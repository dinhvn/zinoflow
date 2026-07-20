import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { CreateContentJobResponse, CreateManualDraftRequest } from "@zinoflow/contracts";
import { ContentJob } from "../../domain/content-job";
import { CONTENT_JOB_REPOSITORY, type ContentJobRepository } from "../ports/content-job.repository";
import {
  CONTENT_DRAFT_REPOSITORY,
  type ContentDraftRepository,
} from "../ports/content-draft.repository";
import { getArticleTypeProfile } from "../services/article-type-profiles";

/**
 * Tao draft VIET TAY — sourceType=Manual (dichoithoi-article-spec.md §1.1).
 * KHONG enqueue pg-boss, KHONG goi AI provider: job di THANG Created -> DraftReady
 * voi 1 khung bai goi y cau truc (placeholder ro rang, nguoi dung sua tiep qua
 * man edit thong thuong). Sau DraftReady, moi buoc (edit/quality gate/review/
 * approve/publish) chay giong het bai AI — khong co duong tat bo qua gate nao.
 */
@Injectable()
export class CreateManualDraftUseCase {
  private readonly logger = new Logger(CreateManualDraftUseCase.name);

  // Khong goi AI nhung domain entity van can 1 gia tri hop le cho field bat buoc.
  private static readonly INERT_PROVIDER = "anthropic" as const;
  private static readonly INERT_MODEL = "manual";

  constructor(
    @Inject(CONTENT_JOB_REPOSITORY) private readonly jobs: ContentJobRepository,
    @Inject(CONTENT_DRAFT_REPOSITORY) private readonly drafts: ContentDraftRepository,
  ) {}

  async execute(request: CreateManualDraftRequest): Promise<CreateContentJobResponse> {
    const job = ContentJob.create({
      id: randomUUID(),
      siteCode: request.siteCode,
      sourceType: "Manual",
      sourceRef: request.sourceRef,
      topic: request.topic,
      articleType: request.articleType,
      keywordSeed: request.keywordSeed,
      toneProfile: null,
      sourceContext: request.sourceContext ?? null,
      contentTier: null,
      comparisonKey: null,
      originalityExcerpt: null,
      coverImageId: null,
      aiProvider: CreateManualDraftUseCase.INERT_PROVIDER,
      aiModel: CreateManualDraftUseCase.INERT_MODEL,
    });

    const profile = getArticleTypeProfile(request.articleType);
    const article = profile.createManualSkeleton(request.topic);

    // Job PHAI ghi truoc draft — draft.jobId co FK tro toi content_jobs.id,
    // ghi nguoc lai se vi pham foreign key constraint (job chua ton tai trong DB).
    job.transitionTo("DraftReady");
    await this.jobs.save(job);

    await this.drafts.save({
      id: randomUUID(),
      jobId: job.id,
      version: 1,
      title: profile.extractTitle(article),
      outline: { title: profile.extractTitle(article), sectionHeadings: [] },
      article,
      draftMarkdown: profile.renderMarkdown(article),
      createdAt: new Date(),
    });

    this.logger.log(`Job ${job.id} (Manual) -> DraftReady ngay, khong qua AI`);

    return { jobId: job.id, status: job.status };
  }
}
