import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  CONTENT_JOB_REPOSITORY,
  type ContentJobRepository,
} from "../ports/content-job.repository";
import { JOB_QUEUE, QUEUE_NAMES, type JobQueue } from "../../../shared/jobs/job-queue.port";
import { DomainRuleError } from "../../../shared/errors/app-error";

/**
 * Use case: retry/generate lai 1 content job tu UI.
 * Hop le khi job o Failed (retry) hoac DraftReady (generate lai truoc khi review)
 * — state machine enforce qua transitionTo, cac trang thai khac bi tu choi 422.
 * Draft moi se duoc luu voi version tang dan (khong ghi de draft cu).
 */
@Injectable()
export class RetryContentJobUseCase {
  private readonly logger = new Logger(RetryContentJobUseCase.name);

  constructor(
    @Inject(CONTENT_JOB_REPOSITORY) private readonly repository: ContentJobRepository,
    @Inject(JOB_QUEUE) private readonly jobQueue: JobQueue,
  ) {}

  async execute(contentJobId: string): Promise<{ jobId: string; status: string }> {
    const job = await this.repository.findById(contentJobId);
    if (!job) {
      throw new DomainRuleError(`Content job ${contentJobId} not found`, [
        "Job có thể đã bị xóa — tải lại danh sách",
      ]);
    }

    // transitionTo nem DomainRuleError neu trang thai hien tai khong cho retry
    job.transitionTo("GeneratingOutline");
    await this.repository.save(job);

    const queueJobId = await this.jobQueue.send(QUEUE_NAMES.contentGenerate, {
      contentJobId: job.id,
    });
    this.logger.log(`Job ${job.id} re-queued as ${queueJobId ?? "(queue disabled)"}`);

    return { jobId: job.id, status: job.status };
  }
}
