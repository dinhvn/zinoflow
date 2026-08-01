import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AiBatchItemStatus } from "@zinoflow/contracts";
import {
  AI_BATCH_REPOSITORY,
  type AiBatchItemRecord,
  type AiBatchRecord,
  type AiBatchRepository,
} from "../ports/ai-batch.repository";
import { AI_PROVIDER_REGISTRY, type AiProviderRegistry } from "../ports/content-ai-provider.port";
import {
  BATCH_TASK_HANDLER_REGISTRY,
  type BatchTaskHandlerRegistry,
} from "../ports/batch-task-handler.port";
import { DomainRuleError } from "../../../shared/errors/app-error";

/**
 * Bam "Kiểm tra" cho 1 batch — KHONG tu dong poll (nguoi dung tu goi).
 * Loi validate/apply 1 item KHONG lam hong ca batch — chi item do "failed".
 */
@Injectable()
export class CheckAiBatchUseCase {
  private readonly logger = new Logger(CheckAiBatchUseCase.name);

  constructor(
    @Inject(BATCH_TASK_HANDLER_REGISTRY)
    private readonly handlers: BatchTaskHandlerRegistry,
    @Inject(AI_PROVIDER_REGISTRY)
    private readonly providers: AiProviderRegistry,
    @Inject(AI_BATCH_REPOSITORY)
    private readonly repo: AiBatchRepository,
  ) {}

  async execute(batchId: string): Promise<{ batch: AiBatchRecord; items: AiBatchItemRecord[] }> {
    const batch = await this.repo.findBatchById(batchId);
    if (!batch) {
      throw new DomainRuleError(`Không tìm thấy batch ${batchId}`);
    }
    const provider = this.providers.resolve(batch.provider);
    if (!provider.checkBatch) {
      throw new DomainRuleError(`Provider "${batch.provider}" không hỗ trợ Batch API`);
    }
    const handler = this.handlers.resolve(batch.taskType);
    const result = await provider.checkBatch(batch.providerBatchName);
    const now = new Date();

    if (result.state === "pending") {
      await this.repo.updateBatchStatus(batch.id, "submitted", now);
      return { batch: { ...batch, checkedAt: now }, items: await this.repo.findItemsByBatchId(batch.id) };
    }

    if (result.state === "failed") {
      await this.repo.updateBatchStatus(batch.id, "failed", now);
      const items = await this.repo.findItemsByBatchId(batch.id);
      await Promise.all(
        items
          .filter((item) => item.status === "pending")
          .map((item) =>
            this.applyOutcomeError(handler, item, "Batch job thất bại phía Gemini (JOB_STATE_FAILED/CANCELLED/EXPIRED)"),
          ),
      );
      return { batch: { ...batch, status: "failed", checkedAt: now }, items: await this.repo.findItemsByBatchId(batch.id) };
    }

    // succeeded
    const existingItems = await this.repo.findItemsByBatchId(batch.id);
    const byEntityId = new Map(existingItems.map((item) => [item.entityId, item]));
    for (const outcome of result.items ?? []) {
      const item = byEntityId.get(outcome.key);
      if (!item) {
        this.logger.warn(`Batch ${batch.id}: kết quả trả về key "${outcome.key}" không khớp item nào`);
        continue;
      }
      if (item.status !== "pending") continue; // da xu ly (kiem tra lai lan 2)

      if (outcome.errorMessage) {
        await this.applyOutcomeError(handler, item, outcome.errorMessage);
        continue;
      }
      try {
        await handler.applyResult(item.entityId, outcome.rawOutput, outcome.usage!, {
          provider: batch.provider,
          model: batch.model,
        });
        await this.repo.updateItemResult(item.id, "succeeded", null);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.applyOutcomeError(handler, item, message);
      }
    }

    await this.repo.updateBatchStatus(batch.id, "succeeded", now);
    return {
      batch: { ...batch, status: "succeeded", checkedAt: now },
      items: await this.repo.findItemsByBatchId(batch.id),
    };
  }

  private async applyOutcomeError(
    handler: { applyError(entityId: string, errorMessage: string): Promise<void> },
    item: AiBatchItemRecord,
    errorMessage: string,
  ): Promise<void> {
    try {
      await handler.applyError(item.entityId, errorMessage);
    } catch (error) {
      this.logger.error(
        `applyError thất bại cho item ${item.entityId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const failedStatus: AiBatchItemStatus = "failed";
    await this.repo.updateItemResult(item.id, failedStatus, errorMessage);
  }
}
