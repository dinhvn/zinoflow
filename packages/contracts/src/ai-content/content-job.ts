import { z } from "zod/v4";
import { aiProviderKeySchema } from "./ai-provider";

/**
 * Trang thai content job — state machine theo spec §5.
 * Transition rules nam o domain layer (apps/api), khong nam o day.
 */
export const contentJobStatusSchema = z.enum([
  "Created",
  "GeneratingOutline",
  "DraftReady",
  "InReview",
  "Approved",
  "Rejected",
  "Failed",
]);
export type ContentJobStatus = z.infer<typeof contentJobStatusSchema>;

/**
 * Manual = tao draft KHONG qua AI (viet tay tu dau) — mo rong 07/2026, xem
 * dichoithoi-article-spec.md §1.1. Job Manual di thang Created -> DraftReady,
 * khong enqueue pg-boss, khong goi AI provider (content-job-state.ts).
 */
export const contentSourceTypeSchema = z.enum(["Topic", "Campaign", "ProductSet", "Manual"]);
export type ContentSourceType = z.infer<typeof contentSourceTypeSchema>;

/**
 * Loai bai viet — quyet dinh prompt pack + output schema su dung (spec §17.2 + §19.3).
 * toplist/review: bai affiliate 8-block. guide-diem-den: bai diem den dichoithoi.
 * km-<postType>: bai CMS khuyenmai laruki/dochoi3s (schema cms-article.ts, prompt theo
 * site x postType — resolve trong prompt-builder).
 */
export const KNOWN_ARTICLE_TYPES = ["toplist", "review", "guide-diem-den", "cam-nang"] as const;
export const articleTypeSchema = z.union([
  z.enum(KNOWN_ARTICLE_TYPES),
  z.string().regex(/^km-[a-z0-9-]+$/, "articleType khuyenmai phải dạng km-<slug>"),
]);
export type ArticleType = z.infer<typeof articleTypeSchema>;

/** Request tao content job — spec §7.1. */
export const createContentJobRequestSchema = z.object({
  siteCode: z.string().min(1), // vd: "laruki" | "dochoi3s"
  sourceType: contentSourceTypeSchema,
  sourceRef: z.string(),
  topic: z.string().min(5),
  /** Optional — default "toplist" de tuong thich voi client cu. */
  articleType: articleTypeSchema.default("toplist"),
  keywordSeed: z.array(z.string()).default([]),
  toneProfile: z.string().optional(),
  /**
   * Ngu canh nguon cho prompt (du lieu diem den, content cu khi update...).
   * AI CHI duoc dung thong tin trong day + kien thuc nen, khong tu che so lieu.
   */
  sourceContext: z.string().max(60_000).optional(),
  /** Optional — default theo SiteProfile neu khong truyen. */
  aiProvider: aiProviderKeySchema.optional(),
  aiModel: z.string().optional(),
});
export type CreateContentJobRequest = z.infer<typeof createContentJobRequestSchema>;

/**
 * Request sua tham so sinh bai cua 1 job (topic/keyword/provider/model/tone)
 * truoc khi generate lai — chi hop le khi job o Failed hoac DraftReady (state machine §5).
 * Tat ca field optional: chi field nao gui len moi bi ghi de.
 */
export const updateContentJobRequestSchema = z
  .object({
    topic: z.string().min(5),
    keywordSeed: z.array(z.string()),
    toneProfile: z.string().nullable(),
    aiProvider: aiProviderKeySchema,
    aiModel: z.string().min(1),
  })
  .partial();
export type UpdateContentJobRequest = z.infer<typeof updateContentJobRequestSchema>;

export const contentJobSchema = z.object({
  id: z.string().uuid(),
  siteCode: z.string(),
  sourceType: contentSourceTypeSchema,
  sourceRef: z.string(),
  topic: z.string(),
  articleType: articleTypeSchema,
  keywordSeed: z.array(z.string()),
  status: contentJobStatusSchema,
  aiProvider: aiProviderKeySchema,
  aiModel: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ContentJob = z.infer<typeof contentJobSchema>;

export const createContentJobResponseSchema = z.object({
  jobId: z.string().uuid(),
  status: contentJobStatusSchema,
});
export type CreateContentJobResponse = z.infer<typeof createContentJobResponseSchema>;

/**
 * Tao draft VIET TAY (khong qua AI) — dichoithoi-article-spec.md §1.1.
 * Tra ve ngay DraftReady voi 1 khung bai goi y cau truc (nguoi dung sua tiep
 * qua man edit thong thuong — khong co duong tat bo qua quality gate/review).
 */
export const createManualDraftRequestSchema = z.object({
  siteCode: z.string().min(1),
  sourceRef: z.string(),
  topic: z.string().min(5),
  articleType: articleTypeSchema.default("toplist"),
  keywordSeed: z.array(z.string()).default([]),
  sourceContext: z.string().max(60_000).optional(),
});
export type CreateManualDraftRequest = z.infer<typeof createManualDraftRequestSchema>;
