import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import type { AffiliateLinkStatus } from "@zinoflow/contracts";

/** Bang tours (Postgres) — nguon su that duy nhat cho du lieu tour (tour-spec §3) */
@Entity("tours")
export class TourEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 256 })
  name!: string;

  @Column({ name: "short_description", type: "varchar", length: 500, nullable: true })
  shortDescription!: string | null;

  @Column({ name: "duration_days", type: "smallint", nullable: true })
  durationDays!: number | null;

  @Column({ name: "duration_nights", type: "smallint", nullable: true })
  durationNights!: number | null;

  @Column({ name: "departure_from", type: "varchar", length: 256, nullable: true })
  departureFrom!: string | null;

  @Column({ name: "province_code", type: "varchar", length: 2, nullable: true })
  provinceCode!: string | null;

  @Column({ name: "price_from", type: "decimal", precision: 12, scale: 0, nullable: true })
  priceFrom!: string | null;

  @Column({ type: "decimal", precision: 2, scale: 1, nullable: true })
  rating!: string | null;

  @Column({ name: "review_count", type: "int", nullable: true })
  reviewCount!: number | null;

  @Column({ name: "thumbnail_url", type: "varchar", length: 512, nullable: true })
  thumbnailUrl!: string | null;

  @Column({ type: "jsonb", default: () => "'[]'" })
  images!: string[];

  @Column({ type: "varchar", length: 64, nullable: true })
  provider!: string | null;

  @Column({ name: "source_url", type: "varchar", length: 512 })
  sourceUrl!: string;

  @Column({ name: "affiliate_url", type: "varchar", length: 512, nullable: true })
  affiliateUrl!: string | null;

  @Column({ name: "link_status", type: "varchar", length: 20, default: "no-rule" })
  linkStatus!: AffiliateLinkStatus;

  @Column({ type: "smallint", default: 0 })
  source!: number;

  @Column({ name: "site_id", type: "int", nullable: true })
  siteId!: number | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
