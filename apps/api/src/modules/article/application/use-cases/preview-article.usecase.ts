import { Inject, Injectable } from "@nestjs/common";
import { articleCamNangSchema, type PreviewArticleResult } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  CONTENT_JOB_REPOSITORY,
  type ContentJobRepository,
} from "../../../ai-content/application/ports/content-job.repository";
import {
  CONTENT_DRAFT_REPOSITORY,
  type ContentDraftRepository,
} from "../../../ai-content/application/ports/content-draft.repository";
import { getArticleTypeProfile } from "../../../ai-content/application/services/article-type-profiles";
import { ArticleBlockCompiler } from "../services/article-block-compiler.service";
import { ArticleAutoLinkService } from "../services/article-auto-link.service";

/**
 * Xem truoc HTML se ghi luc Publish (dry-run, KHONG ghi SQL Server/quan he) —
 * chay DUNG compile khoi dong + auto-link nhu PublishArticleUseCase, de nguoi
 * duyet thay dung noi dung se len web TRUOC khi Approve/Publish (nhat quan voi
 * PreviewDestinationPublishHtmlUseCase, article-workflow-plan.md muc 2).
 *
 * Khac Publish: loi khoi dong KHONG throw — tra thang trong `errors` de UI
 * hien ngay trong preview, khong phai doi tao bam Publish moi biet.
 */
@Injectable()
export class PreviewArticleUseCase {
  constructor(
    @Inject(CONTENT_JOB_REPOSITORY) private readonly jobs: ContentJobRepository,
    @Inject(CONTENT_DRAFT_REPOSITORY) private readonly drafts: ContentDraftRepository,
    private readonly compiler: ArticleBlockCompiler,
    private readonly autoLink: ArticleAutoLinkService,
  ) {}

  async execute(jobId: string): Promise<PreviewArticleResult> {
    const job = await this.jobs.findById(jobId);
    if (!job) throw new DomainRuleError(`Không tìm thấy job ${jobId}`);
    const snapshot = job.toSnapshot();
    if (snapshot.articleType !== "cam-nang") {
      throw new DomainRuleError("Job này không phải bài cẩm nang (cam-nang)");
    }

    const draft = await this.drafts.findLatestByJobId(jobId);
    if (!draft?.article) throw new DomainRuleError("Draft chưa có nội dung bài viết");
    const article = articleCamNangSchema.parse(draft.article);
    const profile = getArticleTypeProfile("cam-nang");
    const rawMarkdown = draft.draftMarkdown ?? profile.renderMarkdown(article);

    const compiled = await this.compiler.compile(rawMarkdown);
    if (compiled.errors.length > 0) {
      return {
        jobId,
        html: compiled.html,
        blockCount: compiled.blockCount,
        warnings: compiled.warnings,
        errors: compiled.errors,
        addedLinks: [],
      };
    }
    const { html: linkedHtml, addedLinks } = await this.autoLink.linkHtml(compiled.html);

    return {
      jobId,
      html: linkedHtml,
      blockCount: compiled.blockCount,
      warnings: compiled.warnings,
      errors: [],
      addedLinks,
    };
  }
}
