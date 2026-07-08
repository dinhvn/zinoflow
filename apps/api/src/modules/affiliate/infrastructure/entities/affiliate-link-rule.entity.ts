import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import type { AffiliatePlaceholder } from "@zinoflow/contracts";

/** Bang affiliate_link_rules (Postgres) — nguon su that duy nhat cho rule convert link */
@Entity("affiliate_link_rules")
export class AffiliateLinkRuleEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 64, unique: true })
  provider!: string;

  @Column({ name: "match_domain", type: "varchar", length: 256, nullable: true })
  matchDomain!: string | null;

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
