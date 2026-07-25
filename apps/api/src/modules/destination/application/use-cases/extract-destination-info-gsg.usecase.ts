import { Inject, Injectable, Logger } from "@nestjs/common";
import { z } from "zod/v4";
import {
  destinationAiExtractionFieldKeySchema,
  destinationOpeningHoursSchema,
  externalReviewUrlItemSchema,
  priceBreakdownItemSchema,
  type DestinationAiExtraction,
  type DestinationAiExtractionFieldItem,
} from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import {
  DESTINATION_AI_EXTRACTION_REPOSITORY,
  type DestinationAiExtractionRepository,
} from "../ports/destination-ai-extraction.repository";
import {
  AI_PROVIDER_REGISTRY,
  type AiProviderRegistry,
} from "../../../ai-content/application/ports/content-ai-provider.port";
import { AI_USAGE_RECORDER, type AiUsageRecorder } from "../../../ai-content/application/ports/ai-usage-recorder.port";
import { dedupeExtractionFields } from "../services/dedupe-extraction-fields";
import { buildPromptLogText } from "../../../ai-content/application/services/prompt-log-text";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";
import { KIND_LABELS } from "../../domain/destination-mirror";

/**
 * Model FLASH (khong phai Pro) — trich xuat la tac vu HANG LOAT + can JSON chuan
 * xac, khong can van phong sau. Dung nguyen tac site dat ra tu dau: Flash cho
 * hang loat/structured, Pro chi danh cho viet bai Key/Featured (§6 B1).
 */
const GSG_MODEL = "gemini-3.6-flash";
/** Uu tien chinh xac/nhat quan toi da — thap hon nhieu so voi 0.5 cua buoc viet bai. */
const GSG_TEMPERATURE = 0.1;

/**
 * newValue RANG BUOC theo union cac shape thuc te (khong dung z.unknown()) — schema
 * long le lam mat huong dan cho Gemini structured output voi field long nhau
 * (openingHours/priceBreakdown/externalReviewUrl), gay du lieu sai dang (da gap that
 * khi test: openingHours.periods tra ve mang phang sai thay vi dung shape). Field
 * dang string (name/address/...) van hop le vi nam trong nhanh z.string() cua union.
 */
const gsgNewValueSchema = z.union([
  z.string(),
  destinationOpeningHoursSchema,
  externalReviewUrlItemSchema,
  z.array(priceBreakdownItemSchema),
]);

const gsgFieldSchema = z.object({
  key: destinationAiExtractionFieldKeySchema,
  newValue: gsgNewValueSchema.nullable(),
  found: z.boolean(),
  note: z.string().nullable(),
});
const gsgResponseSchema = z.array(gsgFieldSchema);

const SYSTEM_PROMPT = `Dùng Google Search để tìm thông tin ĐẦY ĐỦ, MỚI NHẤT về điểm du lịch được nêu trong yêu cầu.

Trả về DUY NHẤT JSON theo đúng schema đã cho (mảng field {key, newValue, found, note}) — KHÔNG kèm văn bản dẫn dắt, không giải thích ngoài JSON.

Với MỖI field:
- found=true CHỈ KHI tìm thấy thông tin cụ thể qua kết quả tìm kiếm — không suy đoán/dùng kiến thức nền nếu search không ra kết quả rõ ràng cho field cứng (địa chỉ, SĐT, giờ mở cửa, giá vé, link đánh giá ngoài).
- found=false + newValue=null khi không tìm thấy — không bịa.
- Chủ động tìm thêm 3 mục sau nếu có (KHÔNG bắt buộc, không thấy thì found=false bình thường, không ảnh hưởng các field khác):
  · contactWebsite: website chính thức của điểm đến (không phải trang tổng hợp/OTA như Klook, Traveloka).
  · externalReviewUrl: link Fanpage Facebook chính thức (label "Facebook").
  · externalReviewUrl: link trang đánh giá TripAdvisor hoặc Google Maps review nếu Facebook không có (label "TripAdvisor"/"Google Maps") — mỗi link 1 phần tử riêng trong mảng, không gộp chung 1 field.
- Nguồn mâu thuẫn nhau: tự chọn 1 giá trị hợp lý nhất (ưu tiên nguồn chính thức/số đông thống nhất), ghi lý do + phương án bị loại vào \`note\`.
- aiReferenceSummary: tổng hợp CÓ CẤU TRÚC gồm — điểm đặc biệt/kỷ lục/kiến trúc nổi bật, trải nghiệm không thể bỏ qua, thời gian/mùa lý tưởng để đi, kinh nghiệm thực tế (trang phục, mẹo mua vé/di chuyển, lưu ý quan trọng). KHÔNG nhét giá vé vào đây (đã có priceBreakdown riêng).
- openingHours.newValue (nếu found) PHẢI đúng shape { note: string, periods: [{days:string[], opens, closes}] } — note là câu ngắn gọn, chỉ thêm periods khi giờ THỰC SỰ khác nhau theo ngày.
- priceBreakdown.newValue (nếu found) PHẢI đúng shape mảng [{audience, price, note}] — audience là tên nhóm tiếng Việt ngắn gọn, price là số nguyên VNĐ.
- externalReviewUrl.newValue (nếu found) PHẢI đúng shape { label: string, url: string }.
- Tiếng Việt có dấu đầy đủ cho mọi giá trị text.`;

/** currentValue that (doc truoc khi goi AI) cho tung field — dung dung shape voi cot GSG rieng cho aiReferenceSummary (§6 A2). */
function currentValueOf(
  destination: DestinationMirrorEntity,
  key: DestinationAiExtractionFieldItem["key"],
): unknown {
  switch (key) {
    case "name":
      return destination.name;
    case "addressNew":
      return destination.addressNew;
    case "contactPhone":
      return destination.contactPhone;
    case "contactWebsite":
      return destination.contactWebsite;
    case "shortDescription":
      return destination.shortDescription;
    case "metaTitle":
      return destination.metaTitle;
    case "openingHours":
      return destination.openingHours;
    case "aiReferenceSummary":
      // Ghi vao cot GSG rieng khi Chap nhan (khac ban Skill) — currentValue phai
      // khop dung cot se bi ghi de, khong phai cot Skill.
      return destination.aiReferenceSummaryGsg;
    case "priceBreakdown":
      return destination.priceBreakdown;
    case "editorialReview":
      return destination.editorialReview;
    case "externalReviewUrl":
      // Nhieu candidate/dong — khong co 1 gia tri cu tuong ung 1:1, dung quy uoc
      // cua skill thu cong (currentValue=null cho field nay).
      return null;
    default:
      return null;
  }
}

/**
 * Trich xuat thong tin diem den TU DONG qua Gemini + Google Search Grounding —
 * chay NGAY TRONG APP (khong can Claude Code nhu skill thu cong), ghi vao CUNG
 * bang staging voi source="gsg" (song song source="skill", khong ghi de nhau).
 * dichoithoi-destination-ai-extraction-plan.md §6 B2.
 *
 * Response schema TAI DUNG dung destinationAiExtractionFieldItemSchema (qua
 * gsgFieldSchema rut gon — Gemini chi tra key/newValue/found/note, currentValue
 * va status do CHINH use case nay tinh, khong de AI tu bia).
 */
@Injectable()
export class ExtractDestinationInfoGsgUseCase {
  private readonly logger = new Logger(ExtractDestinationInfoGsgUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(DESTINATION_AI_EXTRACTION_REPOSITORY)
    private readonly extractionRepo: DestinationAiExtractionRepository,
    @Inject(AI_PROVIDER_REGISTRY) private readonly registry: AiProviderRegistry,
    @Inject(AI_USAGE_RECORDER) private readonly usage: AiUsageRecorder,
  ) {}

  async execute(slug: string): Promise<DestinationAiExtraction> {
    const all = await this.mirrorRepo.findAll();
    const destination = all.find((d) => d.slug === slug);
    if (!destination) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${slug}" trong mirror`);
    }

    const provinceName =
      all.find((d) => d.kind === "province" && d.provinceCode === destination.provinceCode)?.name ??
      null;
    const queryContext = [
      destination.name,
      provinceName ? `(${provinceName})` : null,
      `— loại: ${KIND_LABELS[destination.kind] ?? destination.kind}`,
    ]
      .filter(Boolean)
      .join(" ");

    const provider = this.registry.resolve("gemini");
    const promptRequest = {
      model: GSG_MODEL,
      operation: "extract-destination-gsg",
      system: SYSTEM_PROMPT,
      prompt: `Điểm du lịch cần tra cứu: "${queryContext}".`,
      maxTokens: 8_000,
      vars: {},
      temperature: GSG_TEMPERATURE,
      useGoogleSearch: true,
    };

    const { output, usage } = await provider.generateStructured(promptRequest, gsgResponseSchema);

    // currentValue do CHINH use case doc truoc khi goi AI (khong de AI tu dien) —
    // dung nguyen tac buoc 6 cua skill thu cong.
    const newFields = output.map((f) => ({
      key: f.key,
      newValue: f.newValue,
      currentValue: currentValueOf(destination, f.key),
      found: f.found,
      note: f.note,
    }));

    const prevRecord = await this.extractionRepo.findBySlugAndSource(slug, "gsg");
    const fields = dedupeExtractionFields(prevRecord?.fields ?? [], newFields);

    const extractedAt = new Date();
    await this.extractionRepo.upsert({
      destinationSlug: slug,
      source: "gsg",
      // GSG khong doc tu 1 danh sach URL co san — Google tu tim, khong co URL cu
      // the de ghi lai (rui ro da xac dinh: grounding + structured output lam
      // rong grounding_chunks, khong lay duoc URL that su da dung, §5.0).
      sourceUrls: [],
      extractedAt,
      fields,
    });

    await this.usage.record({
      jobId: null,
      provider: provider.key,
      model: GSG_MODEL,
      operation: "extract-destination-gsg",
      ...usage,
      promptText: buildPromptLogText(promptRequest.system, promptRequest.prompt, gsgResponseSchema),
      responseText: JSON.stringify(output),
    });

    const found = fields.filter((f) => f.found).length;
    this.logger.log(
      `Trích xuất GSG cho ${slug} — tìm được ${found}/${fields.length} field`,
    );

    return {
      destinationSlug: slug,
      source: "gsg",
      sourceUrls: [],
      extractedAt: extractedAt.toISOString(),
      fields,
    };
  }
}
