import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import type { AiProviderKey } from "@zinoflow/contracts";
import type { ZodType } from "zod/v4";
import type {
  BatchTaskHandler,
  BatchTaskHandlerRegistry,
} from "../../application/ports/batch-task-handler.port";
import { BATCH_TASK_HANDLER_REGISTRY } from "../../application/ports/batch-task-handler.port";
import type { AiCallUsage, StructuredGenerationRequest } from "../../application/ports/content-ai-provider.port";
import {
  CONTENT_JOB_REPOSITORY,
  type ContentJobRepository,
} from "../../application/ports/content-job.repository";
import {
  CONTENT_GENERATION_CHECKPOINT_REPOSITORY,
  type ContentGenerationCheckpointRepository,
} from "../../application/ports/content-generation-checkpoint.repository";
import { AI_USAGE_RECORDER, type AiUsageRecorder } from "../../application/ports/ai-usage-recorder.port";
import { PromptBuilder } from "../../application/services/prompt-builder";
import { ContentJobContextBuilder } from "../../application/services/content-job-context.builder";
import { getArticleTypeProfile, type OutlineLike } from "../../application/services/article-type-profiles";
import { DomainRuleError } from "../../../shared/errors/app-error";

/**
 * Handler taskType "content-outline" — buoc 1 cua viet bai hang loat qua
 * Batch AI. entityId = contentJobId. Xem docs/specs/ai-batch-mode.md.
 */
@Injectable()
export class ContentOutlineBatchTaskHandler implements BatchTaskHandler, OnModuleInit {
  readonly taskType = "content-outline";
  private readonly logger = new Logger(ContentOutlineBatchTaskHandler.name);

  constructor(
    @Inject(CONTENT_JOB_REPOSITORY) private readonly jobs: ContentJobRepository,
    @Inject(CONTENT_GENERATION_CHECKPOINT_REPOSITORY)
    private readonly checkpoints: ContentGenerationCheckpointRepository,
    @Inject(AI_USAGE_RECORDER) private readonly usage: AiUsageRecorder,
    private readonly prompts: PromptBuilder,
    private readonly contextBuilder: ContentJobContextBuilder,
    @Inject(BATCH_TASK_HANDLER_REGISTRY) private readonly registry: BatchTaskHandlerRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async buildRequest(
    entityId: string,
    _params?: Record<string, unknown>,
    override?: { provider: AiProviderKey; model: string },
  ): Promise<{ request: StructuredGenerationRequest; schema: ZodType; providerKey: AiProviderKey }> {
    const job = await this.jobs.findById(entityId);
    if (!job) throw new DomainRuleError(`Content job ${entityId} không tồn tại`);
    const snapshot = job.toSnapshot();
    const profile = getArticleTypeProfile(snapshot.articleType);
    const ctx = await this.contextBuilder.build(snapshot, profile);
    if (override) ctx.model = override.model;
    const request = await this.prompts.buildOutline(ctx);
    return { request, schema: profile.outlineSchema, providerKey: override?.provider ?? snapshot.aiProvider };
  }

  /** Danh dau job "da gui di" — chi goi SAU KHI submitBatch thanh cong that. */
  async onSubmitted(entityId: string): Promise<void> {
    const job = await this.jobs.findById(entityId);
    if (!job) return;
    if (job.status !== "GeneratingOutline") {
      job.transitionTo("GeneratingOutline");
      await this.jobs.save(job);
    }
  }

  async applyResult(
    entityId: string,
    rawOutput: unknown,
    usage: AiCallUsage,
    batchContext: { provider: AiProviderKey; model: string },
  ): Promise<void> {
    const job = await this.jobs.findById(entityId);
    if (!job) throw new DomainRuleError(`Content job ${entityId} không tồn tại`);
    const snapshot = job.toSnapshot();
    const profile = getArticleTypeProfile(snapshot.articleType);
    const rawOutline = profile.outlineSchema.parse(rawOutput) as OutlineLike;
    // Ep cung sectionHeadings/blockKey — giong het luong sync (generate-content.usecase.ts).
    const outline = profile.normalizeOutline
      ? profile.normalizeOutline(rawOutline, snapshot.topic)
      : rawOutline;
    await this.checkpoints.save({
      jobId: entityId,
      outline: outline as OutlineLike & Record<string, unknown>,
      sections: [],
    });
    await this.usage.record({
      ...usage,
      jobId: entityId,
      provider: batchContext.provider,
      model: batchContext.model,
      operation: "outline",
      responseText: JSON.stringify(outline),
    });
    job.transitionTo("OutlineReady");
    await this.jobs.save(job);
    this.logger.log(`Job ${entityId} -> OutlineReady (batch)`);
  }

  async applyError(entityId: string, errorMessage: string): Promise<void> {
    const job = await this.jobs.findById(entityId);
    if (!job) return;
    job.transitionTo("Failed");
    await this.jobs.save(job);
    this.logger.error(`Job ${entityId} batch outline thất bại: ${errorMessage}`);
  }
}
