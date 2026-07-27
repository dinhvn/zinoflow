/**
 * GD2 — Backup truoc dot lam moi du lieu theo Atlas (phuong an A wipe & restore,
 * docs/dichoithoi/chuan-hoa-du-lieu/plan-lam-moi-du-lieu-atlas.md).
 *
 * Lam 4 viec, theo thu tu:
 * 1. Tao bang tam `dichoithoi_destinations_backup` = copy NGUYEN dong bang
 *    dichoithoi_destinations (du moi cot) + 2 cot quan tri restored_to_slug /
 *    restore_note. Bang da ton tai -> DUNG LAI, khong ghi de (tranh mat backup cu).
 * 2. Copy toan bo thu muc anh diem den (DICHOITHOI_LOCAL_WEB_ROOT + FTP_BASE_DIR)
 *    sang thu muc tam NGOAI web root: <web_root>/../backup-images-atlas-<date>/.
 * 3. pg_dump Postgres ra file .dump (custom format).
 * 4. Backup SQL Server LocalDB dichoithoi_dev ra file .bak.
 *
 * Chay: pnpm --filter @zinoflow/api exec ts-node scripts/atlas-backup-destinations.ts
 * KHONG xoa gi — script nay an toan chay lai (idempotent tung buoc).
 */
import "dotenv/config";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
// pg khong co @types trong repo — require + type toi thieu (script one-time)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Client } = require("pg") as {
  Client: new (config: { connectionString?: string }) => {
    connect(): Promise<void>;
    end(): Promise<void>;
    query(sql: string, params?: unknown[]): Promise<{ rows: Array<Record<string, string>>; rowCount: number | null }>;
  };
};
type Client = InstanceType<typeof Client>;

const BACKUP_TABLE = "dichoithoi_destinations_backup";
const DATE_TAG = "2026-07-27";
const PG_DUMP = "C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe";

async function backupPostgresTable(client: Client): Promise<void> {
  const exists = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_name = $1`,
    [BACKUP_TABLE],
  );
  if (exists.rowCount && exists.rowCount > 0) {
    const n = await client.query(`SELECT count(*) FROM ${BACKUP_TABLE}`);
    console.log(`[1/4] Bang ${BACKUP_TABLE} DA TON TAI (${n.rows[0]?.count} dong) — giu nguyen, khong ghi de.`);
    return;
  }
  await client.query(`CREATE TABLE ${BACKUP_TABLE} AS SELECT * FROM dichoithoi_destinations`);
  await client.query(`ALTER TABLE ${BACKUP_TABLE} ADD COLUMN restored_to_slug varchar(64) NULL`);
  await client.query(`ALTER TABLE ${BACKUP_TABLE} ADD COLUMN restore_note text NULL`);
  await client.query(`ALTER TABLE ${BACKUP_TABLE} ADD PRIMARY KEY (slug)`);
  const srcCount = (await client.query(`SELECT count(*) FROM dichoithoi_destinations`)).rows[0]?.count;
  const dstCount = (await client.query(`SELECT count(*) FROM ${BACKUP_TABLE}`)).rows[0]?.count;
  if (!srcCount || srcCount !== dstCount) {
    throw new Error(`Lech so dong: goc ${srcCount} vs backup ${dstCount}`);
  }
  console.log(`[1/4] Da tao ${BACKUP_TABLE}: ${dstCount} dong (khop bang goc).`);
}

function backupImages(): string {
  const webRoot = process.env.DICHOITHOI_LOCAL_WEB_ROOT;
  const baseDir = process.env.DICHOITHOI_FTP_BASE_DIR;
  if (!webRoot || !baseDir) throw new Error("Thieu DICHOITHOI_LOCAL_WEB_ROOT / DICHOITHOI_FTP_BASE_DIR");
  const source = path.join(webRoot, baseDir.replace(/^[/\\]+/, ""));
  // NGOAI web root de khong bi serve nham (plan GD2)
  const target = path.join(webRoot, "..", `backup-images-atlas-${DATE_TAG}`);
  if (existsSync(target)) {
    console.log(`[2/4] Thu muc anh tam DA TON TAI (${target}) — giu nguyen, khong copy lai.`);
    return target;
  }
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
  const srcCount = readdirSync(source).length;
  const dstCount = readdirSync(target).length;
  if (srcCount !== dstCount) throw new Error(`Lech so muc anh: goc ${srcCount} vs backup ${dstCount}`);
  console.log(`[2/4] Da copy anh: ${dstCount} muc -> ${target}`);
  return target;
}

function pgDump(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Thieu DATABASE_URL");
  const out = path.resolve(__dirname, "..", `..\\..\\..\\zinoflow-backup-atlas-${DATE_TAG}.dump`);
  if (existsSync(out)) {
    console.log(`[3/4] File pg_dump DA TON TAI (${out}) — giu nguyen.`);
    return out;
  }
  execFileSync(PG_DUMP, ["--format=custom", `--file=${out}`, url], { stdio: "inherit" });
  console.log(`[3/4] pg_dump xong -> ${out}`);
  return out;
}

function sqlServerBackup(): string {
  const out = `D:\\Gits\\mmo\\dichoithoi_dev-backup-atlas-${DATE_TAG}.bak`;
  if (existsSync(out)) {
    console.log(`[4/4] File .bak DA TON TAI (${out}) — giu nguyen.`);
    return out;
  }
  execFileSync(
    "sqlcmd",
    [
      "-S", "(localdb)\\MSSQLLocalDB",
      "-Q", `BACKUP DATABASE [dichoithoi_dev] TO DISK = N'${out}' WITH INIT`,
    ],
    { stdio: "inherit" },
  );
  console.log(`[4/4] Backup SQL Server xong -> ${out}`);
  return out;
}

async function main(): Promise<void> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await backupPostgresTable(client);
    const imgDir = backupImages();
    const dumpFile = pgDump();
    const bakFile = sqlServerBackup();
    console.log("\n=== GD2 BACKUP XONG ===");
    console.log(`Bang tam   : ${BACKUP_TABLE}`);
    console.log(`Anh tam    : ${imgDir}`);
    console.log(`pg_dump    : ${dumpFile}`);
    console.log(`SQL .bak   : ${bakFile}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Backup THAT BAI:", err);
  process.exit(1);
});
