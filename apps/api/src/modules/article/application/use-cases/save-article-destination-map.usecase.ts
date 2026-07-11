import { Inject, Injectable, Logger } from "@nestjs/common";
import type { SaveArticleDestinationMapRequest } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  ARTICLE_PUBLICATION_REPOSITORY,
  type ArticlePublicationRepository,
} from "../ports/article-publication.repository";
import { ARTICLE_SITE_DB, type ArticleSiteDb } from "../ports/article-site-db.port";

/**
 * Ghi de gan ket Article -> Destination theo tick xac nhan cua nguoi dung
 * (article-spec §8.1, Phase 26) — KHONG bao gio tu gan im lang, day la buoc
 * LUU sau khi da xac nhan trong form (nguon goi y: publishResult.addedLinks).
 */
@Injectable()
export class SaveArticleDestinationMapUseCase {
  private readonly logger = new Logger(SaveArticleDestinationMapUseCase.name);

  constructor(
    @Inject(ARTICLE_PUBLICATION_REPOSITORY)
    private readonly publications: ArticlePublicationRepository,
    @Inject(ARTICLE_SITE_DB) private readonly siteDb: ArticleSiteDb,
  ) {}

  async execute(jobId: string, request: SaveArticleDestinationMapRequest): Promise<void> {
    const publication = await this.publications.findByJobId(jobId);
    if (!publication) throw new DomainRuleError(`Bài ${jobId} chưa publish — chưa gán được điểm đến`);

    await this.siteDb.replaceDestinationMap(publication.siteId, request.items);
    this.logger.log(
      `Gán ${request.items.length} điểm đến cho bài ${publication.slug} (article-spec §8.1)`,
    );
  }
}
