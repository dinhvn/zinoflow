import type { AiBatchItemStatus, AiBatchStatus, AiBatchTaskType, AiProviderKey } from "@zinoflow/contracts";

export const AI_BATCH_REPOSITORY = Symbol("AI_BATCH_REPOSITORY");

export interface AiBatchRecord {
  id: string;
  taskType: AiBatchTaskType;
  provider: AiProviderKey;
  model: string;
  providerBatchName: string;
  status: AiBatchStatus;
  itemCount: number;
  createdAt: Date;
  checkedAt: Date | null;
  /** Ghi chu tuy chon nguoi dung nhap luc gui batch — xem AiBatchEntity.note. */
  note: string | null;
}

export interface AiBatchItemRecord {
  id: string;
  batchId: string;
  entityId: string;
  params: Record<string, unknown> | null;
  /** Prompt log day du chup luc submit — xem AiBatchItemEntity.requestText. */
  requestText: string | null;
  status: AiBatchItemStatus;
  errorMessage: string | null;
  /** Chi co gia tri khi status "succeeded" — xem AiBatchItemEntity. */
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  createdAt: Date;
}

export interface AiBatchUsageTotals {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

/** Port persistence cho Batch AI — khong biet gi ve noi dung tung tac vu (do BatchTaskHandler lo). */
export interface AiBatchRepository {
  createBatch(batch: AiBatchRecord): Promise<void>;
  createItems(items: AiBatchItemRecord[]): Promise<void>;
  findBatchById(id: string): Promise<AiBatchRecord | null>;
  updateBatchStatus(id: string, status: AiBatchStatus, checkedAt: Date): Promise<void>;
  findItemsByBatchId(batchId: string): Promise<AiBatchItemRecord[]>;
  /** usage chi truyen khi status "succeeded" (item that/pending khong co token/cost). */
  updateItemResult(
    id: string,
    status: AiBatchItemStatus,
    errorMessage: string | null,
    usage?: { inputTokens: number; outputTokens: number; costUsd: number } | null,
  ): Promise<void>;
  listRecent(taskType?: AiBatchTaskType, limit?: number): Promise<AiBatchRecord[]>;
  /** batchId -> so item "failed" — dung de UI phan biet batch.status "succeeded"
   * (Google xu ly xong job) voi con item BEN TRONG that bai (vd loi validate/AI). */
  countFailedItemsByBatchIds(batchIds: string[]): Promise<Record<string, number>>;
  /** batchId -> tong token/cost cong don tu cac item "succeeded" — dung cho
   * bang "Batch gần đây" (khong dua vao ai_usage_logs, xem AiBatchItemRecord). */
  sumUsageByBatchIds(batchIds: string[]): Promise<Record<string, AiBatchUsageTotals>>;
}
