import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { CreateContentJobRequest, CreateContentJobResponse } from "@zinoflow/contracts";
import { ContentJob } from "../../domain/content-job";
import {
  CONTENT_JOB_REPOSITORY,
  type ContentJobRepository,
} from "../ports/content-job.repository";
import {
  AI_PROVIDER_SETTINGS,
  type AiProviderSettings,
} from "../ports/ai-provider-settings.port";
import { JOB_QUEUE, QUEUE_NAMES, type JobQueue } from "../../../shared/jobs/job-queue.port";
import { DomainRuleError } from "../../../shared/errors/app-error";

/**
 * Use case: tao content job va day vao queue de generate async.
 * AI generation KHONG chay trong request nay — worker xu ly qua pg-boss
 * (request tra ve ngay, UI poll status).
 */
@Injectable()
export class CreateContentJobUseCase {
  private readonly logger = new Logger(CreateContentJobUseCase.name);

  // Default khi request khong chi dinh — sau nay doc tu SiteProfile (M4).
  // Model default phai di theo provider duoc chon (khong duoc ghep cheo).
  private static readonly DEFAULT_PROVIDER = "anthropic" as const;
  private static readonly DEFAULT_MODELS: Record<string, string> = {
    anthropic: "claude-opus-4-8",
    gemini: "gemini-3.1-pro-preview",
    openai: "gpt-default", // thay khi implement OpenAI adapter
  };

  constructor(
    @Inject(CONTENT_JOB_REPOSITORY) private readonly repository: ContentJobRepository,
    @Inject(JOB_QUEUE) private readonly jobQueue: JobQueue,
    @Inject(AI_PROVIDER_SETTINGS) private readonly providerSettings: AiProviderSettings,
  ) {}

  async execute(request: CreateContentJobRequest): Promise<CreateContentJobResponse> {
    const aiProvider = request.aiProvider ?? CreateContentJobUseCase.DEFAULT_PROVIDER;

    // Provider bi tat tu Settings -> tu choi tao job (business rule)
    if (!(await this.providerSettings.isEnabled(aiProvider))) {
      throw new DomainRuleError(`AI provider "${aiProvider}" is disabled`, [
        "Bật lại provider này trong trang Settings trước khi tạo job",
      ]);
    }
    const job = ContentJob.create({
      id: randomUUID(),
      siteCode: request.siteCode,
      sourceType: request.sourceType,
      sourceRef: request.sourceRef,
      topic: request.topic,
      articleType: request.articleType,
      keywordSeed: request.keywordSeed,
      toneProfile: request.toneProfile ?? null,
      sourceContext: request.sourceContext ?? null,
      contentTier: request.contentTier ?? null,
      nodeKind: request.nodeKind ?? null,
      comparisonKey: request.comparisonKey ?? null,
      originalityExcerpt: null,
      coverImageId: null,
      category: null,
      referenceUrls: request.referenceUrls ?? null,
      aiProvider,
      aiModel:
        request.aiModel ??
        CreateContentJobUseCase.DEFAULT_MODELS[aiProvider] ??
        CreateContentJobUseCase.DEFAULT_MODELS["anthropic"]!,
    });

    await this.repository.save(job);

    // Bai cam-nang KHONG tu queue generate luc tao (article-ai-extraction-plan.md
    // GĐ1) — nguoi dung can trich xuat nguon (skill/GSG) + rap sourceContext
    // truoc, roi tu bam "Bắt đầu sinh nội dung" (POST /content/jobs/:id/retry,
    // hop le vi Created nam trong EDITABLE_STATUSES/transition GeneratingOutline).
    if (request.articleType === "cam-nang") {
      this.logger.log(`Content job ${job.id} (cẩm nang) created, chờ trích xuất nguồn trước khi sinh nội dung`);
      return { jobId: job.id, status: job.status };
    }

    const queueJobId = await this.jobQueue.send(QUEUE_NAMES.contentGenerate, {
      contentJobId: job.id,
    });
    this.logger.log(`Content job ${job.id} created, queued as ${queueJobId ?? "(queue disabled)"}`);

    return { jobId: job.id, status: job.status };
  }
}
