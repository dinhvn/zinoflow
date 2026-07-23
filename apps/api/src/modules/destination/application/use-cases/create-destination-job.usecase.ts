import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  aiProviderKeySchema,
  type CreateDestinationJobRequest,
  type CreateDestinationJobResponse,
  type PreviewDestinationJobPromptRequest,
  type PreviewDestinationJobPromptResponse,
} from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import { CreateContentJobUseCase } from "../../../ai-content/application/use-cases/create-content-job.usecase";
import { PromptBuilder, type PromptJobContext } from "../../../ai-content/application/services/prompt-builder";
import {
  CONTENT_JOB_REPOSITORY,
  type ContentJobRepository,
} from "../../../ai-content/application/ports/content-job.repository";
import { REFERENCE_FETCHER, type ReferenceFetcher } from "../ports/reference-fetcher.port";
import { stripHtml } from "../../../shared/text/strip-html";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import {
  POI_DISTANCE_REPOSITORY,
  type PoiDistanceRepository,
} from "../ports/poi-distance.repository";
import { clusterDistanceKey, formatDistanceBadge } from "../../domain/related-builder";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";

const SITE_CODE = "dichoithoi";
/** Gioi han content cu dua vao prompt (token budget) */
const MAX_OLD_CONTENT_CHARS = 20_000;
/** So diem lien quan cung tinh dua vao prompt de AI chu dong nhac ten (auto-link) */
const MAX_RELATED_IN_PROMPT = 15;

/**
 * Tao content job AI cho 1 diem den (spec dichoithoi-destination-spec §5, §7.4).
 * - mode create: diem da co trong mirror nhung chua co bai AI.
 * - mode update: dua content hien tai tren site vao ngu canh de AI viet lai tot hon.
 * Generate chay tren pipeline ai-content (articleType guide-diem-den) —
 * module nay chi chuan bi sourceContext, KHONG goi AI provider truc tiep.
 */
@Injectable()
export class CreateDestinationJobUseCase {
  private readonly logger = new Logger(CreateDestinationJobUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
    @Inject(CONTENT_JOB_REPOSITORY) private readonly jobRepo: ContentJobRepository,
    @Inject(REFERENCE_FETCHER) private readonly referenceFetcher: ReferenceFetcher,
    @Inject(POI_DISTANCE_REPOSITORY)
    private readonly poiDistanceRepo: PoiDistanceRepository,
    private readonly createContentJob: CreateContentJobUseCase,
    private readonly promptBuilder: PromptBuilder,
  ) {}

  /** Luu thong tin cung cap cho AI ma KHONG tao bai (nut "Luu thong tin"). */
  async saveInputs(
    slug: string,
    notes: string | null,
    referenceUrls: Array<{ label: string; url: string }>,
  ): Promise<void> {
    const existing = await this.mirrorRepo.findBySlug(slug);
    if (!existing) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${slug}" trong mirror`);
    }
    await this.mirrorRepo.saveAiInputs(slug, notes?.trim() ? notes.trim() : null, referenceUrls);
    this.logger.log(`Luu thong tin AI cho diem den ${slug}`);
  }

  async execute(
    slug: string,
    request: CreateDestinationJobRequest,
  ): Promise<CreateDestinationJobResponse> {
    const all = await this.mirrorRepo.findAll();
    const destination = all.find((d) => d.slug === slug);
    if (!destination) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${slug}" trong mirror`, [
        "Bấm Đồng bộ từ website rồi thử lại",
      ]);
    }
    if (destination.activeContentJobId) {
      // Job Failed/Rejected la ngo cut (terminal hoac can lam lai) — cho phep
      // tao job moi thay the de diem den khong bi ket vinh vien
      const activeJob = await this.jobRepo.findById(destination.activeContentJobId);
      const stuckStatus = activeJob?.toSnapshot().status;
      if (activeJob && stuckStatus !== "Failed" && stuckStatus !== "Rejected") {
        throw new DomainRuleError(
          `Điểm đến "${destination.name}" đang có bài soạn/duyệt dở`,
          ["Hoàn tất hoặc hủy job hiện tại trước khi tạo job mới"],
        );
      }
    }

    // Luu lai thong tin nguoi dung cung cap (ghi chu + URL nguon) tren diem den
    // de tu dien lai + tai dung khi viet lai bai sau nay.
    await this.mirrorRepo.saveAiInputs(
      destination.slug,
      request.userNotes?.trim() ? request.userNotes.trim() : null,
      request.referenceUrls ?? [],
    );

    const sourceContext = await this.buildSourceContext(destination, all, request);

    const result = await this.createContentJob.execute({
      siteCode: SITE_CODE,
      sourceType: "Topic",
      sourceRef: destination.slug,
      topic: destination.name,
      articleType: "guide-diem-den",
      keywordSeed: [destination.name],
      sourceContext,
      contentTier: destination.contentTier,
      // Gate "originality" (07/2026) — chi so trung lap voi bai KHAC cung tinh,
      // null (chua gan tinh) = gate tu bo qua khi khong co comparisonKey.
      comparisonKey: destination.provinceCode,
      aiProvider: request.aiProvider
        ? aiProviderKeySchema.parse(request.aiProvider)
        : undefined,
      aiModel: request.aiModel,
    });

    await this.mirrorRepo.setActiveJob(destination.slug, result.jobId);
    this.logger.log(
      `Tao job ${result.jobId} cho diem den ${destination.slug} (mode ${request.mode})`,
    );
    return { jobId: result.jobId, status: result.status };
  }

  /**
   * Xem truoc prompt se gui AI (nut "Xem trước prompt" o tab AI ho tro, khong tao
   * job/khong goi AI) — dung LAI dung logic buildSourceContext + PromptBuilder.buildOutline
   * de nguoi dung thay CHINH XAC nhung gi AI se nhan cho buoc 1 (outline). Buoc 2
   * (content) dung cung sourceContext nay + outline AI tra ve o buoc 1 nen chua preview
   * duoc toan van (chua co outline that) — response chi tra outlinePrompt.
   */
  async previewPrompt(
    slug: string,
    request: PreviewDestinationJobPromptRequest,
  ): Promise<PreviewDestinationJobPromptResponse> {
    const all = await this.mirrorRepo.findAll();
    const destination = all.find((d) => d.slug === slug);
    if (!destination) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${slug}" trong mirror`, [
        "Bấm Đồng bộ từ website rồi thử lại",
      ]);
    }

    const sourceContext = await this.buildSourceContext(destination, all, request);
    const ctx: PromptJobContext = {
      model: request.aiModel ?? "preview",
      articleType: "guide-diem-den",
      topic: destination.name,
      siteCode: SITE_CODE,
      keywordSeed: [destination.name],
      toneProfile: null,
      sourceContext,
      contentTier: destination.contentTier,
      products: [],
    };
    const outlineRequest = await this.promptBuilder.buildOutline(ctx);
    return {
      systemPrompt: outlineRequest.system,
      outlinePrompt: outlineRequest.prompt,
      sourceContext,
    };
  }

  /**
   * Ghep nguon su that cho prompt: facts tu mirror + diem lien quan cung tinh
   * (de AI nhac ten chuan -> auto-link) + content hien tai khi mode update
   * + ghi chu nguoi dung. AI bi cam bia so lieu ngoai khoi nay.
   */
  private async buildSourceContext(
    destination: DestinationMirrorEntity,
    all: DestinationMirrorEntity[],
    request: CreateDestinationJobRequest,
  ): Promise<string> {
    const parts: string[] = [];

    parts.push("## Dữ liệu điểm đến (nguồn sự thật)");
    parts.push(`- Tên: ${destination.name}`);
    parts.push(`- Slug hiện tại: ${destination.slug}`);
    if (destination.addressNew) parts.push(`- Địa chỉ mới (sau sáp nhập): ${destination.addressNew}`);
    if (destination.addressOld) parts.push(`- Địa chỉ cũ (trước sáp nhập): ${destination.addressOld}`);
    if (destination.lat && destination.lng) {
      parts.push(`- Tọa độ: ${destination.lat}, ${destination.lng}`);
    }
    if (destination.contactPhone) parts.push(`- Điện thoại: ${destination.contactPhone}`);
    if (destination.contactWebsite) parts.push(`- Website chính thức: ${destination.contactWebsite}`);

    const related = all
      .filter(
        (d) =>
          d.slug !== destination.slug &&
          d.provinceCode !== null &&
          d.provinceCode === destination.provinceCode &&
          d.siteStatus === 1,
      )
      .slice(0, MAX_RELATED_IN_PROMPT);
    if (related.length > 0) {
      // Giai doan 4 (dichoithoi-poi-distance-plan.md): nhac them so km THAT
      // (dichoithoi_poi_distances) khi da co du lieu — chi co gia tri neu diem
      // nay da tung bam nut "Tinh khoang cach" (Giai doan 2/3), nen KHONG phai
      // moi ten deu co so — bo qua im lang khi chua co, khong bia so.
      const poiDistancePairs = await this.poiDistanceRepo.findAll();
      const poiDistances = new Map(
        poiDistancePairs.map((p) => [clusterDistanceKey(p.poiASlug, p.poiBSlug), p.distanceMeters]),
      );
      parts.push("", "## Điểm đến liên quan cùng khu vực (dùng đúng TÊN CHUẨN khi nhắc tới)");
      parts.push(
        related
          .map((d) => {
            const meters = poiDistances.get(clusterDistanceKey(destination.slug, d.slug));
            return meters === undefined ? `- ${d.name}` : `- ${d.name} (${formatDistanceBadge(meters)})`;
          })
          .join("\n"),
      );
    }

    if (request.mode === "update" && destination.siteId !== null) {
      const current = await this.siteDb.fetchDestinationContent(destination.siteId);
      if (current) {
        parts.push("", "## Nội dung hiện tại trên website (viết lại tốt hơn, giữ thông tin đúng)");
        if (current.openingTime) parts.push(`- Giờ mở cửa hiện ghi: ${current.openingTime}`);
        if (current.ticketPrice) parts.push(`- Giá vé hiện ghi: ${current.ticketPrice}`);
        if (current.transport) parts.push(`- Di chuyển hiện ghi: ${stripHtml(current.transport)}`);
        if (current.tip) parts.push(`- Mẹo hiện ghi: ${stripHtml(current.tip)}`);
        parts.push("", "### Thân bài hiện tại (đã bỏ HTML):");
        parts.push(stripHtml(current.contentHtml).slice(0, MAX_OLD_CONTENT_CHARS));
      }
    }

    if (request.userNotes?.trim()) {
      parts.push("", "## Ghi chú từ người quản trị (ưu tiên cao nhất)");
      parts.push(request.userNotes.trim());
    }

    if (destination.aiReferenceSummary) {
      // Da co tom tat tu skill trich xuat AI (dichoithoi-destination-ai-extraction-plan
      // §2.2) — dung truc tiep, KHONG fetch lai tung URL (tiet kiem, tranh trung lap).
      parts.push("", "## Tóm tắt nguồn tham khảo (đã trích xuất, đã duyệt)");
      parts.push(destination.aiReferenceSummary);
    } else {
      // Chua co tom tat san: fetch text tung URL + ghi ro nguon de AI chu thich (spec
      // §3.6). 1 nguon loi khong lam chet job — ghi chu de nguoi duyet biet.
      for (const ref of request.referenceUrls ?? []) {
        try {
          const text = await this.referenceFetcher.fetchText(ref.url);
          parts.push("", `## Nguồn tham khảo cho "${ref.label}" (${ref.url})`);
          parts.push(text || "(trang không có nội dung text)");
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Bo qua nguon tham khao ${ref.url}: ${message}`);
          parts.push(
            "",
            `## Nguồn tham khảo cho "${ref.label}" (${ref.url})`,
            "(không tải được trang — dữ liệu trường này cần kiểm tra tay)",
          );
        }
      }
    }

    return parts.join("\n");
  }
}
