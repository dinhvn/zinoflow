import { z } from "zod/v4";

/**
 * Dang chung cho moi endpoint "xem truoc prompt" (khong goi AI that) trong khu
 * dichoithoi — Kanban Type/Tag, goi y tag hang loat... (phan hoi nguoi dung
 * 24/07/2026: "cho nao cung co the... xem truoc prompt", 1 dang chung dung lai).
 * "sections" tach rieng system prompt / prompt de FE hien tung khoi <details>,
 * cung UX voi `DestinationPromptPreviewModal` da co cho luong tao bai Article.
 */
export const promptPreviewSectionSchema = z.object({
  title: z.string(),
  text: z.string(),
});
export type PromptPreviewSection = z.infer<typeof promptPreviewSectionSchema>;

export const previewPromptResponseSchema = z.object({
  sections: z.array(promptPreviewSectionSchema),
});
export type PreviewPromptResponse = z.infer<typeof previewPromptResponseSchema>;
