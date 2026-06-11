import { Injectable, Logger } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  articleOutlineSchema,
  articleSchema,
  type Article,
  type ArticleOutline,
} from "@zinoflow/contracts";
import type { ZodType, z } from "zod/v4";
import type {
  AiCallUsage,
  ContentAiProvider,
  GenerateArticleInput,
  GenerateOutlineInput,
} from "../../application/ports/content-ai-provider.port";
import { AiProviderError } from "../../../shared/errors/app-error";
import { computeAnthropicCostUsd } from "./anthropic-pricing";

/**
 * Provider Anthropic (Claude) — adapter duy nhat trong he thong duoc import SDK Anthropic.
 *
 * Quy tac voi Opus 4.8 (vi pham la API tra 400):
 * - thinking: { type: "adaptive" } — KHONG dung budget_tokens
 * - KHONG truyen temperature / top_p / top_k
 * - Khong prefill assistant message — structured output qua output_config
 *
 * Structured output: messages.parse() + zodOutputFormat(schema tu contracts)
 * -> output da duoc validate dung schema 8-block truoc khi ra khoi adapter.
 *
 * M2: prompt se doc tu bang prompt_templates (co version); hien tai inline.
 */
@Injectable()
export class AnthropicContentAiProvider implements ContentAiProvider {
  readonly key = "anthropic" as const;
  private readonly logger = new Logger(AnthropicContentAiProvider.name);
  private client: Anthropic | null = null;

  isConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  async generateOutline(
    input: GenerateOutlineInput,
  ): Promise<{ outline: ArticleOutline; usage: AiCallUsage }> {
    const prompt = [
      `Tạo OUTLINE cho bài viết affiliate tiếng Việt.`,
      `Chủ đề: ${input.topic}`,
      `Từ khóa chính: ${input.keywordSeed.join(", ") || "(tự suy ra từ chủ đề)"}`,
      `Website: ${input.siteCode}`,
      input.toneProfile ? `Giọng văn: ${input.toneProfile}` : null,
      `Dữ liệu sản phẩm (JSON): ${JSON.stringify(input.products)}`,
      ``,
      `Yêu cầu:`,
      `- BẮT BUỘC viết tiếng Việt có dấu đầy đủ. Nếu chủ đề đầu vào không dấu,`,
      `  hãy chuẩn hóa lại thành tiếng Việt có dấu trong title và mọi nội dung.`,
      `- title: 50-70 ký tự, chứa từ khóa chính một cách tự nhiên.`,
      `- sectionHeadings: 3-5 mục H2 (ví dụ: tiêu chí xếp hạng, hướng dẫn chọn theo nhu cầu).`,
      `- plannedProducts: chọn từ dữ liệu sản phẩm; nếu danh sách rỗng thì để mảng rỗng.`,
      `- plannedFaqQuestions: 3-6 câu hỏi theo search intent thực tế của người mua.`,
    ]
      .filter((line): line is string => line !== null)
      .join("\n");

    const { parsed, usage } = await this.parse(
      input.model,
      "outline",
      prompt,
      articleOutlineSchema,
      8000,
    );
    return { outline: parsed, usage };
  }

  async generateArticle(
    input: GenerateArticleInput,
  ): Promise<{ article: Article; usage: AiCallUsage }> {
    const prompt = [
      `Viết bài viết affiliate tiếng Việt HOÀN CHỈNH theo outline và dữ liệu dưới đây.`,
      `Outline (JSON): ${JSON.stringify(input.outline)}`,
      `Website: ${input.siteCode}`,
      `Từ khóa chính: ${input.keywordSeed.join(", ") || "(tự suy ra từ chủ đề)"}`,
      input.toneProfile ? `Giọng văn: ${input.toneProfile}` : null,
      `Dữ liệu sản phẩm (JSON): ${JSON.stringify(input.products)}`,
      ``,
      `Yêu cầu nội dung (bắt buộc):`,
      `- BẮT BUỘC viết tiếng Việt có dấu đầy đủ trong TOÀN BỘ nội dung (title,`,
      `  heading, đoạn văn, FAQ...). Nếu outline hoặc chủ đề có chỗ không dấu,`,
      `  hãy chuẩn hóa lại thành có dấu.`,
      `- hero.affiliateDisclosure: câu khai báo tiếp thị liên kết rõ ràng.`,
      `- Mỗi section 120-250 từ, giọng tự nhiên như người viết thật, không khoa trương.`,
      `- productRecommendations: CHỈ dùng sản phẩm trong dữ liệu; nếu dữ liệu rỗng,`,
      `  tạo gợi ý chung chung với productUrl là "https://example.com/placeholder"`,
      `  và ghi rõ trong whyInList rằng cần bổ sung dữ liệu sản phẩm thật.`,
      `- KHÔNG tự chế thông số, giá, khuyến mãi không có trong dữ liệu.`,
      `- KHÔNG claim quá đà ("tốt nhất thị trường", "cam kết 100%", claim y khoa...).`,
      `- metadata.metaTitle <= 70 ký tự, metaDescription <= 170 ký tự,`,
      `  internalLinkSuggestions: 2 đường dẫn nội bộ dạng "/ten-bai-viet" (slug không dấu).`,
    ]
      .filter((line): line is string => line !== null)
      .join("\n");

    const { parsed, usage } = await this.parse(input.model, "article", prompt, articleSchema, 16000);
    return { article: parsed, usage };
  }

  /**
   * Goi messages.parse voi structured output + do usage/cost/latency.
   * Moi loi SDK duoc map ve AiProviderError (error envelope nhom AiProviderError).
   */
  private async parse<TSchema extends ZodType>(
    model: string,
    operation: string,
    prompt: string,
    schema: TSchema,
    maxTokens: number,
  ): Promise<{ parsed: z.infer<TSchema>; usage: AiCallUsage }> {
    const startedAt = Date.now();
    try {
      const response = await this.getClient().messages.parse({
        model,
        max_tokens: maxTokens,
        thinking: { type: "adaptive" },
        system:
          "Bạn là chuyên gia viết content affiliate tiếng Việt cho website thương mại. " +
          "Bạn LUÔN viết tiếng Việt có dấu đầy đủ, viết trung thực, chỉ dùng dữ liệu được cung cấp, " +
          "tuân thủ schema output nghiêm ngặt.",
        messages: [{ role: "user", content: prompt }],
        output_config: { format: zodOutputFormat(schema) },
      });

      if (response.parsed_output == null) {
        // stop_reason refusal/max_tokens -> khong co output hop le
        throw new AiProviderError(`Anthropic ${operation}: no parsed output`, [
          `stop_reason: ${response.stop_reason}`,
        ]);
      }

      const latencyMs = Date.now() - startedAt;
      const inputTokens =
        response.usage.input_tokens +
        (response.usage.cache_read_input_tokens ?? 0) +
        (response.usage.cache_creation_input_tokens ?? 0);
      const outputTokens = response.usage.output_tokens;
      const { costUsd, priced } = computeAnthropicCostUsd(model, inputTokens, outputTokens);
      if (!priced) {
        this.logger.warn(`No pricing for model "${model}" - cost logged as 0`);
      }

      return {
        parsed: response.parsed_output as z.infer<TSchema>,
        usage: { inputTokens, outputTokens, costUsd, latencyMs },
      };
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      // Typed SDK errors — khong string-match message
      if (error instanceof Anthropic.APIError) {
        throw new AiProviderError(`Anthropic ${operation} failed: ${error.message}`, [
          `status: ${error.status}`,
        ]);
      }
      // Zod validation fail tu parse() hoac loi khac
      throw new AiProviderError(
        `Anthropic ${operation} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Lazy init de app boot duoc khi chua co key (registry da fallback stub). */
  private getClient(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic({
        // doc ANTHROPIC_API_KEY tu env
        timeout: 120_000, // bai dai nhat ~60s, 2 phut la du; qua thi de pg-boss retry
        maxRetries: 2, // SDK tu retry 429/5xx
      });
    }
    return this.client;
  }
}
