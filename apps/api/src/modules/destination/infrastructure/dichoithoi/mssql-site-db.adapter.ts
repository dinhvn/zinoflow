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
  SiteDestinationContent,
  SiteTypeRow,
} from "../../application/ports/dichoithoi-site-db.port";

const KIND_BY_NUMBER: Record<number, SiteDestinationRow["kind"]> = {
  1: "province",
  2: "cluster",
  3: "poi",
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
    return rows.map((r) => ({ id: r.Id, slug: r.Slug, name: r.Name }));
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

  /** Retry 2 lan voi backoff 1s/3s cho loi mang/timeout (khong retry loi cu phap) */
  private async queryWithRetry<T>(queryText: string): Promise<T[]> {
    const delays = [0, 1_000, 3_000];
    let lastError: Error | null = null;
    for (const delay of delays) {
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      try {
        const pool = await this.getPool();
        const result = await pool.request().query<T>(queryText);
        return result.recordset;
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
