import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import type * as sql from "mssql";
import { UpstreamApiError } from "../../../shared/errors/app-error";

/**
 * Chon driver theo host: LocalDB (sandbox dev) can msnodesqlv8 (named pipe),
 * server thuong (production site4now) dung tedious. KHONG require ca 2 cung luc
 * — chung shared state trong package mssql.
 */
function isLocalDbHost(host: string): boolean {
  return host.toLowerCase().startsWith("(localdb)");
}

function loadMssqlDriver(host: string): typeof sql {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return isLocalDbHost(host) ? require("mssql/msnodesqlv8") : require("mssql");
}
import type { SiteDestinationRow } from "../../domain/destination-mirror";
import type {
  DichoithoiSiteDb,
  PublishDestinationInput,
  SiteContentRow,
  SiteDestinationContent,
  SiteDestinationMeta,
  SiteTypeRow,
} from "../../application/ports/dichoithoi-site-db.port";

const KIND_BY_NUMBER: Record<number, SiteDestinationRow["kind"]> = {
  1: "province",
  2: "cluster",
  3: "poi",
};

const NUMBER_BY_KIND: Record<SiteDestinationMeta["kind"], number> = {
  province: 1,
  cluster: 2,
  poi: 3,
};

/**
 * Adapter SQL Server cua website dichoithoi (schema MOI — redesign doc §4).
 * - Lazy connect: chi mo pool khi can, dong khi shutdown.
 * - Timeout 15s + retry 2 lan co backoff (rule external call).
 * - CHI module nay duoc dung mssql — application layer khong biet SQL Server.
 */
@Injectable()
export class MssqlSiteDbAdapter implements DichoithoiSiteDb, OnModuleDestroy {
  private readonly logger = new Logger(MssqlSiteDbAdapter.name);
  private pool: sql.ConnectionPool | null = null;

  isConfigured(): boolean {
    return Boolean(process.env.DICHOITHOI_DB_HOST && process.env.DICHOITHOI_DB_USER);
  }

  async fetchAllDestinations(): Promise<SiteDestinationRow[]> {
    const result = await this.queryWithRetry<Record<string, unknown>>(`
      SELECT
        d.Id, d.Slug, d.Kind, d.Name, d.ShortDescription, d.Thumbnail,
        d.Lat, d.Lng, d.AddressNew, d.AddressOld, d.ContactPhone, d.ContactWebsite,
        d.BookingUrl, d.HotelGroupId, d.IsFeatured, d.Status, d.ContentSource, d.UpdatedAt,
        p.Code AS ProvinceCode,
        par.Slug AS ParentSlug,
        CONVERT(varchar(64), HASHBYTES('SHA2_256', CAST(c.ContentHtml AS nvarchar(max))), 2) AS ContentHash
      FROM v2.Destination d
      LEFT JOIN v2.Destination par ON par.Id = d.ParentId
      LEFT JOIN v2.Province p ON p.Id = d.ProvinceId
      LEFT JOIN v2.DestinationContent c ON c.DestinationId = d.Id
    `);
    return result.map((r) => ({
      siteId: r.Id as number,
      slug: r.Slug as string,
      kind: KIND_BY_NUMBER[r.Kind as number] ?? "poi",
      parentSlug: (r.ParentSlug as string | null) ?? null,
      provinceCode: (r.ProvinceCode as string | null) ?? null,
      name: r.Name as string,
      shortDescription: (r.ShortDescription as string | null) ?? null,
      thumbnail: (r.Thumbnail as string | null) ?? null,
      lat: r.Lat === null ? null : Number(r.Lat),
      lng: r.Lng === null ? null : Number(r.Lng),
      addressNew: (r.AddressNew as string | null) ?? null,
      addressOld: (r.AddressOld as string | null) ?? null,
      contactPhone: (r.ContactPhone as string | null) ?? null,
      contactWebsite: (r.ContactWebsite as string | null) ?? null,
      bookingUrl: (r.BookingUrl as string | null) ?? null,
      hotelGroupId: (r.HotelGroupId as string | null) ?? null,
      isFeatured: Boolean(r.IsFeatured),
      siteStatus: Number(r.Status),
      contentSource: r.ContentSource === null ? null : Number(r.ContentSource),
      contentHash: (r.ContentHash as string | null) ?? null,
      siteUpdatedAt: r.UpdatedAt ? new Date(r.UpdatedAt as string) : null,
    }));
  }

  async fetchDestinationContent(siteId: number): Promise<SiteDestinationContent | null> {
    const rows = await this.queryWithRetry<Record<string, unknown>>(
      `SELECT ContentHtml, OpeningTime, TicketPrice, Transport, Food, HotelText, Tip
       FROM v2.DestinationContent WHERE DestinationId = ${Number(siteId)}`,
    );
    const r = rows[0];
    if (!r) return null;
    return {
      contentHtml: (r.ContentHtml as string) ?? "",
      openingTime: (r.OpeningTime as string | null) ?? null,
      ticketPrice: (r.TicketPrice as string | null) ?? null,
      transport: (r.Transport as string | null) ?? null,
      food: (r.Food as string | null) ?? null,
      hotel: (r.HotelText as string | null) ?? null,
      tip: (r.Tip as string | null) ?? null,
    };
  }

  async fetchTypes(): Promise<SiteTypeRow[]> {
    const rows = await this.queryWithRetry<{ Id: number; Slug: string; Name: string }>(
      `SELECT Id, Slug, Name FROM v2.DestinationType ORDER BY [Order], Name`,
    );
    // Driver SQL Server co the tra Id dang chuoi — ep ve number cho dung contract
    return rows.map((r) => ({ id: Number(r.Id), slug: r.Slug, name: r.Name }));
  }

  /**
   * Publish bai AI vao SQL Server — 1 batch co BEGIN TRAN/COMMIT + ROLLBACK khi loi
   * (tranh quirks transaction object giua tedious va msnodesqlv8). KHONG wipe:
   * update dong Destination co san + upsert DestinationContent theo DestinationId.
   */
  async publishDestination(input: PublishDestinationInput): Promise<{ contentHash: string }> {
    const targets = [...new Set(input.mentionedTargetSiteIds)].filter((id) => id !== input.siteId);
    const insertRelations = targets
      .map(
        (_, i) =>
          `INSERT INTO v2.DestinationRelation (SourceId, TargetId, RelationType, Weight, IsAuto)
           SELECT @siteId, @target${i}, 3, 0, 1
           WHERE EXISTS (SELECT 1 FROM v2.Destination WHERE Id = @target${i});`,
      )
      .join("\n");

    const rows = await this.runWithRetry<Array<{ ContentHash: string }>>(async (pool) => {
      const request = pool.request();
      request.input("siteId", input.siteId);
      request.input("thumbnail", input.thumbnail);
      request.input("shortDescription", input.shortDescription);
      request.input("searchKeyword", input.searchKeyword);
      request.input("contentHtml", input.contentHtml);
      request.input("openingTime", input.openingTime);
      request.input("ticketPrice", input.ticketPrice);
      request.input("transport", input.transport);
      request.input("food", input.food);
      request.input("hotel", input.hotel);
      request.input("tip", input.tip);
      request.input("faqJson", input.faqJson);
      request.input("metaTitle", input.metaTitle);
      request.input("metaDescription", input.metaDescription);
      targets.forEach((id, i) => request.input(`target${i}`, id));

      const result = await request.query<{ ContentHash: string }>(`
        SET XACT_ABORT ON;
        BEGIN TRAN;

        UPDATE v2.Destination SET
          ShortDescription = @shortDescription,
          SearchKeyword    = @searchKeyword,
          Thumbnail        = @thumbnail,
          ContentSource    = 1,
          UpdatedAt        = SYSUTCDATETIME()
        WHERE Id = @siteId;

        UPDATE v2.DestinationContent SET
          ContentHtml = @contentHtml, OpeningTime = @openingTime, TicketPrice = @ticketPrice,
          Transport = @transport, Food = @food, HotelText = @hotel, Tip = @tip,
          FaqJson = @faqJson, MetaTitle = @metaTitle, MetaDescription = @metaDescription
        WHERE DestinationId = @siteId;
        IF @@ROWCOUNT = 0
          INSERT INTO v2.DestinationContent
            (DestinationId, ContentHtml, OpeningTime, TicketPrice, Transport, Food, HotelText,
             Tip, FaqJson, MetaTitle, MetaDescription)
          VALUES
            (@siteId, @contentHtml, @openingTime, @ticketPrice, @transport, @food, @hotel,
             @tip, @faqJson, @metaTitle, @metaDescription);

        -- Quan he mentioned tu auto-link: thay toan bo dong auto cu cua nguon nay
        DELETE FROM v2.DestinationRelation
        WHERE SourceId = @siteId AND RelationType = 3 AND IsAuto = 1;
        ${insertRelations}

        COMMIT;

        SELECT CONVERT(varchar(64),
          HASHBYTES('SHA2_256', CAST(ContentHtml AS nvarchar(max))), 2) AS ContentHash
        FROM v2.DestinationContent WHERE DestinationId = @siteId;
      `);
      return result.recordset;
    });

    const contentHash = rows[0]?.ContentHash;
    if (!contentHash) {
      throw new UpstreamApiError(
        `Publish điểm đến siteId=${input.siteId} không ghi được nội dung (không thấy dòng DestinationContent sau khi ghi)`,
      );
    }
    return { contentHash };
  }

  async fetchAllContentRows(): Promise<SiteContentRow[]> {
    const rows = await this.queryWithRetry<{ Id: number; Slug: string; ContentHtml: string }>(`
      SELECT d.Id, d.Slug, c.ContentHtml
      FROM v2.DestinationContent c
      JOIN v2.Destination d ON d.Id = c.DestinationId
      WHERE d.Status = 1
    `);
    return rows.map((r) => ({ siteId: r.Id, slug: r.Slug, contentHtml: r.ContentHtml ?? "" }));
  }

  async updateContentHtml(siteId: number, contentHtml: string): Promise<void> {
    await this.runWithRetry(async (pool) => {
      const request = pool.request();
      request.input("siteId", siteId);
      request.input("contentHtml", contentHtml);
      return request.query(
        `UPDATE v2.DestinationContent SET ContentHtml = @contentHtml WHERE DestinationId = @siteId`,
      );
    });
  }

  async addMentionedRelations(
    sourceSiteId: number,
    targetSiteIds: readonly number[],
  ): Promise<void> {
    const targets = [...new Set(targetSiteIds)].filter((id) => id !== sourceSiteId);
    if (targets.length === 0) return;
    await this.runWithRetry(async (pool) => {
      const request = pool.request();
      request.input("sourceId", sourceSiteId);
      targets.forEach((id, i) => request.input(`target${i}`, id));
      const statements = targets
        .map(
          (_, i) =>
            `INSERT INTO v2.DestinationRelation (SourceId, TargetId, RelationType, Weight, IsAuto)
             SELECT @sourceId, @target${i}, 3, 0, 1
             WHERE NOT EXISTS (
               SELECT 1 FROM v2.DestinationRelation
               WHERE SourceId = @sourceId AND TargetId = @target${i} AND RelationType = 3
             );`,
        )
        .join("\n");
      return request.query(statements);
    });
  }

  async fetchSlugRedirects(): Promise<Map<string, string>> {
    const rows = await this.queryWithRetry<{ OldSlug: string; Slug: string }>(`
      SELECT r.OldSlug, d.Slug
      FROM v2.SlugRedirect r
      JOIN v2.Destination d ON d.Id = r.DestinationId
    `);
    return new Map(rows.map((r) => [r.OldSlug, r.Slug]));
  }

  async updateRelatedJson(siteId: number, relatedJson: string): Promise<boolean> {
    return this.runWithRetry(async (pool) => {
      const request = pool.request();
      request.input("siteId", siteId);
      request.input("relatedJson", relatedJson);
      // Chi ghi khi gia tri doi — tranh write + invalidate cache vo ich (spec §12.3)
      const result = await request.query(`
        UPDATE v2.DestinationContent SET RelatedJson = @relatedJson
        WHERE DestinationId = @siteId
          AND (RelatedJson IS NULL OR RelatedJson <> @relatedJson)
      `);
      return (result.rowsAffected[0] ?? 0) > 0;
    });
  }

  async createDestination(meta: SiteDestinationMeta): Promise<{ siteId: number }> {
    const rows = await this.runWithRetry<Array<{ SiteId: number }>>(async (pool) => {
      const request = this.bindMeta(pool.request(), meta);
      const result = await request.query<{ SiteId: number }>(`
        DECLARE @parentId int = (SELECT Id FROM v2.Destination WHERE Slug = @parentSlug);
        DECLARE @provinceId int = (SELECT Id FROM v2.Province WHERE Code = @provinceCode);
        INSERT INTO v2.Destination
          (Slug, Kind, ParentId, ProvinceId, Name, NameUnaccented, ShortDescription, Thumbnail,
           Lat, Lng, AddressNew, AddressOld, ContactPhone, ContactWebsite, BookingUrl,
           HotelGroupId, IsFeatured, Status, ContentSource)
        VALUES
          (@slug, @kind, @parentId, @provinceId, @name, @nameUnaccented,
           COALESCE(@shortDescription, N''), @thumbnail, @lat, @lng, @addressNew, @addressOld,
           @contactPhone, @contactWebsite, @bookingUrl, @hotelGroupId, @isFeatured, 1, 1);
        SELECT CAST(SCOPE_IDENTITY() AS int) AS SiteId;
      `);
      return result.recordset;
    });
    const siteId = rows[0]?.SiteId;
    if (!siteId) {
      throw new UpstreamApiError(`Không tạo được điểm đến "${meta.slug}" trên SQL Server`);
    }
    return { siteId };
  }

  async updateMetadata(siteId: number, meta: SiteDestinationMeta): Promise<void> {
    await this.runWithRetry(async (pool) => {
      const request = this.bindMeta(pool.request(), meta);
      request.input("siteId", siteId);
      return request.query(`
        DECLARE @parentId int = (SELECT Id FROM v2.Destination WHERE Slug = @parentSlug);
        DECLARE @provinceId int = (SELECT Id FROM v2.Province WHERE Code = @provinceCode);
        UPDATE v2.Destination SET
          Kind = @kind, ParentId = @parentId, ProvinceId = @provinceId,
          Name = @name, NameUnaccented = @nameUnaccented,
          ShortDescription = COALESCE(@shortDescription, N''), Thumbnail = @thumbnail,
          Lat = @lat, Lng = @lng, AddressNew = @addressNew, AddressOld = @addressOld,
          ContactPhone = @contactPhone, ContactWebsite = @contactWebsite, BookingUrl = @bookingUrl,
          HotelGroupId = @hotelGroupId, IsFeatured = @isFeatured, UpdatedAt = SYSUTCDATETIME()
        WHERE Id = @siteId;
      `);
    });
  }

  /** Bind tham so metadata dung chung cho insert + update */
  private bindMeta(request: sql.Request, meta: SiteDestinationMeta): sql.Request {
    request.input("slug", meta.slug);
    request.input("kind", NUMBER_BY_KIND[meta.kind]);
    request.input("parentSlug", meta.parentSlug);
    request.input("provinceCode", meta.provinceCode);
    request.input("name", meta.name);
    request.input("nameUnaccented", meta.nameUnaccented);
    request.input("shortDescription", meta.shortDescription);
    request.input("thumbnail", meta.thumbnail);
    request.input("lat", meta.lat);
    request.input("lng", meta.lng);
    request.input("addressNew", meta.addressNew);
    request.input("addressOld", meta.addressOld);
    request.input("contactPhone", meta.contactPhone);
    request.input("contactWebsite", meta.contactWebsite);
    request.input("bookingUrl", meta.bookingUrl);
    request.input("hotelGroupId", meta.hotelGroupId);
    request.input("isFeatured", meta.isFeatured);
    return request;
  }

  async updateThumbnail(siteId: number, thumbnail: string | null): Promise<void> {
    await this.runWithRetry(async (pool) => {
      const request = pool.request();
      request.input("siteId", siteId);
      request.input("thumbnail", thumbnail);
      return request.query(
        `UPDATE v2.Destination SET Thumbnail = @thumbnail, UpdatedAt = SYSUTCDATETIME()
         WHERE Id = @siteId`,
      );
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
        "Chưa cấu hình kết nối database dichoithoi (DICHOITHOI_DB_* trong .env — xem .env.example)",
      );
    }
    const host = process.env.DICHOITHOI_DB_HOST ?? "";
    const driver = loadMssqlDriver(host);
    const config: sql.config = isLocalDbHost(host)
      ? // LocalDB sandbox: Windows auth qua ODBC
        ({
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
    this.logger.log(
      `Da ket noi SQL Server dichoithoi (${isLocalDbHost(host) ? "LocalDB sandbox" : host})`,
    );
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
        const pool = await this.getPool();
        return await fn(pool);
      } catch (err) {
        const error = err as Error & { code?: string; number?: number };
        lastError = error;
        // Loi schema (bang chua ton tai) khong retry — bao ro de chay migration.
        // tedious: error.number=208; msnodesqlv8 (ODBC): chi co message.
        if (error.number === 208 || /invalid object name/i.test(error.message)) {
          throw new UpstreamApiError(
            "Schema mới (v2) chưa được tạo trên SQL Server dichoithoi — chạy scripts/dichoithoi-sqlserver/01-create-new-schema.sql và 02-migrate-data.sql trước (SAU KHI BACKUP).",
          );
        }
        this.logger.warn(`Query site DB loi (se retry): ${error.message}`);
        // pool co the hong sau loi mang — bo de lan sau tao lai
        if (this.pool && !this.pool.connected) this.pool = null;
      }
    }
    throw new UpstreamApiError(
      `Không truy vấn được database dichoithoi: ${lastError?.message ?? "không rõ nguyên nhân"}`,
    );
  }
}
