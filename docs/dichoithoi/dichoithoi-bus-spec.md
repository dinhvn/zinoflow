# Dichoithoi Bus — Technical Spec (phân tích 07/2026, CHƯA vào lộ trình build)

⚠️ **Trạng thái**: đây là tài liệu PHÂN TÍCH — chưa chốt để build. Chưa thêm vào
`dichoithoi-implementation-plan.md` hay `dichoithoi-system-overview.md`. Khi
quyết định build, cập nhật 2 tài liệu đó + đổi tiêu đề file này bỏ chữ "phân tích".

Module mới, song song Flight (`dichoithoi-flight-spec.md`): quản lý dữ liệu **nhà
xe/vé xe khách** — cùng câu hỏi "tới điểm đến này bằng cách nào", cùng nguyên tắc
gắn theo TUYẾN (cấp tỉnh/thành, không theo POI) đã phân tích ở flight-spec §1.
Dùng chung cơ chế link gốc → affiliate ở
`dichoithoi-affiliate-link-conversion-spec.md`.

## 1) Vai trò & khác biệt so với Flight

Giống Flight: phục vụ kiếm tiền qua affiliate (đặt vé xe), không phải nội dung
SEO độc lập — không AI generate bài, không quality gates, không review/publish
2 chốt.

Khác Flight ở chỗ:
1. **Đơn vị là "nhà xe"**, không phải "hãng". Mỗi dòng = 1 nhà xe cụ thể chạy 1
   tuyến (có tên riêng, SĐT liên hệ trực tiếp — nhiều nhà xe nhỏ không có nền
   tảng đặt vé online, chỉ có SĐT để gọi/nhắn).
2. **Giá vé xe ổn định hơn vé máy bay** (ít biến động theo ngày) — nhưng vẫn chỉ
   là **giá tham khảo tĩnh, cập nhật định kỳ**, cùng nguyên tắc đã chốt ở
   flight-spec §1 mục 3 (không suy diễn, không tra real-time).
3. Có field riêng: **loại xe** (giường nằm/ghế ngồi/limousine — text tự do, MVP
   không cần chuẩn hoá thành enum) và **số điện thoại** (kênh liên hệ thay thế
   khi không có link đặt vé online).

Hai nguồn nhập liệu (giống Hotel/Tour/Flight):
1. **Cào** từ trang tổng hợp vé xe (vd vexere.com, các trang so sánh nhà xe) —
   lấy tên nhà xe, tuyến, loại xe, giá tham khảo. Mỗi nguồn 1 parser riêng
   (`IBusScraper` theo nguồn).
2. **Nhập tay**: khi không cào được, hoặc nhà xe đối tác trực tiếp không có
   trên nền tảng nào.

⚠️ Cùng lưu ý ToS như Hotel/Tour/Flight — ưu tiên API/affiliate feed chính thức
nếu nền tảng đặt vé xe đang tham gia có cung cấp.

## 2) Data model — Postgres (zinoflow, nguồn sự thật)

```sql
CREATE TABLE bus_routes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_name  varchar(256) NOT NULL,                -- tên nhà xe
  phone          varchar(32),                            -- SĐT liên hệ trực tiếp (thay thế khi ko co link)
  departure_city varchar(128) NOT NULL,                  -- text tự do, vd "Hà Nội", "TP.HCM"
  arrival_province_id int NOT NULL REFERENCES admin_provinces(id), -- tinh/thanh dich
  vehicle_type   varchar(64),                             -- text tự do: giường nằm / ghế ngồi / limousine...
  price_from     numeric(12,0),                           -- VND, giá THAM KHẢO tĩnh
  thumbnail_url  varchar(512),                            -- ảnh xe/logo nhà xe (tuỳ chọn)
  provider       varchar(64),                             -- khớp affiliate_link_rules.provider (spec chung)
  source_url     varchar(512),                            -- link đặt vé — TUỲ CHỌN (khác Hotel/Tour/Flight:
                                                            -- nhiều nhà xe nhỏ chỉ có SĐT, không có link online)
  affiliate_url  varchar(512),                            -- chỉ tính khi có source_url
  link_status    varchar(20) NOT NULL DEFAULT 'no-rule',  -- converted | no-rule | manual-override | 'no-link' (chỉ có SĐT)
  source         smallint NOT NULL DEFAULT 0,             -- 0 nhập tay, 1 cào nguồn A, ...
  last_synced_at timestamptz,
  site_id        varchar(64),
  status         smallint NOT NULL DEFAULT 1,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
```

Khác Flight: `source_url` KHÔNG bắt buộc (nhiều nhà xe nhỏ chỉ có SĐT gọi trực
tiếp, không có nền tảng đặt vé online) — cần thêm giá trị `link_status='no-link'`
so với 3 giá trị chuẩn ở `affiliate-link-conversion-spec.md` để phân biệt "chưa
có rule" (`no-rule`, có source_url nhưng chưa map được affiliate) với "vốn dĩ
không có link để convert" (`no-link`, chỉ hiện SĐT trên card).

## 3) Đồng bộ xuống SQL Server (website chỉ đọc)

Bảng mới bên SQL Server: `BusRoute`, cấu trúc rút gọn từ bảng Postgres trên.
zinoflow là single-writer (`IBusRoutePublisher`, cùng pattern các publisher khác).

Query gợi ý: `SELECT ... FROM BusRoute WHERE ArrivalProvinceId=@provinceId AND
Status=1 ORDER BY PriceFrom` — cùng cơ chế kế thừa qua `ProvinceId` như Flight
(flight-spec §3), không có bảng map riêng cho POI.

## 4) Job cào & đồng bộ (pg-boss)

Giống Flight (`dichoithoi-flight-spec.md` §4):
1. **Cào theo tuyến/nguồn**: nhập tỉnh đích → job fetch + parse theo
   `IBusScraper` → tạo dòng `status=0` (nháp) để soát trước khi publish.
2. **Cập nhật giá tham khảo định kỳ**: tần suất có thể thưa hơn Flight (giá vé
   xe ổn định hơn) — vd hàng tháng thay vì hàng tuần, cần chốt khi build.
3. **Áp dụng lại affiliate rule**: dùng chung job affiliate-conversion-spec §4.

MVP: nhập tay trước cho các tỉnh/thành hot nhất, xây crawler khi khối lượng đủ lớn.

## 5) UI trong AI tool

Thêm dưới khu "Dichoithoi", mục mới `Vé xe` (song song `Vé máy bay`):
- Bảng danh sách: tên nhà xe, điểm khởi hành, tỉnh đích, loại xe, giá từ, SĐT,
  trạng thái link affiliate (bao gồm `no-link`), cập nhật lúc.
- Form thêm/sửa: field ở §2 + preview `affiliate_url` khi dán `source_url` (nếu
  có) — SĐT là field độc lập, không phụ thuộc affiliate.
- Không có panel "gán vào điểm đến" (giống Flight — gắn theo tỉnh, không theo POI).

## 6) Việc cần chốt trước khi build (bổ sung khi quyết định làm)

1. Chọn nguồn cào trước (vexere.com hay nguồn khác) — ảnh hưởng parser đầu tiên
   + rủi ro ToS.
2. Xác nhận mạng affiliate vé xe đang/sẽ tham gia đã cấp rule dạng nào (nếu
   nhà xe nhỏ không có affiliate, chỉ hiện SĐT — không phải mọi dòng đều cần
   `affiliate_url`).
3. Tần suất cập nhật giá tham khảo (ảnh hưởng lịch job §4.2).
4. ✅ **ĐÃ CHỐT 07/2026** — cách hiển thị trên trang POI/tỉnh: xem
   `content-seo-ux-plan.md` §5.8 (2 card "✈️"/"🚌" cạnh nhau trong mục "Cách
   tới đây", gộp chung bảng `transports` với Flight qua cột `mode`, không
   tách bảng riêng — không còn là việc mở).
