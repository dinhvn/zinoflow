import type { AiProviderKey, Article, ArticleOutline } from "@zinoflow/contracts";

/**
 * Port cho AI content generation — application layer CHI biet interface nay.
 * Implementations o infrastructure: StubProvider (Day 4), AnthropicProvider (Day 5),
 * OpenAIProvider (M2+). Them provider = them adapter, khong sua use case.
 *
 * Luu y M2: generateArticle se duoc tach thanh expand tung section (retry per-block).
 * Interface giu nguyen — viec tach nam ben trong implementation.
 */

/** Token usage + cost cua 1 lan goi AI — bat buoc tra ve de ghi ai_usage_logs. */
export interface AiCallUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
}

export interface GenerateOutlineInput {
  model: string;
  topic: string;
  siteCode: string;
  keywordSeed: string[];
  toneProfile: string | null;
  /** Du lieu san pham tu CMS cu (M2). Day 4-5: mang rong hoac mock. */
  products: ProductContext[];
}

export interface GenerateArticleInput extends GenerateOutlineInput {
  outline: ArticleOutline;
}

/** Product context toi thieu de AI viet bai — KHONG cho AI tu che thong tin ngoai day. */
export interface ProductContext {
  name: string;
  url: string;
  price: string | null;
  description: string | null;
}

export interface ContentAiProvider {
  readonly key: AiProviderKey | "stub";
  /** Provider co du config de goi that khong (API key trong env). */
  isConfigured(): boolean;
  generateOutline(input: GenerateOutlineInput): Promise<{ outline: ArticleOutline; usage: AiCallUsage }>;
  generateArticle(input: GenerateArticleInput): Promise<{ article: Article; usage: AiCallUsage }>;
}

/** Registry resolve provider theo aiProvider tren job. */
export const AI_PROVIDER_REGISTRY = Symbol("AI_PROVIDER_REGISTRY");

export interface AiProviderRegistry {
  /** Tra ve provider theo key; fallback ve stub (kem warn) neu chua configured. */
  resolve(key: AiProviderKey): ContentAiProvider;
}
