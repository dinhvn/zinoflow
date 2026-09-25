import { Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import {
  submitAiBatchRequestSchema,
  listAiBatchesQuerySchema,
  previewAiBatchPromptRequestSchema,
  type AiBatch,
  type AiBatchItem,
  type CheckAiBatchResponse,
  type ListAiBatchesQuery,
  type PreviewAiBatchPromptRequest,
  type PreviewAiBatchPromptResponse,
  type SubmitAiBatchRequest,
  type SubmitAiBatchResponse,
} from "@zinoflow/contracts";
import { ZodValidationPipe } from "../../shared/validation/zod-validation.pipe";
import { SubmitAiBatchUseCase } from "../application/use-cases/submit-ai-batch.usecase";
import { CheckAiBatchUseCase } from "../application/use-cases/check-ai-batch.usecase";
import { PreviewAiBatchPromptUseCase } from "../application/use-cases/preview-ai-batch-prompt.usecase";
import {
  AI_BATCH_REPOSITORY,
  type AiBatchItemRecord,
  type AiBatchRecord,
  type AiBatchRepository,
} from "../application/ports/ai-batch.repository";
import { DomainRuleError } from "../../shared/errors/app-error";

/**
 * Batch AI (Gemini Batch API) — gui nhieu item cung luc cho 1 taskType, re
 * hon ~50% nhung khong co ket qua ngay, phai tu bam "Kiểm tra" (khong tu
 * dong poll). Xem docs/specs/ai-batch-mode.md.
 */
@Controller("ai-batches")
export class AiBatchController {
  constructor(
    private readonly submitAiBatch: SubmitAiBatchUseCase,
    private readonly checkAiBatch: CheckAiBatchUseCase,
    private readonly previewAiBatchPrompt: PreviewAiBatchPromptUseCase,
    @Inject(AI_BATCH_REPOSITORY) private readonly repo: AiBatchRepository,
  ) {}

  @Post()
  async submit(
    @Body(new ZodValidationPipe(submitAiBatchRequestSchema)) request: SubmitAiBatchRequest,
  ): Promise<SubmitAiBatchResponse> {
    const override =
      request.provider && request.model
        ? { provider: request.provider, model: request.model }
        : undefined;
    return this.submitAiBatch.execute(request.taskType, request.items, override, request.note);
  }

  /** Xem trước prompt sẽ gửi cho 1 item, KHÔNG gửi AI/lưu batch — dùng ở nút
   * "Xem prompt" trong danh sách đã chọn ở /ai-batches (yêu cầu người dùng 08/2026). */
  @Post("preview-prompt")
  async previewPrompt(
    @Body(new ZodValidationPipe(previewAiBatchPromptRequestSchema)) request: PreviewAiBatchPromptRequest,
  ): Promise<PreviewAiBatchPromptResponse> {
    const override =
      request.provider && request.model
        ? { provider: request.provider, model: request.model }
        : undefined;
    return this.previewAiBatchPrompt.execute(request.taskType, request.entityId, request.params, override);
  }

  @Post(":id/check")
  async check(@Param("id") id: string): Promise<CheckAiBatchResponse> {
    const { batch, items } = await this.checkAiBatch.execute(id);
    return {
      batch: toBatchResponse(batch, summarizeItems(items)),
      items: items.map(toItemResponse),
    };
  }

  /** Xem chi tiet 1 batch (danh sach item + trang thai tung item) — chi doc
   * tu DB, KHONG goi provider (khac voi /check). Dung khi bam vao 1 dong o
   * bang "Batch gần đây" de xem no gom nhung item nao, item nao loi. */
  @Get(":id")
  async detail(@Param("id") id: string): Promise<CheckAiBatchResponse> {
    const batch = await this.repo.findBatchById(id);
    if (!batch) {
      throw new DomainRuleError(`Không tìm thấy batch ${id}`);
    }
    const items = await this.repo.findItemsByBatchId(id);
    return {
      batch: toBatchResponse(batch, summarizeItems(items)),
      items: items.map(toItemResponse),
    };
  }

  @Get()
  async list(
    @Query(new ZodValidationPipe(listAiBatchesQuerySchema)) query: ListAiBatchesQuery,
  ): Promise<AiBatch[]> {
    const batches = await this.repo.listRecent(query.taskType);
    const batchIds = batches.map((b) => b.id);
    const [failedCounts, usageTotals] = await Promise.all([
      this.repo.countFailedItemsByBatchIds(batchIds),
      this.repo.sumUsageByBatchIds(batchIds),
    ]);
    return batches.map((b) =>
      toBatchResponse(b, {
        failedItemCount: failedCounts[b.id] ?? 0,
        totalInputTokens: usageTotals[b.id]?.inputTokens ?? 0,
        totalOutputTokens: usageTotals[b.id]?.outputTokens ?? 0,
        totalCostUsd: usageTotals[b.id]?.costUsd ?? 0,
      }),
    );
  }
}

interface BatchSummary {
  failedItemCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
}

/** Cong don tu items da co san (check/detail deu doc het items ve san) —
 * tranh 1 query rieng nhu list() phai lam vi khong doc items. */
function summarizeItems(items: AiBatchItemRecord[]): BatchSummary {
  const succeeded = items.filter((i) => i.status === "succeeded");
  return {
    failedItemCount: items.filter((i) => i.status === "failed").length,
    totalInputTokens: succeeded.reduce((sum, i) => sum + (i.inputTokens ?? 0), 0),
    totalOutputTokens: succeeded.reduce((sum, i) => sum + (i.outputTokens ?? 0), 0),
    totalCostUsd: succeeded.reduce((sum, i) => sum + (i.costUsd ?? 0), 0),
  };
}

function toBatchResponse(batch: AiBatchRecord, summary: BatchSummary): AiBatch {
  return {
    id: batch.id,
    taskType: batch.taskType,
    provider: batch.provider,
    model: batch.model,
    providerBatchName: batch.providerBatchName,
    status: batch.status,
    itemCount: batch.itemCount,
    createdAt: batch.createdAt.toISOString(),
    checkedAt: batch.checkedAt ? batch.checkedAt.toISOString() : null,
    note: batch.note,
    failedItemCount: summary.failedItemCount,
    totalInputTokens: summary.totalInputTokens,
    totalOutputTokens: summary.totalOutputTokens,
    totalCostUsd: summary.totalCostUsd,
  };
}

function toItemResponse(item: AiBatchItemRecord): AiBatchItem {
  return {
    id: item.id,
    batchId: item.batchId,
    entityId: item.entityId,
    params: item.params,
    status: item.status,
    errorMessage: item.errorMessage,
    inputTokens: item.inputTokens,
    outputTokens: item.outputTokens,
    costUsd: item.costUsd,
    createdAt: item.createdAt.toISOString(),
  };
}
