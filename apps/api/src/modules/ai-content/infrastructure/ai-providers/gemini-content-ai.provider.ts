import { Injectable, Logger } from "@nestjs/common";
import { GoogleGenAI } from "@google/genai";
import { z, type ZodType } from "zod/v4";
import type {
  AiCallUsage,
  ContentAiProvider,
  StructuredGenerationRequest,
} from "../../application/ports/content-ai-provider.port";
import { AiProviderError } from "../../../shared/errors/app-error";
import { computeGeminiCostUsd } from "./gemini-pricing";

/**
 * Provider Google Gemini — adapter duy nhat duoc import @google/genai.
 * Prompt KHONG nam o day — PromptBuilder (application layer) build tu prompt_templates DB.
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

  async generateStructured<TSchema extends ZodType>(
    request: StructuredGenerationRequest,
    schema: TSchema,
  ): Promise<{ output: z.infer<TSchema>; usage: AiCallUsage }> {
    const startedAt = Date.now();
    try {
      const response = await this.callWithRetry(request, schema);
      const text = response.text;
      if (!text) {
        throw new AiProviderError(`Gemini ${request.operation}: empty response`, [
          `finishReason: ${response.candidates?.[0]?.finishReason ?? "unknown"}`,
        ]);
      }

      // Phong truong hop model boc JSON trong ```json fence (hiem khi da set mimeType)
      const cleanJson = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      const output = schema.parse(JSON.parse(cleanJson)) as z.infer<TSchema>;

      const latencyMs = Date.now() - startedAt;
      const meta = response.usageMetadata;
      const inputTokens = meta?.promptTokenCount ?? 0;
      // Gemini 2.5 tinh thinking tokens vao gia output
      const outputTokens = (meta?.candidatesTokenCount ?? 0) + (meta?.thoughtsTokenCount ?? 0);
      const { costUsd, priced } = computeGeminiCostUsd(request.model, inputTokens, outputTokens);
      if (!priced) {
        this.logger.warn(`No pricing for model "${request.model}" - cost logged as 0`);
      }

      return { output, usage: { inputTokens, outputTokens, costUsd, latencyMs } };
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      throw new AiProviderError(
        `Gemini ${request.operation} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Goi Gemini voi retry 429/5xx (rule: moi external call co retry/backoff o adapter).
   * 429 free tier (5 req/phut voi flash) la binh thuong khi pipeline goi 6+ lan lien
   * tiep — ton trong retryDelay tu RetryInfo cua API (cap 60s), toi da 3 lan retry.
   */
  private async callWithRetry<TSchema extends ZodType>(
    request: StructuredGenerationRequest,
    schema: TSchema,
  ) {
    const MAX_RETRIES = 3;
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.getClient().models.generateContent({
          model: request.model,
          contents: request.prompt,
          config: {
            systemInstruction: request.system,
            responseMimeType: "application/json",
            // JSON Schema sinh tu chinh Zod schema trong contracts — 1 nguon su that
            responseJsonSchema: z.toJSONSchema(schema),
            // KHONG set maxOutputTokens: Gemini 2.5 tinh ca thinking tokens vao limit
            // -> de SDK default, request.maxTokens chi ap dung cho Anthropic
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const retriable = /"code"\s*:\s*(429|500|503)|RESOURCE_EXHAUSTED|UNAVAILABLE/.test(
          message,
        );
        if (!retriable || attempt >= MAX_RETRIES) throw error;
        const delayMs = parseRetryDelayMs(message) ?? 15_000 * (attempt + 1);
        this.logger.warn(
          `Gemini ${request.operation} bi gioi han (lan ${attempt + 1}/${MAX_RETRIES}) - cho ${Math.round(delayMs / 1000)}s roi thu lai`,
        );
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  /** Lazy init de app boot duoc khi chua co key (registry da fallback stub). */
  private getClient(): GoogleGenAI {
    if (!this.client) {
      this.client = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        // 2 phut la du cho 1 call; qua thi de pg-boss/section retry
        httpOptions: { timeout: 120_000 },
      });
    }
    return this.client;
  }
}

/** Doc retryDelay tu RetryInfo trong message loi 429 ("retryDelay":"35s"), cap 60s */
function parseRetryDelayMs(message: string): number | null {
  const match = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(message);
  if (!match) return null;
  const seconds = Number(match[1]);
  return Math.min(Math.ceil(seconds) + 1, 60) * 1000;
}
