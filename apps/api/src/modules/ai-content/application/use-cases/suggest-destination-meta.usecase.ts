import { Inject, Injectable } from "@nestjs/common";
import {
  aiProviderKeySchema,
  destinationMetaSuggestionSchema,
  type DestinationMetaSuggestion,
  type SuggestDestinationMetaRequest,
} from "@zinoflow/contracts";
import {
  AI_PROVIDER_REGISTRY,
  type AiProviderRegistry,
} from "../ports/content-ai-provider.port";
import { AI_USAGE_RECORDER, type AiUsageRecorder } from "../ports/ai-usage-recorder.port";

/** Provider/model mac dinh — Anthropic la primary; chua co key thi registry fallback stub. */
const DEFAULT_PROVIDER = "anthropic";
const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-haiku-4-5", // tac vu nhe -> Haiku (spec §5)
  gemini: "gemini-2.5-flash-lite",
  openai: "gpt-4o-mini",
};

const SYSTEM = [
  "Bạn là biên tập viên du lịch Việt Nam.",
  "Luôn trả lời bằng tiếng Việt có dấu đầy đủ.",
  "TUYỆT ĐỐI KHÔNG bịa số liệu cứng: toạ độ, địa chỉ, giá vé, giờ mở cửa.",
].join(" ");

/**
 * AI goi y metadata "mem" cho 1 diem den (mo ta ngan, phan loai, tu khoa) — spec §3.5.
 * Chi gợi ý phan editor de nguoi dung sua, KHONG dung lat/lng/dia chi (de tranh bia).
 * Di qua IContentAIProvider nhu moi call AI khac; ghi ai_usage_logs (jobId=null).
 */
@Injectable()
export class SuggestDestinationMetaUseCase {
  constructor(
    @Inject(AI_PROVIDER_REGISTRY) private readonly registry: AiProviderRegistry,
    @Inject(AI_USAGE_RECORDER) private readonly usage: AiUsageRecorder,
  ) {}

  async execute(request: SuggestDestinationMetaRequest): Promise<DestinationMetaSuggestion> {
    const providerKey = aiProviderKeySchema.parse(request.aiProvider ?? DEFAULT_PROVIDER);
    const model = request.aiModel ?? DEFAULT_MODELS[providerKey] ?? DEFAULT_MODELS[DEFAULT_PROVIDER]!;
    const provider = this.registry.resolve(providerKey);

    const location = request.provinceName ? ` (thuộc ${request.provinceName})` : "";
    const prompt = [
      `Điểm đến: "${request.name}"${location}.`,
      "Hãy gợi ý giúp người biên tập:",
      "- shortDescription: 1-2 câu mô tả ngắn, hấp dẫn, KHÔNG nêu giá vé/giờ/địa chỉ cụ thể.",
      "- suggestedKind: phân loại đúng một trong: province (tỉnh/thành), cluster (cụm/quần thể), poi (điểm đến lẻ).",
      "- searchKeyword: 3-6 từ khoá người dùng hay tìm, cách nhau dấu phẩy.",
    ].join("\n");

    const { output, usage } = await provider.generateStructured(
      {
        model,
        operation: "suggest-meta",
        system: SYSTEM,
        prompt,
        maxTokens: 1_000,
        vars: { topic: request.name, articleType: "guide-diem-den-suggest" },
      },
      destinationMetaSuggestionSchema,
    );

    await this.usage.record({
      jobId: null,
      provider: provider.key,
      model,
      operation: "suggest-meta",
      ...usage,
    });
    return output;
  }
}
