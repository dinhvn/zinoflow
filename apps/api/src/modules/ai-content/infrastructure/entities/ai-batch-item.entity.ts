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

  /** Prompt log day du (system+prompt+response schema) chup luc submit batch —
   * luu lai vi request goc bi huy sau khi gui di Google, dung de ghi vao
   * ai_usage_logs.promptText luc "Kiem tra" (xem migration AiBatchItemRequestTextAndUsageLink). */
  @Column({ name: "request_text", type: "text", nullable: true })
  requestText!: string | null;

  @Column({ type: "varchar", length: 10, default: "pending" })
  status!: AiBatchItemStatus;

  @Column({ name: "error_message", type: "text", nullable: true })
  errorMessage!: string | null;

  /** 3 cot usage chi co gia tri khi item "succeeded" — dung de tinh tong chi
   * phi/token ca batch (SUM), khong dua vao ai_usage_logs vi bang do khong
   * tra duoc theo batch/destination slug (chi co jobId). */
  @Column({ name: "input_tokens", type: "int", nullable: true })
  inputTokens!: number | null;

  @Column({ name: "output_tokens", type: "int", nullable: true })
  outputTokens!: number | null;

  /** numeric -> pg driver tra string, repository tu Number() (giong ai_usage_logs). */
  @Column({ name: "cost_usd", type: "numeric", precision: 12, scale: 6, nullable: true })
  costUsd!: string | null;

  @Column({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
