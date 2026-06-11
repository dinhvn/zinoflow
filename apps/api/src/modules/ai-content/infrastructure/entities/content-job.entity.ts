import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import type { AiProviderKey, ContentJobStatus, ContentSourceType } from "@zinoflow/contracts";

/**
 * Bang content_jobs — persistence cho ContentJob domain entity.
 * Entity nay CHI la mapping DB, khong chua business rules (rules o domain layer).
 */
@Entity("content_jobs")
export class ContentJobEntity {
  /** Id sinh tu app (randomUUID) de domain entity tu quan ly identity. */
  @PrimaryColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "site_code", type: "varchar", length: 50 })
  siteCode!: string;

  @Column({ name: "source_type", type: "varchar", length: 20 })
  sourceType!: ContentSourceType;

  @Index()
  @Column({ name: "source_ref", type: "varchar", length: 255 })
  sourceRef!: string;

  @Column({ type: "text" })
  topic!: string;

  @Column({ name: "keyword_seed", type: "jsonb", default: () => "'[]'" })
  keywordSeed!: string[];

  @Column({ name: "tone_profile", type: "varchar", length: 100, nullable: true })
  toneProfile!: string | null;

  @Index()
  @Column({ type: "varchar", length: 30 })
  status!: ContentJobStatus;

  @Column({ name: "ai_provider", type: "varchar", length: 20 })
  aiProvider!: AiProviderKey;

  @Column({ name: "ai_model", type: "varchar", length: 100 })
  aiModel!: string;

  @Index()
  @Column({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @Column({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
