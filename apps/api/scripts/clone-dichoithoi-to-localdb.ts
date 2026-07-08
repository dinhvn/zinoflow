/**
 * Clone du lieu dichoithoi tu PRODUCTION (CHI DOC) -> LocalDB de dev sandbox,
 * KHONG dung gi toi production. Sau khi tinh nang OK moi chay migration that.
 *
 * - Production: doc qua tedious (DICHOITHOI_DB_* trong .env).
 * - LocalDB:   ghi qua msnodesqlv8 (named pipe, Windows only).
 * - Chi clone cac bang nhom DESTINATION ma 02-migrate-data.sql can.
 * - Idempotent: drop + tao lai tung bang trong dichoithoi_dev.
 *
 * Chay: pnpm clone:dichoithoi
 * Sau do: sqlcmd -S "(localdb)\MSSQLLocalDB" -d dichoithoi_dev -i scripts SQL.
 */
import "dotenv/config";
// Dung msnodesqlv8 (ODBC) cho CA 2 ket noi — mssql tedious va msnodesqlv8
// chia se base singleton, tron 2 driver trong 1 process se loi.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sqlLocal = require("mssql/msnodesqlv8") as typeof import("mssql");

const LOCAL_SERVER = "(localdb)\\MSSQLLocalDB";
const LOCAL_DB = "dichoithoi_dev";

/** Connection string ODBC cho LocalDB (msnodesqlv8 can driver tuong minh) */
function localConnectionString(database: string): string {
  return `Driver={ODBC Driver 17 for SQL Server};Server=${LOCAL_SERVER};Database=${database};Trusted_Connection=yes;`;
}

/** DDL bang cu (du cot 02-migrate-data.sql can) — theo DiChoiThoi.Common/DbEntities */
const TABLE_DDL: Record<string, string> = {
  Destination: `CREATE TABLE dbo.Destination (
    Id nvarchar(64) NOT NULL PRIMARY KEY,
    DestinationGroupId nvarchar(128) NULL,
    DestinationGroupName nvarchar(128) NULL,
    AreaId nvarchar(32) NULL,
    ProvinceId nvarchar(32) NULL,
    ProvinceName nvarchar(32) NULL,
    DisctrictId nvarchar(32) NULL,
    HotelGroupId nvarchar(50) NULL,
    Type nvarchar(128) NULL,
    Name nvarchar(128) NOT NULL,
    Description nvarchar(1000) NULL,
    [Order] int NOT NULL DEFAULT 0,
    Address nvarchar(128) NULL,
    Lat nvarchar(64) NULL,
    Lng nvarchar(64) NULL,
    DistanceFromCenter decimal(18,0) NULL,
    IsGroup bit NOT NULL DEFAULT 0,
    IsArea bit NOT NULL DEFAULT 0,
    IsProvince bit NOT NULL DEFAULT 0,
    SearchKeyword nvarchar(256) NULL
  )`,
  DestinationDetail: `CREATE TABLE dbo.DestinationDetail (
    Id int NOT NULL PRIMARY KEY,
    DestinationId nvarchar(64) NULL,
    Content nvarchar(max) NULL,
    OpeningTime nvarchar(512) NULL,
    TicketPrice nvarchar(512) NULL,
    Food nvarchar(max) NULL,
    Transport nvarchar(max) NULL,
    Tip nvarchar(max) NULL,
    Hotel nvarchar(max) NULL,
    Phone nvarchar(128) NULL
  )`,
  DestinationGroup: `CREATE TABLE dbo.DestinationGroup (
    Id nvarchar(128) NOT NULL PRIMARY KEY,
    Name nvarchar(128) NOT NULL,
    [Order] int NOT NULL DEFAULT 0,
    Thumbnail nvarchar(64) NULL,
    Lat nvarchar(64) NULL,
    Lng nvarchar(64) NULL,
    ShortDescription nvarchar(max) NULL,
    Description nvarchar(max) NULL,
    AreaId nvarchar(32) NULL,
    ProvinceId nvarchar(32) NULL,
    DistrictId nvarchar(32) NULL
  )`,
  Province: `CREATE TABLE dbo.Province (
    Id nvarchar(32) NOT NULL PRIMARY KEY,
    Name nvarchar(128) NOT NULL,
    [Order] int NOT NULL DEFAULT 0,
    Thumbnail nvarchar(64) NULL,
    Lat nvarchar(64) NULL,
    Lng nvarchar(64) NULL,
    Description nvarchar(max) NULL,
    AreaId nvarchar(32) NULL
  )`,
  DestinationReview: `CREATE TABLE dbo.DestinationReview (
    Id int NOT NULL PRIMARY KEY,
    DestinationId nvarchar(128) NULL,
    UserId int NULL,
    Name nvarchar(128) NULL,
    Email nvarchar(64) NULL,
    Rating int NOT NULL DEFAULT 0,
    Comment nvarchar(max) NULL,
    IsAdmin bit NOT NULL DEFAULT 0,
    IsApproved bit NOT NULL DEFAULT 0,
    DateCreated datetime NOT NULL DEFAULT GETDATE(),
    DateApproved datetime NULL
  )`,
  // Hotel/HotelGroup: website doc o trang chu (HomeController.Index) va trang
  // khach san — them vao day de dev local khong bi loi "Invalid object name".
  HotelGroup: `CREATE TABLE dbo.HotelGroup (
    Id nvarchar(50) NOT NULL PRIMARY KEY,
    [Order] int NOT NULL DEFAULT 0,
    IsPopular bit NOT NULL DEFAULT 0,
    DestinationName nvarchar(50) NULL,
    Title nvarchar(256) NULL,
    Description nvarchar(512) NULL,
    Content nvarchar(max) NULL
  )`,
  Hotel: `CREATE TABLE dbo.Hotel (
    Id int NOT NULL PRIMARY KEY,
    Name nvarchar(128) NOT NULL,
    SupplierName nvarchar(50) NOT NULL,
    HotelGroupId nvarchar(50) NOT NULL,
    DestinationName nvarchar(50) NULL,
    Address nvarchar(128) NULL,
    ImageUrl nvarchar(512) NULL,
    Link nvarchar(256) NOT NULL,
    Star int NOT NULL DEFAULT 0,
    Price money NOT NULL DEFAULT 0,
    SalePrice money NULL,
    SaleRate int NOT NULL DEFAULT 0,
    Description nvarchar(512) NULL,
    BookingDate datetime NOT NULL DEFAULT GETDATE(),
    InsertDate datetime NOT NULL DEFAULT GETDATE()
  )`,
};

async function main(): Promise<void> {
  console.log("1) Ket noi PRODUCTION (chi doc)...");
  const prodConnectionString =
    `Driver={ODBC Driver 17 for SQL Server};Server=${process.env.DICHOITHOI_DB_HOST};` +
    `Database=${process.env.DICHOITHOI_DB_NAME};Uid=${process.env.DICHOITHOI_DB_USER};` +
    `Pwd=${process.env.DICHOITHOI_DB_PASSWORD};TrustServerCertificate=yes;`;
  const prod = await new sqlLocal.ConnectionPool({
    connectionString: prodConnectionString,
    requestTimeout: 120_000,
  } as never).connect();

  console.log(`2) Tao database ${LOCAL_DB} tren ${LOCAL_SERVER} (neu chua co)...`);
  const master = await new sqlLocal.ConnectionPool({
    connectionString: localConnectionString("master"),
  } as never).connect();
  await master
    .request()
    .query(`IF DB_ID('${LOCAL_DB}') IS NULL CREATE DATABASE [${LOCAL_DB}]`);
  await master.close();

  const local = await new sqlLocal.ConnectionPool({
    connectionString: localConnectionString(LOCAL_DB),
  } as never).connect();

  try {
    for (const [table, ddl] of Object.entries(TABLE_DDL)) {
      process.stdout.write(`3) Clone dbo.${table} ... `);
      const rows = (await prod.request().query(`SELECT * FROM dbo.${table}`)).recordset;

      await local.request().query(`IF OBJECT_ID('dbo.${table}') IS NOT NULL DROP TABLE dbo.${table}`);
      await local.request().query(ddl);

      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      let inserted = 0;
      for (const row of rows) {
        const req = local.request();
        // prefix "val" tranh dung @P1/@p1 noi bo cua msnodesqlv8
        const params = columns.map((c, i) => {
          req.input(`val${i}`, (row as Record<string, unknown>)[c] ?? null);
          return `@val${i}`;
        });
        await req.query(
          `INSERT INTO dbo.${table} (${columns.map((c) => `[${c}]`).join(",")}) VALUES (${params.join(",")})`,
        );
        inserted++;
      }
      console.log(`${inserted} dong`);
    }

    const check = await local
      .request()
      .query(
        `SELECT (SELECT COUNT(*) FROM dbo.Destination) AS Des,
                (SELECT COUNT(*) FROM dbo.DestinationDetail) AS Detail,
                (SELECT COUNT(*) FROM dbo.DestinationGroup) AS Grp,
                (SELECT COUNT(*) FROM dbo.Province) AS Prov,
                (SELECT COUNT(*) FROM dbo.DestinationReview) AS Rev,
                (SELECT COUNT(*) FROM dbo.HotelGroup) AS HotelGrp,
                (SELECT COUNT(*) FROM dbo.Hotel) AS Hotel`,
      );
    console.log("4) Kiem tra LocalDB:", check.recordset[0]);
    console.log(`XONG — sandbox: ${LOCAL_SERVER} / ${LOCAL_DB}. Production KHONG bi dong toi.`);
  } finally {
    await local.close();
    await prod.close();
  }
}

main().catch((err) => {
  console.error("Clone that bai:", err.message);
  process.exit(1);
});
