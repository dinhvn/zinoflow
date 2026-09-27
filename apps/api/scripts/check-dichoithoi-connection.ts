/**
 * Smoke test ket noi PostgreSQL dichoithoi (CHI DOC — khong ghi gi).
 * Chay: pnpm check:dichoithoi
 * Kiem tra: (1) ket noi duoc tu may local toi DICHOITHOI_DATABASE_URL, (2) schema v2 da duoc
 * tao boi EF migrations ben repo dichoithoi, (3) doc tieng Viet co dau dung encoding.
 */
import "dotenv/config";
import { Client } from "pg";

async function main(): Promise<void> {
  const connectionString = process.env.DICHOITHOI_DATABASE_URL;
  if (!connectionString) {
    throw new Error("Thieu DICHOITHOI_DATABASE_URL trong .env");
  }

  const url = new URL(connectionString);
  console.log(`Dang ket noi ${url.host}${url.pathname} ...`);
  const client = new Client({ connectionString, connectionTimeoutMillis: 15_000 });
  await client.connect();
  try {
    const migrations = await client.query<{ migration_id: string }>(
      "SELECT migration_id FROM __ef_migrations_history ORDER BY migration_id",
    );
    console.log(`OK — da chay ${migrations.rowCount} EF migration: ${migrations.rows.map((r) => r.migration_id).join(", ")}`);

    const counts = await client.query<{ table_name: string; total: string }>(`
      SELECT 'destination' AS table_name, COUNT(*) AS total FROM v2.destination
      UNION ALL SELECT 'province', COUNT(*) FROM v2.province
      UNION ALL SELECT 'destination_type', COUNT(*) FROM v2.destination_type
      UNION ALL SELECT 'destination_tag', COUNT(*) FROM v2.destination_tag`);
    for (const row of counts.rows) console.log(`  - v2.${row.table_name}: ${row.total} dong`);

    const sample = await client.query<{ code: string; name: string }>(
      `SELECT code, name FROM v2.province ORDER BY "order", id LIMIT 3`,
    );
    console.log("Mau du lieu (kiem tra tieng Viet co dau):");
    for (const row of sample.rows) console.log(`  - [${row.code}] ${row.name}`);
  } finally {
    await client.end();
  }
}

main().catch((err: Error) => {
  console.error("KET NOI THAT BAI:", err.message);
  process.exit(1);
});
