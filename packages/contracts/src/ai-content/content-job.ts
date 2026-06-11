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

export const contentSourceTypeSchema = z.enum(["Topic", "Campaign", "ProductSet"]);
export type ContentSourceType = z.infer<typeof contentSourceTypeSchema>;

/** Request tao content job — spec §7.1. */
export const createContentJobRequestSchema = z.object({
  siteCode: z.string().min(1), // vd: "laruki" | "dochoi3s"
  sourceType: contentSourceTypeSchema,
  sourceRef: z.string(),
  topic: z.string().min(5),
  keywordSeed: z.array(z.string()).default([]),
  toneProfile: z.string().optional(),
  /** Optional — default theo SiteProfile neu khong truyen. */
  aiProvider: aiProviderKeySchema.optional(),
  aiModel: z.string().optional(),
});
export type CreateContentJobRequest = z.infer<typeof createContentJobRequestSchema>;

export const contentJobSchema = z.object({
  id: z.string().uuid(),
  siteCode: z.string(),
  sourceType: contentSourceTypeSchema,
  sourceRef: z.string(),
  topic: z.string(),
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
