import type { SiteDestinationRow } from "../../domain/destination-mirror";

/**
 * Port doc/ghi SQL Server cua website dichoithoi (schema MOI — redesign doc §4).
 * Implementation: infrastructure/dichoithoi/mssql-site-db.adapter.ts.
 * Phase A chi can DOC (sync mirror); Phase C them upsert publish.
 */
export const DICHOITHOI_SITE_DB = Symbol("DICHOITHOI_SITE_DB");

export interface SiteTypeRow {
  id: number;
  slug: string;
  name: string;
}

export interface DichoithoiSiteDb {
  /** false khi thieu DICHOITHOI_DB_* trong env — UI hien huong dan cau hinh */
  isConfigured(): boolean;
  /** Doc toan bo diem den tu schema moi (kem content hash de phat hien sua tay) */
  fetchAllDestinations(): Promise<SiteDestinationRow[]>;
  /** Danh sach loai diem den (cho taxonomy form/filter) */
  fetchTypes(): Promise<SiteTypeRow[]>;
}
