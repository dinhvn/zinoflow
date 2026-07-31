import { Inject, Injectable } from "@nestjs/common";
import type { SetArticleCategoryRequest } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  CONTENT_JOB_REPOSITORY,
  type ContentJobRepository,
} from "../../../ai-content/application/ports/content-job.repository";

/**
 * Gan danh muc bai cam nang (loc/lien ket tren /cam-nang/danh-muc — chot
 * 31/07/2026, dichoithoi-camnang-affiliate-overflow-plan.md). Doc lap voi
 * noi dung — khong can Approve/publish lai de doi danh muc.
 */
@Injectable()
export class SetArticleCategoryUseCase {
  constructor(
    @Inject(CONTENT_JOB_REPOSITORY) private readonly jobs: ContentJobRepository,
  ) {}

  async execute(jobId: string, request: SetArticleCategoryRequest): Promise<void> {
    const job = await this.jobs.findById(jobId);
    if (!job) throw new DomainRuleError(`Không tìm thấy job ${jobId}`);

    job.setCategory(request.category);
    await this.jobs.save(job);
  }
}
