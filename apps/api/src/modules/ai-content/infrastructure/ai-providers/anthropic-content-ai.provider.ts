import { Injectable, Logger } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ZodType, z } from "zod/v4";
import type {
  AiCallUsage,
  ContentAiProvider,
  StructuredGenerationRequest,
} from "../../application/ports/content-ai-provider.port";
import { AiProviderError } from "../../../shared/errors/app-error";
import { computeAnthropicCostUsd } from "./anthropic-pricing";

/**
 * Provider Anthropic (Claude) — adapter duy nhat trong he thong duoc import SDK Anthropic.
 * Prompt KHONG nam o day — PromptBuilder (application layer) build tu prompt_templates DB.
 *
 * Quy tac voi Opus 4.8 (vi pham la API tra 400):
 * - thinking: { type: "adaptive" } — KHONG dung budget_tokens
 * - KHONG truyen temperature / top_p / top_k
 * - Khong prefill assistant message — structured output qua output_config
 *
 * Structured output: messages.parse() + zodOutputFormat(schema tu contracts)
 * -> output da duoc validate dung schema truoc khi ra khoi adapter.
 */
@Injectable()
export class AnthropicContentAiProvider implements ContentAiProvider {
  readonly key = "anthropic" as const;
  private readonly logger = new Logger(AnthropicContentAiProvider.name);
  private client: Anthropic | null = null;

  isConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  async generateStructured<TSchema extends ZodType>(
    request: StructuredGenerationRequest,
    schema: TSchema,
  ): Promise<{ output: z.infer<TSchema>; usage: AiCallUsage }> {
    const startedAt = Date.now();
    try {
      const response = await this.getClient().messages.parse({
        model: request.model,
        max_tokens: request.maxTokens,
        thinking: { type: "adaptive" },
        system: request.system,
        messages: [{ role: "user", content: request.prompt }],
        output_config: { format: zodOutputFormat(schema) },
      });

      if (response.parsed_output == null) {
        // stop_reason refusal/max_tokens -> khong co output hop le
        throw new AiProviderError(`Anthropic ${request.operation}: no parsed output`, [
          `stop_reason: ${response.stop_reason}`,
        ]);
      }

      const latencyMs = Date.now() - startedAt;
      const inputTokens =
        response.usage.input_tokens +
        (response.usage.cache_read_input_tokens ?? 0) +
        (response.usage.cache_creation_input_tokens ?? 0);
      const outputTokens = response.usage.output_tokens;
      const { costUsd, priced } = computeAnthropicCostUsd(request.model, inputTokens, outputTokens);
      if (!priced) {
        this.logger.warn(`No pricing for model "${request.model}" - cost logged as 0`);
      }

      return {
        output: response.parsed_output as z.infer<TSchema>,
        usage: { inputTokens, outputTokens, costUsd, latencyMs },
      };
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      // Typed SDK errors — khong string-match message
      if (error instanceof Anthropic.APIError) {
        throw new AiProviderError(`Anthropic ${request.operation} failed: ${error.message}`, [
          `status: ${error.status}`,
        ]);
      }
      // Zod validation fail tu parse() hoac loi khac
      throw new AiProviderError(
        `Anthropic ${request.operation} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Lazy init de app boot duoc khi chua co key (registry da fallback stub). */
  private getClient(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic({
        // doc ANTHROPIC_API_KEY tu env
        timeout: 120_000, // 1 call gio ngan hon (per-section); qua thi de retry
        maxRetries: 2, // SDK tu retry 429/5xx
      });
    }
    return this.client;
  }
}
