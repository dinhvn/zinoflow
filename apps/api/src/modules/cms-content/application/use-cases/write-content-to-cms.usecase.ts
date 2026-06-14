import { Inject, Injectable, Logger } from "@nestjs/common";
import { cmsArticleSchema, type WriteCmsResult } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  CONTENT_JOB_REPOSITORY,
  type ContentJobRepository,
} from "../../../ai-content/application/ports/content-job.repository";
import {
  CONTENT_DRAFT_REPOSITORY,
  type ContentDraftRepository,
} from "../../../ai-content/application/ports/content-draft.repository";
import {
  CMS_POST_MIRROR_REPOSITORY,
  type CmsPostMirrorRepository,
} from "../ports/cms-post-mirror.repository";
import { KHUYENMAI_CMS_DB, type KhuyenMaiCmsDb } from "../ports/khuyenmai-cms-db.port";
import { renderCmsBodyHtml } from "../services/cms-html.renderer";

/**
 * Ghi content da DUYET (Approved) xuong CMS (UPDATE WordpressPost.FixedContent) — phuong an R.
 * Gate thu cong thu 2: chi ghi khi job Approved. CMS giu chen tag + publish.
 * Bai moi (postId=0, chua co cmsId) -> Phase 4 (INSERT). Day xu ly bai DA co cmsId.
 */
@Injectable()
export class WriteContentToCmsUseCase {
  private readonly logger = new Logger(WriteContentToCmsUseCase.name);

  constructor(
    @Inject(CMS_POST_MIRROR_REPOSITORY) private readonly mirror: CmsPostMirrorRepository,
    @Inject(KHUYENMAI_CMS_DB) private readonly cmsDb: KhuyenMaiCmsDb,
    @Inject(CONTENT_JOB_REPOSITORY) private readonly jobRepo: ContentJobRepository,
    @Inject(CONTENT_DRAFT_REPOSITORY) private readonly draftRepo: ContentDraftRepository,
  ) {}

  async execute(cmsId: number): Promise<WriteCmsResult> {
    const post = await this.mirror.findByCmsId(cmsId);
    if (!post) throw new DomainRuleError(`Không tìm thấy bài CMS #${cmsId}`);

    const jobId = post.activeContentJobId;
    if (!jobId) {
      throw new DomainRuleError(`Bài "${post.title}" không có bài đang chờ ghi`, [
        "Tạo bài AI và duyệt (Approved) trước khi ghi vào CMS",
      ]);
    }
    const job = await this.jobRepo.findById(jobId);
    const snapshot = job?.toSnapshot();
    if (snapshot?.status !== "Approved") {
      throw new DomainRuleError(
        `Bài đang ở trạng thái ${snapshot?.status ?? "?"} — chỉ ghi được bài đã duyệt (Approved)`,
      );
    }

    const draft = await this.draftRepo.findLatestByJobId(jobId);
    if (!draft?.article) throw new DomainRuleError("Draft đã duyệt không có nội dung bài viết");
    const article = cmsArticleSchema.parse(draft.article);

    const html = await renderCmsBodyHtml(article);
    await this.cmsDb.updateContent(cmsId, {
      title: article.title,
      fixedContent: html,
      excerpt: article.excerpt,
    });
    await this.mirror.markContentWritten(cmsId, new Date());

    this.logger.log(`Ghi content vao CMS #${cmsId} (job ${jobId})`);
    return { cmsId, jobId, title: article.title };
  }
}
