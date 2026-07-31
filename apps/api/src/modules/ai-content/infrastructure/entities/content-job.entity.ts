import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import type {
  AiProviderKey,
  ArticleCategory,
  ArticleType,
  ContentJobStatus,
  ContentSourceType,
} from "@zinoflow/contracts";

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

  @Column({ name: "article_type", type: "varchar", length: 20, default: "toplist" })
  articleType!: ArticleType;

  @Column({ name: "keyword_seed", type: "jsonb", default: () => "'[]'" })
  keywordSeed!: string[];

  @Column({ name: "tone_profile", type: "varchar", length: 100, nullable: true })
  toneProfile!: string | null;

  /** Ngu canh nguon cho prompt (du lieu diem den, content cu...) — M4 Phase B */
  @Column({ name: "source_context", type: "text", nullable: true })
  sourceContext!: string | null;

  /** flagship | standard | null — chi y nghia voi articleType guide-diem-den (Phase 28.3) */
  @Column({ name: "content_tier", type: "varchar", length: 16, nullable: true })
  contentTier!: "flagship" | "standard" | null;

  /**
   * poi | cluster | province | null — chi y nghia voi articleType guide-diem-den.
   * Quyet dinh PromptBuilder chon bo prompt POI hay Cum (khong con phu thuoc
   * contentTier nhu Phase 28.3 cu, xem prompt-builder.ts).
   */
  @Column({ name: "node_kind", type: "varchar", length: 16, nullable: true })
  nodeKind!: "poi" | "cluster" | "province" | null;

  /**
   * Gate "originality" (07/2026) — slug tinh, copy 1 lan luc tao job, CHI set
   * khi articleType=guide-diem-den. Dung lam pham vi so sanh (chi so voi bai
   * cung tinh, tranh false-positive giua cac tinh khac nhau).
   */
  @Column({ name: "comparison_key", type: "varchar", length: 255, nullable: true })
  comparisonKey!: string | null;

  /** Doan van trich xuat (mo bai + section rui ro) — ghi luc job Approved, dung lam corpus so sanh cho job sau. */
  @Column({ name: "originality_excerpt", type: "text", nullable: true })
  originalityExcerpt!: string | null;

  /** Anh dai dien (og:image/JSON-LD image) — CHI y nghia voi articleType cam-nang. */
  @Column({ name: "cover_image_id", type: "uuid", nullable: true })
  coverImageId!: string | null;

  /** Danh muc bai cam nang — CHI y nghia voi articleType cam-nang. */
  @Column({ type: "varchar", length: 32, nullable: true })
  category!: ArticleCategory | null;

  /** Website tham khao — CHI y nghia voi articleType cam-nang. */
  @Column({ name: "reference_urls", type: "jsonb", nullable: true })
  referenceUrls!: string[] | null;

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
