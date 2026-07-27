/**
 * GD3 — WIPE toan bo du lieu diem den (2 DB) cho dot lam moi theo Atlas
 * (plan-lam-moi-du-lieu-atlas.md GD3). CHI chay sau khi GD2 backup xong.
 *
 * - GUARD: tu kiem tra bang backup + thu muc anh tam + pg_dump + .bak ton tai
 *   truoc khi xoa bat ky thu gi — thieu 1 trong 4 la DUNG.
 * - SQL Server (LocalDB dichoithoi_dev): xoa sach nhom destination cua schema v2
 *   (Destination, Content, TagMap, TypeMap, Relation, Review, SlugRedirect,
 *   ArticleDestinationMap, HotelDestinationMap, TourDestinationMap) — GIU
 *   Province (34 tinh moi, chi go DestinationId), GIU taxonomy Tag/Type/TypeGroup.
 * - Postgres: cung danh sach cau lenh voi DestinationMirrorRepository.deleteCascade
 *   (typeorm-destination-mirror.repository.ts:310) ap cho TOAN BO slug — khong
 *   DELETE tay khac thu tu; bang staging cluster_poi_candidates/ai_extractions
 *   sach theo FK CASCADE + cau lenh san co.
 * - KHONG xoa anh vat ly (da co ban copy; anh goc don o GD9 — plan GD3).
 *
 * Chay: npx ts-node scripts/atlas-wipe-destinations.ts --yes
 */
import "dotenv/config";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Client } = require("pg") as {
  Client: new (config: { connectionString?: string }) => {
    connect(): Promise<void>;
    end(): Promise<void>;
    query(sql: string, params?: unknown[]): Promise<{ rows: Array<Record<string, string>>; rowCount: number | null }>;
  };
};

const BACKUP_TABLE = "dichoithoi_destinations_backup";
const IMG_BACKUP_DIR = "D:\\Gits\\mmo\\dichoithoi\\backup-images-atlas-2026-07-27";
const PG_DUMP_FILE = "D:\\Gits\\mmo\\zinoflow-backup-atlas-2026-07-27.dump";
const BAK_FILE = "D:\\Gits\\mmo\\dichoithoi_dev-backup-atlas-2026-07-27.bak";

async function guardBackups(client: InstanceType<typeof Client>): Promise<void> {
  const t = await client.query(
    `SELECT count(*) AS c FROM information_schema.tables WHERE table_name = $1`,
    [BACKUP_TABLE],
  );
  if (t.rows[0]?.c === "0") throw new Error(`GUARD: bang ${BACKUP_TABLE} chua ton tai — chay GD2 truoc`);
  const n = await client.query(`SELECT count(*) AS c FROM ${BACKUP_TABLE}`);
  if (!Number(n.rows[0]?.c)) throw new Error(`GUARD: bang ${BACKUP_TABLE} rong`);
  for (const f of [IMG_BACKUP_DIR, PG_DUMP_FILE, BAK_FILE]) {
    if (!existsSync(f)) throw new Error(`GUARD: thieu backup ${f}`);
  }
  console.log(`GUARD OK: bang backup ${n.rows[0]?.c} dong + anh tam + pg_dump + .bak deu ton tai.`);
}

function wipeSqlServer(): void {
  const sql = `
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
BEGIN TRAN;
DELETE FROM v2.ArticleDestinationMap;
DELETE FROM v2.HotelDestinationMap;
DELETE FROM v2.TourDestinationMap;
DELETE FROM v2.DestinationTagMap;
DELETE FROM v2.DestinationTypeMap;
DELETE FROM v2.DestinationRelation;
DELETE FROM v2.DestinationReview;
DELETE FROM v2.DestinationContent;
DELETE FROM v2.SlugRedirect;
UPDATE v2.Province SET DestinationId = NULL;
UPDATE v2.Destination SET ParentId = NULL;
DELETE FROM v2.Destination;
COMMIT;
SELECT 'v2.Destination' AS tbl, count(*) AS remaining FROM v2.Destination
UNION ALL SELECT 'v2.DestinationContent', count(*) FROM v2.DestinationContent
UNION ALL SELECT 'v2.DestinationTagMap', count(*) FROM v2.DestinationTagMap
UNION ALL SELECT 'v2.DestinationTypeMap', count(*) FROM v2.DestinationTypeMap
UNION ALL SELECT 'v2.DestinationRelation', count(*) FROM v2.DestinationRelation
UNION ALL SELECT 'v2.DestinationReview', count(*) FROM v2.DestinationReview
UNION ALL SELECT 'v2.SlugRedirect', count(*) FROM v2.SlugRedirect;`;
  execFileSync("sqlcmd", ["-S", "(localdb)\\MSSQLLocalDB", "-d", "dichoithoi_dev", "-Q", sql], {
    stdio: "inherit",
  });
  console.log("SQL Server: wipe xong (Province + taxonomy GIU nguyen).");
}

async function wipePostgres(client: InstanceType<typeof Client>): Promise<void> {
  const slugsRes = await client.query(`SELECT slug FROM dichoithoi_destinations`);
  const list = slugsRes.rows.map((r) => r.slug);
  console.log(`Postgres: xoa ${list.length} destination + bang ve tinh...`);
  // Cung thu tu cau lenh voi deleteCascade (typeorm-destination-mirror.repository.ts:310)
  await client.query("BEGIN");
  try {
    await client.query(`DELETE FROM dichoithoi_destination_relations WHERE source_slug = ANY($1) OR target_slug = ANY($1)`, [list]);
    await client.query(`DELETE FROM dichoithoi_poi_distances WHERE poi_a_slug = ANY($1) OR poi_b_slug = ANY($1)`, [list]);
    await client.query(`DELETE FROM dichoithoi_cluster_distances WHERE cluster_a_slug = ANY($1) OR cluster_b_slug = ANY($1)`, [list]);
    await client.query(`DELETE FROM hotel_destination_map WHERE destination_slug = ANY($1)`, [list]);
    await client.query(`DELETE FROM tour_destination_map WHERE destination_slug = ANY($1)`, [list]);
    await client.query(`DELETE FROM destination_tickets WHERE destination_slug = ANY($1)`, [list]);
    await client.query(`DELETE FROM dichoithoi_destination_ai_extractions WHERE destination_slug = ANY($1)`, [list]);
    await client.query(
      `UPDATE products SET tags = COALESCE(
         (SELECT array_agg(t) FROM unnest(tags) t WHERE t <> ALL($1)), '{}'
       ) WHERE tags && $1`,
      [list],
    );
    await client.query(`DELETE FROM dichoithoi_destinations WHERE slug = ANY($1)`, [list]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }

  const checks = [
    "dichoithoi_destinations",
    "dichoithoi_destination_relations",
    "dichoithoi_poi_distances",
    "dichoithoi_cluster_distances",
    "destination_tickets",
    "dichoithoi_destination_ai_extractions",
    "dichoithoi_cluster_poi_candidates",
  ];
  for (const tbl of checks) {
    const r = await client.query(`SELECT count(*) AS c FROM ${tbl}`);
    console.log(`  ${tbl}: ${r.rows[0]?.c} dong con lai`);
  }
  const backup = await client.query(`SELECT count(*) AS c FROM ${BACKUP_TABLE}`);
  console.log(`  ${BACKUP_TABLE} (PHAI CON NGUYEN): ${backup.rows[0]?.c} dong`);
}

async function main(): Promise<void> {
  if (!process.argv.includes("--yes")) {
    console.error("Day la thao tac XOA SACH du lieu diem den ca 2 DB. Chay lai kem --yes de xac nhan.");
    process.exit(1);
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await guardBackups(client);
    wipeSqlServer();
    await wipePostgres(client);
    console.log("\n=== GD3 WIPE XONG ===");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Wipe THAT BAI:", err);
  process.exit(1);
});
