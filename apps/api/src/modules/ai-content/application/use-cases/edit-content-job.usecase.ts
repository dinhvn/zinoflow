import { Inject, Injectable } from "@nestjs/common";
import type { UpdateContentJobRequest } from "@zinoflow/contracts";
import { ContentJob } from "../../domain/content-job";
import {
  CONTENT_JOB_REPOSITORY,
  type ContentJobRepository,
} from "../ports/content-job.repository";
import {
  AI_PROVIDER_SETTINGS,
  type AiProviderSettings,
} from "../ports/ai-provider-settings.port";
import { DomainRuleError } from "../../../shared/errors/app-error";

/**
 * Use case: sua tham so sinh bai (topic/keyword/tone/provider/model) cua 1 job
 * dang Failed hoac DraftReady, truoc khi bam chay lai (retry).
 * Domain (updateGenerationParams) enforce trang thai; day KHONG requeue —
 * UI goi retry sau khi luu de tach 2 buoc ro rang.
 */
@Injectable()
export class EditContentJobUseCase {
  constructor(
    @Inject(CONTENT_JOB_REPOSITORY) private readonly repository: ContentJobRepository,
    @Inject(AI_PROVIDER_SETTINGS) private readonly providerSettings: AiProviderSettings,
  ) {}

  async execute(contentJobId: string, request: UpdateContentJobRequest): Promise<ContentJob> {
    const job = await this.repository.findById(contentJobId);
    if (!job) {
      throw new DomainRuleError(`Content job ${contentJobId} not found`, [
        "Job có thể đã bị xóa — tải lại danh sách",
      ]);
    }

    // Provider bi tat tu Settings -> tu choi (dong bo voi CreateContentJobUseCase)
    if (request.aiProvider && !(await this.providerSettings.isEnabled(request.aiProvider))) {
      throw new DomainRuleError(`AI provider "${request.aiProvider}" is disabled`, [
        "Bật lại provider này trong trang Settings trước khi chọn",
      ]);
    }

    job.updateGenerationParams(request);
    await this.repository.save(job);
    return job;
  }
}
