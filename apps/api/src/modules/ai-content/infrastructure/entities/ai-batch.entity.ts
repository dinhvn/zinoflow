import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import type { AiBatchStatus, AiBatchTaskType, AiProviderKey } from "@zinoflow/contracts";

/**
 * Bang ai_batches — 1 lan gui request len Gemini Batch API cho 1 taskType.
 * Xem docs/specs/ai-batch-mode.md.
 */
@Entity("ai_batches")
export class AiBatchEntity {
  @PrimaryColumn("uuid")
  id!: string;

  @Index()
  @Column({ name: "task_type", type: "varchar", length: 40 })
  taskType!: AiBatchTaskType;

  @Column({ type: "varchar", length: 20 })
  provider!: AiProviderKey;

  @Column({ type: "varchar", length: 100 })
  model!: string;

  /** Resource name Google tra ve luc submit (vd "batches/abc123") — dung de check status. */
  @Column({ name: "provider_batch_name", type: "text" })
  providerBatchName!: string;

  @Column({ type: "varchar", length: 10, default: "submitted" })
  status!: AiBatchStatus;

  @Column({ name: "item_count", type: "int" })
  itemCount!: number;

  @Index()
  @Column({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @Column({ name: "checked_at", type: "timestamptz", nullable: true })
  checkedAt!: Date | null;
}
