/**
 * Sinh scripts/dichoithoi-sqlserver/02-migrate-data.sql tu dataset dvhcvn:
 * - 34 INSERT v2.Province (kem Region Bac/Trung/Nam + OldNames).
 * - Bang map ten tinh cu -> ma tinh moi (#ProvinceMap) tu ward_mappings.
 * - Phan than migration (old schema -> v2) la SQL tinh trong TEMPLATE ben duoi.
 *
 * Chay: pnpm ts-node scripts/generate-dichoithoi-migration.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";

const DATA_DIR = path.join(__dirname, "..", "seed-data", "dvhcvn");
const OUT_FILE = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "scripts",
  "dichoithoi-sqlserver",
  "02-migrate-data.sql",
);

/** Region theo ma tinh dvhcvn: 1 Bac, 2 Trung, 3 Nam */
const REGION_BY_CODE: Record<string, number> = {
  "01": 1, "04": 1, "08": 1, "11": 1, "12": 1, "14": 1, "15": 1, "19": 1,
  "20": 1, "22": 1, "24": 1, "25": 1, "31": 1, "33": 1, "37": 1,
  "38": 2, "40": 2, "42": 2, "44": 2, "46": 2, "48": 2, "51": 2, "52": 2,
  "56": 2, "66": 2, "68": 2,
  "75": 3, "79": 3, "80": 3, "82": 3, "86": 3, "91": 3, "92": 3, "96": 3,
};

interface ProvinceRow {
  provinceCode: string;
  name: string;
  shortName: string;
}
interface MappingRow {
  oldDistrictName: string | null;
  oldProvinceName: string | null;
  newProvinceName: string | null;
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/thanh pho /g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Bo tien to "Tỉnh "/"Thành phố " de so khop ten kieu cu ("Lâm Đồng") */
function stripPrefix(name: string): string {
  return name.replace(/^(Tỉnh|Thành phố)\s+/u, "").trim();
}

function sqlString(value: string): string {
  return `N'${value.replace(/'/g, "''")}'`;
}

const provinces: ProvinceRow[] = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "provinces.json"), "utf8"),
);
const mappings: MappingRow[] = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "ward-mappings.json"), "utf8"),
);

// old province name (da bo tien to) -> new province name (da bo tien to)
const oldToNew = new Map<string, string>();
for (const m of mappings) {
  if (m.oldProvinceName && m.newProvinceName) {
    oldToNew.set(stripPrefix(m.oldProvinceName), stripPrefix(m.newProvinceName));
  }
}

// Ten THANH PHO/THI XA cu -> tinh moi (data cu co dong dung ten TP lam ProvinceName,
// vd "Phan Thiet", "Hoi An"). Bo qua ten trung voi map tinh; ten TP xuat hien o
// 2 tinh khac nhau thi loai (mơ ho — de dong do rơi vao danh sach ra tay).
const cityToNew = new Map<string, string | null>();
for (const m of mappings) {
  if (!m.oldDistrictName || !m.newProvinceName) continue;
  const match = /^(Thành phố|Thị xã)\s+(.+)$/u.exec(m.oldDistrictName);
  if (!match?.[2]) continue;
  const city = match[2].trim();
  if (oldToNew.has(city)) continue;
  const newName = stripPrefix(m.newProvinceName);
  if (cityToNew.has(city) && cityToNew.get(city) !== newName) {
    cityToNew.set(city, null); // mo ho — loai
  } else if (!cityToNew.has(city)) {
    cityToNew.set(city, newName);
  }
}
// OldNames cho tung tinh moi
const oldNamesByNew = new Map<string, string[]>();
for (const [oldName, newName] of oldToNew) {
  const list = oldNamesByNew.get(newName) ?? [];
  if (oldName !== newName) list.push(oldName);
  oldNamesByNew.set(newName, list);
}

const provinceInserts = provinces
  .map((p) => {
    const region = REGION_BY_CODE[p.provinceCode];
    if (!region) throw new Error(`Thieu region cho tinh ${p.provinceCode} ${p.name}`);
    const display = stripPrefix(p.shortName);
    const oldNames = (oldNamesByNew.get(display) ?? []).sort().join(", ");
    return `  ('${toSlug(p.name)}', '${p.provinceCode}', ${sqlString(display)}, ${region}, ${
      oldNames ? sqlString(oldNames) : "NULL"
    })`;
  })
  .join(",\n");

const provinceMapInserts = [...oldToNew.entries()]
  .map(([oldName, newName]) => `  (${sqlString(oldName)}, ${sqlString(newName)})`)
  .join(",\n");

const cityMapInserts = [...cityToNew.entries()]
  .filter((entry): entry is [string, string] => entry[1] !== null)
  .map(([city, newName]) => `  (${sqlString(city)}, ${sqlString(newName)})`)
  .join(",\n");

const sqlOut = `/*
  Dichoithoi — DAI TU SCHEMA (buoc 2/2): migrate data bang cu -> schema [v2].
  SINH TU DONG boi apps/api/scripts/generate-dichoithoi-migration.ts — DUNG SUA TAY,
  sua generator roi chay lai.

  Yeu cau: da chay 01-create-new-schema.sql; DA BACKUP toan bo DB.
  Script chay trong 1 transaction — loi o dau rollback toan bo.
  Theo docs/dichoithoi/dichoithoi-database-redesign.md §7.
*/
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET XACT_ABORT ON;
BEGIN TRAN;

IF EXISTS (SELECT 1 FROM v2.Destination)
BEGIN
  RAISERROR (N'v2.Destination da co du lieu — script nay chi chay 1 lan. Rollback.', 16, 1);
  ROLLBACK TRAN;
  RETURN;
END

/* ===== 1) 34 tinh/thanh moi (tu dvhcvn, Region gan tay trong generator) ===== */
INSERT INTO v2.Province (Slug, Code, Name, Region, OldNames) VALUES
${provinceInserts};

/* ===== 2) Bang map ten tinh CU -> ten tinh MOI (tu ward_mappings dvhcvn) ===== */
CREATE TABLE #ProvinceMap (OldName nvarchar(128) PRIMARY KEY, NewName nvarchar(128) NOT NULL);
INSERT INTO #ProvinceMap (OldName, NewName) VALUES
${provinceMapInserts};

-- Ten thanh pho/thi xa cu -> tinh moi (data cu co dong ProvinceName la ten TP,
-- vd "Phan Thiet" -> Lam Dong, "Hoi An" -> Da Nang)
CREATE TABLE #CityMap (CityName nvarchar(128) PRIMARY KEY, NewName nvarchar(128) NOT NULL);
INSERT INTO #CityMap (CityName, NewName) VALUES
${cityMapInserts};

/* ===== 3) Destination -> v2 voi Kind suy tu flags + cau truc data THAT =====
   Data that (kiem tra 12/06/2026): bang dbo.DestinationGroup va dbo.Province RONG —
   "nhom" la dong Destination IsGroup=1, "tinh" nam o cot ProvinceName.
   Quy tac Kind:
     1 (province) = IsProvince=1 HOAC (IsGroup=1 va Name = ProvinceName — group trung ten tinh)
     2 (cluster)  = IsGroup=1 con lai (vd da-lat thuoc Lam Dong)
     3 (poi)      = con lai
*/
INSERT INTO v2.Destination
  (Slug, Kind, Name, NameUnaccented, ShortDescription, Thumbnail, Lat, Lng,
   AddressOld, [Order], Status, DistanceFromCenter, SearchKeyword, HotelGroupId)
SELECT d.Id,
       CASE
         WHEN d.IsProvince = 1 THEN 1
         WHEN d.IsGroup = 1 AND d.Name = d.ProvinceName THEN 1
         WHEN d.IsGroup = 1 THEN 2
         ELSE 3
       END,
       d.Name, LOWER(d.Id), ISNULL(d.Description, N''), d.Id + '.webp',
       TRY_CONVERT(decimal(9,6), d.Lat), TRY_CONVERT(decimal(9,6), d.Lng),
       NULLIF(d.Address, ''), d.[Order], 1, d.DistanceFromCenter, d.SearchKeyword, d.HotelGroupId
FROM dbo.Destination d;

/* ===== 4) Gan ProvinceId cho MOI dong: ten tinh cu -> moi, fallback ten TP cu ===== */
UPDATE vd SET vd.ProvinceId = p.Id
FROM v2.Destination vd
JOIN dbo.Destination od ON od.Id = vd.Slug
LEFT JOIN #ProvinceMap pm ON pm.OldName = od.ProvinceName
LEFT JOIN #CityMap cm ON cm.CityName = od.ProvinceName
JOIN v2.Province p ON p.Name = COALESCE(pm.NewName, cm.NewName, od.ProvinceName);

-- Nguoc lai: Province tro toi trang tinh (neu co nhieu dong Kind=1 cung tinh,
-- lay dong co [Order] nho nhat)
UPDATE p SET p.DestinationId = x.Id
FROM v2.Province p
CROSS APPLY (
  SELECT TOP 1 vd.Id FROM v2.Destination vd
  WHERE vd.ProvinceId = p.Id AND vd.Kind = 1
  ORDER BY vd.[Order], vd.Id
) x;

-- Tinh gop (vd Kien Giang -> An Giang) tao 2+ dong Kind=1 cung tinh:
-- giu dong da chon lam trang tinh, cac dong con lai tu demote thanh cluster (Kind=2)
UPDATE vd SET vd.Kind = 2
FROM v2.Destination vd
JOIN v2.Province p ON p.Id = vd.ProvinceId
WHERE vd.Kind = 1 AND vd.Id <> p.DestinationId;

/* ===== 5) ParentId: poi -> nhom (DestinationGroupId), nhom/poi le -> trang tinh ===== */
-- cha = dong nhom (group cu) theo DestinationGroupId, tru chinh no
UPDATE v3 SET v3.ParentId = vg.Id
FROM v2.Destination v3
JOIN dbo.Destination od ON od.Id = v3.Slug AND v3.Kind = 3
JOIN v2.Destination vg ON vg.Slug = od.DestinationGroupId AND vg.Kind IN (1, 2)
WHERE od.DestinationGroupId IS NOT NULL AND od.DestinationGroupId <> ''
  AND vg.Id <> v3.Id;

-- cluster + poi chua co cha: cha = trang tinh cua tinh do
UPDATE vd SET vd.ParentId = p.DestinationId
FROM v2.Destination vd
JOIN v2.Province p ON p.Id = vd.ProvinceId
WHERE vd.Kind IN (2, 3) AND vd.ParentId IS NULL
  AND p.DestinationId IS NOT NULL AND p.DestinationId <> vd.Id;

/* ===== 6) Loai diem den: 3 nhom + 18 loai chuan (redesign §3.2/§9.2),
   map tu CSV tu do cu (best-effort — ra soat lai truoc khi len production, §9.2) ===== */
INSERT INTO v2.DestinationTypeGroup (Slug, Name, [Order]) VALUES
  ('thien-nhien', N'Thiên nhiên', 1),
  ('van-hoa-lich-su', N'Văn hóa - Lịch sử', 2),
  ('vui-choi-trai-nghiem', N'Vui chơi - Trải nghiệm', 3);

INSERT INTO v2.DestinationType (GroupId, Slug, Name, [Order]) VALUES
  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'thien-nhien'), 'bien-dao', N'Biển - Đảo', 1),
  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'thien-nhien'), 'nui-cao-nguyen', N'Núi - Cao nguyên', 2),
  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'thien-nhien'), 'thac-ho-suoi', N'Sông - Suối - Hồ - Thác', 3),
  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'thien-nhien'), 'hang-dong', N'Hang động', 4),
  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'thien-nhien'), 'rung-vuon-quoc-gia', N'Rừng - Vườn quốc gia', 5),
  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'thien-nhien'), 'dong-que-mien-tay', N'Đồng quê - Sông nước miền Tây', 6),
  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'van-hoa-lich-su'), 'di-tich-lich-su', N'Di tích lịch sử', 1),
  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'van-hoa-lich-su'), 'chua-den', N'Chùa - Đền - Miếu', 2),
  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'van-hoa-lich-su'), 'nha-tho', N'Nhà thờ', 3),
  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'van-hoa-lich-su'), 'lang-nghe-truyen-thong', N'Làng nghề truyền thống', 4),
  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'van-hoa-lich-su'), 'bao-tang', N'Bảo tàng', 5),
  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'van-hoa-lich-su'), 'cong-trinh-kien-truc', N'Công trình kiến trúc', 6),
  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'vui-choi-trai-nghiem'), 'khu-vui-choi', N'Khu vui chơi - Giải trí', 1),
  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'vui-choi-trai-nghiem'), 'check-in-song-ao', N'Check-in sống ảo', 2),
  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'vui-choi-trai-nghiem'), 'cho-pho-dem', N'Chợ - Phố đêm', 3),
  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'vui-choi-trai-nghiem'), 'am-thuc', N'Khu - Phố ẩm thực', 4),
  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'vui-choi-trai-nghiem'), 'pho-co-pho-di-bo', N'Phố cổ - Phố đi bộ', 5),
  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'vui-choi-trai-nghiem'), 'nghi-duong', N'Nghỉ dưỡng', 6);

-- Ten loai TU DO trong CSV cu -> slug loai MOI. Nhieu bien the/loai khong con y nghia
-- (admin: xã/tỉnh/thị trấn/thành phố; hoat dong: phượt/khám phá; tinh trang: tuyết/lãng mạn)
-- CHU Y khong map — dong nao khong khop bang nay se KHONG co DestinationTypeMap (bo qua).
CREATE TABLE #TypeMap (OldName nvarchar(128) PRIMARY KEY, NewSlug varchar(64) NOT NULL);
INSERT INTO #TypeMap (OldName, NewSlug) VALUES
  (N'lâu đài', 'cong-trinh-kien-truc'),
  (N'nhà hát', 'cong-trinh-kien-truc'),
  (N'làng chài', 'dong-que-mien-tay'),
  (N'đầm', 'thac-ho-suoi'),
  (N'dầm', 'thac-ho-suoi'),
  (N'kiến trúc', 'cong-trinh-kien-truc'),
  (N'nhà tù', 'di-tich-lich-su'),
  (N'phong cảnh', 'check-in-song-ao'),
  (N'khu du lịch', 'khu-vui-choi'),
  (N'hòn', 'bien-dao'),
  (N'di sản', 'di-tich-lich-su'),
  (N'nhà thờ', 'nha-tho'),
  (N'chùa', 'chua-den'),
  (N'miếu', 'chua-den'),
  (N'di tích', 'di-tich-lich-su'),
  (N'cánh đồng', 'dong-que-mien-tay'),
  (N'quảng trường', 'cong-trinh-kien-truc'),
  (N'sông', 'thac-ho-suoi'),
  (N'đình thờ', 'chua-den'),
  (N'hồ', 'thac-ho-suoi'),
  (N'hang', 'hang-dong'),
  (N'tâm linh', 'chua-den'),
  (N'tháp', 'cong-trinh-kien-truc'),
  (N'danh thắng', 'check-in-song-ao'),
  (N'điểm tham quan', 'khu-vui-choi'),
  (N'suối', 'thac-ho-suoi'),
  (N'đảo', 'bien-dao'),
  (N'phố đi bộ', 'pho-co-pho-di-bo'),
  (N'đình', 'chua-den'),
  (N'núi', 'nui-cao-nguyen'),
  (N'lịch sử', 'di-tich-lich-su'),
  (N'rừng', 'rung-vuon-quoc-gia'),
  (N'thác', 'thac-ho-suoi'),
  (N'tứ đại đỉnh đèo', 'nui-cao-nguyen'),
  (N'đi bộ', 'pho-co-pho-di-bo'),
  (N'vịnh', 'bien-dao'),
  (N'biển', 'bien-dao'),
  (N'rượu', 'am-thuc'),
  (N'điểm cực bắc', 'check-in-song-ao'),
  (N'hải đăng', 'cong-trinh-kien-truc'),
  (N'cao nguyên', 'nui-cao-nguyen'),
  (N'nhà cổ', 'lang-nghe-truyen-thong'),
  (N'đèo', 'nui-cao-nguyen'),
  (N'đồi cát', 'bien-dao'),
  (N'chợ', 'cho-pho-dem'),
  (N'cầu', 'cong-trinh-kien-truc'),
  (N'lang', 'dong-que-mien-tay'),
  (N'làng', 'dong-que-mien-tay'),
  (N'thắng cảnh', 'check-in-song-ao'),
  (N'phố cổ', 'pho-co-pho-di-bo'),
  (N'mua sắm', 'cho-pho-dem'),
  (N'bản làng', 'dong-que-mien-tay'),
  (N'ăn uống', 'am-thuc'),
  (N'thung lũng', 'nui-cao-nguyen'),
  (N'bảo tàng', 'bao-tang');

;WITH SplitTypes AS (
  SELECT d.Id AS OldSlug, LTRIM(RTRIM(value)) AS TypeName
  FROM dbo.Destination d
  CROSS APPLY STRING_SPLIT(d.Type, ',')
  WHERE d.Type IS NOT NULL AND LTRIM(RTRIM(value)) <> ''
)
INSERT INTO v2.DestinationTypeMap (DestinationId, TypeId)
SELECT DISTINCT vd.Id, t.Id
FROM SplitTypes s
JOIN #TypeMap tm ON LOWER(tm.OldName) = LOWER(s.TypeName)
JOIN v2.Destination vd ON vd.Slug = s.OldSlug
JOIN v2.DestinationType t ON t.Slug = tm.NewSlug;

-- PrimaryTypeId = loai dau tien trong CSV cu co map duoc; neu khong, lay bat ky loai da map
;WITH FirstType AS (
  SELECT d.Id AS OldSlug,
         LTRIM(RTRIM(LEFT(d.Type, CHARINDEX(',', d.Type + ',') - 1))) AS TypeName
  FROM dbo.Destination d
  WHERE d.Type IS NOT NULL AND d.Type <> ''
)
UPDATE vd SET vd.PrimaryTypeId = COALESCE(
  (SELECT t.Id FROM FirstType f
   JOIN #TypeMap tm ON LOWER(tm.OldName) = LOWER(f.TypeName)
   JOIN v2.DestinationType t ON t.Slug = tm.NewSlug
   WHERE f.OldSlug = vd.Slug),
  (SELECT TOP 1 t.Id FROM v2.DestinationTypeMap m
   JOIN v2.DestinationType t ON t.Id = m.TypeId
   WHERE m.DestinationId = vd.Id)
)
FROM v2.Destination vd;

/* ===== 7) DestinationDetail -> DestinationContent (+ Phone -> ContactPhone) ===== */
INSERT INTO v2.DestinationContent
  (DestinationId, ContentHtml, OpeningTime, TicketPrice, Transport, Food, Tip, HotelText)
SELECT vd.Id, dd.Content, dd.OpeningTime, dd.TicketPrice, dd.Transport, dd.Food, dd.Tip, dd.Hotel
FROM dbo.DestinationDetail dd
JOIN v2.Destination vd ON vd.Slug = dd.DestinationId;

UPDATE vd SET vd.ContactPhone = LEFT(dd.Phone, 32)
FROM v2.Destination vd
JOIN dbo.DestinationDetail dd ON dd.DestinationId = vd.Slug
WHERE dd.Phone IS NOT NULL AND dd.Phone <> '';

/* ===== 8) Reviews remap slug -> Id int + counter cache ===== */
INSERT INTO v2.DestinationReview
  (DestinationId, UserId, Name, Email, Rating, Comment, IsAdmin, IsApproved, DateCreated, DateApproved)
SELECT vd.Id, r.UserId, r.Name, r.Email, r.Rating, r.Comment, r.IsAdmin, r.IsApproved,
       r.DateCreated, r.DateApproved
FROM dbo.DestinationReview r
JOIN v2.Destination vd ON vd.Slug = r.DestinationId;

UPDATE vd SET
  vd.ReviewCount = agg.Cnt,
  vd.AvgRating = agg.Avg
FROM v2.Destination vd
JOIN (
  SELECT DestinationId, COUNT(*) AS Cnt, CAST(AVG(CAST(Rating AS decimal(5,2))) AS decimal(3,2)) AS Avg
  FROM v2.DestinationReview WHERE IsApproved = 1 GROUP BY DestinationId
) agg ON agg.DestinationId = vd.Id;

UPDATE vp SET vp.ChildCount = c.Cnt
FROM v2.Destination vp
JOIN (SELECT ParentId, COUNT(*) AS Cnt FROM v2.Destination WHERE ParentId IS NOT NULL GROUP BY ParentId) c
  ON c.ParentId = vp.Id;

COMMIT TRAN;

/* ===== 9) KIEM TRA SAU MIGRATION — xem ky truoc khi sua website ===== */
SELECT 'tong so diem' = (SELECT COUNT(*) FROM dbo.Destination),
       'v2 diem' = (SELECT COUNT(*) FROM v2.Destination),
       'v2 content' = (SELECT COUNT(*) FROM v2.DestinationContent),
       'v2 types' = (SELECT COUNT(*) FROM v2.DestinationType),
       'v2 reviews' = (SELECT COUNT(*) FROM v2.DestinationReview);

-- Tinh moi co NHIEU dong Kind=1 (do gop tinh) -> RA TAY: giu 1 dong tinh,
-- doi cac dong thua thanh Kind=2 (cluster) hoac gop noi dung
SELECT p.Name AS TinhMoi, vd.Slug
FROM v2.Destination vd JOIN v2.Province p ON p.Id = vd.ProvinceId
WHERE vd.Kind = 1 AND vd.ProvinceId IN (
  SELECT ProvinceId FROM v2.Destination WHERE Kind = 1 GROUP BY ProvinceId HAVING COUNT(*) > 1
)
ORDER BY p.Name;

-- Dong khong gan duoc tinh / khong parse duoc toa do -> ra soat tay
SELECT Slug, Name, 'thieu ProvinceId' AS VanDe FROM v2.Destination WHERE ProvinceId IS NULL
UNION ALL
SELECT vd.Slug, vd.Name, 'Lat/Lng parse fail'
FROM v2.Destination vd JOIN dbo.Destination od ON od.Id = vd.Slug
WHERE vd.Lat IS NULL AND od.Lat IS NOT NULL AND od.Lat <> '';
`;

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
// BOM bat buoc: sqlcmd doc file khong BOM theo codepage ANSI -> hong literal tieng Viet
fs.writeFileSync(OUT_FILE, "﻿" + sqlOut);
console.log(
  `Da sinh ${OUT_FILE} — ${provinces.length} tinh, ${oldToNew.size} cap map ten cu->moi`,
);
