import type { ListDestinationsQuery } from "@zinoflow/contracts";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";
import type { SiteDestinationRow } from "../../domain/destination-mirror";

/**
 * Port repository mirror diem den (Postgres).
 * Implementation: infrastructure/repositories/typeorm-destination-mirror.repository.ts.
 */
export const DESTINATION_MIRROR_REPOSITORY = Symbol("DESTINATION_MIRROR_REPOSITORY");

export interface DestinationMirrorListResult {
  items: DestinationMirrorEntity[];
  total: number;
}

export interface ProvinceOption {
  provinceCode: string;
  name: string;
  shortName: string;
}

export interface DestinationMirrorRepository {
  findAll(): Promise<DestinationMirrorEntity[]>;
  list(query: ListDestinationsQuery): Promise<DestinationMirrorListResult>;
  /** Upsert tu site row; flags ghi de hoan toan (ket qua quyet dinh sync moi nhat) */
  upsertFromSite(row: SiteDestinationRow, flags: string[], syncedAt: Date): Promise<void>;
  /** Danh dau orphan (co o mirror, mat ben site) — khong tu xoa (spec §12.1) */
  setFlags(slug: string, flags: string[]): Promise<void>;
  /** Gan/clear content job dang chay cho diem den (null = clear) */
  setActiveJob(slug: string, jobId: string | null): Promise<void>;
  /** 34 tinh tu admin_provinces (seed dvhcvn) cho form/filter */
  listProvinces(): Promise<ProvinceOption[]>;
}
