import { z } from "zod/v4";

/**
 * Contracts cho man "Backup con lai" (dot lam moi du lieu theo Atlas — GD7
 * plan-lam-moi-du-lieu-atlas.md) — liet ke dong trong bang tam
 * dichoithoi_destinations_backup CHUA duoc khoi phuc vao dau, cho nguoi dung
 * khoi phuc tay (chon cum) hoac bo han. Dieu kien cung: dot lam moi chi coi la
 * XONG khi man nay ve 0 dong.
 */

export const clusterPoiBackupRemainingItemSchema = z.object({
  slug: z.string(),
  name: z.string(),
  kind: z.string(),
  provinceCode: z.string().nullable(),
  hasArticle: z.boolean(),
  hasImages: z.boolean(),
  shortDescription: z.string().nullable(),
});
export type ClusterPoiBackupRemainingItem = z.infer<typeof clusterPoiBackupRemainingItemSchema>;

/** GET /destinations/cluster-poi-backup/remaining */
export const getClusterPoiBackupRemainingResponseSchema = z.object({
  count: z.number().int(),
  items: z.array(clusterPoiBackupRemainingItemSchema),
});
export type GetClusterPoiBackupRemainingResponse = z.infer<
  typeof getClusterPoiBackupRemainingResponseSchema
>;

/** POST /destinations/cluster-poi-backup/:slug/restore */
export const restoreClusterPoiBackupRequestSchema = z.object({
  targetClusterSlug: z.string().min(1).max(64),
});
export type RestoreClusterPoiBackupRequest = z.infer<typeof restoreClusterPoiBackupRequestSchema>;
export const restoreClusterPoiBackupResponseSchema = z.object({ newSlug: z.string() });
export type RestoreClusterPoiBackupResponse = z.infer<typeof restoreClusterPoiBackupResponseSchema>;

/** POST /destinations/cluster-poi-backup/:slug/skip */
export const skipClusterPoiBackupRequestSchema = z.object({
  note: z.string().min(1).max(500),
});
export type SkipClusterPoiBackupRequest = z.infer<typeof skipClusterPoiBackupRequestSchema>;
