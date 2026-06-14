/**
 * Smoke test ket noi SQL Server CMS khuyenmai (CHI DOC — khong ghi gi).
 * Chay: pnpm check:khuyenmai
 * Kiem tra: (1) ket noi tu may local, (2) doc bang WordpressPost (laruki=1, dochoi3s=2),
 * (3) encoding tieng Viet co dau.
 */
import "dotenv/config";
import * as sql from "mssql";

const SITE_LABEL: Record<number, string> = { 1: "Laruki", 2: "Dochoi3s" };

async function main(): Promise<void> {
  const config: sql.config = {
    server: process.env.KHUYENMAI_DB_HOST ?? "",
    database: process.env.KHUYENMAI_DB_NAME ?? "",
    user: process.env.KHUYENMAI_DB_USER ?? "",
    password: process.env.KHUYENMAI_DB_PASSWORD ?? "",
    options: { encrypt: true, trustServerCertificate: true },
    connectionTimeout: 15_000,
    requestTimeout: 15_000,
  };
  if (!config.server || !config.user) {
    throw new Error("Thieu KHUYENMAI_DB_* trong .env");
  }

  console.log(`Dang ket noi ${config.server} / ${config.database} ...`);
  const pool = await sql.connect(config);
  try {
    const bySite = await pool.request().query(
      "SELECT SiteId, COUNT(*) AS total FROM WordpressPost GROUP BY SiteId ORDER BY SiteId",
    );
    console.log("Bang WordpressPost theo site:");
    for (const row of bySite.recordset) {
      console.log(`  - SiteId ${row.SiteId} (${SITE_LABEL[row.SiteId] ?? "?"}): ${row.total} bai`);
    }

    const sample = await pool.request().query(
      "SELECT TOP 5 Id, SiteId, PostId, Title, PostType, IsReadyAuto FROM WordpressPost ORDER BY DateUpdated DESC",
    );
    console.log("Mau 5 bai moi cap nhat (kiem tra tieng Viet co dau):");
    for (const row of sample.recordset) {
      console.log(
        `  - [${row.Id}] site=${row.SiteId} wpPost=${row.PostId} type=${row.PostType ?? "-"} ready=${row.IsReadyAuto} | ${row.Title}`,
      );
    }
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error("KET NOI THAT BAI:", err.message);
  process.exit(1);
});
