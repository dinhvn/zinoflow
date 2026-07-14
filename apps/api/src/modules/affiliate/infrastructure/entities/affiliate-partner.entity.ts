import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

/** Bang affiliate_partners (Postgres) — 1 doi tac cu the (klook/vexere/booking...), `code` khop provider trong ticketLinks[]/Hotel/Tour */
@Entity("affiliate_partners")
export class AffiliatePartnerEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 64, unique: true })
  code!: string;

  @Column({ type: "varchar", length: 128 })
  name!: string;

  @Column({ name: "homepage_url", type: "varchar", length: 512, nullable: true })
  homepageUrl!: string | null;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ name: "network_id", type: "uuid", nullable: true })
  @Index()
  networkId!: string | null;

  @Column({ name: "match_domain", type: "varchar", length: 256, nullable: true })
  matchDomain!: string | null;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
