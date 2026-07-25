/* =====================================================================
   Taxonomy redesign — xoá toàn bộ Nhóm/Type/Tag cũ, seed lại theo bản
   chốt docs/dichoithoi/phan-tich/dichoithoi-taxonomy-chuan-hoa.md (24/07/2026).

   Quyết định của người dùng (24/07/2026): không giữ dữ liệu Nhóm/Type/Tag
   cũ, xoá sạch và seed lại theo thiết kế mới (4 Nhóm/18 Type/17 Tag) —
   thiết kế cho quy mô nhập liệu toàn quốc, không ràng buộc theo 247 điểm
   hiện có. KHÔNG idempotent theo kiểu "chạy nhiều lần vô hại" như
   01-create-new-schema.sql — đây là script XOÁ + SEED LẠI, chỉ chạy 1 lần.
   Sau khi chạy: mọi POI mất hết gán Type/Tag (PrimaryTypeId=NULL, không
   còn dòng nào trong TypeMap/TagMap) — cần chạy lại quy trình gán Type/Tag
   (tay hoặc AI gợi ý) cho từng điểm đến.
   ===================================================================== */

SET QUOTED_IDENTIFIER ON;
GO

BEGIN TRAN;

-- 1) Gỡ FK PrimaryTypeId trước khi xoá DestinationType (tránh vi phạm FK)
UPDATE v2.Destination SET PrimaryTypeId = NULL WHERE PrimaryTypeId IS NOT NULL;

-- 2) Xoá toàn bộ gán cũ
DELETE FROM v2.DestinationTypeMap;
DELETE FROM v2.DestinationTagMap;

-- 3) Xoá từ vựng cũ
DELETE FROM v2.DestinationType;
DELETE FROM v2.DestinationTypeGroup;
DELETE FROM v2.DestinationTag;

-- 4) Reset IDENTITY để Id bắt đầu lại từ 1 (không bắt buộc, chỉ cho gọn)
DBCC CHECKIDENT ('v2.DestinationTypeGroup', RESEED, 0);
DBCC CHECKIDENT ('v2.DestinationType', RESEED, 0);
DBCC CHECKIDENT ('v2.DestinationTag', RESEED, 0);

/* ===== 5) Seed 4 Nhóm mới ===== */
INSERT INTO v2.DestinationTypeGroup (Slug, Name, [Order]) VALUES
  ('thien-nhien', N'Thiên nhiên & Sinh thái', 1),
  ('tam-linh-ton-giao', N'Tâm linh & Tôn giáo', 2),
  ('van-hoa-lich-su', N'Văn hóa - Lịch sử', 3),
  ('vui-choi-giai-tri', N'Vui chơi & Giải trí', 4);

/* ===== 6) Seed 18 Type mới, gán đúng Nhóm ===== */
INSERT INTO v2.DestinationType (GroupId, Slug, Name, [Order]) VALUES
  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'thien-nhien'), 'bien-dao', N'Biển - Bãi tắm - Đảo', 1),
  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'thien-nhien'), 'nui-cao-nguyen', N'Núi - Cao nguyên - Đèo', 2),
  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'thien-nhien'), 'thac-ho-suoi', N'Sông - Suối - Hồ - Thác', 3),
  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'thien-nhien'), 'hang-dong', N'Hang động', 4),
  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'thien-nhien'), 'rung-vuon-quoc-gia', N'Rừng - Vườn quốc gia', 5),
  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'thien-nhien'), 'sinh-thai-dong-que', N'Sinh thái - Đồng quê - Vườn trái cây', 6),

  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'tam-linh-ton-giao'), 'quan-the-tam-linh', N'Quần thể & Danh thắng tâm linh', 1),
  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'tam-linh-ton-giao'), 'chua-den-mieu', N'Chùa - Đền - Miếu - Toà thánh', 2),
  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'tam-linh-ton-giao'), 'nha-tho-cong-giao', N'Nhà thờ - Công trình Công giáo', 3),

  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'van-hoa-lich-su'), 'di-tich-lich-su', N'Di tích lịch sử - Thành cổ', 1),
  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'van-hoa-lich-su'), 'bao-tang-trien-lam', N'Bảo tàng - Triển lãm', 2),
  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'van-hoa-lich-su'), 'lang-nghe-truyen-thong', N'Làng nghề truyền thống', 3),
  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'van-hoa-lich-su'), 'cong-trinh-kiet-tac', N'Công trình kiến trúc - Biểu tượng', 4),

  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'vui-choi-giai-tri'), 'khu-vui-choi-cong-vien', N'Khu vui chơi - Công viên chủ đề', 1),
  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'vui-choi-giai-tri'), 'nong-trai-vuon-hoa-camping', N'Nông trại - Vườn hoa - Cắm trại', 2),
  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'vui-choi-giai-tri'), 'khoang-nong-onsen-spa', N'Suối khoáng nóng - Onsen - Spa', 3),
  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'vui-choi-giai-tri'), 'cho-pho-dem-am-thuc', N'Chợ - Phố đêm - Khu ẩm thực', 4),
  ((SELECT Id FROM v2.DestinationTypeGroup WHERE Slug = 'vui-choi-giai-tri'), 'pho-co-pho-di-bo', N'Phố cổ - Phố đi bộ', 5);

/* ===== 7) Seed 17 Tag mới (Status=0 draft — tất cả trống dữ liệu, chưa đủ
   ≥5 điểm để publish/index cho tới khi chạy gán Tag thật) ===== */
INSERT INTO v2.DestinationTag (Slug, Name, Status) VALUES
  ('phu-hop-gia-dinh', N'Phù hợp gia đình & trẻ nhỏ', 0),
  ('lang-man-cap-doi', N'Lãng mạn — Phù hợp cặp đôi', 0),
  ('nhom-ban-teambuilding', N'Tụ tập nhóm bạn — Team building', 0),
  ('nghi-duong-chua-lanh', N'Nghỉ dưỡng — Chữa lành — Thư giãn', 0),
  ('check-in-song-ao', N'Check-in sống ảo — Góc chụp đẹp', 0),
  ('san-may-hoang-hon', N'Săn mây — Ngắm hoàng hôn & bình minh', 0),
  ('hoang-so-kham-pha', N'Hoang sơ — Vắng người — Yêu thiên nhiên', 0),
  ('mao-hiem-trekking', N'Mạo hiểm — Trekking — Phượt', 0),
  ('cam-trai-dieu-da', N'Cắm trại — Glamping — Dã ngoại', 0),
  ('di-choi-ban-dem', N'Vui chơi ban đêm — Nightlife', 0),
  ('du-lich-cuoi-tuan', N'Đi về trong ngày — Du lịch cuối tuần', 0),
  ('canh-sac-theo-mua', N'Mùa hoa — Cảnh sắc theo mùa', 0),
  ('am-thuc-dac-san', N'Ẩm thực & Đặc sản địa phương', 0),
  ('van-hoa-ban-dia', N'Văn hoá bản địa — Bản làng & Phong tục', 0),
  ('di-san-ky-luc', N'Di sản — Kỷ lục thế giới', 0),
  ('lich-su-chien-tranh', N'Lịch sử chiến tranh — Hoài niệm', 0),
  ('bieu-tuong', N'Biểu tượng địa phương — Phải ghé', 0);

COMMIT TRAN;

-- Kiểm tra nhanh sau khi chạy
SELECT (SELECT COUNT(*) FROM v2.DestinationTypeGroup) AS Groups,
       (SELECT COUNT(*) FROM v2.DestinationType) AS Types,
       (SELECT COUNT(*) FROM v2.DestinationTag) AS Tags,
       (SELECT COUNT(*) FROM v2.DestinationTypeMap) AS TypeAssignments,
       (SELECT COUNT(*) FROM v2.DestinationTagMap) AS TagAssignments;
