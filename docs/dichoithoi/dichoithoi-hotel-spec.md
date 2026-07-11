# Dichoithoi Hotel — Technical Spec (tạo 07/2026)

Module mới trong AI Content Tool: quản lý dữ liệu **khách sạn** hiển thị dạng khối
gợi ý trên trang điểm đến (KHÔNG có trang chi tiết riêng — quyết định 07/2026, xem
`dichoithoi-content-seo-ux-plan.md` §2 để biết vị trí hiển thị trên trang). zinoflow
trở thành CMS cho cả Destination lẫn Hotel — cùng nguyên tắc single-writer đã nêu
ở `dichoithoi-system-overview.md` §1. Link đặt phòng dùng chung cơ chế "link gốc
→ affiliate" ở `dichoithoi-affiliate-link-conversion-spec.md` (áp dụng đồng nhất
cho Hotel/Tour/vé điểm đến).

## 1) Vai trò & nguồn dữ liệu

Khách sạn PHỤC VỤ mục đích kiếm tiền (affiliate đặt phòng qua Booking.com/Agoda...),
KHÔNG phải nội dung SEO độc lập — vì vậy module này đơn giản hơn Destination nhiều:
không có AI generate bài viết, không có quality gates travel, không có review/publish
2 chốt tay. Chỉ cần đúng dữ liệu + link affiliate hoạt động.

Hai nguồn nhập liệu:
1. **Cào từ trang booking** (Booking.com, Agoda, Traveloka...): lấy tên, ảnh, giá
   từ, rating, số review, toạ độ. Dùng cho khối lượng lớn, cập nhật giá định kỳ.
2. **Nhập tay**: khi không cào được (trang chặn bot, hoặc khách sạn đối tác trực
   tiếp không có trên OTA) — nhập qua form, giống cách destination-spec nhập
   metadata tay.

⚠️ **Lưu ý ràng buộc pháp lý/ToS**: các trang OTA lớn (Booking.com, Agoda...)
thường có điều khoản dịch vụ cấm cào tự động dữ liệu ở quy mô lớn/tần suất cao,
và có thể chặn IP hoặc yêu cầu gỡ bỏ. Rủi ro thấp hơn nếu:
- Cào tần suất thấp, số lượng vừa phải (không giống bot thương mại quy mô lớn).
- Ưu tiên dùng **API/affiliate feed chính thức** nếu chương trình affiliate đang
  tham gia có cung cấp (nhiều mạng Booking Affiliate Partner có API hoặc widget
  nhúng hợp lệ thay vì cào HTML) — nên kiểm tra trước khi build crawler.
- Với Klook/BestPrice (vé) cũng áp dụng nguyên tắc tương tự nếu sau này cào thêm.
Đây là quyết định rủi ro-kinh doanh của bạn, không phải giới hạn kỹ thuật — ghi
nhận ở đây để cân nhắc khi chọn giữa "cào" và "API chính thức" lúc build.

## 2) Vì sao không cần trang chi tiết riêng

Quyết định 07/2026: hotel chỉ là **card gợi ý** trong trang điểm đến (tên, ảnh,
giá từ, rating, nút "Đặt phòng" → link affiliate ra ngoài). Hệ quả thiết kế:
- Không cần slug/URL/SEO fields riêng cho hotel (title, meta description, content
  HTML...) — giảm hẳn khối lượng field so với Destination.
- Không cần content pipeline AI, không cần review/approve — dữ liệu đúng là đủ.
- Không cần bảng quan hệ phức tạp — chỉ cần biết "khách sạn nào gợi ý cho điểm
  đến nào" (qua `HotelDestinationMap`, §4 — trực tiếp theo khoảng cách hoặc gán tay).
- Nếu sau này muốn có trang riêng (SEO "khách sạn gần {điểm đến}") thì làm ở giai
  đoạn sau — bảng thiết kế dưới đây vẫn đủ field để mở rộng thành trang riêng
  (thêm slug + content) mà không phải đổi cấu trúc.

## 3) Data model — Postgres (zinoflow, nguồn sự thật)

```sql
CREATE TABLE hotels (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           varchar(256) NOT NULL,
  address        varchar(512),
  lat            decimal(9,6),
  lng            decimal(9,6),
  province_id    int REFERENCES admin_provinces(id),      -- lọc/gợi ý theo tỉnh
  price_from     numeric(12,0),                            -- VND, giá thấp nhất hiện có
  rating         decimal(2,1),                             -- 0.0–10.0 hoặc 0–5 tuỳ nguồn, chuẩn hoá lúc lưu
  review_count   int,
  thumbnail_url  varchar(512),
  images         jsonb,                                    -- mảng URL ảnh phụ (tuỳ chọn)
  provider       varchar(64),                               -- khớp affiliate_link_rules.provider (spec chung)
  source_url     varchar(512) NOT NULL,                    -- link gốc (trang khách sạn thật) — BẮT BUỘC
  affiliate_url  varchar(512),                              -- tính sẵn qua affiliate_link_rules (conversion spec §3)
  link_status    varchar(20) NOT NULL DEFAULT 'no-rule',    -- converted | no-rule | manual-override
  source         smallint NOT NULL DEFAULT 0,              -- 0 nhập tay, 1 cào booking.com, 2 cào agoda, ...
  last_synced_at timestamptz,                               -- lần cào/cập nhật gần nhất
  site_id        varchar(64),                               -- id bên SQL Server sau khi publish, NULL = chưa publish
  status         smallint NOT NULL DEFAULT 1,               -- 0 nháp, 1 published, 2 ẩn
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Gán khách sạn cho điểm đến — THAY THẾ HotelGroupId (§4 sửa 07/2026: HotelGroupId
-- là model nhóm cũ, không đủ linh hoạt "1 khách sạn nhiều điểm đến gần"; bảng
-- này match đúng pattern TourDestinationMap của module Tour, không bắt buộc 1-1).
CREATE TABLE hotel_destination_map (
  hotel_id        uuid REFERENCES hotels(id),
  destination_slug varchar(64) NOT NULL,                   -- khớp mirror destinations
  distance_m      int,                                      -- khoảng cách, nếu gán tự động theo toạ độ
  is_manual       boolean NOT NULL DEFAULT false,           -- true = gán tay ưu tiên hơn tự động
  PRIMARY KEY (hotel_id, destination_slug)
);
```

Gán khách sạn cho điểm đến có 2 cách, giống mô hình `nearby` của Destination
(destination-spec §12.3): tự động theo bán kính từ lat/lng (job batch, tương tự
`recompute related`), hoặc gán tay khi cần ưu tiên 1 khách sạn cụ thể (đối tác
trả hoa hồng cao hơn, hoặc vị trí đặc biệt tốt).

## 4) Đồng bộ xuống SQL Server (website chỉ đọc) — sửa 07/2026 cho khớp §3

Bản đầu (12/06 gốc) định giữ nguyên render qua `HotelGroupId` — MÂU THUẪN với
`hotel_destination_map` ở §3 (bảng đó sẽ vô dụng nếu website không đọc nó).
Chốt lại: **`HotelDestinationMap` (mirror của `hotel_destination_map`) là cơ
chế render THẬT SỰ, thay cho `HotelGroupId`** — đúng pattern đã dùng cho Tour
(`TourDestinationMap`, tour-spec §4), để 2 module nhất quán với nhau:

1. Giữ bảng `Hotel` hiện có bên SQL Server (ít sửa entity nhất có thể); zinoflow
   upsert theo `id` map (Postgres `hotels.site_id` ↔ SQL Server `Hotel.Id`) —
   cùng adapter pattern `IDestinationPublisher` (`IHotelPublisher`,
   infrastructure layer, transaction + timeout/retry).
2. Thêm bảng MỚI `HotelDestinationMap` (SQL Server, giống cấu trúc
   `hotel_destination_map` Postgres) — đây là bảng website JOIN để lấy khách
   sạn gợi ý cho 1 điểm đến, KHÔNG còn qua `HotelGroupId`.
3. `Destination.HotelGroupId` (database-redesign §4.2) chuyển thành **cột
   legacy/fallback**: giữ tạm trong giai đoạn chuyển tiếp (website cũ có thể
   còn đọc), nhưng mọi gợi ý khách sạn MỚI đi qua `HotelDestinationMap`. Sau khi
   website đổi xong query (§6 việc cần chốt), có thể bỏ hẳn cột này ở đợt dọn
   nợ kỹ thuật sau — không xoá vội để tránh gãy trang đang chạy giữa lúc chuyển đổi.
4. Card hiển thị: `SELECT ... FROM HotelDestinationMap JOIN Hotel WHERE
   DestinationSlug=@slug AND Status=1` — same shape với query Tour (tour-spec §4).
   **Cập nhật 07/2026**: query sống này bị THAY bởi cơ chế bake HTML chung
   (`database-redesign.md` §3.4) — zinoflow chạy đúng query trên (trên nguồn
   Postgres) lúc publish/khi Hotel-DestinationMap đổi, ghi kết quả vào
   `DestinationContent.DynamicBlocksJson["hotels"]`, website chỉ đọc field đó.
   Bảng `HotelDestinationMap` bên SQL Server ở mục 2 vẫn giữ (không xoá) — hữu
   ích nếu sau này làm trang riêng "khách sạn gần {điểm đến}" (đã nhắc ở đầu
   tài liệu), nhưng không còn là đường query bắt buộc cho card trên trang điểm đến.
5. Publish khách sạn độc lập với publish điểm đến (không qua 2 chốt review/approve
   — xem §2) — có thể chạy 1 nút "Đồng bộ khách sạn" ghi thẳng, hoặc tự động sau
   mỗi lần cào thành công (cấu hình được).

## 5) Job cào dữ liệu (pg-boss)

Giống 3 job vận hành của Destination (destination-spec §12): chạy qua pg-boss,
idempotent, có report ở màn "Công cụ".

1. **Cào theo URL/khu vực**: người dùng nhập URL khách sạn cụ thể hoặc URL danh
   sách theo khu vực trên OTA → job fetch + parse (`IHotelScraper` adapter,
   infrastructure) → tạo/update dòng `hotels` ở trạng thái `status=0` (nháp) để
   người dùng xem qua trước khi publish (không tự động lên web ngay, tránh data
   cào sai/thiếu `source_url`).
2. **Cập nhật giá định kỳ**: re-fetch các khách sạn đã published theo lịch (vd
   hàng tuần), so sánh `price_from`/`rating` — chỉ ghi khi khác (giống nguyên tắc
   "khác mới UPDATE" ở destination-spec §12.3).
3. ✅ **XONG (07/2026)** — **Gán tự động theo khoảng cách**: `AutoAssignHotelsByDistanceUseCase`
   tính lại `hotel_destination_map` (tái dùng `haversineMeters` của Destination),
   chạy qua pg-boss `hotel.auto-assign` — tự động khi tạo khách sạn mới có
   toạ độ, hoặc bấm nút "Tính lại gán tự động" ở UI khi điểm đến đổi toạ độ.
   Không bao giờ đụng khách sạn đã có dòng gán tay.
4. **Áp dụng lại affiliate rule**: dùng chung job ở
   `dichoithoi-affiliate-link-conversion-spec.md` §4 khi rule đổi (không viết
   riêng job này cho hotel).

MVP có thể bỏ qua job (1) và (2) tự động hoá, làm bằng tay trước (nhập/cào 1 lần
qua form, publish tay) — xây job tự động khi khối lượng khách sạn đủ lớn để đáng
công sức.

**Import từ Google Sheet (CHỐT 07/2026)**: dùng chung cơ chế ở
`dichoithoi-product-spec.md` §5.1 (link sheet công khai → CSV export → preview
dry-run → UPSERT theo `source_url`, không xoá dòng vắng mặt) — chỉ khác
template cột theo field §3 của spec này. Cột ảnh → ingest về server
(`dichoithoi-destination-spec.md` §14.5), không hotlink.

## 6) UI trong AI tool

Thêm dưới khu "Dichoithoi" (system-overview §7 cấu trúc menu hiện tại), mục mới
`Khách sạn`:
- Bảng danh sách: tên, tỉnh, giá từ, rating, nguồn (tay/cào), trạng thái link
  affiliate (`converted`/`no-rule`/`manual-override`), số điểm đến đang gợi ý,
  cập nhật lúc.
- Form thêm/sửa: các field ở §3, dán `source_url` → preview `affiliate_url` ngay
  (cơ chế chung §"Áp dụng cho 3 nơi" ở conversion spec), nút "Cào lại từ URL nguồn".
- Từ màn chi tiết 1 điểm đến (destination-spec §7.3): thêm tab hoặc panel nhỏ
  "Khách sạn gợi ý" — xem danh sách đang map + nút thêm/gỡ map tay.

## 7) Việc cần chốt trước khi build

1. Chọn OTA nào cào trước (Booking.com/Agoda/Traveloka) — ảnh hưởng cấu trúc
   parser, và cần xác nhận rủi ro ToS (§1) trước khi build crawler thật.
2. Xác nhận mạng affiliate đang/sẽ tham gia đã có rule trong
   `affiliate_link_rules` chưa (deep-link theo từng khách sạn hay chỉ link
   chung) — ảnh hưởng cách build CTA, xem
   `dichoithoi-affiliate-link-conversion-spec.md`.
3. Ngưỡng khối lượng khách sạn cần có trước khi đáng xây job cào tự động (§5) —
   MVP có thể chỉ cần vài chục khách sạn nhập tay cho các điểm đến hot nhất.
