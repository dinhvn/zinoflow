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
}

export interface AiBatchItemRecord {
  id: string;
  batchId: string;
  entityId: string;
  params: Record<string, unknown> | null;
  status: AiBatchItemStatus;
  errorMessage: string | null;
  createdAt: Date;
}

/** Port persistence cho Batch AI — khong biet gi ve noi dung tung tac vu (do BatchTaskHandler lo). */
export interface AiBatchRepository {
  createBatch(batch: AiBatchRecord): Promise<void>;
  createItems(items: AiBatchItemRecord[]): Promise<void>;
  findBatchById(id: string): Promise<AiBatchRecord | null>;
  updateBatchStatus(id: string, status: AiBatchStatus, checkedAt: Date): Promise<void>;
  findItemsByBatchId(batchId: string): Promise<AiBatchItemRecord[]>;
  updateItemResult(id: string, status: AiBatchItemStatus, errorMessage: string | null): Promise<void>;
  listRecent(taskType?: AiBatchTaskType, limit?: number): Promise<AiBatchRecord[]>;
}
