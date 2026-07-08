# Dichoithoi Tour — Technical Spec (tạo 07/2026)

Module mới trong AI Content Tool, song song với Hotel (`dichoithoi-hotel-spec.md`):
quản lý dữ liệu **tour du lịch** gắn vào 1 hoặc nhiều điểm đến, hiển thị dạng khối
gợi ý (KHÔNG có trang chi tiết riêng — quyết định 07/2026, giống Hotel). Dùng
chung cơ chế chuyển link gốc → affiliate ở
`dichoithoi-affiliate-link-conversion-spec.md`.

## 1) Vai trò & nguồn dữ liệu

Giống Hotel: phục vụ kiếm tiền qua affiliate đặt tour, KHÔNG phải nội dung SEO
độc lập (đã chốt không có trang riêng) → không cần AI generate bài, không quality
gates, không review/publish 2 chốt — chỉ cần đúng dữ liệu + link affiliate hoạt
động.

Hai nguồn nhập liệu (giống Hotel):
1. **Cào từ nhiều nguồn** (trang bán tour: Klook, TripVision, website nhà xe/tour
   operator, hoặc trang tổng hợp khác) — mỗi nguồn có parser riêng
   (`ITourScraper` theo nguồn, adapter pattern).
2. **Nhập tay**: khi không cào được, hoặc tour đối tác trực tiếp.

⚠️ Cùng lưu ý ToS như Hotel (`dichoithoi-hotel-spec.md` §1): ưu tiên API/affiliate
feed chính thức nếu nhà cung cấp có, cào tần suất thấp/vừa phải nếu phải cào HTML.

## 2) Vì sao không cần trang chi tiết riêng

Quyết định 07/2026 (nhất quán với Hotel): tour chỉ là **card gợi ý** trong trang
điểm đến — tên tour, ảnh, giá từ, thời lượng, điểm khởi hành, nút "Đặt tour" → link
affiliate ra ngoài. Hệ quả: không cần slug/URL/SEO fields riêng, không cần content
pipeline AI, không cần review/approve. Nếu sau này muốn có trang riêng (SEO "tour
Vịnh Hạ Long 2 ngày 1 đêm" — có search volume thật, khác Hotel) thì làm ở giai
đoạn sau; bảng thiết kế dưới đủ field để mở rộng thành trang riêng mà không phải
đổi cấu trúc.

## 3) Data model — Postgres (zinoflow, nguồn sự thật)

```sql
CREATE TABLE tours (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           varchar(256) NOT NULL,
  short_description varchar(500),                  -- 1-2 câu cho card
  duration_days  smallint,                          -- vd 2 (2 ngày 1 đêm → duration_days=2, duration_nights=1)
  duration_nights smallint,
  departure_from varchar(256),                      -- điểm khởi hành, vd "Hà Nội"
  province_id    int REFERENCES admin_provinces(id),-- tỉnh đích chính, lọc/gợi ý theo tỉnh
  price_from     numeric(12,0),                      -- VND, giá thấp nhất hiện có
  rating         decimal(2,1),
  review_count   int,
  thumbnail_url  varchar(512),
  images         jsonb,
  provider       varchar(64),                        -- khớp affiliate_link_rules.provider (spec chung)
  source_url     varchar(512) NOT NULL,               -- link gốc — BẮT BUỘC
  affiliate_url  varchar(512),                        -- tính sẵn qua affiliate_link_rules (spec chung §3)
  link_status    varchar(20) NOT NULL DEFAULT 'no-rule', -- converted | no-rule | manual-override
  source         smallint NOT NULL DEFAULT 0,          -- 0 nhập tay, 1 cào klook, 2 cào tripvision, ...
  last_synced_at timestamptz,
  site_id        varchar(64),                          -- id bên SQL Server sau khi publish, NULL = chưa publish
  status         smallint NOT NULL DEFAULT 1,           -- 0 nháp, 1 published, 2 ẩn
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- 1 tour có thể đi qua NHIỀU điểm đến (vd "tour Hạ Long - Ninh Bình 3 ngày 2 đêm")
CREATE TABLE tour_destination_map (
  tour_id          uuid REFERENCES tours(id),
  destination_slug varchar(64) NOT NULL,             -- khớp mirror destinations
  is_primary       boolean NOT NULL DEFAULT false,   -- điểm đến chính của tour (dùng để chọn ảnh/thứ tự hiển thị)
  is_manual        boolean NOT NULL DEFAULT false,
  PRIMARY KEY (tour_id, destination_slug)
);
```

So với Hotel: bỏ toạ độ lat/lng riêng (tour không có 1 vị trí cố định, gắn qua
`tour_destination_map` là đủ) + thêm field đặc thù tour (`duration_days/nights`,
`departure_from`) + dùng chung 3 field affiliate (`provider`, `source_url`,
`affiliate_url`, `link_status`) theo spec chung.

## 4) Đồng bộ xuống SQL Server (website chỉ đọc)

Bảng mới bên SQL Server (chưa tồn tại, không như Hotel đã có sẵn `Hotel`/
`HotelGroup`): `Tour` + `TourDestinationMap`, cấu trúc rút gọn từ bảng Postgres
trên (chỉ giữ cột website cần render: tên, ảnh, giá từ, thời lượng, điểm khởi
hành, `AffiliateUrl`, rating). zinoflow là single-writer (`ITourPublisher`,
infrastructure layer, transaction + timeout/retry — cùng pattern
`IDestinationPublisher`/`IHotelPublisher`).

Card tour hiển thị ở trang điểm đến: `SELECT ... FROM TourDestinationMap JOIN
Tour WHERE DestinationSlug=@slug AND Status=1 ORDER BY IsPrimary DESC` — 1 query
thêm, hoặc gộp vào query trang detail nếu số tour/điểm nhỏ (tối đa hiển thị
4-6 tour, giống giới hạn card related).

## 5) Job cào & đồng bộ (pg-boss)

Giống Hotel (`dichoithoi-hotel-spec.md` §5), thêm phần riêng cho tour:
1. **Cào theo URL/nguồn**: nhập URL tour cụ thể hoặc trang danh sách theo điểm
   đến → job fetch + parse theo `ITourScraper` của nguồn tương ứng → tạo dòng
   `status=0` (nháp) để soát trước khi publish.
2. **Cập nhật giá định kỳ**: re-fetch tour đã published, so giá/rating, chỉ ghi
   khi khác.
3. **Áp dụng lại affiliate rule**: dùng chung job ở
   `dichoithoi-affiliate-link-conversion-spec.md` §4 (không viết riêng job này
   cho tour).

MVP: nhập tay trước cho các điểm đến hot nhất, xây crawler khi khối lượng đủ lớn.

## 6) UI trong AI tool

Thêm dưới khu "Dichoithoi", mục mới `Tour` (song song mục `Khách sạn` của Hotel):
- Bảng danh sách: tên, tỉnh đích, thời lượng, giá từ, nguồn, trạng thái link
  affiliate (`converted`/`no-rule`/`manual-override`), số điểm đến đang gán.
- Form thêm/sửa: field ở §3 + preview `affiliateUrl` khi dán `source_url` (theo
  cơ chế chung).
- Từ màn chi tiết điểm đến: panel "Tour gợi ý" — danh sách tour đang gán + thêm/
  gỡ tay, đánh dấu tour nào là điểm đến chính (`is_primary`).

## 7) Việc cần chốt trước khi build

1. Chọn nguồn cào trước (Klook tour, TripVision, hay nhà cung cấp khác) — ảnh
   hưởng parser đầu tiên.
2. Xác nhận mạng affiliate của từng nguồn đã có rule trong
   `affiliate_link_rules` chưa trước khi tour đầu tiên lên web (không thì
   `link_status='no-rule'`, mất hoa hồng).
3. Ngưỡng khối lượng tour cần có trước khi đáng xây job cào tự động (§5) — MVP
   có thể chỉ vài tour nhập tay cho các điểm đến hot nhất.
