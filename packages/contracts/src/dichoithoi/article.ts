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

/** 1 diem den duoc auto-link nhac toi trong bai (article-spec §3.4/§8.1) */
export const articleAddedLinkSchema = z.object({
  targetSlug: z.string(),
  targetName: z.string(),
});
export type ArticleAddedLink = z.infer<typeof articleAddedLinkSchema>;

export const publishArticleResultSchema = z.object({
  jobId: z.string().uuid(),
  slug: z.string(),
  siteId: z.number().int(),
  blockCount: z.number().int(),
  warnings: z.array(articleBlockWarningSchema),
  durationMs: z.number().int(),
  /** Diem den auto-link nhac trong bai — nguon goi y gan ArticleDestinationMap (§8.1) */
  addedLinks: z.array(articleAddedLinkSchema),
});
export type PublishArticleResult = z.infer<typeof publishArticleResultSchema>;

/**
 * Quan he NGUOC Article -> Destination (article-spec §8.1, Phase 26 — nen
 * tang): trang diem den can biet co bai cam nang nao viet ve minh de hien
 * link ra. Gan tay/tick xac nhan tu goi y auto-link, khong tu dong hoan toan.
 */
export const articleTopicSchema = z.enum([
  "itinerary",
  "food",
  "souvenir",
  "nightlife",
  "poi-guide",
  "tour",
  "ticket",
  "transport",
  "general",
]);
export type ArticleTopic = z.infer<typeof articleTopicSchema>;

/**
 * Danh muc bai cam nang — gan truc tiep tren bai (KHAC voi articleTopicSchema
 * o tren, von gan theo tung cap bai-diem-den). Dung cho trang hub
 * /cam-nang/danh-muc/{slug} + loc/lien ket bai lien quan
 * (dichoithoi-camnang-affiliate-overflow-plan.md, chot 31/07/2026).
 */
export const articleCategorySchema = z.enum([
  "kinh-nghiem",
  "lich-trinh",
  "di-chuyen",
  "an-uong",
  "luu-tru",
  "diem-tham-quan-vui-choi",
  "mua-sam",
]);
export type ArticleCategory = z.infer<typeof articleCategorySchema>;

export const setArticleCategoryRequestSchema = z.object({
  category: articleCategorySchema.nullable(),
});
export type SetArticleCategoryRequest = z.infer<typeof setArticleCategoryRequestSchema>;

export const articleDestinationMapItemSchema = z.object({
  destinationSlug: z.string().min(1).max(64),
  destinationName: z.string(),
  topic: articleTopicSchema,
  order: z.number().int().default(0),
});
export type ArticleDestinationMapItem = z.infer<typeof articleDestinationMapItemSchema>;

export const saveArticleDestinationMapRequestSchema = z.object({
  items: z.array(
    z.object({
      destinationSlug: z.string().min(1).max(64),
      topic: articleTopicSchema,
      order: z.number().int().default(0),
    }),
  ),
});
export type SaveArticleDestinationMapRequest = z.infer<
  typeof saveArticleDestinationMapRequestSchema
>;

export const articleDestinationMapResponseSchema = z.object({
  items: z.array(articleDestinationMapItemSchema),
});
export type ArticleDestinationMapResponse = z.infer<typeof articleDestinationMapResponseSchema>;

/** "Làm mới khối động" — khong AI, khong qua review lai (spec §7) */
export const refreshDynamicBlocksResultSchema = z.object({
  jobId: z.string().uuid(),
  slug: z.string(),
  blockCount: z.number().int(),
  warnings: z.array(articleBlockWarningSchema),
});
export type RefreshDynamicBlocksResult = z.infer<typeof refreshDynamicBlocksResultSchema>;

/**
 * Xem truoc HTML se ghi luc Publish (dry-run, KHONG ghi SQL Server) — resolve
 * DUNG khoi dong + auto-link nhu Publish that, de nguoi duyet thay dung noi
 * dung se len web TRUOC khi Approve/Publish (article-workflow-plan.md muc 2).
 */
export const previewArticleResultSchema = z.object({
  jobId: z.string().uuid(),
  html: z.string(),
  blockCount: z.number().int(),
  warnings: z.array(articleBlockWarningSchema),
  errors: z.array(articleBlockErrorSchema),
  addedLinks: z.array(articleAddedLinkSchema),
});
export type PreviewArticleResult = z.infer<typeof previewArticleResultSchema>;

export const refreshAllDynamicBlocksReportSchema = z.object({
  totalChecked: z.number().int(),
  totalRefreshed: z.number().int(),
  failures: z.array(z.object({ jobId: z.string(), slug: z.string(), message: z.string() })),
  durationMs: z.number().int(),
});
export type RefreshAllDynamicBlocksReport = z.infer<typeof refreshAllDynamicBlocksReportSchema>;
