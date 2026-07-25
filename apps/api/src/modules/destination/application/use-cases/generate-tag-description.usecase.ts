import { Inject, Injectable } from "@nestjs/common";
import {
  aiProviderKeySchema,
  generateTagDescriptionResponseSchema,
  type GenerateTagDescriptionRequest,
  type GenerateTagDescriptionResponse,
} from "@zinoflow/contracts";
import {
  AI_PROVIDER_REGISTRY,
  type AiProviderRegistry,
} from "../../../ai-content/application/ports/content-ai-provider.port";
import { AI_USAGE_RECORDER, type AiUsageRecorder } from "../../../ai-content/application/ports/ai-usage-recorder.port";
import { DomainRuleError } from "../../../shared/errors/app-error";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";

const DEFAULT_PROVIDER = "anthropic";
const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-haiku-4-5",
  gemini: "gemini-3.1-flash-lite",
  openai: "gpt-4o-mini",
};

const SYSTEM = [
  "Bạn là biên tập viên SEO du lịch Việt Nam.",
  "Luôn trả lời bằng tiếng Việt có dấu đầy đủ.",
  "TUYỆT ĐỐI KHÔNG bịa tên điểm đến, số liệu cứng hay chi tiết cụ thể không chắc chắn.",
  "Được dùng Markdown nhẹ: đoạn văn cách nhau 1 dòng trống, gạch đầu dòng (\"- \") khi",
  "liệt kê tiêu chí, in đậm (\"**...**\") cho từ khoá quan trọng. KHÔNG dùng heading",
  "(##), ảnh, bảng, hay tự chèn link — trang sẽ tự động link tên điểm đến sau.",
].join(" ");

/**
 * Buoc 3 (destination-spec §2.4) — AI soan doan gioi thieu cho trang /chu-de/{slug}.
 * Chi tra ve goi y; nguoi dung duyet roi goi UpdateTagDescriptionUseCase de luu.
 * Tai dung IContentAIProvider nhu moi call AI khac trong ai-content — khong flow moi.
 */
@Injectable()
export class GenerateTagDescriptionUseCase {
  constructor(
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
    @Inject(AI_PROVIDER_REGISTRY) private readonly registry: AiProviderRegistry,
    @Inject(AI_USAGE_RECORDER) private readonly usage: AiUsageRecorder,
  ) {}

  async execute(request: GenerateTagDescriptionRequest): Promise<GenerateTagDescriptionResponse> {
    const tags = await this.siteDb.fetchTags();
    const tag = tags.find((t) => t.slug === request.tagSlug);
    if (!tag) {
      throw new DomainRuleError(`Không tìm thấy tag "${request.tagSlug}"`);
    }

    const assignedDestinations = await this.siteDb.fetchDestinationsForTag(request.tagSlug);

    const providerKey = aiProviderKeySchema.parse(request.aiProvider ?? DEFAULT_PROVIDER);
    const model = request.aiModel ?? DEFAULT_MODELS[providerKey] ?? DEFAULT_MODELS[DEFAULT_PROVIDER]!;
    const provider = this.registry.resolve(providerKey);

    const prompt = [
      `Chủ đề: "${tag.name}" (trang /chu-de/${tag.slug}).`,
      "Soạn 1 đoạn giới thiệu 300-500 từ cho trang danh mục này — đủ dài để trang có lý",
      "do tồn tại độc lập, không chỉ là tag archive trùng lặp trang Loại/Tỉnh. Giải thích",
      "tiêu chí chọn lọc chủ đề này (dùng gạch đầu dòng nếu có nhiều tiêu chí), gợi ý cách",
      "dùng danh sách, có thể thêm 1-2 câu kinh nghiệm thực tế chung chung (không bịa số",
      "liệu). CHỈ được nhắc tên điểm đến trong danh sách dưới đây (đã thực sự gán chủ đề",
      "này) — không bịa thêm tên khác, không bắt buộc nhắc hết:",
      assignedDestinations.length > 0
        ? assignedDestinations.map((d) => `- ${d.name}`).join("\n")
        : "(chưa có điểm đến nào gán chủ đề này — chỉ mô tả tiêu chí chọn lọc, không nhắc tên)",
    ].join("\n");

    const { output, usage } = await provider.generateStructured(
      {
        model,
        operation: "generate-tag-description",
        system: SYSTEM,
        prompt,
        maxTokens: 1500,
        vars: { topic: tag.name, articleType: "guide-diem-den-suggest" },
      },
      generateTagDescriptionResponseSchema,
    );

    await this.usage.record({
      jobId: null,
      provider: provider.key,
      model,
      operation: "generate-tag-description",
      ...usage,
      promptText: `${SYSTEM}\n\n${prompt}`,
      responseText: JSON.stringify(output),
    });
    return output;
  }
}
