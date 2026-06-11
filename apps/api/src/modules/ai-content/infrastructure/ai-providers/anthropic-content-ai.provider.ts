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
          "Ban la chuyen gia viet content affiliate tieng Viet cho website thuong mai. " +
          "Ban viet trung thuc, chi dung du lieu duoc cung cap, tuan thu schema output nghiem ngat.",
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
      this.client = new Anthropic(); // doc ANTHROPIC_API_KEY tu env
    }
    return this.client;
  }
}
