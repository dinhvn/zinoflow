import type { ClusterPoiBackupEntity } from "../../infrastructure/entities/cluster-poi-backup.entity";

/**
 * Port doc/ghi bang tam dichoithoi_destinations_backup (dot lam moi du lieu theo
 * Atlas, GD2/GD6/GD7 plan-lam-moi-du-lieu-atlas.md). Bang nay TAM THOI — dropped
 * o GD9. Implementation: infrastructure/repositories/typeorm-cluster-poi-backup.repository.ts.
 */
export const CLUSTER_POI_BACKUP_REPOSITORY = Symbol("CLUSTER_POI_BACKUP_REPOSITORY");

export interface ClusterPoiBackupRepository {
  /** Ton tai bang backup khong (GD9 co the da DROP) — false thi cac ham khac tra rong. */
  tableExists(): Promise<boolean>;
  /** Chi cac dong CUNG tinh + CHUA khoi phuc (restored_to_slug IS NULL) — dung cho fuzzy-match GD6. */
  findUnrestoredByProvince(provinceCode: string | null): Promise<ClusterPoiBackupEntity[]>;
  findBySlug(slug: string): Promise<ClusterPoiBackupEntity | null>;
  /** Man "Backup con lai" (GD7) — toan bo dong chua xu ly, khong loc tinh. */
  findAllUnrestored(): Promise<ClusterPoiBackupEntity[]>;
  countUnrestored(): Promise<number>;
  markRestored(slug: string, restoredToSlug: string): Promise<void>;
  markSkipped(slug: string, note: string): Promise<void>;
}
