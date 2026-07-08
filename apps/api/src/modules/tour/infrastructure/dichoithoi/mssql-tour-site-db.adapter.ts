import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import type * as sql from "mssql";
import { UpstreamApiError } from "../../../shared/errors/app-error";
import type {
  PublishTourInput,
  TourCardData,
  TourSiteDb,
} from "../../application/ports/tour-site-db.port";

function isLocalDbHost(host: string): boolean {
  return host.toLowerCase().startsWith("(localdb)");
}

function loadMssqlDriver(host: string): typeof sql {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return isLocalDbHost(host) ? require("mssql/msnodesqlv8") : require("mssql");
}

/** Adapter SQL Server cho v2.Tour/v2.TourDestinationMap (tour-spec §4) */
@Injectable()
export class MssqlTourSiteDbAdapter implements TourSiteDb, OnModuleDestroy {
  private readonly logger = new Logger(MssqlTourSiteDbAdapter.name);
  private pool: sql.ConnectionPool | null = null;

  isConfigured(): boolean {
    return Boolean(process.env.DICHOITHOI_DB_HOST && process.env.DICHOITHOI_DB_USER);
  }

  async upsertTour(input: PublishTourInput): Promise<{ siteId: number }> {
    const rows = await this.runWithRetry<Array<{ SiteId: number }>>(async (pool) => {
      const request = pool.request();
      request.input("siteId", input.siteId);
      request.input("name", input.name);
      request.input("shortDescription", input.shortDescription);
      request.input("durationDays", input.durationDays);
      request.input("durationNights", input.durationNights);
      request.input("departureFrom", input.departureFrom);
      request.input("provinceCode", input.provinceCode);
      request.input("priceFrom", input.priceFrom);
      request.input("rating", input.rating);
      request.input("reviewCount", input.reviewCount);
      request.input("thumbnailUrl", input.thumbnailUrl);
      request.input("imagesJson", input.imagesJson);
      request.input("provider", input.provider);
      request.input("sourceUrl", input.sourceUrl);
      request.input("affiliateUrl", input.affiliateUrl);
      request.input("linkStatus", input.linkStatus);
      const result = await request.query<{ SiteId: number }>(`
        DECLARE @provinceId int = (SELECT Id FROM v2.Province WHERE Code = @provinceCode);
        IF @siteId IS NULL
        BEGIN
          INSERT INTO v2.Tour
            (Name, ShortDescription, DurationDays, DurationNights, DepartureFrom, ProvinceId,
             PriceFrom, Rating, ReviewCount, ThumbnailUrl, ImagesJson, Provider, SourceUrl,
             AffiliateUrl, LinkStatus)
          VALUES
            (@name, @shortDescription, @durationDays, @durationNights, @departureFrom, @provinceId,
             @priceFrom, @rating, @reviewCount, @thumbnailUrl, @imagesJson, @provider, @sourceUrl,
             @affiliateUrl, @linkStatus);
          SELECT CAST(SCOPE_IDENTITY() AS int) AS SiteId;
        END
        ELSE
        BEGIN
          UPDATE v2.Tour SET
            Name = @name, ShortDescription = @shortDescription, DurationDays = @durationDays,
            DurationNights = @durationNights, DepartureFrom = @departureFrom, ProvinceId = @provinceId,
            PriceFrom = @priceFrom, Rating = @rating, ReviewCount = @reviewCount,
            ThumbnailUrl = @thumbnailUrl, ImagesJson = @imagesJson, Provider = @provider,
            SourceUrl = @sourceUrl, AffiliateUrl = @affiliateUrl, LinkStatus = @linkStatus,
            UpdatedAt = SYSUTCDATETIME()
          WHERE Id = @siteId;
          SELECT @siteId AS SiteId;
        END
      `);
      return result.recordset;
    });
    const siteId = rows[0]?.SiteId;
    if (!siteId) throw new UpstreamApiError(`Không upsert được tour "${input.name}"`);
    return { siteId };
  }

  async assignToDestination(
    tourSiteId: number,
    destinationSlug: string,
    isPrimary: boolean,
    isManual: boolean,
  ): Promise<void> {
    await this.runWithRetry(async (pool) => {
      const request = pool.request();
      request.input("tourId", tourSiteId);
      request.input("destinationSlug", destinationSlug);
      request.input("isPrimary", isPrimary);
      request.input("isManual", isManual);
      return request.query(`
        DECLARE @destinationId int = (SELECT Id FROM v2.Destination WHERE Slug = @destinationSlug);
        MERGE v2.TourDestinationMap AS target
        USING (SELECT @tourId AS TourId, @destinationId AS DestinationId) AS src
          ON target.TourId = src.TourId AND target.DestinationId = src.DestinationId
        WHEN MATCHED THEN UPDATE SET IsPrimary = @isPrimary, IsManual = @isManual
        WHEN NOT MATCHED THEN INSERT (TourId, DestinationId, IsPrimary, IsManual)
          VALUES (@tourId, @destinationId, @isPrimary, @isManual);
      `);
    });
  }

  async unassignFromDestination(tourSiteId: number, destinationSlug: string): Promise<void> {
    await this.runWithRetry(async (pool) => {
      const request = pool.request();
      request.input("tourId", tourSiteId);
      request.input("destinationSlug", destinationSlug);
      return request.query(`
        DELETE m FROM v2.TourDestinationMap m
        JOIN v2.Destination d ON d.Id = m.DestinationId
        WHERE m.TourId = @tourId AND d.Slug = @destinationSlug;
      `);
    });
  }

  async findCardsForDestination(destinationSlug: string, take: number): Promise<TourCardData[]> {
    const rows = await this.runWithRetry<Array<Record<string, unknown>>>(async (pool) => {
      const request = pool.request();
      request.input("destinationSlug", destinationSlug);
      request.input("take", take);
      const result = await request.query<Record<string, unknown>>(`
        SELECT TOP (@take) t.Id, t.Name, t.ShortDescription, t.DurationDays, t.DurationNights,
          t.PriceFrom, t.Rating, t.ReviewCount, t.ThumbnailUrl, t.AffiliateUrl, t.SourceUrl, t.LinkStatus
        FROM v2.TourDestinationMap m
        JOIN v2.Tour t ON t.Id = m.TourId
        JOIN v2.Destination d ON d.Id = m.DestinationId
        WHERE d.Slug = @destinationSlug AND t.Status = 1
        ORDER BY t.Rating DESC
      `);
      return result.recordset;
    });
    return rows.map((r) => ({
      id: r.Id as number,
      name: r.Name as string,
      shortDescription: (r.ShortDescription as string | null) ?? null,
      durationDays: (r.DurationDays as number | null) ?? null,
      durationNights: (r.DurationNights as number | null) ?? null,
      priceFrom: r.PriceFrom === null ? null : Number(r.PriceFrom),
      rating: r.Rating === null ? null : Number(r.Rating),
      reviewCount: (r.ReviewCount as number | null) ?? null,
      thumbnailUrl: (r.ThumbnailUrl as string | null) ?? null,
      affiliateUrl: (r.AffiliateUrl as string | null) ?? null,
      sourceUrl: r.SourceUrl as string,
      linkStatus: r.LinkStatus as string,
    }));
  }

  async findDestinationSlugsForTour(tourSiteId: number): Promise<string[]> {
    const rows = await this.runWithRetry<Array<{ Slug: string }>>(async (pool) => {
      const request = pool.request();
      request.input("tourId", tourSiteId);
      const result = await request.query<{ Slug: string }>(`
        SELECT d.Slug FROM v2.TourDestinationMap m
        JOIN v2.Destination d ON d.Id = m.DestinationId
        WHERE m.TourId = @tourId
      `);
      return result.recordset;
    });
    return rows.map((r) => r.Slug);
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
            "Bảng v2.Tour/v2.TourDestinationMap chưa tồn tại — chạy scripts/dichoithoi-sqlserver/01-create-new-schema.sql trước.",
          );
        }
        this.logger.warn(`Query Tour site DB loi (se retry): ${error.message}`);
        if (this.pool && !this.pool.connected) this.pool = null;
      }
    }
    throw new UpstreamApiError(
      `Không truy vấn được v2.Tour: ${lastError?.message ?? "không rõ nguyên nhân"}`,
    );
  }
}
