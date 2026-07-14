import { Inject, Injectable, Logger } from "@nestjs/common";
import type {
  ContentJobStatus,
  DestinationDetail,
  DestinationSiteContent,
  RelatedDestinationRef,
} from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  DESTINATION_RELATION_REPOSITORY,
  type DestinationMirrorRepository,
  type DestinationRelationRepository,
} from "../ports/destination-mirror.repository";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import {
  CONTENT_JOB_REPOSITORY,
  type ContentJobRepository,
} from "../../../ai-content/application/ports/content-job.repository";
import { IMAGE_CHECKER, type ImageChecker } from "../ports/image-checker.port";
import { computeNearby, type RelatedCandidate } from "../../domain/related-builder";
import { deriveContentState, deriveProductionState } from "../../domain/destination-mirror";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";

const NEARBY_PREVIEW_COUNT = 8;

/**
 * Chi tiet 1 diem den cho trang /dichoithoi/[slug] (spec §7.3): gom mirror +
 * cay (cha/con) + quan he (nearby tu tinh, related curated, duoc nhac toi) +
 * URL anh + trang thai job dang chay. Doc-only, khong sua gi.
 */
@Injectable()
export class GetDestinationDetailUseCase {
  private readonly logger = new Logger(GetDestinationDetailUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(DESTINATION_RELATION_REPOSITORY)
    private readonly relationRepo: DestinationRelationRepository,
    @Inject(CONTENT_JOB_REPOSITORY) private readonly jobRepo: ContentJobRepository,
    @Inject(IMAGE_CHECKER) private readonly imageChecker: ImageChecker,
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
  ) {}

  async execute(slug: string): Promise<DestinationDetail> {
    const all = await this.mirrorRepo.findAll();
    const entity = all.find((d) => d.slug === slug);
    if (!entity) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${slug}" trong mirror`, [
        "Bấm Đồng bộ từ website rồi thử lại",
      ]);
    }

    const bySlug = new Map(all.map((d) => [d.slug, d]));
    const provinces = await this.mirrorRepo.listProvinces();
    const provinceName =
      provinces.find((p) => p.provinceCode === entity.provinceCode)?.shortName ?? null;

    // Trang thai job dang chay (neu co) — UI quyet dinh nut Xem draft / Publish
    let activeJobStatus: ContentJobStatus | null = null;
    if (entity.activeContentJobId) {
      const job = await this.jobRepo.findById(entity.activeContentJobId);
      activeJobStatus = job ? job.toSnapshot().status : null;
    }

    // Cay: cha truc tiep + con truc tiep
    const parent = entity.parentSlug ? this.toRef(bySlug.get(entity.parentSlug)) : null;
    const children = all
      .filter((d) => d.parentSlug === slug)
      .map((d) => this.toRef(d))
      .filter((r): r is RelatedDestinationRef => r !== null);

    // Nearby: tinh on-the-fly tu toa do (cung logic builder RelatedJson)
    const candidates = all.map(toCandidate);
    const self = candidates.find((c) => c.slug === slug)!;
    const nearby = computeNearby(self, candidates)
      .slice(0, NEARBY_PREVIEW_COUNT)
      .map((n) => this.toRef(bySlug.get(n.slug), n.distanceMeters))
      .filter((r): r is RelatedDestinationRef => r !== null);

    // Related curated (quan he type 2 nguoi dung them tay)
    const curated = await this.relationRepo.findCuratedRelated(slug);
    const relatedCurated = curated
      .map((r) => this.toRef(bySlug.get(r.targetSlug)))
      .filter((r): r is RelatedDestinationRef => r !== null);

    // "Duoc nhac trong bai nao" — cac bai co link mentioned toi diem nay
    const mentionedBy = (await this.relationRepo.findSourcesLinkingTo(slug))
      .map((sourceSlug) => this.toRef(bySlug.get(sourceSlug)))
      .filter((r): r is RelatedDestinationRef => r !== null);

    // Noi dung hien tai tren web (bai AI da publish hoac bai viet tay) — best-effort:
    // SQL Server co the chua cau hinh hoac diem chua co bai -> content = null.
    const content = await this.fetchSiteContent(entity.siteId);

    return {
      siteId: entity.siteId,
      slug: entity.slug,
      kind: entity.kind as DestinationDetail["kind"],
      parentSlug: entity.parentSlug,
      provinceCode: entity.provinceCode,
      provinceName,
      name: entity.name,
      shortDescription: entity.shortDescription,
      thumbnail: entity.thumbnail,
      lat: entity.lat === null ? null : Number(entity.lat),
      lng: entity.lng === null ? null : Number(entity.lng),
      addressNew: entity.addressNew,
      addressOld: entity.addressOld,
      contactPhone: entity.contactPhone,
      contactWebsite: entity.contactWebsite,
      ticketLinks: entity.ticketLinks,
      ticketPrice: entity.ticketPrice,
      priceBreakdown: entity.priceBreakdown,
      practicalNotes: entity.practicalNotes,
      editorialReview: entity.editorialReview,
      externalReviewUrls: entity.externalReviewUrls,
      gallery: entity.gallery,
      hotelGroupId: entity.hotelGroupId,
      isFeatured: entity.isFeatured,
      contentTier: entity.contentTier,
      siteStatus: entity.siteStatus,
      contentState: deriveContentState({
        activeContentJobId: entity.activeContentJobId,
        activeJobStatus,
        contentSource: entity.contentSource,
        contentHash: entity.contentHash,
      }),
      productionState: deriveProductionState(entity.siteId, entity.siteStatus),
      activeContentJobId: entity.activeContentJobId,
      syncFlags: entity.syncFlags as DestinationDetail["syncFlags"],
      siteUpdatedAt: entity.siteUpdatedAt?.toISOString() ?? null,
      syncedAt: entity.syncedAt?.toISOString() ?? null,
      imageUrl: this.imageChecker.buildUrl(entity.thumbnail),
      galleryImageUrls: entity.gallery.map((g) => this.imageChecker.buildUrl(g.path)),
      activeJobStatus,
      draftArticle: entity.draftArticle,
      content,
      aiNotes: entity.aiNotes ?? null,
      aiReferenceUrls: entity.aiReferenceUrls ?? [],
      parent,
      children,
      nearby,
      relatedCurated,
      mentionedBy,
    };
  }

  private toRef(
    entity: DestinationMirrorEntity | undefined,
    distanceMeters: number | null = null,
  ): RelatedDestinationRef | null {
    if (!entity) return null;
    return {
      slug: entity.slug,
      name: entity.name,
      kind: entity.kind as RelatedDestinationRef["kind"],
      // Ref lan can chi la chip — khong batch status job, coi job dang chay la "dang-soan"
      contentState: deriveContentState({
        activeContentJobId: entity.activeContentJobId,
        activeJobStatus: null,
        contentSource: entity.contentSource,
        contentHash: entity.contentHash,
      }),
      distanceMeters,
    };
  }

  /** Doc noi dung hien tai tren site — null khi chua co bai / chua cau hinh SQL. */
  private async fetchSiteContent(siteId: number | null): Promise<DestinationSiteContent | null> {
    if (siteId === null) return null;
    try {
      const current = await this.siteDb.fetchDestinationContent(siteId);
      if (!current?.contentHtml?.trim()) return null;
      return {
        contentHtml: current.contentHtml,
        openingTime: current.openingTime,
        ticketPrice: current.ticketPrice,
        transport: current.transport,
        food: current.food,
        hotel: current.hotel,
        tip: current.tip,
      };
    } catch (err) {
      this.logger.warn(
        `Khong doc duoc noi dung site cho siteId=${siteId}: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }
}

function toCandidate(d: DestinationMirrorEntity): RelatedCandidate {
  return {
    slug: d.slug,
    name: d.name,
    thumbnail: d.thumbnail,
    kind: d.kind as RelatedCandidate["kind"],
    parentSlug: d.parentSlug,
    provinceCode: d.provinceCode,
    lat: d.lat === null ? null : Number(d.lat),
    lng: d.lng === null ? null : Number(d.lng),
    siteStatus: d.siteStatus,
    isFeatured: d.isFeatured,
    order: d.order,
    distanceFromCenter: d.distanceFromCenter === null ? null : Number(d.distanceFromCenter),
  };
}
