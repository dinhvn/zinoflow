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
import {
  POI_DISTANCE_REPOSITORY,
  type PoiDistanceRepository,
} from "../ports/poi-distance.repository";
import {
  clusterDistanceKey,
  computeNearby,
  type RelatedCandidate,
} from "../../domain/related-builder";
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
    @Inject(POI_DISTANCE_REPOSITORY)
    private readonly poiDistanceRepo: PoiDistanceRepository,
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
    // Job MOI NHAT theo sourceRef — co the KHAC activeContentJobId khi publish da
    // clear no nhung sau đo nguoi dung Retry job cu tu trang /content chung (bug
    // 07/2026: goi y AI/status AI bien mat vinh vien sau lan publish dau tien).
    const latestJob = await this.jobRepo.findLatestBySourceRef("dichoithoi", slug);
    const latestContentJobId = latestJob?.id ?? null;

    // Cay: cha truc tiep + con truc tiep
    const parent = entity.parentSlug ? this.toRef(bySlug.get(entity.parentSlug)) : null;
    const children = all
      .filter((d) => d.parentSlug === slug)
      .map((d) => this.toRef(d))
      .filter((r): r is RelatedDestinationRef => r !== null);

    // Nearby: tinh on-the-fly tu toa do (Haversine, cung logic builder RelatedJson),
    // uu tien so THAT (dichoithoi_poi_distances, dichoithoi-poi-distance-plan.md)
    // neu da tung tinh cho cap nay — tranh CMS hien Haversine trong khi RelatedJson
    // that (website doc) da dung khoang cach duong bo (bug nguoi dung phat hien 07/2026).
    const candidates = all.map(toCandidate);
    const self = candidates.find((c) => c.slug === slug)!;
    const poiDistancePairs = await this.poiDistanceRepo.findAll();
    const poiDistances = new Map(
      poiDistancePairs.map((p) => [clusterDistanceKey(p.poiASlug, p.poiBSlug), p.distanceMeters]),
    );
    // Da bam nut tinh khoang cach (Giai doan 2/3) chua? Dung de FE canh bao
    // luc tao bai AI thieu so km thuc te (Giai doan 4).
    const hasDistanceData =
      entity.distanceFromCenter !== null ||
      poiDistancePairs.some((p) => p.poiASlug === slug || p.poiBSlug === slug);
    const nearby = computeNearby(self, candidates)
      .slice(0, NEARBY_PREVIEW_COUNT)
      .map((n) => {
        const realMeters = poiDistances.get(clusterDistanceKey(slug, n.slug));
        return this.toRef(bySlug.get(n.slug), realMeters ?? n.distanceMeters);
      })
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

    // Type/Tag da gan (§7.3, hien badge chi-doc tren trang detail) — doc thang tu
    // SQL Server (KHONG qua Postgres mirror, "types" tren mirror chi dung rieng cho
    // related-builder va co the stale sau khi seed lai taxonomy). Best-effort nhu
    // fetchSiteContent: site DB co the chua cau hinh.
    const { assignedTypes, assignedTags } = await this.fetchTaxonomyAssignments(entity.siteId);

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
      googleMapsUrl: entity.googleMapsUrl,
      addressNew: entity.addressNew,
      addressOld: entity.addressOld,
      contactPhone: entity.contactPhone,
      contactWebsite: entity.contactWebsite,
      ticketLinks: entity.ticketLinks,
      ticketPrice: entity.ticketPrice,
      priceBreakdown: entity.priceBreakdown,
      practicalNotes: entity.practicalNotes,
      editorialReview: entity.editorialReview,
      metaTitle: entity.metaTitle,
      externalReviewUrls: entity.externalReviewUrls,
      gallery: entity.gallery,
      heroImageMeta: entity.heroImageMeta,
      hotelGroupId: entity.hotelGroupId,
      priority: entity.priority,
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
      latestContentJobId,
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
      openingHours: entity.openingHours,
      aiReferenceSummary: entity.aiReferenceSummary,
      aiReferenceSummaryUpdatedAt: entity.aiReferenceSummaryUpdatedAt?.toISOString() ?? null,
      aiReferenceSummaryGsg: entity.aiReferenceSummaryGsg,
      aiReferenceSummaryGsgUpdatedAt: entity.aiReferenceSummaryGsgUpdatedAt?.toISOString() ?? null,
      parent,
      children,
      nearby,
      relatedCurated,
      mentionedBy,
      hasDistanceData,
      assignedTypes,
      assignedTags,
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

  /** Type/Tag da gan cho 1 diem den — rong neu site DB chua cau hinh hoac loi (khong chan trang detail). */
  private async fetchTaxonomyAssignments(
    siteId: number | null,
  ): Promise<Pick<DestinationDetail, "assignedTypes" | "assignedTags">> {
    const empty = { assignedTypes: [], assignedTags: [] };
    if (siteId === null || !this.siteDb.isConfigured()) return empty;
    try {
      const [taxonomyContent, typeAssignments, tags, tagAssignments] = await Promise.all([
        this.siteDb.fetchTaxonomyContent(),
        this.siteDb.fetchTypeAssignments(),
        this.siteDb.fetchTags(),
        this.siteDb.fetchTagAssignments(),
      ]);
      const groupNameById = new Map(taxonomyContent.groups.map((g) => [g.id, g.name]));
      const typeBySlug = new Map(
        taxonomyContent.types.map((t) => [
          t.slug,
          { name: t.name, groupName: groupNameById.get(t.groupId) ?? "" },
        ]),
      );
      const typeSlugs = typeAssignments.find((a) => a.destinationId === siteId)?.typeSlugs ?? [];
      const assignedTypes = typeSlugs
        .map((slug) => {
          const t = typeBySlug.get(slug);
          return t ? { slug, name: t.name, groupName: t.groupName } : null;
        })
        .filter((t): t is { slug: string; name: string; groupName: string } => t !== null);

      const tagNameBySlug = new Map(tags.map((t) => [t.slug, t.name]));
      const tagSlugs = tagAssignments.find((a) => a.destinationId === siteId)?.tagSlugs ?? [];
      const assignedTags = tagSlugs
        .map((slug) => {
          const name = tagNameBySlug.get(slug);
          return name ? { slug, name } : null;
        })
        .filter((t): t is { slug: string; name: string } => t !== null);

      return { assignedTypes, assignedTags };
    } catch (err) {
      this.logger.warn(
        `Khong doc duoc Type/Tag da gan cho siteId=${siteId}: ${err instanceof Error ? err.message : err}`,
      );
      return empty;
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
    priority: d.priority,
    order: d.order,
    distanceFromCenter: d.distanceFromCenter === null ? null : Number(d.distanceFromCenter),
    types: d.types,
    tags: d.tags,
    contentTier: d.contentTier,
  };
}
