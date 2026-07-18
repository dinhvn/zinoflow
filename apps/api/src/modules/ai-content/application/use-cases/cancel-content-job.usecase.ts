import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  CONTENT_JOB_REPOSITORY,
  type ContentJobRepository,
} from "../ports/content-job.repository";
import { DomainRuleError } from "../../../shared/errors/app-error";

/**
 * Use case: huy 1 content job dang chay (Created/GeneratingOutline) -> Failed.
 * Dung khi job "ket" (worker crash/restart giua chung khong roi vao catch de
 * tu set Failed — UI van hien dang chay mai). Sau khi huy, job co the Retry
 * lai binh thuong (Failed -> GeneratingOutline).
 */
@Injectable()
export class CancelContentJobUseCase {
  private readonly logger = new Logger(CancelContentJobUseCase.name);

  constructor(
    @Inject(CONTENT_JOB_REPOSITORY) private readonly repository: ContentJobRepository,
  ) {}

  async execute(contentJobId: string): Promise<{ jobId: string; status: string }> {
    const job = await this.repository.findById(contentJobId);
    if (!job) {
      throw new DomainRuleError(`Content job ${contentJobId} not found`, [
        "Job có thể đã bị xóa — tải lại danh sách",
      ]);
    }

    // transitionTo nem DomainRuleError 422 neu trang thai hien tai khong cho huy
    job.transitionTo("Failed");
    await this.repository.save(job);
    this.logger.log(`Job ${job.id} cancelled by user -> Failed`);

    return { jobId: job.id, status: job.status };
  }
}
