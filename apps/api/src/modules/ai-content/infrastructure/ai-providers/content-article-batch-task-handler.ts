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
import {
  finalizeArticle,
  ContentDraftPersister,
} from "../../application/services/content-generation-result-applier";
import { getArticleTypeProfile, type AnyArticle } from "../../application/services/article-type-profiles";
import { DomainRuleError } from "../../../shared/errors/app-error";

/**
 * Handler taskType "content-article" — buoc 2 cua viet bai hang loat qua
 * Batch AI, chi gui duoc sau khi job da OutlineReady (buoc 1 xong). entityId
 * = contentJobId. Xem docs/specs/ai-batch-mode.md.
 */
@Injectable()
export class ContentArticleBatchTaskHandler implements BatchTaskHandler, OnModuleInit {
  readonly taskType = "content-article";
  private readonly logger = new Logger(ContentArticleBatchTaskHandler.name);

  constructor(
    @Inject(CONTENT_JOB_REPOSITORY) private readonly jobs: ContentJobRepository,
    @Inject(CONTENT_GENERATION_CHECKPOINT_REPOSITORY)
    private readonly checkpoints: ContentGenerationCheckpointRepository,
    @Inject(AI_USAGE_RECORDER) private readonly usage: AiUsageRecorder,
    private readonly prompts: PromptBuilder,
    private readonly contextBuilder: ContentJobContextBuilder,
    private readonly draftPersister: ContentDraftPersister,
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
    const checkpoint = await this.checkpoints.findByJobId(entityId);
    if (!checkpoint?.outline) {
      throw new DomainRuleError(`Job ${entityId} chưa có outline`, [
        `Gửi "Batch outline" trước khi gửi "Batch nội dung"`,
      ]);
    }
    const profile = getArticleTypeProfile(snapshot.articleType);
    const ctx = await this.contextBuilder.build(snapshot, profile);
    if (override) ctx.model = override.model;
    const request = await this.prompts.buildContent(ctx, checkpoint.outline);
    return { request, schema: profile.contentSchema, providerKey: override?.provider ?? snapshot.aiProvider };
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
    const checkpoint = await this.checkpoints.findByJobId(entityId);
    if (!checkpoint?.outline) {
      throw new DomainRuleError(`Job ${entityId} chưa có outline lúc áp kết quả content`);
    }
    const profile = getArticleTypeProfile(snapshot.articleType);
    const rawArticle = profile.contentSchema.parse(rawOutput) as AnyArticle;
    const article = finalizeArticle(rawArticle, profile, checkpoint.outline, snapshot.sourceContext);
    await this.draftPersister.saveNewVersion(entityId, profile, checkpoint.outline, article);
    await this.usage.record({
      ...usage,
      jobId: entityId,
      provider: batchContext.provider,
      model: batchContext.model,
      operation: "content",
      responseText: JSON.stringify(article),
    });
    job.transitionTo("DraftReady");
    await this.jobs.save(job);
    await this.checkpoints.clear(entityId);
    this.logger.log(`Job ${entityId} -> DraftReady (batch)`);
  }

  async applyError(entityId: string, errorMessage: string): Promise<void> {
    const job = await this.jobs.findById(entityId);
    if (!job) return;
    job.transitionTo("Failed");
    await this.jobs.save(job);
    this.logger.error(`Job ${entityId} batch content thất bại: ${errorMessage}`);
  }
}
