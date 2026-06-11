import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { QUEUE_NAMES } from "../../../shared/jobs/job-queue.port";
import { PgBossService } from "../../../shared/jobs/pg-boss.service";
import {
  CONTENT_JOB_REPOSITORY,
  type ContentJobRepository,
} from "../../application/ports/content-job.repository";

/**
 * Worker xu ly queue content.generate.
 * Day 2: STUB — chi chuyen status Created -> GeneratingOutline de chung minh
 * flow job + state machine hoat dong. Day 4-5 thay bang generation that
 * (outline -> sections -> assemble qua IContentAIProvider).
 */
@Injectable()
export class ContentGenerateWorker implements OnModuleInit {
  private readonly logger = new Logger(ContentGenerateWorker.name);

  constructor(
    private readonly pgBoss: PgBossService,
    @Inject(CONTENT_JOB_REPOSITORY) private readonly repository: ContentJobRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.pgBoss.registerWorker(QUEUE_NAMES.contentGenerate, (data) =>
      this.handle(data as { contentJobId: string }),
    );
  }

  private async handle(data: { contentJobId: string }): Promise<void> {
    const job = await this.repository.findById(data.contentJobId);
    if (!job) {
      // Job co the mat khi dung in-memory repo va app restart giua chung —
      // log ro thay vi nem loi de pg-boss khoi retry vo ich
      this.logger.warn(`Content job ${data.contentJobId} not found - skipping`);
      return;
    }

    job.transitionTo("GeneratingOutline");
    await this.repository.save(job);
    this.logger.log(`[STUB] Content job ${job.id} -> GeneratingOutline (real AI generation in Day 4-5)`);
  }
}
