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

/** Metadata tao/sua 1 diem den trong mirror (khong dong cham content/job/sync) */
export interface DestinationMetadataInput {
  name: string;
  kind: string;
  parentSlug: string | null;
  provinceCode: string | null;
  shortDescription: string | null;
  thumbnail: string | null;
  lat: number | null;
  lng: number | null;
  addressNew: string | null;
  addressOld: string | null;
  contactPhone: string | null;
  contactWebsite: string | null;
  bookingUrl: string | null;
  hotelGroupId: string | null;
  isFeatured: boolean;
}

export interface DestinationMirrorRepository {
  findAll(): Promise<DestinationMirrorEntity[]>;
  findBySlug(slug: string): Promise<DestinationMirrorEntity | null>;
  list(query: ListDestinationsQuery): Promise<DestinationMirrorListResult>;
  /** Tao diem den moi trong AI tool (siteId=null cho toi khi publish) */
  createLocal(slug: string, meta: DestinationMetadataInput): Promise<void>;
  /** Sua metadata (giu nguyen siteId/content/job/sync) */
  updateMetadata(slug: string, meta: DestinationMetadataInput): Promise<void>;
  /** Upsert tu site row; flags ghi de hoan toan (ket qua quyet dinh sync moi nhat) */
  upsertFromSite(row: SiteDestinationRow, flags: string[], syncedAt: Date): Promise<void>;
  /** Danh dau orphan (co o mirror, mat ben site) — khong tu xoa (spec §12.1) */
  setFlags(slug: string, flags: string[]): Promise<void>;
  /** Gan/clear content job dang chay cho diem den (null = clear) */
  setActiveJob(slug: string, jobId: string | null): Promise<void>;
  /** Gan siteId sau khi insert diem moi xuong SQL Server (publish lan dau) */
  setSiteId(slug: string, siteId: number): Promise<void>;
  /** Cap nhat duong dan thumbnail (spec §14.3) */
  setThumbnail(slug: string, thumbnail: string | null): Promise<void>;
  /**
   * Ghi nhan publish thanh cong: contentSource=1, contentHash moi (de lan sync
   * sau khong bao edited-outside), clear activeContentJobId + hasLocalChanges.
   */
  markPublished(slug: string, contentHash: string): Promise<void>;
  /** 34 tinh tu admin_provinces (seed dvhcvn) cho form/filter */
  listProvinces(): Promise<ProvinceOption[]>;
}

/**
 * Port quan he diem den ben Postgres (nguon su that quan he — spec §3.7).
 * Dong bo xuong SQL Server (DestinationRelation) khi publish/re-link.
 */
export const DESTINATION_RELATION_REPOSITORY = Symbol("DESTINATION_RELATION_REPOSITORY");

export interface RelationRecord {
  sourceSlug: string;
  targetSlug: string;
  relationType: "nearby" | "related" | "mentioned";
  weight: number;
  isAuto: boolean;
}

export interface DestinationRelationRepository {
  /** Thay toan bo quan he mentioned AUTO cua 1 nguon (publish ghi de moi lan) */
  replaceMentioned(sourceSlug: string, targetSlugs: readonly string[]): Promise<void>;
  /** Them mentioned neu chua co (re-link — khong dong cham dong manual) */
  addMentioned(sourceSlug: string, targetSlugs: readonly string[]): Promise<void>;
  /** Quan he related curated cua 1 nguon, sort weight giam dan (builder RelatedJson) */
  findCuratedRelated(sourceSlug: string): Promise<RelationRecord[]>;
  /** Moi diem co quan he toi target — xac dinh bai BI ANH HUONG sau publish (spec §12.3) */
  findSourcesLinkingTo(targetSlug: string): Promise<string[]>;
}
