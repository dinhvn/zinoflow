# Dichoithoi Flight — Technical Spec (phân tích 07/2026, CHƯA vào lộ trình build)

⚠️ **Trạng thái**: đây là tài liệu PHÂN TÍCH — chưa chốt để build. Chưa thêm vào
`dichoithoi-implementation-plan.md` (danh sách phase chính thức) hay
`dichoithoi-system-overview.md` (sơ đồ kiến trúc "đã chốt"). Khi quyết định build,
cập nhật 2 tài liệu đó + đổi tiêu đề file này bỏ chữ "phân tích".

Module mới, song song Hotel/Tour: quản lý dữ liệu **vé máy bay** — trả lời câu hỏi
"tới điểm đến này bằng cách nào" (khác 3 kênh đã có: khách sạn/vé tham quan/tour —
xem `dichoithoi-content-seo-ux-plan.md` §0). Dùng chung cơ chế link gốc → affiliate
ở `dichoithoi-affiliate-link-conversion-spec.md`.

## 1) Vai trò & khác biệt cốt lõi so với Hotel/Tour

Giống Hotel/Tour: phục vụ kiếm tiền qua affiliate (đặt vé máy bay), KHÔNG phải nội
dung SEO độc lập — không AI generate bài, không quality gates, không review/publish
2 chốt tay. Chỉ cần đúng dữ liệu + link affiliate hoạt động.

**Khác biệt quan trọng nhất** (đã thống nhất khi phân tích 07/2026):

1. **Gắn theo TUYẾN, không theo điểm đến (POI)**. Hotel/Tour hợp lý khi gắn vào
   1 điểm đến cụ thể ("khách sạn gần thác Bạc"), nhưng máy bay không hạ cánh
   xuống 1 điểm tham quan — nó tới **sân bay khu vực**. Vì vậy Flight gắn vào
   **cấp tỉnh/thành** (`province_id`), KHÔNG có bảng map kiểu
   `hotel_destination_map`/`tour_destination_map`.
2. **Điểm đến con (POI) vẫn cần hiển thị thông tin này** — nhưng qua kế thừa:
   POI đã có sẵn `province_id` (từ `destinations` mirror/SQL Server
   `v2.Destination.ProvinceId`) → trang POI tự tra chuyến bay theo
   `province_id` đó, không cần map riêng cho từng POI. Cách hiển thị cụ thể
   trên trang (vị trí khối, có gộp chung với phần "Đến đây bằng cách nào" hay
   không, ưu tiên máy bay/xe...) — **CHƯA CHỐT, phân tích riêng ở bước sau**,
   không thuộc phạm vi tài liệu này.
3. **Giá là THAM KHẢO TĨNH, không phải tìm kiếm giá thật theo ngày** (đã chốt
   07/2026). Giá vé máy bay biến động liên tục theo ngày bay/hạng vé — công cụ
   này KHÔNG làm meta-search kiểu Skyscanner (không gọi API tra giá real-time
   theo ngày người dùng chọn). `price_from` chỉ là con số gợi ý, cập nhật định
   kỳ (nhập tay hoặc cào), giống nguyên tắc "AI không bịa dữ liệu cứng" đã áp
   dụng cho Destination — không suy diễn giá khi chưa có dữ liệu thật.

Hai nguồn nhập liệu (giống Hotel/Tour):
1. **Cào** từ trang bán vé (search aggregator như Traveloka/Skyscanner/trang hãng
   bay) — lấy tuyến, hãng bay, giá tham khảo thấp nhất tìm thấy tại thời điểm
   cào. Mỗi nguồn 1 parser riêng (`IFlightScraper` theo nguồn, adapter pattern).
2. **Nhập tay**: khi không cào được, hoặc muốn ưu tiên 1 link đối tác cụ thể.

⚠️ Cùng lưu ý ToS như Hotel/Tour (`dichoithoi-hotel-spec.md` §1): ưu tiên API/
affiliate feed chính thức của mạng đang tham gia (nhiều OTA vé máy bay có API/
widget hợp lệ) thay vì cào HTML tần suất cao — quyết định rủi ro-kinh doanh của
bạn, không phải giới hạn kỹ thuật.

## 2) Data model — Postgres (zinoflow, nguồn sự thật)

```sql
CREATE TABLE flights (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  departure_city varchar(128) NOT NULL,               -- text tự do, vd "Hà Nội", "TP.HCM"
  airline        varchar(128) NOT NULL,                -- text tự do, vd "Vietnam Airlines", "Vietjet"
  arrival_province_id int NOT NULL REFERENCES admin_provinces(id), -- tinh/thanh dich — KHONG gan theo POI
  price_from     numeric(12,0),                        -- VND, gia THAM KHAO tinh (khong phai gia that theo ngay)
  duration_approx varchar(64),                          -- tuy chon, vd "~1h30" — chi mo ta, khong tinh toan
  thumbnail_url  varchar(512),                          -- logo hang bay hoac anh minh hoa (tuy chon)
  provider       varchar(64),                            -- khop affiliate_link_rules.provider (spec chung)
  source_url     varchar(512) NOT NULL,                 -- link gốc (trang tìm vé/hãng bay) — BẮT BUỘC
  affiliate_url  varchar(512),                           -- tính sẵn qua affiliate_link_rules (conversion spec §3)
  link_status    varchar(20) NOT NULL DEFAULT 'no-rule', -- converted | no-rule | manual-override
  source         smallint NOT NULL DEFAULT 0,           -- 0 nhập tay, 1 cào nguồn A, 2 cào nguồn B, ...
  last_synced_at timestamptz,                            -- lần cào/cập nhật giá tham khảo gần nhất
  site_id        varchar(64),                            -- id bên SQL Server sau khi publish, NULL = chưa publish
  status         smallint NOT NULL DEFAULT 1,            -- 0 nháp, 1 published, 2 ẩn
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
```

So với Hotel/Tour: KHÔNG có bảng `*_destination_map` (không gắn theo POI) —
`arrival_province_id` là khoá gắn duy nhất. Nhiều dòng cùng `arrival_province_id`
là bình thường (nhiều hãng bay/nhiều điểm khởi hành cùng tới 1 tỉnh).

## 3) Đồng bộ xuống SQL Server (website chỉ đọc)

Bảng mới bên SQL Server (chưa tồn tại, tương tự Tour): `Flight`, cấu trúc rút gọn
từ bảng Postgres trên (chỉ giữ cột website cần render). zinoflow là single-writer
(`IFlightPublisher`, infrastructure layer, cùng pattern
`IDestinationPublisher`/`IHotelPublisher`/`ITourPublisher`).

Query gợi ý cho trang tỉnh/POI: `SELECT ... FROM Flight WHERE
ArrivalProvinceId=@provinceId AND Status=1 ORDER BY PriceFrom` — `@provinceId`
lấy từ chính destination đang xem (POI hoặc tỉnh) qua `ProvinceId` có sẵn, không
cần join thêm bảng map.

## 4) Job cào & đồng bộ (pg-boss)

Giống Hotel/Tour (`dichoithoi-hotel-spec.md` §5):
1. **Cào theo tuyến/nguồn**: nhập tỉnh đích + (tuỳ chọn) điểm khởi hành → job
   fetch + parse theo `IFlightScraper` của nguồn tương ứng → tạo dòng
   `status=0` (nháp) để soát trước khi publish.
2. **Cập nhật giá tham khảo định kỳ**: re-fetch các chuyến đã published theo
   lịch (vd hàng tuần/2 tuần — giá vé máy bay đổi nhanh hơn khách sạn/tour nên
   tần suất cần cao hơn, hoặc chấp nhận độ trễ và ghi rõ "giá tham khảo, có
   thể đã thay đổi" trên UI).
3. **Áp dụng lại affiliate rule**: dùng chung job ở
   `dichoithoi-affiliate-link-conversion-spec.md` §4.

MVP: nhập tay trước cho các tỉnh/thành hot nhất (Hà Nội, Đà Nẵng, Đà Lạt, Phú
Quốc...), xây crawler khi khối lượng đủ lớn.

## 5) UI trong AI tool

Thêm dưới khu "Dichoithoi", mục mới `Vé máy bay` (song song `Khách sạn`/`Tour`):
- Bảng danh sách: điểm khởi hành, hãng bay, tỉnh đích, giá từ, nguồn (tay/cào),
  trạng thái link affiliate, cập nhật lúc.
- Form thêm/sửa: field ở §2 + preview `affiliate_url` khi dán `source_url` (cơ
  chế chung).
- KHÔNG có panel "gán vào điểm đến" như Hotel/Tour (vì không gắn theo POI) —
  chỉ chọn tỉnh đích khi tạo/sửa.

## 6) Việc cần chốt trước khi build (bổ sung khi quyết định làm)

1. Chọn nguồn cào trước (Traveloka, Skyscanner, hay trực tiếp trang hãng bay) —
   ảnh hưởng parser đầu tiên + rủi ro ToS.
2. Xác nhận mạng affiliate vé máy bay đang/sẽ tham gia (nếu có) đã cấp rule
   dạng nào trong `affiliate_link_rules`.
3. Tần suất cập nhật giá tham khảo chấp nhận được (ảnh hưởng lịch job §4.2 và
   cách hiển thị disclaimer "giá tham khảo" trên UI).
4. Cách hiển thị cụ thể trên trang POI/tỉnh (vị trí, gộp chung hay tách riêng
   với phần vé xe) — phân tích riêng, chưa nằm trong tài liệu này.
