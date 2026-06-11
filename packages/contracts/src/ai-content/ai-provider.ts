import { z } from "zod/v4";

/**
 * Cac AI provider he thong ho tro. Them provider moi = them key o day
 * + 1 adapter o apps/api infrastructure (khong sua core flow).
 */
export const aiProviderKeySchema = z.enum(["anthropic", "openai", "gemini"]);
export type AiProviderKey = z.infer<typeof aiProviderKeySchema>;

/** Thong tin 1 model de UI render dropdown chon model khi tao content. */
export const aiModelInfoSchema = z.object({
  id: z.string(), // model id chinh xac, vd: "claude-opus-4-8"
  displayName: z.string(),
  /** Phan loai de UI goi y: bai dai/kho dung "quality", task nhe dung "light". */
  tier: z.enum(["quality", "balanced", "light"]),
  costNote: z.string().optional(), // vd: "$5/$25 per 1M tokens"
});
export type AiModelInfo = z.infer<typeof aiModelInfoSchema>;

export const aiProviderInfoSchema = z.object({
  key: aiProviderKeySchema,
  displayName: z.string(),
  models: z.array(aiModelInfoSchema),
  /** Provider co san API key trong env hay khong (UI disable neu false). */
  isConfigured: z.boolean(),
});
export type AiProviderInfo = z.infer<typeof aiProviderInfoSchema>;

export const listAiProvidersResponseSchema = z.object({
  providers: z.array(aiProviderInfoSchema),
});
export type ListAiProvidersResponse = z.infer<typeof listAiProvidersResponseSchema>;
