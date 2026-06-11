import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { CreateContentJobRequest, CreateContentJobResponse } from "@zinoflow/contracts";
import { ContentJob } from "../../domain/content-job";
import {
  CONTENT_JOB_REPOSITORY,
  type ContentJobRepository,
} from "../ports/content-job.repository";
import { JOB_QUEUE, QUEUE_NAMES, type JobQueue } from "../../../shared/jobs/job-queue.port";

/**
 * Use case: tao content job va day vao queue de generate async.
 * AI generation KHONG chay trong request nay — worker xu ly qua pg-boss
 * (request tra ve ngay, UI poll status).
 */
@Injectable()
export class CreateContentJobUseCase {
  private readonly logger = new Logger(CreateContentJobUseCase.name);

  // Default khi request khong chi dinh — sau nay doc tu SiteProfile (M4)
  private static readonly DEFAULT_PROVIDER = "anthropic" as const;
  private static readonly DEFAULT_MODEL = "claude-opus-4-8";

  constructor(
    @Inject(CONTENT_JOB_REPOSITORY) private readonly repository: ContentJobRepository,
    @Inject(JOB_QUEUE) private readonly jobQueue: JobQueue,
  ) {}

  async execute(request: CreateContentJobRequest): Promise<CreateContentJobResponse> {
    const job = ContentJob.create({
      id: randomUUID(),
      siteCode: request.siteCode,
      sourceType: request.sourceType,
      sourceRef: request.sourceRef,
      topic: request.topic,
      keywordSeed: request.keywordSeed,
      toneProfile: request.toneProfile ?? null,
      aiProvider: request.aiProvider ?? CreateContentJobUseCase.DEFAULT_PROVIDER,
      aiModel: request.aiModel ?? CreateContentJobUseCase.DEFAULT_MODEL,
    });

    await this.repository.save(job);

    const queueJobId = await this.jobQueue.send(QUEUE_NAMES.contentGenerate, {
      contentJobId: job.id,
    });
    this.logger.log(`Content job ${job.id} created, queued as ${queueJobId ?? "(queue disabled)"}`);

    return { jobId: job.id, status: job.status };
  }
}
