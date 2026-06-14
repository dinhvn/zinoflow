import { z } from "zod/v4";
import { contentSectionSchema } from "../ai-content/article";

/**
 * Output AI cho 1 bai viet CMS khuyenmai (laruki/dochoi3s) — DUY NHAT 1 content.
 * Tag [Type_Param:value] nam INLINE trong section.content; AI goi y + giu nguyen tag
 * khi viet lai (phuong an Y). Render -> 1 HTML ghi vao WordpressPost.FixedContent.
 * Spec: docs/specs/laruki-dochoi3s-content-spec §2.
 */

/** Frame = toan bai TRU sections (buoc 3 pipeline) */
export const cmsArticleFrameSchema = z.object({
  title: z.string().min(10).max(128),
  /** Mo ta ngan -> WordpressPost.Excerpt (<=512) */
  excerpt: z.string().min(20).max(500),
});
export type CmsArticleFrame = z.infer<typeof cmsArticleFrameSchema>;

/** Bai hoan chinh = frame + sections (HTML/markdown van xuoi + tag inline) */
export const cmsArticleSchema = cmsArticleFrameSchema.extend({
  sections: z.array(contentSectionSchema).min(2),
});
export type CmsArticle = z.infer<typeof cmsArticleSchema>;

/** Outline buoc 1 */
export const cmsOutlineSchema = z.object({
  title: z.string(),
  sectionHeadings: z.array(z.string()).min(2).max(10),
});
export type CmsOutline = z.infer<typeof cmsOutlineSchema>;

const referenceUrlSchema = z.object({
  label: z.string().min(1).max(64),
  url: z.string().url(),
});

/** POST /cms/posts/:cmsId/jobs — tao job AI cho 1 bai */
export const createCmsJobRequestSchema = z.object({
  mode: z.enum(["create", "update"]),
  userNotes: z.string().optional(),
  referenceUrls: z.array(referenceUrlSchema).max(5).optional(),
  /** Thong tin tag nguoi dung cung cap truoc de AI goi y dat tag hop ly */
  tagHints: z.string().optional(),
  aiProvider: z.string().optional(),
  aiModel: z.string().optional(),
});
export type CreateCmsJobRequest = z.infer<typeof createCmsJobRequestSchema>;

export const createCmsJobResponseSchema = z.object({
  jobId: z.string(),
  status: z.string(),
});
export type CreateCmsJobResponse = z.infer<typeof createCmsJobResponseSchema>;

/** POST /cms/posts/:cmsId/ai-inputs — luu thong tin cho AI ma chua tao bai */
export const saveCmsAiInputsRequestSchema = z.object({
  userNotes: z.string().optional(),
  referenceUrls: z.array(referenceUrlSchema).max(5).optional(),
  tagHints: z.string().optional(),
});
export type SaveCmsAiInputsRequest = z.infer<typeof saveCmsAiInputsRequestSchema>;
