import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import type * as sql from "mssql";
import { UpstreamApiError } from "../../../shared/errors/app-error";
import type {
  ArticleDestinationMapRow,
  ArticleSiteDb,
  UpsertArticleInput,
} from "../../application/ports/article-site-db.port";

function isLocalDbHost(host: string): boolean {
  return host.toLowerCase().startsWith("(localdb)");
}

function loadMssqlDriver(host: string): typeof sql {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return isLocalDbHost(host) ? require("mssql/msnodesqlv8") : require("mssql");
}

/** Adapter SQL Server cho v2.Article (article-spec §8) */
@Injectable()
export class MssqlArticleSiteDbAdapter implements ArticleSiteDb, OnModuleDestroy {
  private readonly logger = new Logger(MssqlArticleSiteDbAdapter.name);
  private pool: sql.ConnectionPool | null = null;

  isConfigured(): boolean {
    return Boolean(process.env.DICHOITHOI_DB_HOST && process.env.DICHOITHOI_DB_USER);
  }

  async upsertArticle(input: UpsertArticleInput): Promise<{ siteId: number }> {
    const rows = await this.runWithRetry<Array<{ SiteId: number }>>(async (pool) => {
      const request = pool.request();
      request.input("siteId", input.siteId);
      request.input("slug", input.slug);
      request.input("title", input.title);
      request.input("shortDescription", input.shortDescription);
      request.input("thumbnail", input.thumbnail);
      request.input("contentHtml", input.contentHtml);
      request.input("metaTitle", input.metaTitle);
      request.input("metaDescription", input.metaDescription);
      const result = await request.query<{ SiteId: number }>(`
        IF @siteId IS NULL
        BEGIN
          INSERT INTO v2.Article
            (Slug, Title, ShortDescription, Thumbnail, ContentHtml, MetaTitle, MetaDescription,
             Status, PublishedAt)
          VALUES
            (@slug, @title, @shortDescription, @thumbnail, @contentHtml, @metaTitle, @metaDescription,
             1, SYSUTCDATETIME());
          SELECT CAST(SCOPE_IDENTITY() AS int) AS SiteId;
        END
        ELSE
        BEGIN
          UPDATE v2.Article SET
            Slug = @slug, Title = @title, ShortDescription = @shortDescription, Thumbnail = @thumbnail,
            ContentHtml = @contentHtml, MetaTitle = @metaTitle, MetaDescription = @metaDescription,
            Status = 1, PublishedAt = COALESCE(PublishedAt, SYSUTCDATETIME()), UpdatedAt = SYSUTCDATETIME()
          WHERE Id = @siteId;
          SELECT @siteId AS SiteId;
        END
      `);
      return result.recordset;
    });
    const siteId = rows[0]?.SiteId;
    if (!siteId) throw new UpstreamApiError(`Không upsert được bài cẩm nang "${input.slug}"`);
    return { siteId };
  }

  async updateContentHtml(siteId: number, contentHtml: string): Promise<void> {
    await this.runWithRetry(async (pool) => {
      const request = pool.request();
      request.input("siteId", siteId);
      request.input("contentHtml", contentHtml);
      return request.query(
        `UPDATE v2.Article SET ContentHtml = @contentHtml, UpdatedAt = SYSUTCDATETIME() WHERE Id = @siteId`,
      );
    });
  }

  async fetchDestinationMap(articleId: number): Promise<ArticleDestinationMapRow[]> {
    const rows = await this.runWithRetry<Array<{ DestinationSlug: string; Topic: string; Order: number }>>(
      async (pool) => {
        const request = pool.request();
        request.input("articleId", articleId);
        const result = await request.query<{ DestinationSlug: string; Topic: string; Order: number }>(
          `SELECT DestinationSlug, Topic, [Order] FROM v2.ArticleDestinationMap
           WHERE ArticleId = @articleId ORDER BY Topic, [Order]`,
        );
        return result.recordset;
      },
    );
    return rows.map((r) => ({
      destinationSlug: r.DestinationSlug,
      topic: r.Topic,
      order: Number(r.Order),
    }));
  }

  async replaceDestinationMap(
    articleId: number,
    items: readonly ArticleDestinationMapRow[],
  ): Promise<void> {
    await this.runWithRetry(async (pool) => {
      const request = pool.request();
      request.input("articleId", articleId);
      items.forEach((item, i) => {
        request.input(`slug${i}`, item.destinationSlug);
        request.input(`topic${i}`, item.topic);
        request.input(`order${i}`, item.order);
      });
      const insertRows = items
        .map(
          (_, i) =>
            `SELECT @articleId, @slug${i}, @topic${i}, @order${i}
             WHERE EXISTS (SELECT 1 FROM v2.Destination WHERE Slug = @slug${i})`,
        )
        .join("\nUNION ALL\n");
      return request.query(`
        DELETE FROM v2.ArticleDestinationMap WHERE ArticleId = @articleId;
        ${
          items.length > 0
            ? `INSERT INTO v2.ArticleDestinationMap (ArticleId, DestinationSlug, Topic, [Order])\n${insertRows}`
            : ""
        }
      `);
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
    }
  }

  private async getPool(): Promise<sql.ConnectionPool> {
    if (this.pool?.connected) return this.pool;
    if (!this.isConfigured()) {
      throw new UpstreamApiError(
        "Chưa cấu hình kết nối database dichoithoi (DICHOITHOI_DB_* trong .env)",
      );
    }
    const host = process.env.DICHOITHOI_DB_HOST ?? "";
    const driver = loadMssqlDriver(host);
    const config: sql.config = isLocalDbHost(host)
      ? ({
          connectionString:
            `Driver={ODBC Driver 17 for SQL Server};Server=${host};` +
            `Database=${process.env.DICHOITHOI_DB_NAME};Trusted_Connection=yes;`,
          connectionTimeout: 15_000,
          requestTimeout: 30_000,
          pool: { max: 4, min: 0 },
        } as unknown as sql.config)
      : {
          server: host,
          database: process.env.DICHOITHOI_DB_NAME ?? "",
          user: process.env.DICHOITHOI_DB_USER ?? "",
          password: process.env.DICHOITHOI_DB_PASSWORD ?? "",
          options: { encrypt: true, trustServerCertificate: true },
          connectionTimeout: 15_000,
          requestTimeout: 30_000,
          pool: { max: 4, min: 0 },
        };
    this.pool = await new driver.ConnectionPool(config).connect();
    return this.pool;
  }

  private async runWithRetry<T>(fn: (pool: sql.ConnectionPool) => Promise<T>): Promise<T> {
    const delays = [0, 1_000, 3_000];
    let lastError: Error | null = null;
    for (const delay of delays) {
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      try {
        const pool = await this.getPool();
        return await fn(pool);
      } catch (err) {
        const error = err as Error & { code?: string; number?: number };
        lastError = error;
        if (error.number === 208 || /invalid object name/i.test(error.message)) {
          throw new UpstreamApiError(
            "Bảng v2.Article chưa tồn tại — chạy scripts/dichoithoi-sqlserver/01-create-new-schema.sql trước.",
          );
        }
        this.logger.warn(`Query Article site DB loi (se retry): ${error.message}`);
        if (this.pool && !this.pool.connected) this.pool = null;
      }
    }
    throw new UpstreamApiError(
      `Không truy vấn được v2.Article: ${lastError?.message ?? "không rõ nguyên nhân"}`,
    );
  }
}
