import { Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import {
  submitAiBatchRequestSchema,
  listAiBatchesQuerySchema,
  type AiBatch,
  type AiBatchItem,
  type CheckAiBatchResponse,
  type ListAiBatchesQuery,
  type SubmitAiBatchRequest,
  type SubmitAiBatchResponse,
} from "@zinoflow/contracts";
import { ZodValidationPipe } from "../../shared/validation/zod-validation.pipe";
import { SubmitAiBatchUseCase } from "../application/use-cases/submit-ai-batch.usecase";
import { CheckAiBatchUseCase } from "../application/use-cases/check-ai-batch.usecase";
import {
  AI_BATCH_REPOSITORY,
  type AiBatchItemRecord,
  type AiBatchRecord,
  type AiBatchRepository,
} from "../application/ports/ai-batch.repository";

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
    return this.submitAiBatch.execute(request.taskType, request.items, override);
  }

  @Post(":id/check")
  async check(@Param("id") id: string): Promise<CheckAiBatchResponse> {
    const { batch, items } = await this.checkAiBatch.execute(id);
    return { batch: toBatchResponse(batch), items: items.map(toItemResponse) };
  }

  @Get()
  async list(
    @Query(new ZodValidationPipe(listAiBatchesQuerySchema)) query: ListAiBatchesQuery,
  ): Promise<AiBatch[]> {
    const batches = await this.repo.listRecent(query.taskType);
    return batches.map(toBatchResponse);
  }
}

function toBatchResponse(batch: AiBatchRecord): AiBatch {
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
    createdAt: item.createdAt.toISOString(),
  };
}
