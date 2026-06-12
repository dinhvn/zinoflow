import { Inject, Injectable } from "@nestjs/common";
import {
  CONTENT_JOB_REPOSITORY,
  type ContentJobRepository,
} from "../ports/content-job.repository";
import { DomainRuleError } from "../../../shared/errors/app-error";

/**
 * Use case: gui draft vao review — DraftReady -> InReview.
 * Transition khac bi state machine chan (422).
 */
@Injectable()
export class SubmitForReviewUseCase {
  constructor(
    @Inject(CONTENT_JOB_REPOSITORY) private readonly jobs: ContentJobRepository,
  ) {}

  async execute(jobId: string): Promise<{ jobId: string; status: string }> {
    const job = await this.jobs.findById(jobId);
    if (!job) {
      throw new DomainRuleError(`Content job ${jobId} not found`);
    }
    job.transitionTo("InReview");
    await this.jobs.save(job);
    return { jobId: job.id, status: job.status };
  }
}
