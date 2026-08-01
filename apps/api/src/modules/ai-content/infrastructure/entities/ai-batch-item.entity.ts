import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import type { AiBatchItemStatus } from "@zinoflow/contracts";

/**
 * Bang ai_batch_items — 1 item trong 1 AiBatch. entityId da hinh (contentJobId |
 * destination slug | cluster slug...) — KHONG co FK vi tro toi nhieu bang khac
 * nhau tuy taskType cua batch cha. Xem docs/specs/ai-batch-mode.md.
 */
@Entity("ai_batch_items")
export class AiBatchItemEntity {
  @PrimaryColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "batch_id", type: "uuid" })
  batchId!: string;

  @Column({ name: "entity_id", type: "varchar", length: 128 })
  entityId!: string;

  /** Tham so phu tuy tac vu (vd cluster-poi-discovery: {extraNotes}) — handler tu doc field can. */
  @Column({ type: "jsonb", nullable: true })
  params!: Record<string, unknown> | null;

  @Column({ type: "varchar", length: 10, default: "pending" })
  status!: AiBatchItemStatus;

  @Column({ name: "error_message", type: "text", nullable: true })
  errorMessage!: string | null;

  @Column({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
