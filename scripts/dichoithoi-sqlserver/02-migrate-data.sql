/*
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
  ('ha-noi', '01', N'Hà Nội', 1, NULL),
  ('cao-bang', '04', N'Cao Bằng', 1, NULL),
  ('tuyen-quang', '08', N'Tuyên Quang', 1, N'Hà Giang'),
  ('dien-bien', '11', N'Điện Biên', 1, NULL),
  ('lai-chau', '12', N'Lai Châu', 1, NULL),
  ('son-la', '14', N'Sơn La', 1, NULL),
  ('lao-cai', '15', N'Lào Cai', 1, N'Yên Bái'),
  ('thai-nguyen', '19', N'Thái Nguyên', 1, N'Bắc Kạn'),
  ('lang-son', '20', N'Lạng Sơn', 1, NULL),
  ('quang-ninh', '22', N'Quảng Ninh', 1, NULL),
  ('bac-ninh', '24', N'Bắc Ninh', 1, N'Bắc Giang'),
  ('phu-tho', '25', N'Phú Thọ', 1, N'Hoà Bình, Vĩnh Phúc'),
  ('hai-phong', '31', N'Hải Phòng', 1, N'Hải Dương'),
  ('hung-yen', '33', N'Hưng Yên', 1, N'Thái Bình'),
  ('ninh-binh', '37', N'Ninh Bình', 1, N'Hà Nam, Nam Định'),
  ('thanh-hoa', '38', N'Thanh Hóa', 2, NULL),
  ('nghe-an', '40', N'Nghệ An', 2, NULL),
  ('ha-tinh', '42', N'Hà Tĩnh', 2, NULL),
  ('quang-tri', '44', N'Quảng Trị', 2, N'Quảng Bình'),
  ('hue', '46', N'Huế', 2, NULL),
  ('da-nang', '48', N'Đà Nẵng', 2, N'Quảng Nam'),
  ('quang-ngai', '51', N'Quảng Ngãi', 2, N'Kon Tum'),
  ('gia-lai', '52', N'Gia Lai', 2, N'Bình Định'),
  ('khanh-hoa', '56', N'Khánh Hòa', 2, N'Ninh Thuận'),
  ('dak-lak', '66', N'Đắk Lắk', 2, N'Phú Yên'),
  ('lam-dong', '68', N'Lâm Đồng', 2, N'Bình Thuận, Đắk Nông'),
  ('dong-nai', '75', N'Đồng Nai', 3, N'Bình Phước'),
  ('ho-chi-minh', '79', N'Hồ Chí Minh', 3, N'Bà Rịa - Vũng Tàu, Bình Dương'),
  ('tay-ninh', '80', N'Tây Ninh', 3, N'Long An'),
  ('dong-thap', '82', N'Đồng Tháp', 3, N'Tiền Giang'),
  ('vinh-long', '86', N'Vĩnh Long', 3, N'Bến Tre, Trà Vinh'),
  ('an-giang', '91', N'An Giang', 3, N'Kiên Giang'),
  ('can-tho', '92', N'Cần Thơ', 3, N'Hậu Giang, Sóc Trăng'),
  ('ca-mau', '96', N'Cà Mau', 3, N'Bạc Liêu');

/* ===== 2) Bang map ten tinh CU -> ten tinh MOI (tu ward_mappings dvhcvn) ===== */
CREATE TABLE #ProvinceMap (OldName nvarchar(128) PRIMARY KEY, NewName nvarchar(128) NOT NULL);
INSERT INTO #ProvinceMap (OldName, NewName) VALUES
  (N'Hồ Chí Minh', N'Hồ Chí Minh'),
  (N'Khánh Hòa', N'Khánh Hòa'),
  (N'Vĩnh Long', N'Vĩnh Long'),
  (N'Lâm Đồng', N'Lâm Đồng'),
  (N'Hải Phòng', N'Hải Phòng'),
  (N'Đồng Tháp', N'Đồng Tháp'),
  (N'Gia Lai', N'Gia Lai'),
  (N'Cần Thơ', N'Cần Thơ'),
  (N'Huế', N'Huế'),
  (N'Đà Nẵng', N'Đà Nẵng'),
  (N'Bến Tre', N'Vĩnh Long'),
  (N'Bình Phước', N'Đồng Nai'),
  (N'Bình Định', N'Gia Lai'),
  (N'Bình Dương', N'Hồ Chí Minh'),
  (N'Quảng Ninh', N'Quảng Ninh'),
  (N'Quảng Nam', N'Đà Nẵng'),
  (N'Tuyên Quang', N'Tuyên Quang'),
  (N'Tây Ninh', N'Tây Ninh'),
  (N'Cà Mau', N'Cà Mau'),
  (N'Hà Nội', N'Hà Nội'),
  (N'Quảng Bình', N'Quảng Trị'),
  (N'Đồng Nai', N'Đồng Nai'),
  (N'Đắk Lắk', N'Đắk Lắk'),
  (N'Bà Rịa - Vũng Tàu', N'Hồ Chí Minh'),
  (N'Thái Nguyên', N'Thái Nguyên'),
  (N'Phú Yên', N'Đắk Lắk'),
  (N'Bình Thuận', N'Lâm Đồng'),
  (N'Tiền Giang', N'Đồng Tháp'),
  (N'An Giang', N'An Giang'),
  (N'Bạc Liêu', N'Cà Mau'),
  (N'Ninh Thuận', N'Khánh Hòa'),
  (N'Hải Dương', N'Hải Phòng'),
  (N'Đắk Nông', N'Lâm Đồng'),
  (N'Bắc Giang', N'Bắc Ninh'),
  (N'Hà Tĩnh', N'Hà Tĩnh'),
  (N'Bắc Kạn', N'Thái Nguyên'),
  (N'Thanh Hóa', N'Thanh Hóa'),
  (N'Bắc Ninh', N'Bắc Ninh'),
  (N'Lào Cai', N'Lào Cai'),
  (N'Sơn La', N'Sơn La'),
  (N'Hà Nam', N'Ninh Bình'),
  (N'Yên Bái', N'Lào Cai'),
  (N'Quảng Ngãi', N'Quảng Ngãi'),
  (N'Nghệ An', N'Nghệ An'),
  (N'Trà Vinh', N'Vĩnh Long'),
  (N'Ninh Bình', N'Ninh Bình'),
  (N'Hà Giang', N'Tuyên Quang'),
  (N'Kiên Giang', N'An Giang'),
  (N'Hoà Bình', N'Phú Thọ'),
  (N'Hưng Yên', N'Hưng Yên'),
  (N'Nam Định', N'Ninh Bình'),
  (N'Sóc Trăng', N'Cần Thơ'),
  (N'Long An', N'Tây Ninh'),
  (N'Kon Tum', N'Quảng Ngãi'),
  (N'Lạng Sơn', N'Lạng Sơn'),
  (N'Hậu Giang', N'Cần Thơ'),
  (N'Điện Biên', N'Điện Biên'),
  (N'Quảng Trị', N'Quảng Trị'),
  (N'Phú Thọ', N'Phú Thọ'),
  (N'Cao Bằng', N'Cao Bằng'),
  (N'Vĩnh Phúc', N'Phú Thọ'),
  (N'Thái Bình', N'Hưng Yên'),
  (N'Lai Châu', N'Lai Châu');

-- Ten thanh pho/thi xa cu -> tinh moi (data cu co dong ProvinceName la ten TP,
-- vd "Phan Thiet" -> Lam Dong, "Hoi An" -> Da Nang)
CREATE TABLE #CityMap (CityName nvarchar(128) PRIMARY KEY, NewName nvarchar(128) NOT NULL);
INSERT INTO #CityMap (CityName, NewName) VALUES
  (N'Ninh Hòa', N'Khánh Hòa'),
  (N'Bảo Lộc', N'Lâm Đồng'),
  (N'Hồng Ngự', N'Đồng Tháp'),
  (N'An Khê', N'Gia Lai'),
  (N'Thủ Đức', N'Hồ Chí Minh'),
  (N'Bình Long', N'Đồng Nai'),
  (N'An Nhơn', N'Gia Lai'),
  (N'Pleiku', N'Gia Lai'),
  (N'Thuận An', N'Hồ Chí Minh'),
  (N'Đông Triều', N'Quảng Ninh'),
  (N'Điện Bàn', N'Đà Nẵng'),
  (N'Trảng Bàng', N'Tây Ninh'),
  (N'Ayun Pa', N'Gia Lai'),
  (N'Cam Ranh', N'Khánh Hòa'),
  (N'Ba Đồn', N'Quảng Trị'),
  (N'Biên Hòa', N'Đồng Nai'),
  (N'Buôn Hồ', N'Đắk Lắk'),
  (N'Buôn Ma Thuột', N'Đắk Lắk'),
  (N'Bà Rịa', N'Hồ Chí Minh'),
  (N'Tam Kỳ', N'Đà Nẵng'),
  (N'Sông Công', N'Thái Nguyên'),
  (N'Hạ Long', N'Quảng Ninh'),
  (N'Tân Uyên', N'Hồ Chí Minh'),
  (N'Thủ Dầu Một', N'Hồ Chí Minh'),
  (N'Tuy Hoà', N'Đắk Lắk'),
  (N'Long Khánh', N'Đồng Nai'),
  (N'Bình Minh', N'Vĩnh Long'),
  (N'Đồng Xoài', N'Đồng Nai'),
  (N'Phan Thiết', N'Lâm Đồng'),
  (N'Gò Công', N'Đồng Tháp'),
  (N'Long Xuyên', N'An Giang'),
  (N'Thuỷ Nguyên', N'Hải Phòng'),
  (N'Phan Rang-Tháp Chàm', N'Khánh Hòa'),
  (N'Kinh Môn', N'Hải Phòng'),
  (N'Gia Nghĩa', N'Lâm Đồng'),
  (N'Hồng Lĩnh', N'Hà Tĩnh'),
  (N'Nha Trang', N'Khánh Hòa'),
  (N'Bến Cát', N'Hồ Chí Minh'),
  (N'Bỉm Sơn', N'Thanh Hóa'),
  (N'Quế Võ', N'Bắc Ninh'),
  (N'Hoài Nhơn', N'Gia Lai'),
  (N'Cai Lậy', N'Đồng Tháp'),
  (N'Đà Lạt', N'Lâm Đồng'),
  (N'Cao Lãnh', N'Đồng Tháp'),
  (N'Tịnh Biên', N'An Giang'),
  (N'Chí Linh', N'Hải Phòng'),
  (N'Phủ Lý', N'Ninh Bình'),
  (N'Châu Đốc', N'An Giang'),
  (N'Chũ', N'Bắc Ninh'),
  (N'Chơn Thành', N'Đồng Nai'),
  (N'Nghĩa Lộ', N'Lào Cai'),
  (N'Cẩm Phả', N'Quảng Ninh'),
  (N'Vinh', N'Nghệ An'),
  (N'Duy Tiên', N'Ninh Bình'),
  (N'Duyên Hải', N'Vĩnh Long'),
  (N'Dĩ An', N'Hồ Chí Minh'),
  (N'Giá Rai', N'Cà Mau'),
  (N'Quảng Yên', N'Quảng Ninh'),
  (N'Hoa Lư', N'Ninh Bình'),
  (N'Hoàng Mai', N'Nghệ An'),
  (N'Kỳ Anh', N'Hà Tĩnh'),
  (N'Hà Tiên', N'An Giang'),
  (N'Hòa Bình', N'Phú Thọ'),
  (N'Đông Hòa', N'Đắk Lắk'),
  (N'Hòa Thành', N'Tây Ninh'),
  (N'Hương Thủy', N'Huế'),
  (N'Hương Trà', N'Huế'),
  (N'Nghi Sơn', N'Thanh Hóa'),
  (N'Hội An', N'Đà Nẵng'),
  (N'Vĩnh Châu', N'Cần Thơ'),
  (N'Tân An', N'Tây Ninh'),
  (N'Kim Bảng', N'Ninh Bình'),
  (N'Kiến Tường', N'Tây Ninh'),
  (N'La Gi', N'Lâm Đồng'),
  (N'Long Mỹ', N'Cần Thơ'),
  (N'Tân Châu', N'An Giang'),
  (N'Thuận Thành', N'Bắc Ninh'),
  (N'Móng Cái', N'Quảng Ninh'),
  (N'Mường Lay', N'Điện Biên'),
  (N'Điện Biên Phủ', N'Điện Biên'),
  (N'Mộc Châu', N'Sơn La'),
  (N'Mỹ Hào', N'Hưng Yên'),
  (N'Mỹ Tho', N'Đồng Tháp'),
  (N'Ngã Năm', N'Cần Thơ'),
  (N'Sầm Sơn', N'Thanh Hóa'),
  (N'Đông Hà', N'Quảng Trị'),
  (N'Ngã Bảy', N'Cần Thơ'),
  (N'Việt Trì', N'Phú Thọ'),
  (N'Việt Yên', N'Bắc Ninh'),
  (N'Phong Điền', N'Huế'),
  (N'Từ Sơn', N'Bắc Ninh'),
  (N'Phú Mỹ', N'Hồ Chí Minh'),
  (N'Phổ Yên', N'Thái Nguyên'),
  (N'Phúc Yên', N'Phú Thọ'),
  (N'Phước Long', N'Đồng Nai'),
  (N'Vũng Tàu', N'Hồ Chí Minh'),
  (N'Quy Nhơn', N'Gia Lai'),
  (N'Rạch Giá', N'An Giang'),
  (N'Đức Phổ', N'Quảng Ngãi'),
  (N'Sa Pa', N'Lào Cai'),
  (N'Sa Đéc', N'Đồng Tháp'),
  (N'Sông Cầu', N'Đắk Lắk'),
  (N'Sơn Tây', N'Hà Nội'),
  (N'Tam Điệp', N'Ninh Bình'),
  (N'Thái Hoà', N'Nghệ An'),
  (N'Uông Bí', N'Quảng Ninh'),
  (N'Vĩnh Yên', N'Phú Thọ'),
  (N'Vị Thanh', N'Cần Thơ'),
  (N'Đồng Hới', N'Quảng Trị'),
  (N'Phú Quốc', N'An Giang');

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
