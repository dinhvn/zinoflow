import { Inject, Injectable } from "@nestjs/common";
import type { ArticleDestinationMapItem, ArticleTopic } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  ARTICLE_PUBLICATION_REPOSITORY,
  type ArticlePublicationRepository,
} from "../ports/article-publication.repository";
import { ARTICLE_SITE_DB, type ArticleSiteDb } from "../ports/article-site-db.port";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../../../destination/application/ports/destination-mirror.repository";

/** Doc gan ket Article -> Destination hien tai cua 1 bai da publish (article-spec §8.1) */
@Injectable()
export class GetArticleDestinationMapUseCase {
  constructor(
    @Inject(ARTICLE_PUBLICATION_REPOSITORY)
    private readonly publications: ArticlePublicationRepository,
    @Inject(ARTICLE_SITE_DB) private readonly siteDb: ArticleSiteDb,
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
  ) {}

  async execute(jobId: string): Promise<{ items: ArticleDestinationMapItem[] }> {
    const publication = await this.publications.findByJobId(jobId);
    if (!publication) throw new DomainRuleError(`Bài ${jobId} chưa publish — chưa có gán điểm đến`);

    const [rows, allDestinations] = await Promise.all([
      this.siteDb.fetchDestinationMap(publication.siteId),
      this.mirrorRepo.findAll(),
    ]);
    const nameBySlug = new Map(allDestinations.map((d) => [d.slug, d.name]));

    return {
      items: rows.map((r) => ({
        destinationSlug: r.destinationSlug,
        destinationName: nameBySlug.get(r.destinationSlug) ?? r.destinationSlug,
        topic: r.topic as ArticleTopic,
        order: r.order,
      })),
    };
  }
}
