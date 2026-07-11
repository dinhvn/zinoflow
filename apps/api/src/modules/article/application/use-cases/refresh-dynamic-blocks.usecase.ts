import { Inject, Injectable, Logger } from "@nestjs/common";
import { articleCamNangSchema, type RefreshDynamicBlocksResult } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
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

/**
 * "Làm mới khối động" (article-spec §7) — KHÁC "Cập nhật bài": KHÔNG gọi AI,
 * văn bản giữ nguyên, chỉ re-compile lại token với dữ liệu mirror mới nhất.
 * KHÔNG cần qua review lại — chỉ ghi đè ContentHtml.
 */
@Injectable()
export class RefreshDynamicBlocksUseCase {
  private readonly logger = new Logger(RefreshDynamicBlocksUseCase.name);

  constructor(
    @Inject(CONTENT_DRAFT_REPOSITORY) private readonly drafts: ContentDraftRepository,
    @Inject(ARTICLE_SITE_DB) private readonly siteDb: ArticleSiteDb,
    @Inject(ARTICLE_PUBLICATION_REPOSITORY)
    private readonly publications: ArticlePublicationRepository,
    private readonly compiler: ArticleBlockCompiler,
    private readonly autoLink: ArticleAutoLinkService,
  ) {}

  async execute(jobId: string): Promise<RefreshDynamicBlocksResult> {
    const publication = await this.publications.findByJobId(jobId);
    if (!publication) {
      throw new DomainRuleError(`Job ${jobId} chưa publish lần nào — publish trước khi làm mới`);
    }

    const draft = await this.drafts.findLatestByJobId(jobId);
    if (!draft?.article) throw new DomainRuleError("Không tìm thấy nội dung bài viết");
    const article = articleCamNangSchema.parse(draft.article);
    const profile = getArticleTypeProfile("cam-nang");
    const rawMarkdown = draft.draftMarkdown ?? profile.renderMarkdown(article);

    const compiled = await this.compiler.compile(rawMarkdown);
    if (compiled.errors.length > 0) {
      throw new DomainRuleError(
        "Bài có khối động lỗi — sửa trước khi làm mới",
        compiled.errors.map((e) => e.message),
      );
    }
    const { html: linkedHtml } = await this.autoLink.linkHtml(compiled.html);

    await this.siteDb.updateContentHtml(publication.siteId, linkedHtml);
    await this.publications.markRefreshed(jobId, new Date());

    this.logger.log(`Làm mới khối động ${jobId} (${publication.slug}): ${compiled.blockCount} khối`);
    return {
      jobId,
      slug: publication.slug,
      blockCount: compiled.blockCount,
      warnings: compiled.warnings,
    };
  }
}
