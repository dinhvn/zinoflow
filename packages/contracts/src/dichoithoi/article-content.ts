import { z } from "zod/v4";
import { contentSectionSchema } from "../ai-content/article";

/**
 * Bai viet tong hop / cam nang (articleType "cam-nang") — dichoithoi-article-spec.md.
 * Sections co the chua khoi dong `[[block:...]]` tren 1 dong RIENG trong content
 * (compile luc publish thanh HTML that — xem apps/api article module).
 */

export const ARTICLE_FIELD_LIMITS = {
  metaTitle: 145,
  metaDescription: 295,
  searchKeyword: 250,
} as const;

export const articleCamNangMetadataSchema = z.object({
  metaTitle: z.string().min(10).max(ARTICLE_FIELD_LIMITS.metaTitle),
  metaDescription: z.string().min(50).max(ARTICLE_FIELD_LIMITS.metaDescription),
  slugSuggestion: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug chỉ gồm chữ thường, số và dấu gạch ngang"),
  searchKeyword: z.string().min(2).max(ARTICLE_FIELD_LIMITS.searchKeyword),
});

export const articleCamNangFrameSchema = z.object({
  title: z.string().min(10).max(150),
  intro: z.string().min(80),
  metadata: articleCamNangMetadataSchema,
});
export type ArticleCamNangFrame = z.infer<typeof articleCamNangFrameSchema>;

export const articleCamNangSchema = articleCamNangFrameSchema.extend({
  sections: z.array(contentSectionSchema).min(1),
});
export type ArticleCamNang = z.infer<typeof articleCamNangSchema>;

export const articleCamNangOutlineSchema = z.object({
  title: z.string(),
  sectionHeadings: z.array(z.string()).min(1).max(10),
});
export type ArticleCamNangOutline = z.infer<typeof articleCamNangOutlineSchema>;
