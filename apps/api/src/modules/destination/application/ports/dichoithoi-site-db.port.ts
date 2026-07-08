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

/** Noi dung hien tai cua 1 diem den tren site — ngu canh cho mode update */
export interface SiteDestinationContent {
  contentHtml: string;
  openingTime: string | null;
  ticketPrice: string | null;
  transport: string | null;
  food: string | null;
  hotel: string | null;
  tip: string | null;
}

/** 1 dong content cho job re-link (spec §12.2) — thao tac tren ContentHtml */
export interface SiteContentRow {
  siteId: number;
  slug: string;
  contentHtml: string;
}

/** Du lieu publish 1 bai diem den (Phase C) — ghi trong 1 transaction, KHONG wipe */
export interface PublishDestinationInput {
  siteId: number;
  /** Duong dan thumbnail tuong doi — giu nguyen gia tri mirror khi publish (§14.3) */
  thumbnail: string | null;
  shortDescription: string;
  searchKeyword: string | null;
  /** HTML hoan chinh: da sanitize + auto-link */
  contentHtml: string;
  openingTime: string;
  ticketPrice: string;
  transport: string;
  food: string;
  hotel: string;
  tip: string;
  /** JSON [{q,a}] — website render FAQ + JSON-LD */
  faqJson: string;
  /** JSON AffiliateLinkItem[] — carry gia tri mirror hien tai vao lan publish (spec affiliate-link §2) */
  ticketLinksJson: string;
  metaTitle: string;
  metaDescription: string;
  /** SiteId cac diem duoc auto-link nhac toi — ghi DestinationRelation (mentioned) */
  mentionedTargetSiteIds: readonly number[];
}

/** Metadata diem den ghi xuong v2.Destination (insert moi hoac update metadata) */
export interface SiteDestinationMeta {
  slug: string;
  kind: "province" | "cluster" | "poi";
  parentSlug: string | null;
  provinceCode: string | null;
  name: string;
  nameUnaccented: string;
  shortDescription: string | null;
  thumbnail: string | null;
  lat: number | null;
  lng: number | null;
  addressNew: string | null;
  addressOld: string | null;
  contactPhone: string | null;
  contactWebsite: string | null;
  hotelGroupId: string | null;
  isFeatured: boolean;
}

/** 1 dong the du de render card (article-spec §5) — dung chung cho khoi destinations/destination */
export interface DestinationCardRow {
  slug: string;
  name: string;
  shortDescription: string | null;
  thumbnail: string | null;
  kind: "province" | "cluster" | "poi";
}

export interface DestinationCardFilter {
  typeSlug?: string;
  provinceSlug?: string;
  parentSlug?: string;
  limit: number;
  sort: "featured" | "newest" | "order";
}

export interface DichoithoiSiteDb {
  /** false khi thieu DICHOITHOI_DB_* trong env — UI hien huong dan cau hinh */
  isConfigured(): boolean;
  /** Doc toan bo diem den tu schema moi (kem content hash de phat hien sua tay) */
  fetchAllDestinations(): Promise<SiteDestinationRow[]>;
  /** Danh sach loai diem den (cho taxonomy form/filter) */
  fetchTypes(): Promise<SiteTypeRow[]>;
  /** Danh sach tinh/thanh (slug+code+name) — validate tham so province=... o khoi dong (article-spec §4) */
  fetchProvinceSlugs(): Promise<Array<{ slug: string; code: string; name: string }>>;
  /** Noi dung hien tai cua 1 diem den (null neu chua co bai) — cho mode update */
  fetchDestinationContent(siteId: number): Promise<SiteDestinationContent | null>;
  /**
   * Publish bai AI: update Destination (ShortDescription, SearchKeyword,
   * ContentSource=1, UpdatedAt) + upsert DestinationContent + thay quan he mentioned.
   * Tra ve contentHash (SHA-256, cung bieu thuc voi fetchAllDestinations) de mirror
   * khong bao "edited-outside" o lan sync sau.
   */
  publishDestination(input: PublishDestinationInput): Promise<{ contentHash: string }>;
  /** Toan bo ContentHtml cua bai published — cho job re-link (spec §12.2) */
  fetchAllContentRows(): Promise<SiteContentRow[]>;
  /** Ghi ContentHtml sau re-link (chi goi voi bai THAY DOI) */
  updateContentHtml(siteId: number, contentHtml: string): Promise<void>;
  /** Them quan he mentioned (bo qua dong da ton tai) — dung trong re-link */
  addMentionedRelations(sourceSiteId: number, targetSiteIds: readonly number[]): Promise<void>;
  /** Map slug-cu -> slug-hien-tai tu SlugRedirect (chuan hoa link, spec §12.2 buoc 4) */
  fetchSlugRedirects(): Promise<Map<string, string>>;
  /** Ghi RelatedJson, CHI khi khac gia tri cu (spec §12.3) — tra ve true neu co ghi */
  updateRelatedJson(siteId: number, relatedJson: string): Promise<boolean>;
  /** Cap nhat rieng cot Thumbnail (metadata — sua truc tiep, khong qua publish) */
  updateThumbnail(siteId: number, thumbnail: string | null): Promise<void>;
  /**
   * Ghi de TicketLinksJson (DestinationContent) — dung khi diem DA co bai (siteId
   * ton tai), khong can publish lai toan bai (affiliate-link-conversion-spec §5).
   */
  updateTicketLinks(siteId: number, ticketLinksJson: string): Promise<void>;
  /** Insert diem den MOI (resolve ParentId/ProvinceId tu slug/code) -> tra ve siteId */
  createDestination(meta: SiteDestinationMeta): Promise<{ siteId: number }>;
  /** Cap nhat metadata diem den da ton tai (khong dong cham content/quan he) */
  updateMetadata(siteId: number, meta: SiteDestinationMeta): Promise<void>;
  /**
   * Card diem den theo bo loc (article-spec §3.1 khoi `destinations`) — CHI diem
   * da published (Status=1). typeSlug khop qua DestinationTypeMap+DestinationType.
   */
  findDestinationCards(filter: DestinationCardFilter): Promise<DestinationCardRow[]>;
  /** 1 diem cu the theo slug (khoi `destination` so it) — null neu khong ton tai/chua publish */
  findDestinationCardBySlug(slug: string): Promise<DestinationCardRow | null>;
}
