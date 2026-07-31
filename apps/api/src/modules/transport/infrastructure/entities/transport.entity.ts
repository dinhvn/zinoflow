import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import type { TransportLinkStatus } from "@zinoflow/contracts";

/** Bang transports (Postgres) — nguon su that cho Ve xe khach (mode=2)/Ve may bay (mode=1) */
@Entity("transports")
export class TransportEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  /** 1 = may bay (du phong), 2 = xe khach */
  @Column({ type: "smallint" })
  mode!: number;

  @Column({ name: "operator_name", type: "varchar", length: 256 })
  operatorName!: string;

  @Column({ type: "varchar", length: 32, nullable: true })
  phone!: string | null;

  @Column({ name: "vehicle_type", type: "varchar", length: 64, nullable: true })
  vehicleType!: string | null;

  @Column({ name: "price_from", type: "decimal", precision: 12, scale: 0, nullable: true })
  priceFrom!: string | null;

  @Column({ name: "thumbnail_url", type: "varchar", length: 512, nullable: true })
  thumbnailUrl!: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  provider!: string | null;

  @Column({ name: "source_url", type: "varchar", length: 512, nullable: true })
  sourceUrl!: string | null;

  @Column({ name: "affiliate_url", type: "varchar", length: 512, nullable: true })
  affiliateUrl!: string | null;

  @Column({ name: "link_status", type: "varchar", length: 20, default: "no-rule" })
  linkStatus!: TransportLinkStatus;

  /** 0 nhap tay, 1 cao vexere.com... */
  @Column({ type: "smallint", default: 0 })
  source!: number;

  @Column({ name: "site_id", type: "int", nullable: true })
  siteId!: number | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
