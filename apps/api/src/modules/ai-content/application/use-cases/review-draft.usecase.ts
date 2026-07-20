import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { DestinationArticle, ReviewDraftRequest } from "@zinoflow/contracts";
import { evaluateGatesForArticle } from "../../domain/quality-gates/gate-dispatcher";
import { extractOriginalityExcerpt } from "../../domain/quality-gates/originality-excerpt";
import type { SimilarDestinationExcerpt } from "../../domain/quality-gates/originality-gate";
import { ContentJob } from "../../domain/content-job";
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
  REVIEW_RECORD_REPOSITORY,
  type ReviewRecordRepository,
} from "../ports/review-record.repository";
import {
  ORIGINALITY_CORPUS_REPOSITORY,
  type OriginalityCorpusRepository,
} from "../ports/originality-corpus.repository";
import { DomainRuleError } from "../../../shared/errors/app-error";

/**
 * Use case: review action tren 1 draft — spec §7.5.
 * - Approve: CHAY LAI gates ngay luc duyet, bat ky gate fail -> chan (spec §9, §5).
 *   (khong tin ket qua check cu — noi dung co the da bi sua sau lan check truoc)
 * - Reject: bat buoc co ly do (spec §5).
 * - RequestChange: tra ve DraftReady de sua tiep.
 * Moi action ghi 1 ReviewRecord (actor M3 co dinh "admin" — multi-user ngoai pham vi MVP).
 */
@Injectable()
export class ReviewDraftUseCase {
  private readonly logger = new Logger(ReviewDraftUseCase.name);
  private static readonly ACTOR = "admin";

  constructor(
    @Inject(CONTENT_DRAFT_REPOSITORY) private readonly drafts: ContentDraftRepository,
    @Inject(CONTENT_JOB_REPOSITORY) private readonly jobs: ContentJobRepository,
    @Inject(QUALITY_RESULT_REPOSITORY) private readonly results: QualityResultRepository,
    @Inject(REVIEW_RECORD_REPOSITORY) private readonly reviews: ReviewRecordRepository,
    @Inject(ORIGINALITY_CORPUS_REPOSITORY)
    private readonly originalityCorpus: OriginalityCorpusRepository,
  ) {}

  async execute(draftId: string, request: ReviewDraftRequest): Promise<{ newStatus: string }> {
    const draft = await this.drafts.findById(draftId);
    if (!draft) throw new DomainRuleError(`Draft ${draftId} not found`);

    // Chi review duoc version moi nhat — version cu la lich su
    const latest = await this.drafts.findLatestByJobId(draft.jobId);
    if (latest && latest.id !== draft.id) {
      throw new DomainRuleError("Chỉ review được version mới nhất của bài viết", [
        `Version mới nhất là v${latest.version}`,
      ]);
    }

    const job = await this.jobs.findById(draft.jobId);
    if (!job) throw new DomainRuleError(`Content job ${draft.jobId} not found`);

    switch (request.action) {
      case "Approve": {
        await this.assertAllGatesPass(draft.id, job);
        job.transitionTo("Approved");
        break;
      }
      case "Reject": {
        if (!request.note?.trim()) {
          throw new DomainRuleError("Từ chối bài viết bắt buộc phải ghi lý do");
        }
        job.transitionTo("Rejected");
        break;
      }
      case "RequestChange": {
        job.transitionTo("DraftReady");
        break;
      }
    }

    await this.jobs.save(job);
    await this.reviews.save({
      id: randomUUID(),
      draftId: draft.id,
      action: request.action,
      note: request.note?.trim() || null,
      actor: ReviewDraftUseCase.ACTOR,
      createdAt: new Date(),
    });
    this.logger.log(`Draft ${draft.id} (job ${job.id}): ${request.action} -> ${job.status}`);

    return { newStatus: job.status };
  }

  /**
   * Approve bi block den khi ca 4 gate error pass — spec §9. Gate "originality"
   * (severity=warning) KHONG chan (allPassed tu evaluateGatesForArticle da bo
   * qua no) — chi hien canh bao cho nguoi duyet tu quyet dinh (07/2026).
   * Nhan `job` (instance dang dung o execute(), CHUA save) de ghi thang
   * originalityExcerpt vao cung instance nay — save() o execute() se persist
   * luon, khong can fetch/save rieng.
   */
  private async assertAllGatesPass(draftId: string, job: ContentJob): Promise<void> {
    const draft = await this.drafts.findById(draftId);
    if (!draft?.article || !draft.draftMarkdown) {
      throw new DomainRuleError("Draft chưa có nội dung để duyệt");
    }
    const snapshot = job.toSnapshot();

    let originalitySimilarTo: SimilarDestinationExcerpt[] | undefined;
    let excerpt: string | undefined;
    if (snapshot.articleType === "guide-diem-den" && snapshot.comparisonKey) {
      excerpt = extractOriginalityExcerpt(draft.article as DestinationArticle);
      originalitySimilarTo = await this.originalityCorpus.findSimilar({
        excerpt,
        comparisonKey: snapshot.comparisonKey,
        articleType: snapshot.articleType,
        excludeJobId: snapshot.id,
      });
    }

    const { checks, allPassed } = evaluateGatesForArticle({
      articleType: snapshot.articleType,
      article: draft.article,
      draftMarkdown: draft.draftMarkdown,
      keywordSeed: snapshot.keywordSeed,
      contentTier: snapshot.contentTier,
      originalitySimilarTo,
    });
    await this.results.replaceForDraft(draftId, checks);

    if (!allPassed) {
      const failures = checks
        .filter((c) => !c.passed)
        .flatMap((c) => c.details.map((d) => `[${c.gateName}] ${d}`));
      throw new DomainRuleError(
        "Không thể duyệt: còn quality gate chưa đạt — sửa nội dung rồi thử lại",
        failures,
      );
    }

    if (excerpt !== undefined) {
      job.setOriginalityExcerpt(excerpt);
    }
  }
}
