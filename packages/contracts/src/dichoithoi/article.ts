import { z } from "zod/v4";

/**
 * Contracts cho bang Article (SQL Server, moi hoan toan) + report compile khoi
 * dong. Spec: dichoithoi-article-spec.md §8-9.
 */

export const articleSiteRecordSchema = z.object({
  siteId: z.number().int().nullable(),
  slug: z.string().max(128),
  title: z.string().max(200),
  shortDescription: z.string().max(500).nullable(),
  thumbnail: z.string().max(256).nullable(),
  metaTitle: z.string().max(150).nullable(),
  metaDescription: z.string().max(300).nullable(),
  status: z.number().int().min(0).max(2),
  publishedAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type ArticleSiteRecord = z.infer<typeof articleSiteRecordSchema>;

/** 1 canh bao token trong bai (0 ket qua, hoac thieu H2/H3 ngay tren) — khong chan publish tru loi cu phap/tham so */
export const articleBlockWarningSchema = z.object({
  raw: z.string(),
  message: z.string(),
});
export type ArticleBlockWarning = z.infer<typeof articleBlockWarningSchema>;

/** Loi token — CHAN publish (cu phap sai / tham so khong ton tai trong mirror) */
export const articleBlockErrorSchema = z.object({
  raw: z.string(),
  message: z.string(),
});
export type ArticleBlockError = z.infer<typeof articleBlockErrorSchema>;

export const compileArticleReportSchema = z.object({
  html: z.string(),
  errors: z.array(articleBlockErrorSchema),
  warnings: z.array(articleBlockWarningSchema),
  blockCount: z.number().int(),
});
export type CompileArticleReport = z.infer<typeof compileArticleReportSchema>;

export const publishArticleResultSchema = z.object({
  jobId: z.string().uuid(),
  slug: z.string(),
  siteId: z.number().int(),
  blockCount: z.number().int(),
  warnings: z.array(articleBlockWarningSchema),
  durationMs: z.number().int(),
});
export type PublishArticleResult = z.infer<typeof publishArticleResultSchema>;

/** "Làm mới khối động" — khong AI, khong qua review lai (spec §7) */
export const refreshDynamicBlocksResultSchema = z.object({
  jobId: z.string().uuid(),
  slug: z.string(),
  blockCount: z.number().int(),
  warnings: z.array(articleBlockWarningSchema),
});
export type RefreshDynamicBlocksResult = z.infer<typeof refreshDynamicBlocksResultSchema>;

export const refreshAllDynamicBlocksReportSchema = z.object({
  totalChecked: z.number().int(),
  totalRefreshed: z.number().int(),
  failures: z.array(z.object({ jobId: z.string(), slug: z.string(), message: z.string() })),
  durationMs: z.number().int(),
});
export type RefreshAllDynamicBlocksReport = z.infer<typeof refreshAllDynamicBlocksReportSchema>;
