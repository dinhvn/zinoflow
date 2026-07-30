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
  /** Trace rollout; provider bo qua, usage recorder persist de audit output. */
  promptTrace?: {
    key: string;
    version: number | null;
    source: "db" | "default";
    sourceContextHash: string | null;
  };
  vars: Readonly<Record<string, unknown>>;
  /**
   * CHI Gemini doc field nay — Anthropic (Opus 4.8) cam truyen temperature/top_p/
   * top_k (spec §5), provider Anthropic bo qua hoan toan. Khong set = de SDK Gemini
   * tu default, KHONG ngam dinh 1 gia tri co dinh trong provider (moi use case phai
   * tu chon tuong minh theo tac vu — vd 0.1 cho trich xuat GSG, 0.5-0.6 cho viet bai).
   */
  temperature?: number;
  /**
   * CHI Gemini doc field nay — bat Google Search Grounding (`tools:[{google_search:{}}]`).
   * Dung cho nhanh trich xuat GSG (dichoithoi-destination-ai-extraction-plan §6 B2);
   * KHONG dung cho pipeline viet bai (sourceContext da co du du lieu that, khong can
   * search them). Anthropic/OpenAI bo qua field nay.
   */
  useGoogleSearch?: boolean;
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
