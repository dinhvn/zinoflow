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
import {
  clusterDistanceKey,
  computeNearby,
  formatDistanceBadge,
  type RelatedCandidate,
} from "../../domain/related-builder";
import { KIND_LABELS } from "../../domain/destination-mirror";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";

const SITE_CODE = "dichoithoi";
/** Gioi han content cu dua vao prompt (token budget) */
const MAX_OLD_CONTENT_CHARS = 20_000;
/** Tran so diem lien quan dua vao prompt cho nhanh FALLBACK (cung tinh, xem
 * buildSourceContext) — nhanh chinh dung RelatedJson da tu gioi han (toi da
 * RELATED_MAX_COUNT = 12, xem related-builder.ts). */
const MAX_RELATED_IN_PROMPT = 15;
/** So diem GAN NHAT (thuan khoang cach vat ly, khong loc theo Tag/Type) dua
 * vao prompt (25/07/2026) — bo sung cho khoi "lien quan" o tren, vi cong
 * thuc RelatedJson gio Tag chi phoi nen 1 diem rat gan nhung khac tag/type
 * co the KHONG con lot vao 12 muc RelatedJson, mat tin hieu khoang cach that
 * huu ich cho doan "lich trinh goi y"/"di chuyen" trong bai. */
const MAX_NEARBY_IN_PROMPT = 8;

/** Map DestinationMirrorEntity -> RelatedCandidate cho computeNearby() (cung
 * pattern voi get-destination-detail.usecase.ts, recompute-related.service.ts). */
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
   * Ghep nguon su that cho prompt: facts tu mirror + diem lien quan (de AI nhac
   * ten chuan -> auto-link) + content hien tai khi mode update + ghi chu nguoi
   * dung. AI bi cam bia so lieu ngoai khoi nay.
   *
   * Diem lien quan (25/07/2026, sua sau khi phat hien prompt dang dung bo loc
   * "cung tinh" tho rieng, khong lien quan gi thuat toan RelatedJson da nang
   * cap Tag-chi-phoi + rao 100km): UU TIEN dung thang RelatedJson da precompute
   * (fetchRelatedJson) — nhat quan voi khoi "Diem den lien quan" cong khai
   * tren website, dung dung Tag/Type/khoang cach that thay vi "cung tinh" tho
   * (tinh lon nhu Lam Dong co the goi y diem cach hang chuc km khong lien
   * quan). FALLBACK ve loc "cung tinh" cu CHI khi RelatedJson rong (diem MOI
   * chua tung publish/recompute tren site — van can co goi y cho lan viet
   * dau, khong de trong).
   */
  private async buildSourceContext(
    destination: DestinationMirrorEntity,
    all: DestinationMirrorEntity[],
    request: CreateDestinationJobRequest,
  ): Promise<string> {
    const parts: string[] = [];

    parts.push("## Dữ liệu điểm đến (nguồn sự thật)");
    parts.push(`- Tên: ${destination.name}`);
    parts.push(`- Loại điểm đến: ${KIND_LABELS[destination.kind] ?? destination.kind}`);
    parts.push(`- Slug hiện tại: ${destination.slug}`);
    if (destination.addressNew) parts.push(`- Địa chỉ mới (sau sáp nhập): ${destination.addressNew}`);
    if (destination.addressOld) parts.push(`- Địa chỉ cũ (trước sáp nhập): ${destination.addressOld}`);
    if (destination.lat && destination.lng) {
      parts.push(`- Tọa độ: ${destination.lat}, ${destination.lng}`);
    }
    if (destination.contactPhone) parts.push(`- Điện thoại: ${destination.contactPhone}`);
    if (destination.contactWebsite) parts.push(`- Website chính thức: ${destination.contactWebsite}`);

    // Tai 1 lan, dung chung cho ca khoi "lien quan" (fallback) lan khoi "gan nhat" ben duoi.
    const poiDistancePairs = await this.poiDistanceRepo.findAll();
    const poiDistances = new Map(
      poiDistancePairs.map((p) => [clusterDistanceKey(p.poiASlug, p.poiBSlug), p.distanceMeters]),
    );

    const relatedJson = await this.siteDb.fetchRelatedJson(destination.slug);
    const includedSlugs = new Set<string>([destination.slug]);
    let relatedLines: string[];
    if (relatedJson.length > 0) {
      relatedLines = relatedJson.map((r) => {
        includedSlugs.add(r.slug);
        return r.badge ? `- ${r.name} (${r.badge})` : `- ${r.name}`;
      });
    } else {
      // Fallback: diem MOI chua tung publish/recompute -> loc tho cung tinh
      // tu mirror (hanh vi cu, dam bao van co goi y cho lan viet dau tien).
      const fallbackCandidates = all
        .filter(
          (d) =>
            d.slug !== destination.slug &&
            d.provinceCode !== null &&
            d.provinceCode === destination.provinceCode &&
            d.siteStatus === 1,
        )
        .slice(0, MAX_RELATED_IN_PROMPT);
      relatedLines = fallbackCandidates.map((d) => {
        includedSlugs.add(d.slug);
        // nhac them so km THAT (dichoithoi_poi_distances) khi da co du lieu —
        // chi co gia tri neu diem nay da tung bam nut "Tinh khoang cach", nen
        // KHONG phai moi ten deu co so — bo qua im lang khi chua co, khong bia so.
        const meters = poiDistances.get(clusterDistanceKey(destination.slug, d.slug));
        return meters === undefined ? `- ${d.name}` : `- ${d.name} (${formatDistanceBadge(meters)})`;
      });
    }
    if (relatedLines.length > 0) {
      parts.push("", "## Điểm đến liên quan cùng khu vực (dùng đúng TÊN CHUẨN khi nhắc tới)");
      parts.push(relatedLines.join("\n"));
    }

    // Diem GAN NHAT thuan khoang cach vat ly (khong loc theo Tag/Type, xem
    // MAX_NEARBY_IN_PROMPT) — loai nhung ten da co o khoi "lien quan" tren de
    // khong lap. Huu ich cho doan "lich trinh goi y"/"di chuyen" (co the ke
    // ten 1 diem sat ben du khac han chu de).
    const bySlug = new Map(all.map((d) => [d.slug, d]));
    const nearbyLines = computeNearby(toCandidate(destination), all.map(toCandidate))
      .filter((n) => !includedSlugs.has(n.slug))
      .slice(0, MAX_NEARBY_IN_PROMPT)
      .map((n) => {
        const meters = poiDistances.get(clusterDistanceKey(destination.slug, n.slug)) ?? n.distanceMeters;
        const name = bySlug.get(n.slug)?.name ?? n.slug;
        return `- ${name} (${formatDistanceBadge(meters)})`;
      });
    if (nearbyLines.length > 0) {
      parts.push(
        "",
        "## Điểm đến GẦN NHẤT (khoảng cách vật lý, KHÔNG nhất thiết cùng chủ đề — chỉ dùng khi " +
          "cần gợi ý kết hợp lịch trình/di chuyển, không dùng để so sánh trải nghiệm)",
      );
      parts.push(nearbyLines.join("\n"));
    }

    // Da co it nhat 1 tom tat trich xuat (Skill hoac GSG, da qua duyet tay) —
    // dang tin cay hon than bai cu tren site (co the loi thoi, chinh la ly do
    // pipeline trich xuat ra doi). §6 D2: bo han khoi than bai dai khi da co,
    // chi giu 4 dong quick-fact (re, luon huu ich de doi chieu).
    const hasExtractedSummary = Boolean(
      destination.aiReferenceSummary || destination.aiReferenceSummaryGsg,
    );

    if (request.mode === "update" && destination.siteId !== null) {
      const current = await this.siteDb.fetchDestinationContent(destination.siteId);
      if (current) {
        parts.push("", "## Nội dung hiện tại trên website (viết lại tốt hơn, giữ thông tin đúng)");
        if (current.openingTime) parts.push(`- Giờ mở cửa hiện ghi: ${current.openingTime}`);
        if (current.ticketPrice) parts.push(`- Giá vé hiện ghi: ${current.ticketPrice}`);
        if (current.transport) parts.push(`- Di chuyển hiện ghi: ${stripHtml(current.transport)}`);
        if (current.tip) parts.push(`- Mẹo hiện ghi: ${stripHtml(current.tip)}`);
        if (!hasExtractedSummary) {
          parts.push("", "### Thân bài hiện tại (đã bỏ HTML):");
          parts.push(stripHtml(current.contentHtml).slice(0, MAX_OLD_CONTENT_CHARS));
        }
      }
    }

    if (request.userNotes?.trim()) {
      parts.push("", "## Ghi chú từ người quản trị (ưu tiên cao nhất)");
      parts.push(request.userNotes.trim());
    }

    // 3 nguon TACH RIENG, khong gop — AI can biet do tin cay khac nhau giua cac
    // nguon de tu can nhac (dichoithoi-destination-ai-extraction-plan §6 D1).
    if (destination.aiReferenceSummary) {
      parts.push("", "## Tóm tắt nguồn tham khảo — Skill đọc kỹ (đã duyệt)");
      parts.push(destination.aiReferenceSummary);
    }
    if (destination.aiReferenceSummaryGsg) {
      parts.push(
        "",
        "## Tóm tắt nguồn tham khảo — Google Search tự động (đã duyệt, CHƯA xác minh theo từng URL cụ thể)",
      );
      parts.push(destination.aiReferenceSummaryGsg);
    }
    if (!hasExtractedSummary) {
      // Chua co tom tat san tu bat ky nguon nao: fetch text tung URL + ghi ro
      // nguon de AI chu thich (spec §3.6). 1 nguon loi khong lam chet job — ghi
      // chu de nguoi duyet biet.
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
