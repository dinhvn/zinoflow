import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import type {
  AffiliateLinkItem,
  ExternalReviewUrlItem,
  ItineraryPlan,
  PracticalNoteItem,
  PriceBreakdownItem,
} from "@zinoflow/contracts";

/**
 * Mirror metadata diem den dichoithoi (spec dichoithoi-destination-spec §3.2, §12.1).
 * Nguon su that NOI DUNG la content_drafts; bang nay chi phan chieu metadata
 * tu SQL Server de UI list/filter + auto-link + phat hien sua ngoai luong.
 */
@Entity("dichoithoi_destinations")
export class DestinationMirrorEntity {
  /** Slug = Id cu ben site, la khoa tu nhien xuyen suot (URL /diem-den/{slug}) */
  @PrimaryColumn({ type: "varchar", length: 64 })
  slug!: string;

  /** Id int ben SQL Server schema moi; null = diem tao trong AI tool chua publish */
  @Column({ name: "site_id", type: "int", nullable: true })
  @Index()
  siteId!: number | null;

  /** province | cluster | poi */
  @Column({ type: "varchar", length: 16 })
  kind!: string;

  @Column({ name: "parent_slug", type: "varchar", length: 64, nullable: true })
  parentSlug!: string | null;

  @Column({ name: "province_code", type: "varchar", length: 2, nullable: true })
  @Index()
  provinceCode!: string | null;

  @Column({ type: "varchar", length: 128 })
  name!: string;

  @Column({ name: "name_unaccented", type: "varchar", length: 128 })
  nameUnaccented!: string;

  @Column({ name: "short_description", type: "text", nullable: true })
  shortDescription!: string | null;

  @Column({ type: "varchar", length: 256, nullable: true })
  thumbnail!: string | null;

  @Column({ type: "decimal", precision: 9, scale: 6, nullable: true })
  lat!: string | null;

  @Column({ type: "decimal", precision: 9, scale: 6, nullable: true })
  lng!: string | null;

  @Column({ name: "address_new", type: "varchar", length: 256, nullable: true })
  addressNew!: string | null;

  @Column({ name: "address_old", type: "varchar", length: 256, nullable: true })
  addressOld!: string | null;

  @Column({ name: "contact_phone", type: "varchar", length: 32, nullable: true })
  contactPhone!: string | null;

  @Column({ name: "contact_website", type: "varchar", length: 256, nullable: true })
  contactWebsite!: string | null;

  /** Nhieu link mua ve — affiliateUrl da tinh san (redesign §4.2/§4.3, thay booking_url cu) */
  @Column({ name: "ticket_links", type: "jsonb", default: () => "'[]'" })
  ticketLinks!: AffiliateLinkItem[];

  /** Gia ve theo doi tuong, nhap tay hoan toan (content-seo-ux-plan §5.5a, Phase 12) */
  @Column({ name: "price_breakdown", type: "jsonb", default: () => "'[]'" })
  priceBreakdown!: PriceBreakdownItem[];

  /** Luu y thuc te — AI goi y, nguoi dung duyet (content-seo-ux-plan §5.7, Phase 12) */
  @Column({ name: "practical_notes", type: "jsonb", default: () => "'[]'" })
  practicalNotes!: PracticalNoteItem[];

  /** Lich trinh goi y (2N1D/3N2D...) — nhap tay hoan toan, chi Flagship (Phase 28.0) */
  @Column({ type: "jsonb", default: () => "'[]'" })
  itinerary!: ItineraryPlan[];

  /** Danh gia bien tap — text ngan, AI goi y + nguoi dung duyet (Phase 28.0) */
  @Column({ name: "editorial_review", type: "text", nullable: true })
  editorialReview!: string | null;

  /** Link Google Maps/TripAdvisor... nhap tay (Phase 28.0) */
  @Column({ name: "external_review_urls", type: "jsonb", default: () => "'[]'" })
  externalReviewUrls!: ExternalReviewUrlItem[];

  @Column({ name: "hotel_group_id", type: "varchar", length: 50, nullable: true })
  hotelGroupId!: string | null;

  @Column({ name: "is_featured", type: "boolean", default: false })
  isFeatured!: boolean;

  /** flagship | standard | null — chi y nghia voi kind IN (province, cluster), Phase 25 */
  @Column({ name: "content_tier", type: "varchar", length: 16, nullable: true })
  contentTier!: "flagship" | "standard" | null;

  /** Cot Status ben site: 0 draft, 1 published, 2 hidden */
  @Column({ name: "site_status", type: "smallint", nullable: true })
  siteStatus!: number | null;

  /** 0 = viet tay, 1 = AI tool — theo cot ContentSource ben site */
  @Column({ name: "content_source", type: "smallint", nullable: true })
  contentSource!: number | null;

  /** SHA-256 cua ContentHtml ben site — phat hien sua ngoai luong (spec §12.1) */
  @Column({ name: "content_hash", type: "varchar", length: 64, nullable: true })
  contentHash!: string | null;

  /** Job id ai-content dang soan cho diem nay (null = khong co job dang chay) */
  @Column({ name: "active_content_job_id", type: "uuid", nullable: true })
  activeContentJobId!: string | null;

  /** Ghi chu nguoi dung cung cap cho AI (luu lai, tu dien lai + tai dung khi viet lai) */
  @Column({ name: "ai_notes", type: "text", nullable: true })
  aiNotes!: string | null;

  /** URL nguon tham khao theo truong [{label,url}] — luu lai cho lan viet sau */
  @Column({ name: "ai_reference_urls", type: "jsonb", default: () => "'[]'" })
  aiReferenceUrls!: Array<{ label: string; url: string }>;

  /** Co canh bao sync: edited-outside | conflict | orphan (mang rong = sach) */
  @Column({ name: "sync_flags", type: "jsonb", default: () => "'[]'" })
  syncFlags!: string[];

  /** Mirror co thay doi local chua publish (chan sync de khi dong bo) */
  @Column({ name: "has_local_changes", type: "boolean", default: false })
  hasLocalChanges!: boolean;

  @Column({ name: "site_updated_at", type: "timestamptz", nullable: true })
  siteUpdatedAt!: Date | null;

  @Column({ name: "synced_at", type: "timestamptz", nullable: true })
  syncedAt!: Date | null;
}
