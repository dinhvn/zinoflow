# Dichoithoi — Chuyển đổi link gốc → link affiliate (spec tạo 07/2026)

Cơ chế dùng CHUNG cho 3 loại link kiếm tiền: vé điểm đến (`ticketLinks[]` —
`dichoithoi-destination-spec.md` §2.3), khách sạn (`dichoithoi-hotel-spec.md`),
tour (`dichoithoi-tour-spec.md`). Quyết định 07/2026: mọi nơi CHỈ nhập **link
gốc** (trang khách sạn/tour/vé thật); link affiliate được **tự động sinh** theo
quy tắc cấu hình sẵn, không nhập tay (tránh sai, khó đổi hàng loạt khi đổi mã
affiliate/campaign).

## 1) Nguyên tắc thiết kế

1. **Ghi đắt, đọc rẻ**: convert 1 lần lúc lưu/publish, lưu sẵn `affiliateUrl` —
   website và mọi nơi hiển thị CHỈ ĐỌC `affiliateUrl`, không gọi hàm convert lúc
   render (đúng nguyên tắc chung của `dichoithoi-database-redesign.md` §2.1).
2. **Rule là DATA, không phải CODE**: thêm nhà cung cấp mới hoặc đổi mã
   affiliate/campaign KHÔNG cần deploy — sửa 1 dòng trong bảng rule rồi bấm
   "Áp dụng lại", không đụng code.
3. **Không bịa**: link gốc không khớp rule nào → giữ nguyên `affiliateUrl =
   sourceUrl`, gắn cờ rõ ràng để người dùng biết cần thêm rule (không âm thầm
   sai/thiếu hoa hồng).
4. **Có lối thoát cho trường hợp đặc biệt**: cho phép ghi đè `affiliateUrl` tay,
   đánh dấu để job áp dụng lại rule không ghi đè mất chỉnh tay đó.

## 2) Data model (Postgres, zinoflow — nguồn sự thật duy nhất)

```sql
CREATE TABLE affiliate_link_rules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      varchar(64) NOT NULL UNIQUE,      -- 'klook' | 'tripvision' | 'bestprice' | 'booking' | 'agoda' | 'other'
  match_domain  varchar(256),                       -- vd "klook.com" — nhận diện provider tự động từ sourceUrl dán vào
  template      varchar(1024) NOT NULL,             -- vd "https://www.klook.com/aff/123456/?url={url_enc}"
  placeholder   varchar(16) NOT NULL DEFAULT '{url_enc}', -- '{url}' (giữ nguyên) | '{url_enc}' (URL-encode)
  is_active     boolean NOT NULL DEFAULT true,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
```

Mọi link (item trong `ticketLinks[]`, khách sạn, tour) đều mang 4 field chung
(đặt tên nhất quán ở cả 3 nơi):

| Field | Ý nghĩa |
|---|---|
| `provider` | khớp `affiliate_link_rules.provider`, hoặc `other` nếu chưa có rule |
| `sourceUrl` | link gốc — BẮT BUỘC, người dùng nhập/dán |
| `affiliateUrl` | link đã convert — TÍNH SẴN, đây là link thực sự render ra web |
| `linkStatus` | `converted` (đã áp rule) \| `no-rule` (chưa có rule khớp, affiliateUrl=sourceUrl) \| `manual-override` (tự sửa tay, bỏ qua rule) |

## 3) Thuật toán convert

1. Có `sourceUrl` mới hoặc rule liên quan vừa đổi → tìm rule theo `provider`
   (nếu người dùng đã chọn) hoặc tự nhận diện bằng cách khớp domain của
   `sourceUrl` với `match_domain` của các rule `is_active=true`.
2. Không tìm được rule khớp → `affiliateUrl := sourceUrl`, `linkStatus :=
   'no-rule'`.
3. Tìm được rule → thay `{placeholder}` trong `template` bằng giá trị
   `sourceUrl` (encode nếu placeholder là `{url_enc}`) → `affiliateUrl`,
   `linkStatus := 'converted'`.
4. Nếu `linkStatus = 'manual-override'` (người dùng đã tự sửa `affiliateUrl`
   tay) → BỎ QUA, không tính lại — chỉ đổi khi người dùng chủ động sửa lại.

## 4) Job "Áp dụng lại affiliate rule" (pg-boss)

Khi sửa/thêm 1 rule (đổi mã affiliate, campaign mới, thêm nhà cung cấp): nút
"Áp dụng lại" — quét mọi link có `provider` khớp rule đó, bỏ qua
`linkStatus='manual-override'`, tính lại `affiliateUrl` cho các link còn lại →
publish lại nơi tương ứng:
- `ticketLinks[]` → ghi đè `TicketLinksJson` trong `DestinationContent`.
- Hotel/Tour → ghi đè cột trong bảng riêng (`dichoithoi-hotel-spec.md` §4,
  `dichoithoi-tour-spec.md` §4).
Idempotent (chạy 2 lần liên tiếp không đổi thêm gì), có report số link đã đổi —
cùng khuôn mẫu 3 job vận hành đã có ở destination-spec §12.

## 5) UI

- Màn "Công cụ" (`dichoithoi-destination-spec.md` §7.6) thêm mục **"Quy tắc
  affiliate"**: bảng rule (thêm/sửa/tắt), nút "Áp dụng lại" theo 1 rule hoặc
  toàn bộ, log lần chạy gần nhất.
- Ở MỌI form nhập link (ticketLinks của điểm đến, form khách sạn, form tour):
  dán `sourceUrl` → tool tự nhận diện `provider` (dropdown xác nhận lại, sửa
  được) → **preview `affiliateUrl` ngay trong form** trước khi lưu, để người
  dùng kiểm tra link đúng trước khi publish.

## 6) Vì sao không convert lúc render (đã cân nhắc và loại bỏ)

Convert lúc render (mỗi request tính `affiliateUrl` từ `sourceUrl` + rule) đơn
giản hơn về đồng bộ (đổi rule có tác dụng ngay, không cần job) nhưng vi phạm
nguyên tắc "website chỉ SELECT, không xử lý" (database-redesign §2.1) — thêm 1
bước tính toán + lookup rule mỗi lần render mọi CTA affiliate trên trang, ảnh
hưởng tốc độ mà trang điểm đến/hotel/tour ưu tiên nhất. Đổi rule là sự kiện
HIẾM (chỉ khi đổi campaign/thêm nhà cung cấp) — chấp nhận có job "áp dụng lại"
chạy tay đổi lại thay vì trả giá tốc độ mỗi request.
