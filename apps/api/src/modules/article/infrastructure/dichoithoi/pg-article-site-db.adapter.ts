import { Injectable } from "@nestjs/common";
import { UpstreamApiError } from "../../../shared/errors/app-error";
import { DichoithoiSiteDbConnection } from "../../../shared/dichoithoi-site-db/dichoithoi-site-db.connection";
import type {
  ArticleDestinationMapRow,
  ArticleSiteDb,
  UpsertArticleInput,
} from "../../application/ports/article-site-db.port";

/** Adapter PostgreSQL cho v2.article (article-spec §8). */
@Injectable()
export class PgArticleSiteDbAdapter implements ArticleSiteDb {
  constructor(private readonly db: DichoithoiSiteDbConnection) {}

  isConfigured(): boolean {
    return this.db.isConfigured();
  }

  async upsertArticle(input: UpsertArticleInput): Promise<{ siteId: number }> {
    const params = {
      slug: input.slug,
      title: input.title,
      shortDescription: input.shortDescription,
      thumbnail: input.thumbnail,
      contentHtml: input.contentHtml,
      metaTitle: input.metaTitle,
      metaDescription: input.metaDescription,
      category: input.category,
    };
    const { rows } =
      input.siteId === null
        ? await this.db.query<{ id: number }>(
            `INSERT INTO v2.article
               (slug, title, short_description, thumbnail, content_html, meta_title, meta_description,
                category, status, published_at)
             VALUES
               (@slug, @title, @shortDescription, @thumbnail, @contentHtml, @metaTitle, @metaDescription,
                @category, 1, now())
             RETURNING id`,
            params,
          )
        : await this.db.query<{ id: number }>(
            `UPDATE v2.article SET
               slug = @slug, title = @title, short_description = @shortDescription, thumbnail = @thumbnail,
               content_html = @contentHtml, meta_title = @metaTitle, meta_description = @metaDescription,
               category = @category,
               status = 1, published_at = COALESCE(published_at, now()), updated_at = now()
             WHERE id = @siteId RETURNING id`,
            { ...params, siteId: input.siteId },
          );
    const siteId = rows[0]?.id;
    if (!siteId) throw new UpstreamApiError(`Không upsert được bài cẩm nang "${input.slug}"`);
    return { siteId };
  }

  async updateContentHtml(siteId: number, contentHtml: string): Promise<void> {
    await this.db.query(
      `UPDATE v2.article SET content_html = @contentHtml, updated_at = now() WHERE id = @siteId`,
      { siteId, contentHtml },
    );
  }

  async fetchDestinationMap(articleId: number): Promise<ArticleDestinationMapRow[]> {
    const { rows } = await this.db.query<{ destination_slug: string; topic: string; order: number }>(
      `SELECT destination_slug, topic, "order" FROM v2.article_destination_map
       WHERE article_id = @articleId ORDER BY topic, "order"`,
      { articleId },
    );
    return rows.map((r) => ({
      destinationSlug: r.destination_slug,
      topic: r.topic,
      order: Number(r.order),
    }));
  }

  /** Thay toan bo map cua 1 bai — bo qua slug khong con ton tai tren website. */
  async replaceDestinationMap(
    articleId: number,
    items: readonly ArticleDestinationMapRow[],
  ): Promise<void> {
    await this.db.transaction(async (query) => {
      await query(`DELETE FROM v2.article_destination_map WHERE article_id = @articleId`, { articleId });
      if (items.length === 0) return;
      await query(
        `INSERT INTO v2.article_destination_map (article_id, destination_slug, topic, "order")
         SELECT @articleId::int, item.slug, item.topic, item.ord
         FROM unnest(@slugs::text[], @topics::text[], @orders::int[]) AS item(slug, topic, ord)
         WHERE EXISTS (SELECT 1 FROM v2.destination d WHERE d.slug = item.slug)`,
        {
          articleId,
          slugs: items.map((i) => i.destinationSlug),
          topics: items.map((i) => i.topic),
          orders: items.map((i) => i.order),
        },
      );
    });
  }
}
