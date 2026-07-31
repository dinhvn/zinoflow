import { Inject, Injectable, Logger } from "@nestjs/common";
import { z } from "zod/v4";
import type { ArticleAiExtraction } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  CONTENT_JOB_REPOSITORY,
  type ContentJobRepository,
} from "../../../ai-content/application/ports/content-job.repository";
import {
  ARTICLE_AI_EXTRACTION_REPOSITORY,
  type ArticleAiExtractionRepository,
} from "../ports/article-ai-extraction.repository";
import {
  AI_PROVIDER_REGISTRY,
  type AiProviderRegistry,
} from "../../../ai-content/application/ports/content-ai-provider.port";
import {
  AI_USAGE_RECORDER,
  type AiUsageRecorder,
} from "../../../ai-content/application/ports/ai-usage-recorder.port";
import { buildPromptLogText } from "../../../ai-content/application/services/prompt-log-text";

/** Model FLASH — trich xuat hang loat, khong can van phong sau (dong nguyen tac voi destination GSG). */
const GSG_MODEL = "gemini-3.6-flash";
const GSG_TEMPERATURE = 0.1;

const gsgResponseSchema = z.object({
  summary: z.string(),
});

const SYSTEM_PROMPT = `Dùng Google Search để đọc kỹ các website tham khảo được nêu + tìm thêm thông tin liên quan tới chủ đề bài viết.

Trả về DUY NHẤT JSON {"summary": string} — KHÔNG kèm văn bản dẫn dắt, không giải thích ngoài JSON.

"summary" là 1 đoạn tổng hợp thông tin CÓ ÍCH cho người viết bài cẩm nang du lịch về chủ đề này — gồm: thông tin/số liệu cụ thể tìm được (giá cả, thời gian, địa điểm...), kinh nghiệm thực tế đáng chú ý, lưu ý quan trọng. KHÔNG bịa thông tin không tìm thấy qua search — nếu không tìm thấy gì đáng kể, trả về summary ngắn gọn nói rõ không có dữ liệu mới. Tiếng Việt có dấu đầy đủ.`;

/**
 * Trich xuat thong tin nguon cho bai cam nang TU DONG qua Gemini + Google
 * Search Grounding (article-ai-extraction-plan.md GĐ3) — doc lap voi skill
 * Claude Code thu cong (GĐ2), ghi CUNG bang staging voi source="gemini-gsg".
 * Don gian hon ban destination (chi 1 field text, khong tach nhieu field
 * co dinh — chot 31/07/2026).
 */
@Injectable()
export class ExtractArticleInfoGsgUseCase {
  private readonly logger = new Logger(ExtractArticleInfoGsgUseCase.name);

  constructor(
    @Inject(CONTENT_JOB_REPOSITORY) private readonly jobs: ContentJobRepository,
    @Inject(ARTICLE_AI_EXTRACTION_REPOSITORY)
    private readonly extractions: ArticleAiExtractionRepository,
    @Inject(AI_PROVIDER_REGISTRY) private readonly registry: AiProviderRegistry,
    @Inject(AI_USAGE_RECORDER) private readonly usage: AiUsageRecorder,
  ) {}

  async execute(jobId: string): Promise<ArticleAiExtraction> {
    const job = await this.jobs.findById(jobId);
    if (!job) throw new DomainRuleError(`Không tìm thấy job ${jobId}`);
    const snapshot = job.toSnapshot();
    if (snapshot.articleType !== "cam-nang") {
      throw new DomainRuleError("Chỉ bài cẩm nang mới trích xuất nguồn ở đây");
    }

    const referenceUrls = snapshot.referenceUrls ?? [];
    const referenceLine =
      referenceUrls.length > 0
        ? `Website tham khảo: ${referenceUrls.join(", ")}.`
        : "Không có website tham khảo cụ thể — tự tìm nguồn liên quan qua Google Search.";

    const provider = this.registry.resolve("gemini");
    const promptRequest = {
      model: GSG_MODEL,
      operation: "extract-article-gsg",
      system: SYSTEM_PROMPT,
      prompt: `Chủ đề bài viết: "${snapshot.topic}". ${referenceLine}`,
      maxTokens: 4_000,
      vars: {},
      temperature: GSG_TEMPERATURE,
      useGoogleSearch: true,
    };

    const { output, usage } = await provider.generateStructured(promptRequest, gsgResponseSchema);

    const extractedAt = new Date();
    await this.extractions.upsert({
      jobId,
      source: "gemini-gsg",
      sourceUrls: referenceUrls,
      extractedSummary: output.summary,
      extractedAt,
    });

    await this.usage.record({
      jobId,
      provider: provider.key,
      model: GSG_MODEL,
      operation: "extract-article-gsg",
      ...usage,
      promptText: buildPromptLogText(promptRequest.system, promptRequest.prompt, gsgResponseSchema),
      responseText: JSON.stringify(output),
    });

    this.logger.log(`Trích xuất GSG cho job ${jobId} — ${output.summary.length} ký tự`);

    return {
      jobId,
      source: "gemini-gsg",
      sourceUrls: referenceUrls,
      extractedSummary: output.summary,
      extractedAt: extractedAt.toISOString(),
    };
  }
}
