import { Column, Entity, PrimaryColumn } from "typeorm";
import type {
  AffiliateLinkItem,
  ExternalReviewUrlItem,
  GalleryItem,
  HeroImageMeta,
  PracticalNoteItem,
  PriceBreakdownItem,
} from "@zinoflow/contracts";

/**
 * Bang tam `dichoithoi_destinations_backup` (dot lam moi du lieu theo Atlas — GD2
 * plan-lam-moi-du-lieu-atlas.md) — SNAPSHOT nguyen dong dichoithoi_destinations
 * TRUOC khi wipe (GD3), + 2 cot quan tri de theo doi khoi phuc (GD6/GD7).
 * BANG NAY LA TAM THOI — se DROP o GD9 sau khi het dong restored_to_slug=NULL
 * (xem atlas-cleanup-backup.ts). Cung schema voi DestinationMirrorEntity, KHONG
 * xoa/them cot tuy tien o day vi phai khop dung du lieu da backup that.
 */
@Entity("dichoithoi_destinations_backup")
export class ClusterPoiBackupEntity {
  @PrimaryColumn({ type: "varchar", length: 64 })
  slug!: string;

  @Column({ name: "site_id", type: "int", nullable: true })
  siteId!: number | null;

  @Column({ type: "varchar", length: 16 })
  kind!: string;

  @Column({ name: "parent_slug", type: "varchar", length: 64, nullable: true })
  parentSlug!: string | null;

  @Column({ name: "province_code", type: "varchar", length: 2, nullable: true })
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

  @Column({ name: "google_maps_url", type: "text", nullable: true })
  googleMapsUrl!: string | null;

  @Column({ name: "address_new", type: "varchar", length: 256, nullable: true })
  addressNew!: string | null;

  @Column({ name: "address_old", type: "varchar", length: 256, nullable: true })
  addressOld!: string | null;

  @Column({ name: "contact_phone", type: "varchar", length: 32, nullable: true })
  contactPhone!: string | null;

  @Column({ name: "contact_website", type: "varchar", length: 256, nullable: true })
  contactWebsite!: string | null;

  @Column({ name: "ticket_links", type: "jsonb" })
  ticketLinks!: AffiliateLinkItem[];

  @Column({ name: "ticket_price", type: "text", nullable: true })
  ticketPrice!: string | null;

  @Column({ name: "price_breakdown", type: "jsonb" })
  priceBreakdown!: PriceBreakdownItem[];

  @Column({ name: "practical_notes", type: "jsonb" })
  practicalNotes!: PracticalNoteItem[];

  @Column({ name: "editorial_review", type: "text", nullable: true })
  editorialReview!: string | null;

  @Column({ name: "meta_title", type: "varchar", length: 150, nullable: true })
  metaTitle!: string | null;

  @Column({ name: "external_review_urls", type: "jsonb" })
  externalReviewUrls!: ExternalReviewUrlItem[];

  @Column({ name: "hotel_group_id", type: "varchar", length: 50, nullable: true })
  hotelGroupId!: string | null;

  @Column({ type: "smallint" })
  priority!: number;

  @Column({ name: "content_tier", type: "varchar", length: 16, nullable: true })
  contentTier!: "flagship" | "standard" | null;

  @Column({ type: "int" })
  order!: number;

  @Column({ name: "distance_from_center", type: "decimal", precision: 18, scale: 0, nullable: true })
  distanceFromCenter!: string | null;

  @Column({ name: "site_status", type: "smallint", nullable: true })
  siteStatus!: number | null;

  @Column({ name: "content_source", type: "smallint", nullable: true })
  contentSource!: number | null;

  @Column({ name: "content_hash", type: "varchar", length: 64, nullable: true })
  contentHash!: string | null;

  @Column({ name: "ai_notes", type: "text", nullable: true })
  aiNotes!: string | null;

  @Column({ name: "ai_reference_urls", type: "jsonb" })
  aiReferenceUrls!: Array<{ label: string; url: string }>;

  @Column({ name: "types", type: "jsonb" })
  types!: string[];

  @Column({ name: "tags", type: "jsonb" })
  tags!: string[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- xem ghi chu cung ten trong destination-mirror.entity.ts
  @Column({ name: "draft_article", type: "jsonb", nullable: true })
  draftArticle!: any;

  @Column({ type: "jsonb" })
  gallery!: GalleryItem[];

  @Column({ name: "hero_image_meta", type: "jsonb", nullable: true })
  heroImageMeta!: HeroImageMeta | null;

  @Column({ name: "opening_hours", type: "jsonb", nullable: true })
  openingHours!: {
    note: string;
    periods: Array<{ days: string[]; opens: string; closes: string }>;
  } | null;

  @Column({ name: "ai_reference_summary", type: "text", nullable: true })
  aiReferenceSummary!: string | null;

  @Column({ name: "ai_reference_summary_gsg", type: "text", nullable: true })
  aiReferenceSummaryGsg!: string | null;

  /** NULL = chua khoi phuc vao dau ca — man "Backup con lai" (GD7) loc theo cot nay */
  @Column({ name: "restored_to_slug", type: "varchar", length: 64, nullable: true })
  restoredToSlug!: string | null;

  /** Ghi chu khi nguoi dung bam "Bo han" o man Backup con lai (GD7), khong khoi phuc */
  @Column({ name: "restore_note", type: "text", nullable: true })
  restoreNote!: string | null;
}
