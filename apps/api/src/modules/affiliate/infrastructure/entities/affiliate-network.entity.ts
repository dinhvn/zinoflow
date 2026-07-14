import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import type { AffiliatePlaceholder } from "@zinoflow/contracts";

/** Bang affiliate_networks (Postgres) — 1 mang affiliate (vd Accesstrade), template dung chung cho moi doi tac cua no */
@Entity("affiliate_networks")
export class AffiliateNetworkEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 64, unique: true })
  code!: string;

  @Column({ type: "varchar", length: 128 })
  name!: string;

  @Column({ type: "varchar", length: 1024 })
  template!: string;

  @Column({ type: "varchar", length: 16, default: "{url_enc}" })
  placeholder!: AffiliatePlaceholder;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @Column({ type: "text", nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
