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
      `Tao OUTLINE cho bai viet affiliate tieng Viet.`,
      `Chu de: ${input.topic}`,
      `Tu khoa chinh: ${input.keywordSeed.join(", ") || "(tu suy ra tu chu de)"}`,
      `Website: ${input.siteCode}`,
      input.toneProfile ? `Tone: ${input.toneProfile}` : null,
      `Du lieu san pham (JSON): ${JSON.stringify(input.products)}`,
      ``,
      `Yeu cau:`,
      `- title: 50-70 ky tu, chua tu khoa chinh tu nhien.`,
      `- sectionHeadings: 3-5 muc H2 (vd: tieu chi xep hang, huong dan chon theo nhu cau).`,
      `- plannedProducts: chon tu du lieu san pham; neu danh sach rong thi de mang rong.`,
      `- plannedFaqQuestions: 3-6 cau hoi theo search intent thuc te cua nguoi mua.`,
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
      `Viet bai viet affiliate tieng Viet HOAN CHINH theo outline va du lieu duoi day.`,
      `Outline (JSON): ${JSON.stringify(input.outline)}`,
      `Website: ${input.siteCode}`,
      `Tu khoa chinh: ${input.keywordSeed.join(", ") || "(tu suy ra tu chu de)"}`,
      input.toneProfile ? `Tone: ${input.toneProfile}` : null,
      `Du lieu san pham (JSON): ${JSON.stringify(input.products)}`,
      ``,
      `Yeu cau noi dung (bat buoc):`,
      `- hero.affiliateDisclosure: cau khai bao tiep thi lien ket ro rang.`,
      `- Moi section 120-250 tu, giong tu nhien nhu nguoi viet that, khong khoa truong.`,
      `- productRecommendations: CHI dung san pham trong du lieu; neu du lieu rong,`,
      `  tao goi y chung chung voi productUrl la "https://example.com/placeholder"`,
      `  va ghi ro trong whyInList rang can bo sung du lieu san pham that.`,
      `- KHONG tu che thong so, gia, khuyen mai khong co trong du lieu.`,
      `- KHONG claim qua da ("tot nhat thi truong", "cam ket 100%", claim y khoa...).`,
      `- metadata.metaTitle <= 70 ky tu, metaDescription <= 170 ky tu,`,
      `  internalLinkSuggestions: 2 duong dan noi bo dang "/ten-bai-viet".`,
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
            "Ban la chuyen gia viet content affiliate tieng Viet cho website thuong mai. " +
            "Ban viet trung thuc, chi dung du lieu duoc cung cap, tuan thu schema output nghiem ngat.",
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
      this.client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return this.client;
  }
}
