import type { AiProviderKey } from "@zinoflow/contracts";
import type { ZodType, z } from "zod/v4";
import type { ProductContext } from "./product-catalog.port";

/**
 * Port cho AI content generation — application layer CHI biet interface nay.
 * Implementations o infrastructure: Stub, Anthropic, Gemini, OpenAI (skeleton).
 *
 * M2: provider chi con 1 method generic generateStructured(prompt, schema).
 * Prompt duoc build o application layer (PromptBuilder, doc tu prompt_templates DB)
 * — adapter chi lo transport + structured output + usage/cost, KHONG chua prompt.
 */

/** Token usage + cost cua 1 lan goi AI — bat buoc tra ve de ghi ai_usage_logs. */
export interface AiCallUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
}

/**
 * 1 yeu cau sinh structured output.
 * vars: cac bien da interpolate vao prompt — provider that KHONG dung,
 * chi stub provider dung de sinh output deterministic theo topic/section.
 */
export interface StructuredGenerationRequest {
  model: string;
  /** "outline" | "section" | "frame" — de log ai_usage_logs va error message. */
  operation: string;
  system: string;
  prompt: string;
  maxTokens: number;
  vars: Readonly<Record<string, unknown>>;
}

export interface ContentAiProvider {
  readonly key: AiProviderKey | "stub";
  /** Provider co du config de goi that khong (API key trong env). */
  isConfigured(): boolean;
  generateStructured<TSchema extends ZodType>(
    request: StructuredGenerationRequest,
    schema: TSchema,
  ): Promise<{ output: z.infer<TSchema>; usage: AiCallUsage }>;
}

/** Registry resolve provider theo aiProvider tren job. */
export const AI_PROVIDER_REGISTRY = Symbol("AI_PROVIDER_REGISTRY");

export interface AiProviderRegistry {
  /** Tra ve provider theo key; fallback ve stub (kem warn) neu chua configured. */
  resolve(key: AiProviderKey): ContentAiProvider;
}

// Re-export de cac file cu import ProductContext tu port nay van chay (da chuyen sang product-catalog.port)
export type { ProductContext };
