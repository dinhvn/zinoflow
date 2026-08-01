import { Injectable, Logger } from "@nestjs/common";
import { GoogleGenAI } from "@google/genai";
import { z, type ZodType } from "zod/v4";
import type {
  AiCallUsage,
  BatchCheckResult,
  BatchItemOutcome,
  BatchRequestItem,
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

  /** Gemini Batch API (client.batches.create/get) — xem submitBatch/checkBatch duoi. */
  readonly supportsBatch = true;

  async generateStructured<TSchema extends ZodType>(
    request: StructuredGenerationRequest,
    schema: TSchema,
  ): Promise<{ output: z.infer<TSchema>; usage: AiCallUsage }> {
    const startedAt = Date.now();
    try {
      const response = await this.callWithRetry(request, schema);
      const rawOutput = this.extractRawJson(
        response.text,
        response.candidates?.[0]?.finishReason,
        request.operation,
      );
      const output = schema.parse(rawOutput) as z.infer<TSchema>;
      const latencyMs = Date.now() - startedAt;
      const usage = this.usageFrom(response.usageMetadata, request.model, latencyMs);
      return { output, usage };
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      throw new AiProviderError(
        `Gemini ${request.operation} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Boc JSON tu text response — dung chung cho generateStructured (sync) va
   * checkBatch (khi doc tung InlinedResponse). Chi parse JSON, KHONG
   * schema.parse — batch khong biet schema cua tung item (xem port).
   */
  private extractRawJson(
    text: string | undefined,
    finishReason: string | undefined,
    operation: string,
  ): unknown {
    if (!text) {
      throw new AiProviderError(`Gemini ${operation}: empty response`, [
        `finishReason: ${finishReason ?? "unknown"}`,
      ]);
    }
    // Phong truong hop model boc JSON trong ```json fence (hiem khi da set mimeType)
    const cleanJson = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    return JSON.parse(cleanJson);
  }

  private usageFrom(
    meta: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number } | undefined,
    model: string,
    latencyMs: number,
  ): AiCallUsage {
    const inputTokens = meta?.promptTokenCount ?? 0;
    // Gemini 2.5 tinh thinking tokens vao gia output
    const outputTokens = (meta?.candidatesTokenCount ?? 0) + (meta?.thoughtsTokenCount ?? 0);
    const { costUsd, priced } = computeGeminiCostUsd(model, inputTokens, outputTokens);
    if (!priced) {
      this.logger.warn(`No pricing for model "${model}" - cost logged as 0`);
    }
    return { inputTokens, outputTokens, costUsd, latencyMs };
  }

  /**
   * Gui 1 loat request cung luc qua Gemini Batch API — re hon ~50% nhung
   * khong co ket qua ngay (nguoi dung tu bam "Kiem tra" sau, xem checkBatch).
   * metadata.key gan vao tung InlinedRequest de khop lai dung item khi doc
   * ket qua (KHONG dua vao thu tu mang).
   */
  async submitBatch(items: BatchRequestItem[]): Promise<{ providerBatchName: string }> {
    if (items.length === 0) {
      throw new AiProviderError("Gemini submitBatch: danh sach item rong");
    }
    const inlinedRequests = items.map((item) => ({
      model: item.request.model,
      contents: item.request.prompt,
      metadata: { key: item.key },
      config: {
        systemInstruction: item.request.system,
        responseMimeType: "application/json" as const,
        responseJsonSchema: z.toJSONSchema(item.schema),
        ...(item.request.temperature !== undefined ? { temperature: item.request.temperature } : {}),
        ...(item.request.useGoogleSearch ? { tools: [{ googleSearch: {} }] } : {}),
      },
    }));
    try {
      const batchJob = await this.getClient().batches.create({
        model: items[0]!.request.model,
        src: inlinedRequests,
      });
      if (!batchJob.name) {
        throw new AiProviderError("Gemini submitBatch: khong nhan duoc providerBatchName");
      }
      return { providerBatchName: batchJob.name };
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      throw new AiProviderError(
        `Gemini submitBatch failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Kiem tra trang thai 1 batch — nguoi dung tu bam nut, khong auto-poll. */
  async checkBatch(providerBatchName: string): Promise<BatchCheckResult> {
    try {
      const batchJob = await this.getClient().batches.get({ name: providerBatchName });
      const state = batchJob.state;
      if (state === "JOB_STATE_SUCCEEDED") {
        const responses = batchJob.dest?.inlinedResponses ?? [];
        const items: BatchItemOutcome[] = responses.map((res) => {
          const key = res.metadata?.key ?? "";
          if (res.error) {
            return { key, errorMessage: res.error.message ?? "Gemini batch item error" };
          }
          try {
            const rawOutput = this.extractRawJson(
              res.response?.text,
              res.response?.candidates?.[0]?.finishReason,
              "batch-item",
            );
            const usage = this.usageFrom(res.response?.usageMetadata, batchJob.model ?? "", 0);
            return { key, rawOutput, usage };
          } catch (error) {
            return {
              key,
              errorMessage: error instanceof Error ? error.message : String(error),
            };
          }
        });
        return { state: "succeeded", items };
      }
      if (
        state === "JOB_STATE_FAILED" ||
        state === "JOB_STATE_CANCELLED" ||
        state === "JOB_STATE_EXPIRED"
      ) {
        return { state: "failed" };
      }
      return { state: "pending" };
    } catch (error) {
      throw new AiProviderError(
        `Gemini checkBatch failed: ${error instanceof Error ? error.message : String(error)}`,
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
            // Tuong minh theo tac vu (khong ngam dinh 1 gia tri chung) — vd 0.1 cho
            // trich xuat GSG, 0.5-0.6 cho viet bai (§6 A5). Khong set -> SDK tu default.
            ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
            // Gemini 3.x cho ket hop duoc google_search + structured output cung luc
            // (Gemini 2.x truoc day khong the) — dung cho nhanh trich xuat GSG (§6 B2).
            ...(request.useGoogleSearch ? { tools: [{ googleSearch: {} }] } : {}),
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
