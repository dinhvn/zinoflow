import { z } from "zod/v4";
import { reviewActionSchema } from "./content-draft";

/**
 * Quality gates — spec §9 + §17.5. 4 gate bat buoc truoc khi Approve.
 * Ket qua tung gate luu bang content_quality_results.
 */
export const qualityGateNameSchema = z.enum(["structure", "seo", "policy", "data", "originality"]);
export type QualityGateName = z.infer<typeof qualityGateNameSchema>;

/**
 * error = chan cung Approve (assertAllGatesPass) — hanh vi mac dinh, dung cho
 * 4 gate cu. warning = chi hien canh bao, KHONG chan Approve — dung rieng cho
 * gate "originality" (chong trung lap noi bo, phat hien 07/2026): similarity
 * cao giua 2 bai co the la false-positive (cung tinh/loai tu nhien dung chung
 * tu vung dia ly), nen de nguoi duyet tu quyet dinh thay vi chan cung nhu loi
 * du lieu/cau truc that.
 */
export const qualityCheckSeveritySchema = z.enum(["error", "warning"]);
export type QualityCheckSeverity = z.infer<typeof qualityCheckSeveritySchema>;

export const qualityCheckSchema = z.object({
  gateName: qualityGateNameSchema,
  passed: z.boolean(),
  /** Danh sach loi cu the (tieng Viet, hien thi truc tiep tren UI). Rong neu pass. */
  details: z.array(z.string()),
  severity: qualityCheckSeveritySchema.default("error"),
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

/**
 * Sua noi dung draft tu editor — tao version moi, KHONG ghi de version cu.
 * Union 2 nhanh (redesign luong viet bai §Phase 2):
 * - draftMarkdown: hanh vi CU — dung cho cam-nang/affiliate/km-* (textarea markdown tho).
 * - article: hanh vi MOI — dung cho guide-diem-den (editor field-based); server validate
 *   bang schema cua articleType tuong ung roi tu render lai draftMarkdown, tranh lech
 *   du lieu giua article JSON (nguon publish that) va markdown (chi de preview).
 */
export const updateDraftRequestSchema = z.union([
  z.object({ draftMarkdown: z.string().min(50, "Nội dung bài viết quá ngắn") }),
  z.object({ article: z.record(z.string(), z.unknown()) }),
]);
export type UpdateDraftRequest = z.infer<typeof updateDraftRequestSchema>;
