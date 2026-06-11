import { Injectable, Logger } from "@nestjs/common";
import { GoogleGenAI } from "@google/genai";
import { z, type ZodType } from "zod/v4";
import {
  articleOutlineSchema,
  articleSchema,
  type Article,
  type ArticleOutline,
} from "@zinoflow/contracts";
import type {
  AiCallUsage,
  ContentAiProvider,
  GenerateArticleInput,
  GenerateOutlineInput,
} from "../../application/ports/content-ai-provider.port";
import { AiProviderError } from "../../../shared/errors/app-error";
import { computeGeminiCostUsd } from "./gemini-pricing";

/**
 * Provider Google Gemini — adapter duy nhat duoc import @google/genai.
 *
 * Structured output: responseMimeType application/json + responseJsonSchema
 * (JSON Schema sinh truc tiep tu Zod v4 bang z.toJSONSchema). Output van duoc
 * Zod-validate lan nua truoc khi ra khoi adapter — schema la nguon su that duy nhat.
 */
@Injectable()
export class GeminiContentAiProvider implements ContentAiProvider {
  readonly key = "gemini" as const;
  private readonly logger = new Logger(GeminiContentAiProvider.name);
  private client: GoogleGenAI | null = null;

  isConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY);
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

    const { parsed, usage } = await this.generateJson(
      input.model,
      "outline",
      prompt,
      articleOutlineSchema,
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

    const { parsed, usage } = await this.generateJson(input.model, "article", prompt, articleSchema);
    return { article: parsed, usage };
  }

  /** Goi generateContent voi JSON schema enforcement + do usage/cost/latency. */
  private async generateJson<TSchema extends ZodType>(
    model: string,
    operation: string,
    prompt: string,
    schema: TSchema,
  ): Promise<{ parsed: z.infer<TSchema>; usage: AiCallUsage }> {
    const startedAt = Date.now();
    try {
      const response = await this.getClient().models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction:
            "Bạn là chuyên gia viết content affiliate tiếng Việt cho website thương mại. " +
            "Bạn LUÔN viết tiếng Việt có dấu đầy đủ, viết trung thực, chỉ dùng dữ liệu được cung cấp, " +
            "tuân thủ schema output nghiêm ngặt.",
          responseMimeType: "application/json",
          // JSON Schema sinh tu chinh Zod schema trong contracts — 1 nguon su that
          responseJsonSchema: z.toJSONSchema(schema),
        },
      });

      const text = response.text;
      if (!text) {
        throw new AiProviderError(`Gemini ${operation}: empty response`, [
          `finishReason: ${response.candidates?.[0]?.finishReason ?? "unknown"}`,
        ]);
      }

      // Phong truong hop model boc JSON trong ```json fence (hiem khi da set mimeType)
      const cleanJson = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      const parsed = schema.parse(JSON.parse(cleanJson)) as z.infer<TSchema>;

      const latencyMs = Date.now() - startedAt;
      const meta = response.usageMetadata;
      const inputTokens = meta?.promptTokenCount ?? 0;
      // Gemini 2.5 tinh thinking tokens vao gia output
      const outputTokens = (meta?.candidatesTokenCount ?? 0) + (meta?.thoughtsTokenCount ?? 0);
      const { costUsd, priced } = computeGeminiCostUsd(model, inputTokens, outputTokens);
      if (!priced) {
        this.logger.warn(`No pricing for model "${model}" - cost logged as 0`);
      }

      return { parsed, usage: { inputTokens, outputTokens, costUsd, latencyMs } };
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      throw new AiProviderError(
        `Gemini ${operation} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Lazy init de app boot duoc khi chua co key (registry da fallback stub). */
  private getClient(): GoogleGenAI {
    if (!this.client) {
      this.client = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        // 2 phut la du cho bai dai nhat; qua thi de pg-boss retry
        httpOptions: { timeout: 120_000 },
      });
    }
    return this.client;
  }
}
