import { z } from "zod/v4";

/**
 * Trich xuat thong tin nguon cho bai cam nang TRUOC khi AI viet — khac han
 * dichoithoi_destination_ai_extractions (gan theo destination_slug, field co
 * dinh dia chi/SDT...): bai cam nang khong co field co dinh, chi can 1 doan
 * tong hop tu do (article-ai-extraction-plan.md GĐ2, chot 31/07/2026 —
 * "trich xuat thong tin co ich, bo vao 1 field la duoc").
 */
export const articleAiExtractionSourceSchema = z.enum(["claude-skill", "gemini-gsg"]);
export type ArticleAiExtractionSource = z.infer<typeof articleAiExtractionSourceSchema>;

export const articleAiExtractionSchema = z.object({
  jobId: z.string().uuid(),
  source: articleAiExtractionSourceSchema,
  sourceUrls: z.array(z.string()),
  extractedSummary: z.string(),
  extractedAt: z.string().datetime(),
});
export type ArticleAiExtraction = z.infer<typeof articleAiExtractionSchema>;

export const listArticleAiExtractionsResponseSchema = z.object({
  items: z.array(articleAiExtractionSchema),
});
export type ListArticleAiExtractionsResponse = z.infer<
  typeof listArticleAiExtractionsResponseSchema
>;
