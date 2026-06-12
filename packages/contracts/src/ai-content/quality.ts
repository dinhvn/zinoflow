import { z } from "zod/v4";
import { reviewActionSchema } from "./content-draft";

/**
 * Quality gates — spec §9 + §17.5. 4 gate bat buoc truoc khi Approve.
 * Ket qua tung gate luu bang content_quality_results.
 */
export const qualityGateNameSchema = z.enum(["structure", "seo", "policy", "data"]);
export type QualityGateName = z.infer<typeof qualityGateNameSchema>;

export const qualityCheckSchema = z.object({
  gateName: qualityGateNameSchema,
  passed: z.boolean(),
  /** Danh sach loi cu the (tieng Viet, hien thi truc tiep tren UI). Rong neu pass. */
  details: z.array(z.string()),
});
export type QualityCheck = z.infer<typeof qualityCheckSchema>;

export const runQualityChecksResponseSchema = z.object({
  draftId: z.string().uuid(),
  checks: z.array(qualityCheckSchema),
  /** true khi ca 4 gate pass — dieu kien de Approve. */
  allPassed: z.boolean(),
});
export type RunQualityChecksResponse = z.infer<typeof runQualityChecksResponseSchema>;

/** Request review action — spec §7.5. Reject bat buoc note (enforce o use case). */
export const reviewDraftRequestSchema = z.object({
  action: reviewActionSchema,
  note: z.string().max(2000).optional(),
});
export type ReviewDraftRequest = z.infer<typeof reviewDraftRequestSchema>;

/** Sua noi dung draft tu editor — tao version moi, KHONG ghi de version cu. */
export const updateDraftRequestSchema = z.object({
  draftMarkdown: z.string().min(50, "Nội dung bài viết quá ngắn"),
});
export type UpdateDraftRequest = z.infer<typeof updateDraftRequestSchema>;
