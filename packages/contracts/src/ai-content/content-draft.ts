import { z } from "zod/v4";
import { articleSchema } from "./article";
import { destinationArticleSchema } from "../dichoithoi/destination-article";
import { articleCamNangSchema } from "../dichoithoi/article-content";
import { cmsArticleSchema } from "../khuyenmai/cms-article";
import { reviewActionSchema } from "./review-action";

/**
 * Outline toi thieu chung cho moi loai bai (toplist/review co them plannedProducts,
 * guide-diem-den thi khong) — UI chi can title + headings.
 */
export const draftOutlineSchema = z
  .object({
    title: z.string(),
    sectionHeadings: z.array(z.string()),
  })
  .loose();

/** Bai viet cua bat ky loai nao — phan biet qua job.articleType. */
export const draftArticleSchema = z.union([
  articleSchema,
  destinationArticleSchema,
  articleCamNangSchema,
  cmsArticleSchema,
]);
export type DraftArticle = z.infer<typeof draftArticleSchema>;

/**
 * Content draft — spec §4.1 ContentDraft.
 * Moi lan sua noi dung sau khi Approved se tao version moi (spec §5).
 */
export const contentDraftSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  version: z.number().int().min(1),
  title: z.string().nullable(),
  outline: draftOutlineSchema.nullable(),
  /** Bai viet structured (8-block hoac destination article) — nguon render markdown/HTML. */
  article: draftArticleSchema.nullable(),
  draftMarkdown: z.string().nullable(),
  qualityScore: z.number().min(0).max(100).nullable(),
  createdAt: z.string().datetime(),
});
export type ContentDraft = z.infer<typeof contentDraftSchema>;

export const reviewRecordSchema = z.object({
  id: z.string().uuid(),
  draftId: z.string().uuid(),
  action: reviewActionSchema,
  /** Reject bat buoc co reason (enforce o domain layer). */
  note: z.string().nullable(),
  actor: z.string(),
  createdAt: z.string().datetime(),
});
export type ReviewRecord = z.infer<typeof reviewRecordSchema>;

/** Prompt template luu DB + version — spec §4.1 PromptTemplate. */
export const promptTemplateSchema = z.object({
  id: z.string().uuid(),
  templateKey: z.string(), // vd: "toplist.outline.vi"
  version: z.number().int().min(1),
  content: z.string(),
  isActive: z.boolean(),
});
export type PromptTemplate = z.infer<typeof promptTemplateSchema>;
