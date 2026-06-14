import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import * as sql from "mssql";
import { UpstreamApiError } from "../../../shared/errors/app-error";
import type { CmsPostRow } from "../../domain/cms-post";
import type { CmsContentWrite, KhuyenMaiCmsDb } from "../../application/ports/khuyenmai-cms-db.port";

/**
 * Adapter SQL Server CMS khuyenmai (laruki/dochoi3s) — bang WordpressPost.
 * - Lazy connect, timeout 15s, retry 2 lan co backoff (rule external call).
 * - CHI module nay duoc dung mssql. AI tool ghi content; CMS giu Init + Publish.
 * Spec: docs/specs/laruki-dochoi3s-content-spec.md.
 */
@Injectable()
export class MssqlCmsDbAdapter implements KhuyenMaiCmsDb, OnModuleDestroy {
  private readonly logger = new Logger(MssqlCmsDbAdapter.name);
  private pool: sql.ConnectionPool | null = null;

  isConfigured(): boolean {
    return Boolean(process.env.KHUYENMAI_DB_HOST && process.env.KHUYENMAI_DB_USER);
  }

  async fetchPosts(siteId: number): Promise<CmsPostRow[]> {
    const rows = await this.queryWithRetry<Record<string, unknown>>(
      `SELECT Id, SiteId, PostId, PostType, Title, Link, IsReadyAuto, DatePublished, DateUpdated
       FROM WordpressPost WHERE SiteId = ${Number(siteId)}`,
    );
    return rows.map((r) => ({
      cmsId: r.Id as number,
      siteId: r.SiteId as number,
      postId: Number(r.PostId ?? 0),
      postType: r.PostType === null ? null : Number(r.PostType),
      title: (r.Title as string) ?? "",
      link: (r.Link as string | null) ?? null,
      isReadyAuto: Boolean(r.IsReadyAuto),
      datePublished: r.DatePublished ? new Date(r.DatePublished as string) : null,
      dateUpdated: r.DateUpdated ? new Date(r.DateUpdated as string) : null,
    }));
  }

  async fetchPostContent(cmsId: number): Promise<string | null> {
    const rows = await this.queryWithRetry<{ FixedContent: string | null }>(
      `SELECT FixedContent FROM WordpressPost WHERE Id = ${Number(cmsId)}`,
    );
    return rows[0]?.FixedContent ?? null;
  }

  async updateContent(cmsId: number, content: CmsContentWrite): Promise<void> {
    await this.runWithRetry((pool) =>
      this.bindContent(pool.request(), content)
        .input("cmsId", cmsId)
        .query(
          `UPDATE WordpressPost
           SET Title = @title, FixedContent = @fixedContent, Excerpt = @excerpt,
               DateUpdated = GETDATE()
           WHERE Id = @cmsId`,
        ),
    );
  }

  async insertNewPost(
    siteId: number,
    content: CmsContentWrite,
    postType: number | null,
  ): Promise<{ cmsId: number }> {
    const result = await this.runWithRetry<sql.IResult<{ NewId: number }>>((pool) =>
      this.bindContent(pool.request(), content)
        .input("siteId", siteId)
        .input("postType", postType)
        .query<{ NewId: number }>(
          // PostId=0: CMS tao WP post luc publish dau (phuong an R). Link rong tam,
          // DatePublished sentinel '1900-01-01' = chua publish. IsReadyAuto=0: can cau hinh trong CMS.
          `INSERT INTO WordpressPost
             (SiteId, PostId, PostType, Title, Link, FixedContent, Excerpt, IsReadyAuto, DateUpdated, DatePublished)
           OUTPUT INSERTED.Id AS NewId
           VALUES (@siteId, 0, @postType, @title, '', @fixedContent, @excerpt, 0, GETDATE(), '1900-01-01')`,
        ),
    );
    return { cmsId: result.recordset[0]!.NewId };
  }

  private bindContent(request: sql.Request, content: CmsContentWrite): sql.Request {
    request.input("title", content.title.slice(0, 128));
    request.input("fixedContent", content.fixedContent);
    request.input("excerpt", content.excerpt?.slice(0, 512) ?? null);
    return request;
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
        "Chưa cấu hình kết nối database CMS khuyenmai (KHUYENMAI_DB_* trong .env — xem .env.example)",
      );
    }
    const config: sql.config = {
      server: process.env.KHUYENMAI_DB_HOST ?? "",
      database: process.env.KHUYENMAI_DB_NAME ?? "",
      user: process.env.KHUYENMAI_DB_USER ?? "",
      password: process.env.KHUYENMAI_DB_PASSWORD ?? "",
      options: { encrypt: true, trustServerCertificate: true },
      connectionTimeout: 15_000,
      requestTimeout: 30_000,
      pool: { max: 4, min: 0 },
    };
    this.pool = await new sql.ConnectionPool(config).connect();
    this.logger.log(`Da ket noi SQL Server CMS khuyenmai (${config.server})`);
    return this.pool;
  }

  private async queryWithRetry<T>(queryText: string): Promise<T[]> {
    const result = await this.runWithRetry((pool) => pool.request().query<T>(queryText));
    return result.recordset;
  }

  /** Retry 2 lan voi backoff 1s/3s cho loi mang/timeout (khong retry loi cu phap) */
  private async runWithRetry<T>(fn: (pool: sql.ConnectionPool) => Promise<T>): Promise<T> {
    const delays = [0, 1_000, 3_000];
    let lastError: Error | null = null;
    for (const delay of delays) {
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      try {
        return await fn(await this.getPool());
      } catch (err) {
        const error = err as Error & { number?: number };
        lastError = error;
        if (error.number === 208 || /invalid object name/i.test(error.message)) {
          throw new UpstreamApiError(
            "Không tìm thấy bảng WordpressPost trên SQL Server CMS — kiểm tra KHUYENMAI_DB_NAME.",
          );
        }
        this.logger.warn(`Query CMS DB loi (se retry): ${error.message}`);
        if (this.pool && !this.pool.connected) this.pool = null;
      }
    }
    throw new UpstreamApiError(
      `Không truy vấn được database CMS khuyenmai: ${lastError?.message ?? "không rõ nguyên nhân"}`,
    );
  }
}
