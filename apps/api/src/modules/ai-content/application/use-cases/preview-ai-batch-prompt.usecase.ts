import { Injectable, Inject } from "@nestjs/common";
import type { AiBatchTaskType, AiProviderKey, PreviewAiBatchPromptResponse } from "@zinoflow/contracts";
import {
  BATCH_TASK_HANDLER_REGISTRY,
  type BatchTaskHandlerRegistry,
} from "../ports/batch-task-handler.port";
import { buildPromptLogText } from "../services/prompt-log-text";

/**
 * Xem trước prompt SẼ gửi cho 1 item — build y het buildRequest() luc submit
 * that (SubmitAiBatchUseCase) nhung dung lai o day, KHONG goi AI/luu batch,
 * cho nguoi dung kiem tra truoc khi bam "Chạy Batch AI" (yeu cau nguoi dung 08/2026).
 */
@Injectable()
export class PreviewAiBatchPromptUseCase {
  constructor(
    @Inject(BATCH_TASK_HANDLER_REGISTRY)
    private readonly handlers: BatchTaskHandlerRegistry,
  ) {}

  async execute(
    taskType: AiBatchTaskType,
    entityId: string,
    params?: Record<string, unknown>,
    override?: { provider: AiProviderKey; model: string },
  ): Promise<PreviewAiBatchPromptResponse> {
    const handler = this.handlers.resolve(taskType);
    const { request, schema } = await handler.buildRequest(entityId, params, override);
    return {
      model: request.model,
      promptText: buildPromptLogText(request.system, request.prompt, schema),
    };
  }
}
