import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  destinationArticleSchema,
  type PublishDestinationResult,
} from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  CONTENT_JOB_REPOSITORY,
  type ContentJobRepository,
} from "../../../ai-content/application/ports/content-job.repository";
import {
  CONTENT_DRAFT_REPOSITORY,
  type ContentDraftRepository,
} from "../../../ai-content/application/ports/content-draft.repository";
import {
  DESTINATION_MIRROR_REPOSITORY,
  DESTINATION_RELATION_REPOSITORY,
  type DestinationMirrorRepository,
  type DestinationRelationRepository,
} from "../ports/destination-mirror.repository";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import { CACHE_PURGE, type CachePurgePort } from "../ports/cache-purge.port";
import { autoLinkContent, type LinkTarget } from "../../../shared/text/auto-link";
import {
  buildFaqJson,
  renderDestinationBodyHtml,
} from "../services/destination-publish-html.renderer";
import { RecomputeRelatedService } from "../services/recompute-related.service";

/**
 * Publish bai diem den DA DUYET xuong SQL Server dichoithoi (Phase C — spec §3.3, §3.4).
 * Day la gate thu cong thu 2 (Approve ≠ Publish — system overview §2.1):
 * 1. Job phai o trang thai Approved (gates da pass luc duyet).
 * 2. Render than bai -> HTML sach -> auto-link toi diem published khac.
 * 3. UPSERT 1 transaction (KHONG wipe): Destination + DestinationContent + mentioned.
 * 4. Ghi quan he mentioned ben Postgres (nguon su that — spec §3.7).
 * 5. Tinh lai RelatedJson cho cac diem bi anh huong.
 * 6. Mirror: contentSource=1 + contentHash moi + clear activeContentJobId.
 */
@Injectable()
export class PublishDestinationUseCase {
  private readonly logger = new Logger(PublishDestinationUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(DESTINATION_RELATION_REPOSITORY)
    private readonly relationRepo: DestinationRelationRepository,
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
    @Inject(CONTENT_JOB_REPOSITORY) private readonly jobRepo: ContentJobRepository,
    @Inject(CONTENT_DRAFT_REPOSITORY) private readonly draftRepo: ContentDraftRepository,
    @Inject(CACHE_PURGE) private readonly cachePurge: CachePurgePort,
    private readonly recomputeRelated: RecomputeRelatedService,
  ) {}

  async execute(slug: string): Promise<PublishDestinationResult> {
    const startedAt = Date.now();
    const all = await this.mirrorRepo.findAll();
    const destination = all.find((d) => d.slug === slug);
    if (!destination) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${slug}" trong mirror`, [
        "Bấm Đồng bộ từ website rồi thử lại",
      ]);
    }
    const jobId = destination.activeContentJobId;
    if (!jobId) {
      throw new DomainRuleError(`Điểm đến "${destination.name}" không có bài đang chờ publish`, [
        "Tạo bài AI và duyệt bài trước khi publish",
      ]);
    }

    const job = await this.jobRepo.findById(jobId);
    if (!job) throw new DomainRuleError(`Không tìm thấy job ${jobId}`);
    const snapshot = job.toSnapshot();
    if (snapshot.status !== "Approved") {
      // Gate 2 (publish) chi mo sau gate 1 (approve) — system overview §2.1
      throw new DomainRuleError(
        `Bài đang ở trạng thái ${snapshot.status} — chỉ publish được bài đã duyệt (Approved)`,
      );
    }
    if (snapshot.articleType !== "guide-diem-den") {
      throw new DomainRuleError("Job này không phải bài điểm đến (guide-diem-den)");
    }

    // Gate anh (spec §14.3): khong publish bai khong co thumbnail — card danh sach,
    // og:image, khoi lien quan deu can. Nguoi dung set o "Anh đại diện" roi thu lai.
    if (!destination.thumbnail?.trim()) {
      throw new DomainRuleError(`Điểm đến "${destination.name}" chưa có ảnh đại diện (thumbnail)`, [
        "Nhập đường dẫn ảnh ở mục Ảnh đại diện trên trang Điểm đến rồi publish lại",
      ]);
    }

    const draft = await this.draftRepo.findLatestByJobId(jobId);
    if (!draft?.article) throw new DomainRuleError("Draft đã duyệt không có nội dung bài viết");
    const article = destinationArticleSchema.parse(draft.article);

    // Diem MOI (chua co tren web): INSERT shell xuong SQL Server lay siteId truoc khi
    // ghi noi dung. Diem cu: dung siteId san co.
    let siteId = destination.siteId;
    if (siteId === null) {
      const created = await this.siteDb.createDestination({
        slug: destination.slug,
        kind: destination.kind as "province" | "cluster" | "poi",
        parentSlug: destination.parentSlug,
        provinceCode: destination.provinceCode,
        name: destination.name,
        nameUnaccented: destination.nameUnaccented,
        shortDescription: article.metadata.description,
        thumbnail: destination.thumbnail,
        lat: destination.lat === null ? null : Number(destination.lat),
        lng: destination.lng === null ? null : Number(destination.lng),
        addressNew: destination.addressNew,
        addressOld: destination.addressOld,
        contactPhone: destination.contactPhone,
        contactWebsite: destination.contactWebsite,
        hotelGroupId: destination.hotelGroupId,
        isFeatured: destination.isFeatured,
      });
      siteId = created.siteId;
      await this.mirrorRepo.setSiteId(slug, siteId);
      this.logger.log(`Tao diem den moi tren SQL Server: ${slug} -> siteId ${siteId}`);
    }

    // Render HTML sach roi auto-link toi moi diem published khac (spec §3.4 thoi diem 1)
    const bodyHtml = await renderDestinationBodyHtml(article);
    const targets: LinkTarget[] = all
      .filter((d) => d.siteStatus === 1 && d.siteId !== null && d.slug !== slug)
      .map((d) => ({ slug: d.slug, name: d.name }));
    const { html: linkedHtml, addedLinks } = autoLinkContent(bodyHtml, targets, slug);

    const siteIdBySlug = new Map(
      all.filter((d) => d.siteId !== null && d.slug !== slug).map((d) => [d.slug, d.siteId!]),
    );
    const { contentHash } = await this.siteDb.publishDestination({
      siteId,
      thumbnail: destination.thumbnail,
      shortDescription: article.metadata.description,
      searchKeyword: article.metadata.searchKeyword ?? null,
      contentHtml: linkedHtml,
      openingTime: article.quickFacts.openingTime,
      ticketPrice: article.quickFacts.ticketPrice,
      transport: article.quickFacts.transport,
      food: article.quickFacts.food,
      hotel: article.quickFacts.hotel,
      tip: article.quickFacts.tip,
      faqJson: buildFaqJson(article),
      ticketLinksJson: JSON.stringify(destination.ticketLinks),
      priceBreakdownJson: JSON.stringify(destination.priceBreakdown),
      practicalNotesJson: JSON.stringify(destination.practicalNotes),
      metaTitle: article.metadata.metaTitle,
      metaDescription: article.metadata.metaDescription,
      mentionedTargetSiteIds: addedLinks
        .map((l) => siteIdBySlug.get(l.targetSlug))
        .filter((id): id is number => id !== undefined),
    });

    // Nguon su that quan he o Postgres (spec §3.7) — publish ghi de bo mentioned auto
    await this.relationRepo.replaceMentioned(
      slug,
      addedLinks.map((l) => l.targetSlug),
    );

    await this.mirrorRepo.markPublished(slug, contentHash);

    // ContentHtml vua doi — purge dung URL nay (Phase 17), khong doi ket qua recompute
    // vi RelatedJson/Ancestors/Children co the KHONG doi dau du noi dung bai da doi
    await this.cachePurge.purgeDestination(slug);

    // Recompute hep: chi cac diem bi anh huong (spec §12.3) — chay sau khi mirror
    // da cap nhat de RelatedJson nhin thay trang thai moi nhat
    const affected = await this.recomputeRelated.affectedSlugsFor(slug);
    const { updated: relatedRecomputed } = await this.recomputeRelated.recomputeFor(affected);

    this.logger.log(
      `Publish ${slug} xong: ${addedLinks.length} link noi bo, ${relatedRecomputed} RelatedJson cap nhat`,
    );
    return {
      slug,
      jobId,
      addedLinks,
      relatedRecomputed,
      durationMs: Date.now() - startedAt,
    };
  }
}
