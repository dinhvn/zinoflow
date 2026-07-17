import type {
  AddressMapping,
  AddressMappingsQuery,
  AffiliateLinkItem,
  DestinationOpeningHours,
  ExternalReviewUrlItem,
  GalleryItem,
  ListDestinationsQuery,
  PracticalNoteItem,
  PriceBreakdownItem,
} from "@zinoflow/contracts";
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
  /** Toa do — CACHE tu tinh tu googleMapsUrl, khong con nhap tay */
  lat: number | null;
  lng: number | null;
  googleMapsUrl: string | null;
  addressNew: string | null;
  addressOld: string | null;
  contactPhone: string | null;
  contactWebsite: string | null;
  hotelGroupId: string | null;
  priority: number;
  contentTier: "flagship" | "standard" | null;
}

export interface DestinationMirrorRepository {
  findAll(): Promise<DestinationMirrorEntity[]>;
  findBySlug(slug: string): Promise<DestinationMirrorEntity | null>;
  list(query: ListDestinationsQuery): Promise<DestinationMirrorListResult>;
  /** Nhu list() nhung tra ve TOAN BO ket qua khop filter, khong cat trang (export CSV) */
  listAllMatching(
    query: Omit<ListDestinationsQuery, "page" | "limit">,
  ): Promise<DestinationMirrorEntity[]>;
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
   * Doi slug 1 diem den (Phase 24 chieu ghi) — cascade TRONG 1 transaction:
   * dichoithoi_destinations.slug + parent_slug cua con, dichoithoi_destination_relations
   * (source/target_slug), hotel_destination_map/tour_destination_map.destination_slug,
   * products.tags. Cac bang do Hotel/Tour/Product module "so huu" nhung KHONG co FK
   * (chuoi tu do) — cham thang o day de tranh circular dependency module (xem plan).
   */
  renameSlug(oldSlug: string, newSlug: string): Promise<void>;
  /** Cap nhat danh sach link mua ve (affiliateUrl da tinh san — spec affiliate-link §2) */
  setTicketLinks(slug: string, ticketLinks: readonly AffiliateLinkItem[]): Promise<void>;
  /** Cap nhat gia ve theo doi tuong — nhap tay hoan toan (content-seo-ux-plan §5.5a) */
  setPriceBreakdown(slug: string, priceBreakdown: readonly PriceBreakdownItem[]): Promise<void>;
  /** Cap nhat khoi luu y thuc te — sau khi nguoi dung duyet (content-seo-ux-plan §5.7) */
  setPracticalNotes(slug: string, practicalNotes: readonly PracticalNoteItem[]): Promise<void>;
  /** Cap nhat danh gia bien tap — sau khi nguoi dung duyet ban AI goi y (Phase 28.0) */
  setEditorialReview(slug: string, editorialReview: string | null): Promise<void>;
  setMetaTitle(slug: string, metaTitle: string | null): Promise<void>;
  /** Cap nhat link Google Maps/TripAdvisor... nhap tay (Phase 28.0) */
  setExternalReviewUrls(
    slug: string,
    externalReviewUrls: readonly ExternalReviewUrlItem[],
  ): Promise<void>;
  /** Ghi de nguyen mang thu vien anh (them/xoa/sua/doi thu tu deu qua day) */
  setGallery(slug: string, gallery: readonly GalleryItem[]): Promise<void>;
  /** Luu thong tin nguoi dung cung cap cho AI (ghi chu + URL nguon) — tai dung lan sau */
  saveAiInputs(
    slug: string,
    notes: string | null,
    referenceUrls: Array<{ label: string; url: string }>,
  ): Promise<void>;
  /**
   * Ghi nhan publish thanh cong: contentSource=1, contentHash moi (de lan sync
   * sau khong bao edited-outside), clear activeContentJobId + hasLocalChanges.
   */
  markPublished(slug: string, contentHash: string): Promise<void>;
  /** Luu ban nhap bai viet (raw, chua validate) — pivot gop editor vao trang detail. */
  setDraftArticle(slug: string, draftArticle: Record<string, unknown>): Promise<void>;
  /** Ghi de gio mo cua chuan hoa (dichoithoi-destination-ai-extraction-plan §2.2) */
  setOpeningHours(slug: string, openingHours: DestinationOpeningHours | null): Promise<void>;
  /** Ghi de tom tat nguon tham khao + cap nhat thoi diem (dichoithoi-destination-ai-extraction-plan §2.2) */
  setAiReferenceSummary(slug: string, summary: string | null): Promise<void>;
  /** 34 tinh tu admin_provinces (seed dvhcvn) cho form/filter */
  listProvinces(): Promise<ProvinceOption[]>;
  /** Tra cuu dia chi cu->moi (admin_ward_mappings) — phan trang + loc */
  listAddressMappings(query: AddressMappingsQuery): Promise<AddressMappingsListResult>;
  /** Danh sach ten tinh/thanh phan biet (cu va moi) cho bo loc tra cuu */
  listAddressMappingProvinces(): Promise<{ oldProvinces: string[]; newProvinces: string[] }>;
}

export interface AddressMappingsListResult {
  items: AddressMapping[];
  total: number;
}

/**
 * Port quan he diem den ben Postgres (nguon su that quan he — spec §3.7).
 * Dong bo xuong SQL Server (DestinationRelation) khi publish/re-link.
 */
export const DESTINATION_RELATION_REPOSITORY = Symbol("DESTINATION_RELATION_REPOSITORY");

export interface RelationRecord {
  sourceSlug: string;
  targetSlug: string;
  relationType: "nearby" | "related" | "mentioned" | "excluded";
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
  /** TOAN BO quan he related curated (khong loc theo nguon) — ve duong noi tren ban do (C4) */
  findAllCuratedRelated(): Promise<RelationRecord[]>;
  /** Ghi 1 quan he curated (idempotent — da co thi bo qua). Goi 2 lan (2 chieu) tu UI ban do. */
  addCuratedRelated(sourceSlug: string, targetSlug: string, weight?: number): Promise<void>;
  /** Xoa 1 quan he curated */
  removeCuratedRelated(sourceSlug: string, targetSlug: string): Promise<void>;
  /** Moi diem co quan he toi target — xac dinh bai BI ANH HUONG sau publish (spec §12.3) */
  findSourcesLinkingTo(targetSlug: string): Promise<string[]>;
  /**
   * Slug cac diem bi LOAI TRU khoi goi y cua 1 nguon (relations-plan §5.7 muc 3) —
   * dung khi thuat toan cham diem (C2) tu chon sai, admin loai bo tay TREN BAN DO
   * (C4). Loc TRUOC khi cham diem, bat ke diem do le ra duoc diem cao the nao.
   */
  findExcluded(sourceSlug: string): Promise<string[]>;
  /** Ghi 1 quan he excluded (idempotent — da co thi bo qua) */
  addExcluded(sourceSlug: string, targetSlug: string): Promise<void>;
  /** Xoa 1 quan he excluded (vd admin doi y, muon goi y lai binh thuong) */
  removeExcluded(sourceSlug: string, targetSlug: string): Promise<void>;
}
