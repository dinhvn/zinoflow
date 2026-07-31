import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import type * as sql from "mssql";
import { UpstreamApiError } from "../../../shared/errors/app-error";
import type {
  PublishTransportInput,
  PublishTransportStopInput,
  TransportCardData,
  TransportSiteDb,
} from "../../application/ports/transport-site-db.port";

const ROLE_TO_NUM = { origin: 1, destination: 2, waypoint: 3 } as const;

function isLocalDbHost(host: string): boolean {
  return host.toLowerCase().startsWith("(localdb)");
}

function loadMssqlDriver(host: string): typeof sql {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return isLocalDbHost(host) ? require("mssql/msnodesqlv8") : require("mssql");
}

/**
 * Adapter SQL Server cho v2.Transport/v2.TransportStop (transport-plan §2) —
 * dung chung connection config voi Hotel (cung DB dichoithoi, khac pool).
 */
@Injectable()
export class MssqlTransportSiteDbAdapter implements TransportSiteDb, OnModuleDestroy {
  private readonly logger = new Logger(MssqlTransportSiteDbAdapter.name);
  private pool: sql.ConnectionPool | null = null;

  isConfigured(): boolean {
    return Boolean(process.env.DICHOITHOI_DB_HOST && process.env.DICHOITHOI_DB_USER);
  }

  async upsertTransport(input: PublishTransportInput): Promise<{ siteId: number }> {
    const rows = await this.runWithRetry<Array<{ SiteId: number }>>(async (pool) => {
      const request = pool.request();
      request.input("siteId", input.siteId);
      request.input("mode", input.mode);
      request.input("operatorName", input.operatorName);
      request.input("phone", input.phone);
      request.input("vehicleType", input.vehicleType);
      request.input("priceFrom", input.priceFrom);
      request.input("thumbnailUrl", input.thumbnailUrl);
      request.input("provider", input.provider);
      request.input("sourceUrl", input.sourceUrl);
      request.input("affiliateUrl", input.affiliateUrl);
      request.input("linkStatus", input.linkStatus);
      const result = await request.query<{ SiteId: number }>(`
        IF @siteId IS NULL
        BEGIN
          INSERT INTO v2.Transport
            (Mode, OperatorName, Phone, VehicleType, PriceFrom, ThumbnailUrl,
             Provider, SourceUrl, AffiliateUrl, LinkStatus)
          VALUES
            (@mode, @operatorName, @phone, @vehicleType, @priceFrom, @thumbnailUrl,
             @provider, @sourceUrl, @affiliateUrl, @linkStatus);
          SELECT CAST(SCOPE_IDENTITY() AS int) AS SiteId;
        END
        ELSE
        BEGIN
          UPDATE v2.Transport SET
            Mode = @mode, OperatorName = @operatorName, Phone = @phone,
            VehicleType = @vehicleType, PriceFrom = @priceFrom, ThumbnailUrl = @thumbnailUrl,
            Provider = @provider, SourceUrl = @sourceUrl, AffiliateUrl = @affiliateUrl,
            LinkStatus = @linkStatus, UpdatedAt = SYSUTCDATETIME()
          WHERE Id = @siteId;
          SELECT @siteId AS SiteId;
        END
      `);
      return result.recordset;
    });
    const siteId = rows[0]?.SiteId;
    if (!siteId) throw new UpstreamApiError(`Không upsert được nhà xe "${input.operatorName}"`);
    return { siteId };
  }

  async replaceStops(
    transportSiteId: number,
    stops: PublishTransportStopInput[],
  ): Promise<void> {
    await this.runWithRetry(async (pool) => {
      const tx = pool.transaction();
      await tx.begin();
      try {
        const del = tx.request();
        del.input("transportId", transportSiteId);
        await del.query(`DELETE FROM v2.TransportStop WHERE TransportId = @transportId`);
        for (const stop of stops) {
          const ins = tx.request();
          ins.input("transportId", transportSiteId);
          ins.input("slug", stop.destinationSlug);
          ins.input("role", ROLE_TO_NUM[stop.role]);
          ins.input("seqOrder", stop.seqOrder);
          await ins.query(`
            DECLARE @destinationId int = (SELECT Id FROM v2.Destination WHERE Slug = @slug);
            IF @destinationId IS NULL
              THROW 50001, 'Khong tim thay diem den cho slug diem dung tuyen xe', 1;
            INSERT INTO v2.TransportStop (TransportId, DestinationId, Role, SeqOrder)
            VALUES (@transportId, @destinationId, @role, @seqOrder);
          `);
        }
        await tx.commit();
      } catch (err) {
        await tx.rollback();
        throw err;
      }
    });
  }

  /**
   * Neu diem la POI (Kind=3) tu dong resolve sang ParentId (cum cha) truoc
   * khi tra stop — POI khong bao gio la 1 dong TransportStop, chi ke thua
   * tu cum chua no (transport-plan §2). Chi lay role origin(1)/destination(2),
   * KHONG hien waypoint(3).
   */
  async findCardsForDestination(destinationSiteId: number, mode: number): Promise<TransportCardData[]> {
    const rows = await this.runWithRetry<Array<Record<string, unknown>>>(async (pool) => {
      const request = pool.request();
      request.input("destinationId", destinationSiteId);
      request.input("mode", mode);
      const result = await request.query<Record<string, unknown>>(`
        DECLARE @lookupId int = (
          SELECT CASE WHEN d.Kind = 3 THEN d.ParentId ELSE d.Id END
          FROM v2.Destination d WHERE d.Id = @destinationId
        );
        SELECT DISTINCT t.Id, t.Mode, t.OperatorName, t.Phone, t.VehicleType, t.PriceFrom,
          t.ThumbnailUrl, t.AffiliateUrl, t.SourceUrl, t.LinkStatus
        FROM v2.TransportStop s
        JOIN v2.Transport t ON t.Id = s.TransportId
        WHERE s.DestinationId = @lookupId AND s.Role IN (1, 2)
          AND t.Mode = @mode AND t.Status = 1
        ORDER BY t.PriceFrom
      `);
      return result.recordset;
    });
    return rows.map((r) => ({
      id: r.Id as number,
      mode: r.Mode as number,
      operatorName: r.OperatorName as string,
      phone: (r.Phone as string | null) ?? null,
      vehicleType: (r.VehicleType as string | null) ?? null,
      priceFrom: r.PriceFrom === null ? null : Number(r.PriceFrom),
      thumbnailUrl: (r.ThumbnailUrl as string | null) ?? null,
      affiliateUrl: (r.AffiliateUrl as string | null) ?? null,
      sourceUrl: (r.SourceUrl as string | null) ?? null,
      linkStatus: r.LinkStatus as string,
    }));
  }

  async findPoiChildSlugs(clusterSiteId: number): Promise<string[]> {
    const rows = await this.runWithRetry<Array<{ Slug: string }>>(async (pool) => {
      const request = pool.request();
      request.input("clusterId", clusterSiteId);
      const result = await request.query<{ Slug: string }>(`
        SELECT Slug FROM v2.Destination WHERE ParentId = @clusterId AND Kind = 3
      `);
      return result.recordset;
    });
    return rows.map((r) => r.Slug);
  }

  async deleteTransport(transportSiteId: number): Promise<void> {
    await this.runWithRetry(async (pool) => {
      const request = pool.request();
      request.input("transportId", transportSiteId);
      await request.query(`
        DELETE FROM v2.TransportStop WHERE TransportId = @transportId;
        DELETE FROM v2.Transport WHERE Id = @transportId;
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
            "Bảng v2.Transport/v2.TransportStop chưa tồn tại — chạy script SQL Server transport trước.",
          );
        }
        this.logger.warn(`Query Transport site DB loi (se retry): ${error.message}`);
        if (this.pool && !this.pool.connected) this.pool = null;
      }
    }
    throw new UpstreamApiError(
      `Không truy vấn được v2.Transport: ${lastError?.message ?? "không rõ nguyên nhân"}`,
    );
  }
}
