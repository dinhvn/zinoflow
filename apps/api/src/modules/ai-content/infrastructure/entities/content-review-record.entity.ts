import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import type { ReviewAction } from "@zinoflow/contracts";

/** Bang content_review_records — lich su review day du (spec §4.1, §16.2). */
@Entity("content_review_records")
export class ContentReviewRecordEntity {
  @PrimaryColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "draft_id", type: "uuid" })
  draftId!: string;

  @Column({ type: "varchar", length: 20 })
  action!: ReviewAction;

  /** Reject bat buoc co note (enforce o domain layer truoc khi luu). */
  @Column({ type: "text", nullable: true })
  note!: string | null;

  @Column({ type: "varchar", length: 100 })
  actor!: string;

  @Column({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
