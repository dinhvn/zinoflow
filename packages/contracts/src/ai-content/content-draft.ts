import { z } from "zod";
import { articleOutlineSchema, articleSchema } from "./article";

/**
 * Content draft — spec §4.1 ContentDraft.
 * Moi lan sua noi dung sau khi Approved se tao version moi (spec §5).
 */
export const contentDraftSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  version: z.number().int().min(1),
  title: z.string().nullable(),
  outline: articleOutlineSchema.nullable(),
  /** Bai viet structured theo 8-block framework — nguon de render markdown/HTML. */
  article: articleSchema.nullable(),
  draftMarkdown: z.string().nullable(),
  qualityScore: z.number().min(0).max(100).nullable(),
  createdAt: z.string().datetime(),
});
export type ContentDraft = z.infer<typeof contentDraftSchema>;

/** Hanh dong review — spec §4.1 ReviewRecord. */
export const reviewActionSchema = z.enum(["Approve", "RequestChange", "Reject"]);
export type ReviewAction = z.infer<typeof reviewActionSchema>;

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
