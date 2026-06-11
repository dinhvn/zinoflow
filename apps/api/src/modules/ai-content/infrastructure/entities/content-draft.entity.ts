import { Column, Entity, Index, PrimaryColumn, Unique, VersionColumn } from "typeorm";

/**
 * Bang content_drafts. Moi job co the co nhieu draft version (sua sau approve
 * tao version moi — spec §5). lock_version la optimistic locking (spec §10),
 * tach biet voi business version.
 */
@Entity("content_drafts")
@Unique(["jobId", "version"])
export class ContentDraftEntity {
  @PrimaryColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "job_id", type: "uuid" })
  jobId!: string;

  /** Business version: tang khi sua noi dung sau Approved. */
  @Column({ type: "int" })
  version!: number;

  @Column({ type: "text", nullable: true })
  title!: string | null;

  @Column({ name: "outline_json", type: "jsonb", nullable: true })
  outlineJson!: object | null;

  /** Bai viet structured 8-block (articleSchema) — nguon render markdown/HTML. */
  @Column({ name: "article_json", type: "jsonb", nullable: true })
  articleJson!: object | null;

  @Column({ name: "draft_markdown", type: "text", nullable: true })
  draftMarkdown!: string | null;

  @Column({ name: "quality_score", type: "numeric", precision: 5, scale: 2, nullable: true })
  qualityScore!: string | null; // numeric tra ve string tu pg driver

  /** Optimistic locking — TypeORM tu tang va check khi update. */
  @VersionColumn({ name: "lock_version" })
  lockVersion!: number;

  @Column({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @Column({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
