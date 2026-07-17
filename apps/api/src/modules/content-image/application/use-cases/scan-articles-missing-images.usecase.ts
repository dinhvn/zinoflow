import { Inject, Injectable } from "@nestjs/common";
import type { ArticleMissingImage } from "@zinoflow/contracts";
import {
  CONTENT_JOB_REPOSITORY,
  type ContentJobRepository,
} from "../../../ai-content/application/ports/content-job.repository";
import {
  CONTENT_DRAFT_REPOSITORY,
  type ContentDraftRepository,
} from "../../../ai-content/application/ports/content-draft.repository";

/** Bai cam nang co noi dung nhung chua co token [[block:image nao (auto-image-search-plan §2.1).
 * Truy van thuan DB, khong can AI — chi dem so lan token xuat hien. */
const HAS_CONTENT_STATUSES = new Set(["DraftReady", "Approved"]);

@Injectable()
export class ScanArticlesMissingImagesUseCase {
  constructor(
    @Inject(CONTENT_JOB_REPOSITORY) private readonly jobs: ContentJobRepository,
    @Inject(CONTENT_DRAFT_REPOSITORY) private readonly drafts: ContentDraftRepository,
  ) {}

  async execute(): Promise<ArticleMissingImage[]> {
    const allJobs = await this.jobs.findAll();
    const candidates = allJobs
      .map((j) => j.toSnapshot())
      .filter((j) => j.articleType === "cam-nang" && HAS_CONTENT_STATUSES.has(j.status));

    const results: ArticleMissingImage[] = [];
    for (const job of candidates) {
      const draft = await this.drafts.findLatestByJobId(job.id);
      if (!draft?.draftMarkdown?.trim()) continue;
      if (draft.draftMarkdown.includes("[[block:image")) continue;
      results.push({ jobId: job.id, title: draft.title ?? job.topic });
    }
    return results;
  }
}
