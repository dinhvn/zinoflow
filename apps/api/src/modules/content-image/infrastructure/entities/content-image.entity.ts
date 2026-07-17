import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import type { ContentImageStatus } from "@zinoflow/contracts";

/**
 * Bang content_images (Postgres) — thu vien anh noi dung doc lap khoi anh diem den
 * (dichoithoi-content-image-library-plan.md §3.1). path TUONG DOI voi
 * DICHOITHOI_CONTENT_IMAGE_BASE_URL, resolve thanh URL day du luc doc.
 */
@Entity("content_images")
export class ContentImageEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  /** VD "noi-dung/{uuid}.webp" — khong theo slug diem den (doc lap hoan toan) */
  @Column({ type: "varchar", length: 512 })
  path!: string;

  @Column({ name: "alt_text", type: "varchar", length: 256 })
  altText!: string;

  @Column({ type: "varchar", length: 512, nullable: true })
  caption!: string | null;

  /** Kich thuoc that cua anh da resize — dung ghi width/height <img> chong CLS */
  @Column({ type: "int" })
  width!: number;

  @Column({ type: "int" })
  height!: number;

  @Column({ type: "varchar", length: 16, default: "active" })
  status!: ContentImageStatus;

  @Column({ name: "usage_count", type: "int", default: 0 })
  usageCount!: number;

  @Column({ name: "uploaded_at", type: "timestamptz", default: () => "now()" })
  uploadedAt!: Date;

  /** null = upload tay. "pexels" = tu dong tim (auto-image-search-plan §2.2) */
  @Column({ type: "varchar", length: 16, nullable: true })
  source!: string | null;

  @Column({ name: "source_url", type: "varchar", length: 512, nullable: true })
  sourceUrl!: string | null;

  @Column({ type: "varchar", length: 256, nullable: true })
  photographer!: string | null;

  /** Job cam-nang da kich hoat tim anh nay — hien "bai viet lien quan" o man duyet */
  @Column({ name: "related_job_id", type: "uuid", nullable: true })
  relatedJobId!: string | null;

  @Column({ name: "search_keyword", type: "varchar", length: 256, nullable: true })
  searchKeyword!: string | null;
}
