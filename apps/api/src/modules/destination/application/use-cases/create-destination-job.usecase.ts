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
import {
  PromptBuilder,
  type PromptJobContext,
} from "../../../ai-content/application/services/prompt-builder";
import {
  CONTENT_JOB_REPOSITORY,
  type ContentJobRepository,
} from "../../../ai-content/application/ports/content-job.repository";
import {
  REFERENCE_FETCHER,
  type ReferenceFetcher,
} from "../ports/reference-fetcher.port";
import { stripHtml } from "../../../shared/text/strip-html";
import {
  DICHOITHOI_SITE_DB,
  type DichoithoiSiteDb,
} from "../ports/dichoithoi-site-db.port";
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
import { RecomputeRelatedService } from "../services/recompute-related.service";
import { KIND_LABELS } from "../../domain/destination-mirror";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";
import {
  buildDestinationWritingContext,
  wrapExternalSource,
} from "../services/destination-writing-context";

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
    distanceFromCenter:
      d.distanceFromCenter === null ? null : Number(d.distanceFromCenter),
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
    @Inject(CONTENT_JOB_REPOSITORY)
    private readonly jobRepo: ContentJobRepository,
    @Inject(REFERENCE_FETCHER)
    private readonly referenceFetcher: ReferenceFetcher,
    @Inject(POI_DISTANCE_REPOSITORY)
    private readonly poiDistanceRepo: PoiDistanceRepository,
    private readonly createContentJob: CreateContentJobUseCase,
    private readonly promptBuilder: PromptBuilder,
    private readonly recomputeRelated: RecomputeRelatedService,
  ) {}

  /** Luu thong tin cung cap cho AI ma KHONG tao bai (nut "Luu thong tin"). */
  async saveInputs(
    slug: string,
    notes: string | null,
    referenceUrls: Array<{ label: string; url: string }>,
  ): Promise<void> {
    const existing = await this.mirrorRepo.findBySlug(slug);
    if (!existing) {
      throw new DomainRuleError(
        `Không tìm thấy điểm đến "${slug}" trong mirror`,
      );
    }
    await this.mirrorRepo.saveAiInputs(
      slug,
      notes?.trim() ? notes.trim() : null,
      referenceUrls,
    );
    this.logger.log(`Luu thong tin AI cho diem den ${slug}`);
  }

  async execute(
    slug: string,
    request: CreateDestinationJobRequest,
  ): Promise<CreateDestinationJobResponse> {
    const all = await this.mirrorRepo.findAll();
    const destination = all.find((d) => d.slug === slug);
    if (!destination) {
      throw new DomainRuleError(
        `Không tìm thấy điểm đến "${slug}" trong mirror`,
        ["Bấm Đồng bộ từ website rồi thử lại"],
      );
    }
    if (destination.activeContentJobId) {
      // Job Failed/Rejected la ngo cut (terminal hoac can lam lai) — cho phep
      // tao job moi thay the de diem den khong bi ket vinh vien
      const activeJob = await this.jobRepo.findById(
        destination.activeContentJobId,
      );
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

    const sourceContext = await this.buildSourceContext(
      destination,
      all,
      request,
    );

    const result = await this.createContentJob.execute({
      siteCode: SITE_CODE,
      sourceType: "Topic",
      sourceRef: destination.slug,
      topic: destination.name,
      articleType: "guide-diem-den",
      keywordSeed: [destination.name],
      sourceContext,
      contentTier: destination.contentTier,
      // Quyet dinh PromptBuilder chon bo prompt POI hay Cum (thay Phase 28.3 —
      // xem prompt-builder.ts): MOI cluster/province deu dung bo prompt Cum,
      // khong con phu thuoc contentTier nhu truoc. Entity.kind la varchar tho
      // (khong ep kieu literal o tang entity) nen ep kieu tai day.
      nodeKind: destination.kind as "poi" | "cluster" | "province",
      // Gate "originality" (07/2026) — chi so trung lap voi bai KHAC cung tinh,
      // null (chua gan tinh) = gate tu bo qua khi khong co comparisonKey.
      comparisonKey: destination.provinceCode,
      aiProvider: request.aiProvider
        ? aiProviderKeySchema.parse(request.aiProvider)
        : undefined,
      aiModel: request.aiModel,
      generationMode: request.generationMode,
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
      throw new DomainRuleError(
        `Không tìm thấy điểm đến "${slug}" trong mirror`,
        ["Bấm Đồng bộ từ website rồi thử lại"],
      );
    }

    const sourceContext = await this.buildSourceContext(
      destination,
      all,
      request,
    );
    const ctx: PromptJobContext = {
      model: request.aiModel ?? "preview",
      articleType: "guide-diem-den",
      topic: destination.name,
      siteCode: SITE_CODE,
      keywordSeed: [destination.name],
      toneProfile: null,
      sourceContext,
      contentTier: destination.contentTier,
      nodeKind: destination.kind as "poi" | "cluster" | "province",
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
   * Diem lien quan: UU TIEN dung thang RelatedJson da precompute (fetchRelatedJson)
   * — nhat quan voi khoi "Diem den lien quan" cong khai tren website, dung dung
   * Tag/Type/khoang cach that. FALLBACK (26/07/2026, thay ban loc "cung tinh"
   * tho 25/07/2026 — van co the goi y diem cach hang chuc/tram km khong lien
   * quan trong 1 tinh sau sap nhap) CHI khi RelatedJson rong (diem MOI chua
   * tung publish/recompute): dung RecomputeRelatedService.previewFor() — CUNG
   * 1 cong thuc cham diem That (Tag chi phoi + rao 100km), includeDrafts:true
   * de goi y duoc ca ung vien draft cung cum moi, khong ghi gi ca (chi doc).
   */
  private async buildSourceContext(
    destination: DestinationMirrorEntity,
    all: DestinationMirrorEntity[],
    request: CreateDestinationJobRequest,
  ): Promise<string> {
    const parts: string[] = [];

    const parent = destination.parentSlug
      ? (all.find((item) => item.slug === destination.parentSlug) ?? null)
      : null;
    const [provinces, taxonomy] = await Promise.all([
      this.mirrorRepo.listProvinces(),
      this.resolveTaxonomyLabels(destination),
    ]);
    const provinceName =
      provinces.find((item) => item.provinceCode === destination.provinceCode)
        ?.shortName ?? null;
    parts.push(
      buildDestinationWritingContext({
        identity: {
          name: destination.name,
          slug: destination.slug,
          kindLabel: KIND_LABELS[destination.kind] ?? destination.kind,
          contentTier: destination.contentTier,
        },
        hierarchy: {
          parentSlug: destination.parentSlug,
          parentName: parent?.name ?? null,
          provinceCode: destination.provinceCode,
          provinceName,
        },
        taxonomy,
        verifiedFacts: {
          addressNew: destination.addressNew,
          addressOld: destination.addressOld,
          coordinates:
            destination.lat && destination.lng
              ? `${destination.lat}, ${destination.lng}`
              : null,
          contactPhone: destination.contactPhone,
          contactWebsite: destination.contactWebsite,
          openingHours: destination.openingHours?.note ?? null,
          ticketPrice: destination.ticketPrice,
        },
        hasReviewedSummary: Boolean(
          destination.aiReferenceSummary || destination.aiReferenceSummaryGsg,
        ),
      }),
    );

    parts.push("## Dữ liệu điểm đến (nguồn sự thật)");
    parts.push(`- Tên: ${destination.name}`);
    parts.push(
      `- Loại điểm đến: ${KIND_LABELS[destination.kind] ?? destination.kind}`,
    );
    parts.push(`- Slug hiện tại: ${destination.slug}`);
    if (destination.addressNew)
      parts.push(`- Địa chỉ mới (sau sáp nhập): ${destination.addressNew}`);
    if (destination.addressOld)
      parts.push(`- Địa chỉ cũ (trước sáp nhập): ${destination.addressOld}`);
    if (destination.lat && destination.lng) {
      parts.push(`- Tọa độ: ${destination.lat}, ${destination.lng}`);
    }
    if (destination.contactPhone)
      parts.push(`- Điện thoại: ${destination.contactPhone}`);
    if (destination.contactWebsite)
      parts.push(`- Website chính thức: ${destination.contactWebsite}`);

    // Tai 1 lan, dung chung cho ca khoi "lien quan" (fallback) lan khoi "gan nhat" ben duoi.
    const poiDistancePairs = await this.poiDistanceRepo.findAll();
    const poiDistances = new Map(
      poiDistancePairs.map((p) => [
        clusterDistanceKey(p.poiASlug, p.poiBSlug),
        p.distanceMeters,
      ]),
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
      // Fallback: diem MOI chua tung publish/recompute -> tinh LIVE bang dung
      // cong thuc That (Tag chi phoi + rao 100km), includeDrafts:true de goi y
      // duoc ca ung vien draft cung cum moi (vd Da Teh) ngay tu diem dau tien,
      // khong phai doi publish (phan hoi nguoi dung 26/07/2026).
      const preview = await this.recomputeRelated.previewFor(destination.slug);
      relatedLines = preview.slice(0, MAX_RELATED_IN_PROMPT).map((item) => {
        includedSlugs.add(item.slug);
        return item.badge ? `- ${item.name} (${item.badge})` : `- ${item.name}`;
      });
    }
    if (relatedLines.length > 0) {
      parts.push(
        "",
        "## Điểm đến liên quan cùng khu vực (dùng đúng TÊN CHUẨN khi nhắc tới)",
      );
      parts.push(relatedLines.join("\n"));
    }

    // Diem GAN NHAT thuan khoang cach vat ly (khong loc theo Tag/Type, xem
    // MAX_NEARBY_IN_PROMPT) — loai nhung ten da co o khoi "lien quan" tren de
    // khong lap. Huu ich cho doan "lich trinh goi y"/"di chuyen" (co the ke
    // ten 1 diem sat ben du khac han chu de).
    const bySlug = new Map(all.map((d) => [d.slug, d]));
    // includeDrafts: true — ngu canh van ban cho AI, khong phai link that
    // (xem ly do o khoi fallback tren).
    const nearbyLines = computeNearby(
      toCandidate(destination),
      all.map(toCandidate),
      {
        includeDrafts: true,
      },
    )
      .filter((n) => !includedSlugs.has(n.slug))
      .slice(0, MAX_NEARBY_IN_PROMPT)
      .map((n) => {
        const meters =
          poiDistances.get(clusterDistanceKey(destination.slug, n.slug)) ??
          n.distanceMeters;
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
    // dang tin cay hon TOAN BO noi dung site cu (ke ca 4 dong quick-fact), vi:
    // (1) trung lap voi "Facts da duyet" da dua vao sourceContext o tren,
    // (2) 4 dong quick-fact do rat co the chinh la van AI viet o lan generate
    // truoc — dua lai vao lam "ban de viet lai tot hon" tao rui ro bam khuon
    // (anchoring) vao loi van/loi sai cu thay vi viet moi tu nguon dang tin
    // cay hon. Quyet dinh 25/07/2026 (§5.3/D2) chi bo than bai dai — quyet
    // dinh nay (sua theo phan hoi nguoi dung) bo LUON ca 4 dong, chi giu lai
    // TOAN BO khoi "Noi dung hien tai tren website" cho nhanh CHUA co tom tat
    // trich xuat nao (fallback duy nhat con lai cho nhanh do).
    const hasExtractedSummary = Boolean(
      destination.aiReferenceSummary || destination.aiReferenceSummaryGsg,
    );

    if (
      !hasExtractedSummary &&
      request.mode === "update" &&
      destination.siteId !== null
    ) {
      const current = await this.siteDb.fetchDestinationContent(
        destination.siteId,
      );
      if (current) {
        parts.push(
          "",
          "## Nội dung hiện tại trên website (viết lại tốt hơn, giữ thông tin đúng)",
        );
        if (current.openingTime)
          parts.push(`- Giờ mở cửa hiện ghi: ${current.openingTime}`);
        if (current.ticketPrice)
          parts.push(`- Giá vé hiện ghi: ${current.ticketPrice}`);
        if (current.transport)
          parts.push(`- Di chuyển hiện ghi: ${stripHtml(current.transport)}`);
        if (current.tip)
          parts.push(`- Mẹo hiện ghi: ${stripHtml(current.tip)}`);
        parts.push("", "### Thân bài hiện tại (đã bỏ HTML):");
        parts.push(
          stripHtml(current.contentHtml).slice(0, MAX_OLD_CONTENT_CHARS),
        );
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
          parts.push(
            wrapExternalSource(
              ref.label,
              text || "(trang không có nội dung text)",
            ),
          );
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

  private async resolveTaxonomyLabels(
    destination: DestinationMirrorEntity,
  ): Promise<{
    types: Array<{ slug: string; label: string }>;
    tags: Array<{ slug: string; label: string }>;
  }> {
    const fallback = {
      types: destination.types.map((slug) => ({ slug, label: slug })),
      tags: destination.tags.map((slug) => ({ slug, label: slug })),
    };
    if (!this.siteDb.isConfigured()) return fallback;
    try {
      const [content, tags] = await Promise.all([
        this.siteDb.fetchTaxonomyContent(),
        this.siteDb.fetchTags(),
      ]);
      const typeLabels = new Map(
        content.types.map((item) => [item.slug, item.name]),
      );
      const tagLabels = new Map(tags.map((item) => [item.slug, item.name]));
      return {
        types: destination.types.map((slug) => ({
          slug,
          label: typeLabels.get(slug) ?? slug,
        })),
        tags: destination.tags.map((slug) => ({
          slug,
          label: tagLabels.get(slug) ?? slug,
        })),
      };
    } catch (error) {
      this.logger.warn(
        `Khong resolve duoc taxonomy label cho ${destination.slug}: ${error instanceof Error ? error.message : error}`,
      );
      return fallback;
    }
  }
}
