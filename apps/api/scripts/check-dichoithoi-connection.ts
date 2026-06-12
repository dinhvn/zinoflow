/**
 * Smoke test ket noi SQL Server dichoithoi (CHI DOC — khong ghi gi).
 * Chay: pnpm ts-node scripts/check-dichoithoi-connection.ts
 * Kiem tra: (1) ket noi duoc tu may local, (2) doc tieng Viet co dau dung encoding.
 */
import "dotenv/config";
import * as sql from "mssql";

async function main(): Promise<void> {
  const config: sql.config = {
    server: process.env.DICHOITHOI_DB_HOST ?? "",
    database: process.env.DICHOITHOI_DB_NAME ?? "",
    user: process.env.DICHOITHOI_DB_USER ?? "",
    password: process.env.DICHOITHOI_DB_PASSWORD ?? "",
    options: { encrypt: true, trustServerCertificate: true },
    connectionTimeout: 15_000,
    requestTimeout: 15_000,
  };
  if (!config.server || !config.user) {
    throw new Error("Thieu DICHOITHOI_DB_* trong .env");
  }

  console.log(`Dang ket noi ${config.server} / ${config.database} ...`);
  const pool = await sql.connect(config);
  try {
    const count = await pool.request().query("SELECT COUNT(*) AS total FROM Destination");
    console.log(`OK — bang Destination co ${count.recordset[0].total} dong`);

    const sample = await pool
      .request()
      .query("SELECT TOP 3 Id, Name, ProvinceName FROM Destination ORDER BY [Order]");
    console.log("Mau du lieu (kiem tra tieng Viet co dau):");
    for (const row of sample.recordset) {
      console.log(`  - [${row.Id}] ${row.Name} — ${row.ProvinceName ?? "(null)"}`);
    }

    const tables = await pool
      .request()
      .query(
        "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME",
      );
    console.log(`Tong so bang: ${tables.recordset.length}`);
    console.log(tables.recordset.map((r: { TABLE_NAME: string }) => r.TABLE_NAME).join(", "));
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error("KET NOI THAT BAI:", err.message);
  process.exit(1);
});
