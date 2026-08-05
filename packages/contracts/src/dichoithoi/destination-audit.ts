import { z } from "zod/v4";

/**
 * Giai doan 2 (dichoithoi-destination-geocode-audit-plan.md) — bao cao DOC,
 * khong ghi gi. Nguong CHUA duoc chot (quyet dinh 05/08/2026) nen de nguoi
 * dung tu chinh qua query param thay vi hard-code — xem tinh hinh du lieu
 * that roi tu sua tay qua form/panel co san (doi parentSlug, xoa diem trung),
 * chua co co che "Chap nhan hang loat" cho toi khi nguong duoc kiem chung.
 */
export const auditDestinationDuplicatesClusterFitRequestSchema = z.object({
  /** met — mac dinh 150, de nguoi dung tu tang/giam theo du lieu that */
  duplicateThresholdMeters: z.coerce.number().positive().default(150),
  /** cum khac phai gan hon current * ratio moi bi flag — mac dinh 0.5 (gan hon it nhat 2 lan) */
  clusterFitRatio: z.coerce.number().positive().max(1).default(0.5),
});
export type AuditDestinationDuplicatesClusterFitRequest = z.infer<
  typeof auditDestinationDuplicatesClusterFitRequestSchema
>;

export const auditDestinationDuplicatesClusterFitReportSchema = z.object({
  duplicatePairs: z.array(
    z.object({
      clusterSlug: z.string(),
      slugA: z.string(),
      nameA: z.string(),
      slugB: z.string(),
      nameB: z.string(),
      distanceMeters: z.number(),
      nameSimilarity: z.number(),
    }),
  ),
  misclusteredPoints: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      currentParentSlug: z.string(),
      currentDistanceMeters: z.number(),
      suggestedParentSlug: z.string(),
      suggestedParentName: z.string(),
      suggestedDistanceMeters: z.number(),
    }),
  ),
  totalPoiChecked: z.number(),
  totalPoiSkippedNoCoords: z.number(),
});
export type AuditDestinationDuplicatesClusterFitReport = z.infer<
  typeof auditDestinationDuplicatesClusterFitReportSchema
>;
