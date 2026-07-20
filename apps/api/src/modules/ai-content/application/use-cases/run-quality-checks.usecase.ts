import { Inject, Injectable } from "@nestjs/common";
import type { DestinationArticle, RunQualityChecksResponse } from "@zinoflow/contracts";
import { evaluateGatesForArticle } from "../../domain/quality-gates/gate-dispatcher";
import { extractOriginalityExcerpt } from "../../domain/quality-gates/originality-excerpt";
import type { SimilarDestinationExcerpt } from "../../domain/quality-gates/originality-gate";
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
import {
  ORIGINALITY_CORPUS_REPOSITORY,
  type OriginalityCorpusRepository,
} from "../ports/originality-corpus.repository";
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
    @Inject(ORIGINALITY_CORPUS_REPOSITORY)
    private readonly originalityCorpus: OriginalityCorpusRepository,
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
    const snapshot = job?.toSnapshot();
    const keywordSeed = snapshot ? snapshot.keywordSeed : [];

    let originalitySimilarTo: SimilarDestinationExcerpt[] | undefined;
    if (snapshot?.articleType === "guide-diem-den" && snapshot.comparisonKey) {
      originalitySimilarTo = await this.originalityCorpus.findSimilar({
        excerpt: extractOriginalityExcerpt(draft.article as DestinationArticle),
        comparisonKey: snapshot.comparisonKey,
        articleType: snapshot.articleType,
        excludeJobId: snapshot.id,
      });
    }

    const { checks, allPassed } = evaluateGatesForArticle({
      articleType: snapshot ? snapshot.articleType : "toplist",
      article: draft.article,
      draftMarkdown: draft.draftMarkdown,
      keywordSeed,
      contentTier: snapshot?.contentTier,
      originalitySimilarTo,
    });
    await this.results.replaceForDraft(draft.id, checks);

    return { draftId: draft.id, checks, allPassed };
  }
}
