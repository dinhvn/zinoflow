import { Client } from "pg";
import { DichoithoiSiteDbConnection } from "../dichoithoi-site-db.connection";

/**
 * Harness cho test tich hop adapter site DB (plan Postgres Giai doan 3) — chay voi PG that.
 *
 * Bat bang bien DICHOITHOI_TEST_DATABASE_URL tro toi 1 DB RIENG da chay migration ben repo
 * dichoithoi (vd dichoithoi_test — xem docs/runbook.md). Khong co bien -> test tu skip de
 * `pnpm test` van chay duoc tren may chua dung DB.
 */
export const SITE_TEST_DATABASE_URL = process.env.DICHOITHOI_TEST_DATABASE_URL ?? "";

export const describeWithSiteDb: jest.Describe = SITE_TEST_DATABASE_URL ? describe : describe.skip;

/** Bang du lieu (khong phai danh muc seed) — xoa sach truoc moi test. */
const DATA_TABLES = [
  "v2.destination_relation",
  "v2.destination_tag_map",
  "v2.destination_type_map",
  "v2.destination_review",
  "v2.destination_content",
  "v2.slug_redirect",
  "v2.hotel_destination_map",
  "v2.hotel",
  "v2.tour_destination_map",
  "v2.tour",
  "v2.transport_stop",
  "v2.transport",
  "v2.article_destination_map",
  "v2.article",
  "v2.destination",
] as const;

/** Tag do test tao ra phai co tien to nay de reset xoa duoc ma khong dung 17 tag seed. */
export const TEST_TAG_SLUG_PREFIX = "test-";

/** Khoa advisory dung chung — Jest chay cac file test song song, cac suite cung xoa 1 DB. */
const SITE_TEST_ADVISORY_LOCK_KEY = 20260927;

/** beforeAll co the phai cho suite khac chay xong moi lay duoc khoa. */
export const SITE_TEST_LOCK_TIMEOUT_MS = 120_000;

export interface SiteTestDatabase {
  readonly db: DichoithoiSiteDbConnection;
  close(): Promise<void>;
}

/**
 * Mo ket noi toi DB test va giu khoa advisory suot suite (goi trong beforeAll voi
 * SITE_TEST_LOCK_TIMEOUT_MS, `close()` trong afterAll).
 */
export async function openSiteTestDatabase(): Promise<SiteTestDatabase> {
  // Chan nham DB dev/production: TRUNCATE chi chay tren DB co chu "test" trong ten.
  const databaseName = new URL(SITE_TEST_DATABASE_URL).pathname.replace("/", "");
  if (!databaseName.includes("test")) {
    throw new Error(`DICHOITHOI_TEST_DATABASE_URL phai tro toi DB test (ten co "test"), dang la "${databaseName}"`);
  }
  const lockClient = new Client({ connectionString: SITE_TEST_DATABASE_URL });
  await lockClient.connect();
  await lockClient.query("SELECT pg_advisory_lock($1)", [SITE_TEST_ADVISORY_LOCK_KEY]);

  process.env.DICHOITHOI_DATABASE_URL = SITE_TEST_DATABASE_URL;
  const db = new DichoithoiSiteDbConnection();
  return {
    db,
    async close() {
      await db.onModuleDestroy();
      // Dong phien cung tu nha khoa advisory
      await lockClient.end();
    },
  };
}

export async function resetSiteData(db: DichoithoiSiteDbConnection): Promise<void> {
  await db.query(`TRUNCATE ${DATA_TABLES.join(", ")} RESTART IDENTITY CASCADE`);
  await db.query(`DELETE FROM v2.destination_tag WHERE slug LIKE @prefix`, {
    prefix: `${TEST_TAG_SLUG_PREFIX}%`,
  });
}
