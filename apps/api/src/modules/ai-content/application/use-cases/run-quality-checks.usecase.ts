import { Inject, Injectable } from "@nestjs/common";
import type { RunQualityChecksResponse } from "@zinoflow/contracts";
import { evaluateGatesForArticle } from "../../domain/quality-gates/gate-dispatcher";
import {
  CONTENT_DRAFT_REPOSITORY,
  type ContentDraftRepository,
} from "../ports/content-draft.repository";
import {
  CONTENT_JOB_REPOSITORY,
  type ContentJobRepository,
} from "../ports/content-job.repository";
import {
  QUALITY_RESULT_REPOSITORY,
  type QualityResultRepository,
} from "../ports/quality-result.repository";
import { DomainRuleError } from "../../../shared/errors/app-error";

/**
 * Use case: chay 4 quality gates cho 1 draft va luu ket qua — spec §7.4.
 * Code thuan (khong goi AI) nen chay ngay trong request, khong can queue.
 */
@Injectable()
export class RunQualityChecksUseCase {
  constructor(
    @Inject(CONTENT_DRAFT_REPOSITORY) private readonly drafts: ContentDraftRepository,
    @Inject(CONTENT_JOB_REPOSITORY) private readonly jobs: ContentJobRepository,
    @Inject(QUALITY_RESULT_REPOSITORY) private readonly results: QualityResultRepository,
  ) {}

  async execute(draftId: string): Promise<RunQualityChecksResponse> {
    const draft = await this.drafts.findById(draftId);
    if (!draft) {
      throw new DomainRuleError(`Draft ${draftId} not found`);
    }
    if (!draft.article || !draft.draftMarkdown) {
      throw new DomainRuleError("Draft chưa có nội dung để kiểm tra", [
        "Chờ generate xong (trạng thái DraftReady) rồi chạy lại",
      ]);
    }

    const job = await this.jobs.findById(draft.jobId);
    const keywordSeed = job ? job.toSnapshot().keywordSeed : [];

    const { checks, allPassed } = evaluateGatesForArticle({
      articleType: job ? job.toSnapshot().articleType : "toplist",
      article: draft.article,
      draftMarkdown: draft.draftMarkdown,
      keywordSeed,
    });
    await this.results.replaceForDraft(draft.id, checks);

    return { draftId: draft.id, checks, allPassed };
  }
}
