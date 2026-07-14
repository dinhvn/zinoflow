import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import type { AffiliateLinkStatus } from "@zinoflow/contracts";

/** Bang destination_tickets (Postgres) — thay ticketLinks[] nhung trong Destination (doc §11.5) */
@Entity("destination_tickets")
export class DestinationTicketEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "destination_slug", type: "varchar", length: 64 })
  @Index()
  destinationSlug!: string;

  @Column({ type: "varchar", length: 128, nullable: true })
  label!: string | null;

  @Column({ type: "varchar", length: 64 })
  provider!: string;

  @Column({ name: "source_url", type: "varchar", length: 1024 })
  sourceUrl!: string;

  @Column({ name: "affiliate_url", type: "varchar", length: 1024 })
  affiliateUrl!: string;

  @Column({ name: "link_status", type: "varchar", length: 20, default: "no-rule" })
  linkStatus!: AffiliateLinkStatus;

  @Column({ type: "numeric", precision: 12, scale: 0, nullable: true })
  price!: string | null;

  @Column({ name: "thumbnail_url", type: "varchar", length: 512, nullable: true })
  thumbnailUrl!: string | null;

  @Column({ type: "int", default: 0 })
  order!: number;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
