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
  metaTitle: string;
  metaDescription: string;
  /** SiteId cac diem duoc auto-link nhac toi — ghi DestinationRelation (mentioned) */
  mentionedTargetSiteIds: readonly number[];
}

export interface DichoithoiSiteDb {
  /** false khi thieu DICHOITHOI_DB_* trong env — UI hien huong dan cau hinh */
  isConfigured(): boolean;
  /** Doc toan bo diem den tu schema moi (kem content hash de phat hien sua tay) */
  fetchAllDestinations(): Promise<SiteDestinationRow[]>;
  /** Danh sach loai diem den (cho taxonomy form/filter) */
  fetchTypes(): Promise<SiteTypeRow[]>;
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
}
