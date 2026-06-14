import { Column, Entity, Index, PrimaryColumn } from "typeorm";

/**
 * Mirror bai viet CMS khuyenmai (laruki/dochoi3s) tren Postgres — phan chieu bang
 * WordpressPost ben SQL Server CMS de UI list/filter + theo doi trang thai content AI.
 * Nguon su that NOI DUNG la content_drafts (pipeline ai-content); bang nay chi metadata.
 * Spec: docs/specs/laruki-dochoi3s-content-spec.md.
 */
@Entity("cms_post_mirror")
export class CmsPostMirrorEntity {
  /** = WordpressPost.Id ben CMS (khoa tu nhien) */
  @PrimaryColumn({ name: "cms_id", type: "int" })
  cmsId!: number;

  /** SiteId CMS: 1 = laruki, 2 = dochoi3s */
  @Column({ name: "site_id", type: "smallint" })
  @Index()
  siteId!: number;

  /** PostId ben WordPress (0 = bai tao moi o AI tool, chua co WP post) */
  @Column({ name: "post_id", type: "int", default: 0 })
  postId!: number;

  /** PostType int (PostContentType CMS) — null neu chua phan loai */
  @Column({ name: "post_type", type: "smallint", nullable: true })
  postType!: number | null;

  @Column({ type: "varchar", length: 256 })
  title!: string;

  @Column({ name: "title_unaccented", type: "varchar", length: 256 })
  titleUnaccented!: string;

  @Column({ type: "varchar", length: 512, nullable: true })
  link!: string | null;

  @Column({ name: "is_ready_auto", type: "boolean", default: false })
  isReadyAuto!: boolean;

  /** Job ai-content dang soan cho bai nay (null = khong co job dang chay) */
  @Column({ name: "active_content_job_id", type: "uuid", nullable: true })
  activeContentJobId!: string | null;

  /** Lan AI tool ghi content xuong CMS gan nhat (null = chua ghi bai AI nao) */
  @Column({ name: "ai_content_written_at", type: "timestamptz", nullable: true })
  aiContentWrittenAt!: Date | null;

  /** Ghi chu nguoi dung cung cap cho AI (tu dien lai + tai dung khi viet lai) */
  @Column({ name: "ai_notes", type: "text", nullable: true })
  aiNotes!: string | null;

  /** URL nguon tham khao [{label,url}] — gom ca trang tieng Anh cho dochoi3s */
  @Column({ name: "ai_reference_urls", type: "jsonb", default: () => "'[]'" })
  aiReferenceUrls!: Array<{ label: string; url: string }>;

  @Column({ name: "date_published", type: "timestamptz", nullable: true })
  datePublished!: Date | null;

  @Column({ name: "date_updated", type: "timestamptz", nullable: true })
  dateUpdated!: Date | null;

  @Column({ name: "synced_at", type: "timestamptz", nullable: true })
  syncedAt!: Date | null;
}
