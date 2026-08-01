import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod/v4";
import {
  destinationAiExtractionFieldKeySchema,
  destinationOpeningHoursSchema,
  externalReviewUrlItemSchema,
  priceBreakdownItemSchema,
  type AiProviderKey,
  type DestinationAiExtraction,
  type DestinationAiExtractionFieldItem,
} from "@zinoflow/contracts";
import type { StructuredGenerationRequest } from "../../../ai-content/application/ports/content-ai-provider.port";
import { AI_USAGE_RECORDER, type AiUsageRecorder } from "../../../ai-content/application/ports/ai-usage-recorder.port";
import {
  DESTINATION_AI_EXTRACTION_REPOSITORY,
  type DestinationAiExtractionRepository,
} from "../ports/destination-ai-extraction.repository";
import { dedupeExtractionFields } from "./dedupe-extraction-fields";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";
import { KIND_LABELS } from "../../domain/destination-mirror";

/**
 * Trich xuat thong tin diem den qua Gemini + Google Search Grounding —
 * logic dung chung cho luong don le (ExtractDestinationInfoGsgUseCase,
 * POST :slug/ai-extraction/gsg) va Batch AI
 * (DestinationGsgExtractionBatchTaskHandler). Tach lam 2 nua: buildGsgExtractionRequest
 * (build request AI) va GsgExtractionResultApplier.apply (ap ket qua) —
 * dichoithoi-destination-ai-extraction-plan.md §6 B2.
 */

/**
 * Model FLASH (khong phai Pro) — trich xuat la tac vu HANG LOAT + can JSON chuan
 * xac, khong can van phong sau. Dung nguyen tac site dat ra tu dau: Flash cho
 * hang loat/structured, Pro chi danh cho viet bai Key/Featured (§6 B1).
 */
export const GSG_MODEL = "gemini-3.6-flash";
/** Uu tien chinh xac/nhat quan toi da — thap hon nhieu so voi 0.5 cua buoc viet bai. */
export const GSG_TEMPERATURE = 0.1;
export const GSG_PROVIDER_KEY: AiProviderKey = "gemini";

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
export const gsgResponseSchema = z.array(gsgFieldSchema);

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
- editorialReview: viết 1 đoạn ĐÁNH GIÁ BIÊN TẬP mang giọng văn CÁ NHÂN của người đã từng trải nghiệm thực tế (không phải liệt kê thông tin khô khan) — dựa trên đặc điểm/tiện ích/cảm nhận THẬT tìm được từ các nguồn (vd nội dung review thật trên Google Maps). KHÁC HẲN việc tổng hợp điểm đánh giá trung bình (aggregate rating) — đây là NHẬN ĐỊNH/Ý KIẾN. KHÔNG bịa chi tiết trải nghiệm cụ thể không có căn cứ (ngày giờ, tên người, con số chính xác không tìm thấy). Tối đa 500 ký tự. Nên kết ở nhận định "phù hợp với ai / không phù hợp với ai".
- openingHours.newValue (nếu found) PHẢI đúng shape { note: string, periods: [{days:string[], opens, closes}] } — note là câu ngắn gọn, chỉ thêm periods khi giờ THỰC SỰ khác nhau theo ngày.
- priceBreakdown.newValue (nếu found) PHẢI đúng shape mảng [{audience, price, note}] — audience là tên nhóm tiếng Việt ngắn gọn, price là số nguyên VNĐ.
- externalReviewUrl.newValue (nếu found) PHẢI đúng shape { label: string, url: string }.
- Tiếng Việt có dấu đầy đủ cho mọi giá trị text.`;

/** Build request AI cho 1 destination — dung chung sync + batch. */
export function buildGsgExtractionRequest(
  destination: DestinationMirrorEntity,
  provinceName: string | null,
  /** Batch AI cho chon model khac GSG_MODEL mac dinh (trang /ai-batches) — chi doi model, KHONG doi provider (luon Gemini vi can useGoogleSearch). */
  modelOverride?: string,
): { request: StructuredGenerationRequest; schema: typeof gsgResponseSchema } {
  const queryContext = [
    destination.name,
    provinceName ? `(${provinceName})` : null,
    `— loại: ${KIND_LABELS[destination.kind] ?? destination.kind}`,
  ]
    .filter(Boolean)
    .join(" ");

  const request: StructuredGenerationRequest = {
    model: modelOverride ?? GSG_MODEL,
    operation: "extract-destination-gsg",
    system: SYSTEM_PROMPT,
    prompt: `Điểm du lịch cần tra cứu: "${queryContext}".`,
    maxTokens: 8_000,
    vars: {},
    temperature: GSG_TEMPERATURE,
    useGoogleSearch: true,
  };
  return { request, schema: gsgResponseSchema };
}

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

export interface GsgExtractionUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
}

@Injectable()
export class GsgExtractionResultApplier {
  constructor(
    @Inject(DESTINATION_AI_EXTRACTION_REPOSITORY)
    private readonly extractionRepo: DestinationAiExtractionRepository,
    @Inject(AI_USAGE_RECORDER) private readonly usage: AiUsageRecorder,
  ) {}

  /**
   * Ap ket qua AI vao bang staging + ghi usage. promptText chi co o luong
   * sync (da co san request luc goi apply cung 1 lan execute) — luong batch
   * bo qua (request da bi huy sau khi submit, khong con giu lai).
   */
  async apply(
    slug: string,
    destination: DestinationMirrorEntity,
    rawOutput: unknown,
    callUsage: GsgExtractionUsage,
    promptText?: string | null,
    /** Model thuc te da dung (batch co the ghi de GSG_MODEL) — ghi dung vao usage log. */
    modelUsed: string = GSG_MODEL,
  ): Promise<DestinationAiExtraction> {
    const output = gsgResponseSchema.parse(rawOutput);

    // currentValue do CHINH applier doc truoc khi goi AI (khong de AI tu dien) —
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
      provider: GSG_PROVIDER_KEY,
      model: modelUsed,
      operation: "extract-destination-gsg",
      ...callUsage,
      promptText: promptText ?? null,
      responseText: JSON.stringify(output),
    });

    return {
      destinationSlug: slug,
      source: "gsg",
      sourceUrls: [],
      extractedAt: extractedAt.toISOString(),
      fields,
    };
  }
}
