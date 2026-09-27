import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { Pool, type PoolClient } from "pg";
import { AppError, UpstreamApiError } from "../errors/app-error";
import { bindNamedParams } from "./bind-named-params";

export type NamedParams = Readonly<Record<string, unknown>>;

export interface SiteDbQueryResult<T> {
  readonly rows: T[];
  readonly rowCount: number;
}

/** Chay SQL trong 1 transaction dang mo — tham so `@name` nhu `DichoithoiSiteDbConnection.query`. */
export type SiteDbTransactionQuery = <T = Record<string, unknown>>(
  sqlText: string,
  params?: NamedParams,
) => Promise<SiteDbQueryResult<T>>;

/** Pool nho: SmarterASP gioi han so ket noi (plan Postgres GD4 se tinh chinh lai). */
const POOL_MAX_CONNECTIONS = 5;
const CONNECTION_TIMEOUT_MS = 15_000;
const STATEMENT_TIMEOUT_MS = 30_000;
const IDLE_TIMEOUT_MS = 30_000;
const RETRY_DELAYS_MS = [0, 1_000, 3_000] as const;

/** SQLSTATE bang chua ton tai — schema chua tao, retry vo ich. */
const UNDEFINED_TABLE_SQLSTATE = "42P01";

const MISSING_SCHEMA_MESSAGE =
  "Schema v2 chưa được tạo trên PostgreSQL dichoithoi — chạy `dotnet ef database update` trong repo dichoithoi (xem dichoithoi-postgres-migration-plan.md Giai đoạn 1).";

/**
 * Ket noi DUNG CHUNG toi DB PostgreSQL cua website dichoithoi (plan Postgres Giai doan 3) —
 * thay cho 5 pool mssql rieng cua 5 adapter. Schema do repo dichoithoi so huu (EF Core
 * Migrations), repo nay chi doc/ghi du lieu, KHONG tao/sua bang.
 *
 * - Lazy connect qua `DICHOITHOI_DATABASE_URL` (vd postgresql://user:pass@host:5432/dichoithoi_dev).
 * - Timeout ket noi 15s, statement 30s; retry 2 lan (1s/3s) CHI cho loi ket noi — loi SQL
 *   (sai cu phap, vi pham rang buoc) nem ngay.
 */
@Injectable()
export class DichoithoiSiteDbConnection implements OnModuleDestroy {
  private readonly logger = new Logger(DichoithoiSiteDbConnection.name);
  private pool: Pool | null = null;

  isConfigured(): boolean {
    return Boolean(process.env.DICHOITHOI_DATABASE_URL);
  }

  async query<T = Record<string, unknown>>(
    sqlText: string,
    params: NamedParams = {},
  ): Promise<SiteDbQueryResult<T>> {
    const { text, params: values } = bindNamedParams(sqlText, params);
    return this.runWithRetry(async (pool) => {
      const result = await pool.query(text, values);
      return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
    });
  }

  /** BEGIN/COMMIT, ROLLBACK khi `work` nem loi. Retry ca transaction neu mat ket noi. */
  async transaction<T>(work: (query: SiteDbTransactionQuery) => Promise<T>): Promise<T> {
    return this.runWithRetry(async (pool) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await work(this.bindClientQuery(client));
        await client.query("COMMIT");
        return result;
      } catch (err) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw err;
      } finally {
        client.release();
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  private bindClientQuery(client: PoolClient): SiteDbTransactionQuery {
    return async <T>(sqlText: string, params: NamedParams = {}) => {
      const { text, params: values } = bindNamedParams(sqlText, params);
      const result = await client.query(text, values);
      return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
    };
  }

  private getPool(): Pool {
    if (this.pool) return this.pool;
    if (!this.isConfigured()) {
      throw new UpstreamApiError(
        "Chưa cấu hình kết nối database dichoithoi (DICHOITHOI_DATABASE_URL trong .env — xem .env.example)",
      );
    }
    const pool = new Pool({
      connectionString: process.env.DICHOITHOI_DATABASE_URL,
      max: POOL_MAX_CONNECTIONS,
      connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
      idleTimeoutMillis: IDLE_TIMEOUT_MS,
      statement_timeout: STATEMENT_TIMEOUT_MS,
    });
    // Client idle bi server dong (restart, mat mang) phat 'error' tren pool — khong bat se crash process.
    pool.on("error", (err) => this.logger.warn(`Ket noi idle toi DB dichoithoi bi dong: ${err.message}`));
    this.pool = pool;
    return pool;
  }

  private async runWithRetry<T>(fn: (pool: Pool) => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    for (const delay of RETRY_DELAYS_MS) {
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      try {
        return await fn(this.getPool());
      } catch (err) {
        const error = err as Error & { code?: string };
        if (error instanceof AppError) throw error;
        if (error.code === UNDEFINED_TABLE_SQLSTATE) throw new UpstreamApiError(MISSING_SCHEMA_MESSAGE);
        if (!isConnectionError(error)) {
          throw new UpstreamApiError(`Lỗi truy vấn database dichoithoi: ${error.message}`);
        }
        lastError = error;
        this.logger.warn(`Mat ket noi DB dichoithoi (se retry): ${error.message}`);
      }
    }
    throw new UpstreamApiError(
      `Không kết nối được database dichoithoi: ${lastError?.message ?? "không rõ nguyên nhân"}`,
    );
  }
}

/**
 * Loi dang retry: loi mang cua Node (ECONNREFUSED, ETIMEDOUT...) hoac SQLSTATE nhom 08
 * (connection exception) / 57P (server shutdown) / 53300 (qua so ket noi).
 */
function isConnectionError(error: Error & { code?: string }): boolean {
  const code = error.code ?? "";
  const isSqlState = /^[0-9A-Z]{5}$/.test(code);
  if (!isSqlState) return true;
  return code.startsWith("08") || code.startsWith("57P") || code === "53300";
}
