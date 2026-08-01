import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { AiBatchItemInput, AiBatchTaskType, AiProviderKey } from "@zinoflow/contracts";
import {
  AI_BATCH_REPOSITORY,
  type AiBatchRepository,
} from "../ports/ai-batch.repository";
import {
  AI_PROVIDER_REGISTRY,
  type AiProviderRegistry,
  type BatchRequestItem,
} from "../ports/content-ai-provider.port";
import {
  BATCH_TASK_HANDLER_REGISTRY,
  type BatchTaskHandlerRegistry,
} from "../ports/batch-task-handler.port";
import { DomainRuleError } from "../../../shared/errors/app-error";

/**
 * Gui 1 loat item qua Gemini Batch API cho 1 taskType — khong biet gi ve
 * noi dung cu the tung tac vu, chi goi qua BatchTaskHandler tuong ung
 * (docs/specs/ai-batch-mode.md).
 */
@Injectable()
export class SubmitAiBatchUseCase {
  private readonly logger = new Logger(SubmitAiBatchUseCase.name);

  constructor(
    @Inject(BATCH_TASK_HANDLER_REGISTRY)
    private readonly handlers: BatchTaskHandlerRegistry,
    @Inject(AI_PROVIDER_REGISTRY)
    private readonly providers: AiProviderRegistry,
    @Inject(AI_BATCH_REPOSITORY)
    private readonly repo: AiBatchRepository,
  ) {}

  async execute(
    taskType: AiBatchTaskType,
    items: AiBatchItemInput[],
    override?: { provider: AiProviderKey; model: string },
  ): Promise<{ batchId: string }> {
    const handler = this.handlers.resolve(taskType);

    const built = await Promise.all(
      items.map(async (item) => {
        const { request, schema, providerKey } = await handler.buildRequest(
          item.entityId,
          item.params,
          override,
        );
        return { entityId: item.entityId, params: item.params ?? null, request, schema, providerKey };
      }),
    );

    const providerKeys = new Set(built.map((b) => b.providerKey));
    if (providerKeys.size > 1) {
      throw new DomainRuleError("Các item trong 1 batch phải cùng 1 AI provider", [
        `Đang lẫn: ${[...providerKeys].join(", ")}`,
      ]);
    }
    const providerKey = built[0]!.providerKey;
    const provider = this.providers.resolve(providerKey);
    if (!provider.supportsBatch || !provider.submitBatch) {
      throw new DomainRuleError(`Provider "${providerKey}" không hỗ trợ Batch API`);
    }

    const batchRequestItems: BatchRequestItem[] = built.map((b) => ({
      key: b.entityId,
      request: b.request,
      schema: b.schema,
    }));
    const { providerBatchName } = await provider.submitBatch(batchRequestItems);
    if (handler.onSubmitted) {
      await Promise.all(built.map((b) => handler.onSubmitted!(b.entityId)));
    }

    const batchId = randomUUID();
    const now = new Date();
    await this.repo.createBatch({
      id: batchId,
      taskType,
      provider: providerKey,
      model: built[0]!.request.model,
      providerBatchName,
      status: "submitted",
      itemCount: built.length,
      createdAt: now,
      checkedAt: null,
    });
    await this.repo.createItems(
      built.map((b) => ({
        id: randomUUID(),
        batchId,
        entityId: b.entityId,
        params: b.params,
        status: "pending",
        errorMessage: null,
        createdAt: now,
      })),
    );

    this.logger.log(
      `Batch ${batchId} (${taskType}, ${built.length} item) đã gửi lên ${providerKey} — providerBatchName=${providerBatchName}`,
    );
    return { batchId };
  }
}
