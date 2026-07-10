import { Inject, Injectable, Logger } from "@nestjs/common";
import { articleCamNangSchema, type PublishArticleResult } from "@zinoflow/contracts";
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
import { ARTICLE_SITE_DB, type ArticleSiteDb } from "../ports/article-site-db.port";
import {
  ARTICLE_PUBLICATION_REPOSITORY,
  type ArticlePublicationRepository,
} from "../ports/article-publication.repository";

const SHORT_DESCRIPTION_MAX = 500;

/**
 * Publish bai cam nang DA DUYET xuong SQL Server (article-spec §4, §8). Gate
 * publish rieng: MOI token phai parse + resolve duoc (khong loi cu phap/tham
 * so) — loi thi CHAN publish luon (khac gate Approve o domain, day la kiem tra
 * can DB nen nam o application layer).
 */
@Injectable()
export class PublishArticleUseCase {
  private readonly logger = new Logger(PublishArticleUseCase.name);

  constructor(
    @Inject(CONTENT_JOB_REPOSITORY) private readonly jobs: ContentJobRepository,
    @Inject(CONTENT_DRAFT_REPOSITORY) private readonly drafts: ContentDraftRepository,
    @Inject(ARTICLE_SITE_DB) private readonly siteDb: ArticleSiteDb,
    @Inject(ARTICLE_PUBLICATION_REPOSITORY)
    private readonly publications: ArticlePublicationRepository,
    private readonly compiler: ArticleBlockCompiler,
    private readonly autoLink: ArticleAutoLinkService,
  ) {}

  async execute(jobId: string): Promise<PublishArticleResult> {
    const startedAt = Date.now();
    const job = await this.jobs.findById(jobId);
    if (!job) throw new DomainRuleError(`Không tìm thấy job ${jobId}`);
    const snapshot = job.toSnapshot();
    if (snapshot.articleType !== "cam-nang") {
      throw new DomainRuleError("Job này không phải bài cẩm nang (cam-nang)");
    }
    if (snapshot.status !== "Approved") {
      throw new DomainRuleError(
        `Bài đang ở trạng thái ${snapshot.status} — chỉ publish được bài đã duyệt (Approved)`,
      );
    }

    const draft = await this.drafts.findLatestByJobId(jobId);
    if (!draft?.article) throw new DomainRuleError("Draft đã duyệt không có nội dung bài viết");
    const article = articleCamNangSchema.parse(draft.article);
    const profile = getArticleTypeProfile("cam-nang");
    const rawMarkdown = draft.draftMarkdown ?? profile.renderMarkdown(article);

    const compiled = await this.compiler.compile(rawMarkdown);
    if (compiled.errors.length > 0) {
      throw new DomainRuleError(
        "Bài có khối động lỗi — sửa trước khi publish",
        compiled.errors.map((e) => e.message),
      );
    }
    // Chen link noi bo toi diem den nhac trong bai (dung chung engine voi
    // publish-destination.usecase.ts — backlog §B Phase C muc 5).
    const linkedHtml = await this.autoLink.linkHtml(compiled.html);

    const existing = await this.publications.findByJobId(jobId);
    const slug = existing?.slug ?? article.metadata.slugSuggestion;

    const { siteId } = await this.siteDb.upsertArticle({
      siteId: existing?.siteId ?? null,
      slug,
      title: article.title,
      shortDescription: article.intro.slice(0, SHORT_DESCRIPTION_MAX),
      thumbnail: null,
      contentHtml: linkedHtml,
      metaTitle: article.metadata.metaTitle,
      metaDescription: article.metadata.metaDescription,
    });

    await this.publications.upsert({ jobId, siteId, slug, publishedAt: new Date() });

    this.logger.log(
      `Publish bài cẩm nang ${jobId} (${slug}) -> siteId ${siteId}, ${compiled.blockCount} khối động`,
    );
    return {
      jobId,
      slug,
      siteId,
      blockCount: compiled.blockCount,
      warnings: compiled.warnings,
      durationMs: Date.now() - startedAt,
    };
  }
}
