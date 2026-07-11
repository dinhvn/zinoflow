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

/** Noi dung mo ta rieng cho trang danh muc (Phase 18.2, content-seo-ux-plan §10.3) */
export interface TaxonomyContentRows {
  groups: Array<{ id: number; slug: string; name: string; description: string | null }>;
  types: Array<{
    id: number;
    groupId: number;
    slug: string;
    name: string;
    description: string | null;
  }>;
  provinces: Array<{
    id: number;
    slug: string;
    code: string;
    name: string;
    description: string | null;
  }>;
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
  /** JSON PriceBreakdownItem[] — carry gia tri mirror hien tai vao lan publish (Phase 12) */
  priceBreakdownJson: string;
  /** JSON PracticalNoteItem[] — carry gia tri mirror hien tai vao lan publish (Phase 12) */
  practicalNotesJson: string;
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
  /** flagship | standard | null — chi y nghia voi kind IN (province, cluster), Phase 25 */
  contentTier: "flagship" | "standard" | null;
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

/** 1 tag dinh nghia (v2.DestinationTag) — destination-spec §2.4 */
export interface SiteTagRow {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  status: number;
}

/** 1 diem den + slug cac tag dang gan (v2.DestinationTagMap join) */
export interface SiteTagAssignmentRow {
  destinationId: number;
  destinationSlug: string;
  destinationName: string;
  tagSlugs: string[];
}

/** Co du lieu content da co tren v2.DestinationContent — dung tinh Coverage Score (spec §2.2.2) */
export interface SiteContentCoverageRow {
  destinationId: number;
  hasOpeningTime: boolean;
  hasTicketPrice: boolean;
  hasFaq: boolean;
  hasPracticalNotes: boolean;
  hasTicketLinks: boolean;
  hasMainContent: boolean;
  /** GalleryJson co it nhat 1 anh — dung cho canh bao dashboard (destination-spec §7.2) */
  hasGallery: boolean;
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
  /**
   * Ghi AncestorsJson + ChildrenJson, CHI khi 1 trong 2 khac gia tri cu (Phase 14,
   * database-redesign §3.4) — tra ve true neu co ghi.
   */
  updateAncestorsChildren(
    siteId: number,
    ancestorsJson: string,
    childrenJson: string,
  ): Promise<boolean>;
  /**
   * Ghi HotelCardsJson/TourCardsJson (Phase 15) — goi tu module hotel/tour
   * (khong phai module nay tinh du lieu, chi ghi cot dung chung DestinationContent).
   * CHI ghi khi khac gia tri cu — tra ve true neu co ghi.
   */
  updateHotelCards(siteId: number, hotelCardsJson: string): Promise<boolean>;
  updateTourCards(siteId: number, tourCardsJson: string): Promise<boolean>;
  /** Cap nhat rieng cot Thumbnail (metadata — sua truc tiep, khong qua publish) */
  updateThumbnail(siteId: number, thumbnail: string | null): Promise<void>;
  /**
   * Ghi de TicketLinksJson (DestinationContent) — dung khi diem DA co bai (siteId
   * ton tai), khong can publish lai toan bai (affiliate-link-conversion-spec §5).
   */
  updateTicketLinks(siteId: number, ticketLinksJson: string): Promise<void>;
  /** Ghi de PriceBreakdownJson — doc lap voi publish (Phase 12, content-seo-ux-plan §5.5a) */
  updatePriceBreakdown(siteId: number, priceBreakdownJson: string): Promise<void>;
  /** Ghi de PracticalNotesJson — doc lap voi publish (Phase 12, content-seo-ux-plan §5.7) */
  updatePracticalNotes(siteId: number, practicalNotesJson: string): Promise<void>;
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
  /** Toan bo group/type/province kem Description — trang admin sua noi dung danh muc (Phase 18.2) */
  fetchTaxonomyContent(): Promise<TaxonomyContentRows>;
  /** Ghi de Description cho 1 group/type/province (Phase 18.2, content-seo-ux-plan §10.3) */
  updateTaxonomyDescription(
    target: "group" | "type" | "province",
    id: number,
    description: string | null,
  ): Promise<void>;

  /** Toan bo tag da duyet (destination-spec §2.4 buoc 0 — 7 tag seed san) */
  fetchTags(): Promise<SiteTagRow[]>;
  /** Moi diem den (chi diem da published) kem slug cac tag dang gan (rong = chua gan tag nao) */
  fetchTagAssignments(): Promise<SiteTagAssignmentRow[]>;
  /**
   * Ghi de TOAN BO tag cua 1 diem den (theo slug) — xoa cac dong cu, insert lai
   * theo tagSlugs moi. Bo qua slug diem/tag khong ton tai (khong throw ca batch).
   */
  replaceTagAssignments(destinationSlug: string, tagSlugs: readonly string[]): Promise<void>;
  /** Ghi de Description cho 1 tag (buoc 3 — AI soan mo ta) */
  updateTagDescription(tagSlug: string, description: string | null): Promise<void>;

  /** Co du lieu content (chi diem da published) — dung tinh Coverage Score (spec §2.2.2) */
  fetchContentCoverageRows(): Promise<SiteContentCoverageRow[]>;
}
