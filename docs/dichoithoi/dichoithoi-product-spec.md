# Dichoithoi — Module Sản phẩm (affiliate, chèn qua tag trong bài viết, tạo 07/2026)

Phân tích + quyết định (07/2026): kiếm tiền thêm bằng affiliate sản phẩm (dụng cụ
phượt, đồ leo núi...) — chèn vào bài cẩm nang (`dichoithoi-article-spec.md`) qua
cùng cơ chế "khối động" `[[block:...]]` đã có cho điểm đến/khách sạn/tour, KHÔNG
xây hệ thống riêng.

## 1) Vai trò & khác biệt so với Hotel/Tour

- Cùng vai trò kiếm tiền affiliate như Hotel/Tour, nhưng **không gắn vào 1 điểm
  đến cụ thể** — sản phẩm là nội dung "dùng chung", chèn vào bài viết theo **tag**
  (chủ đề), không theo tỉnh/điểm đến.
- Khác Hotel/Tour: Hotel/Tour lọc theo `province`/`destination` (đã có taxonomy
  địa lý sẵn); Product lọc theo `tag` tự do — vì bài viết kiểu "dụng cụ cần
  thiết cho chuyến phượt" không gắn theo tỉnh/điểm đến nào cả.

## 2) Không cần trang chi tiết/catalog riêng (xác nhận 07/2026)

Giống quyết định đã chốt cho Hotel/Tour: sản phẩm **KHÔNG có trang `/san-pham`
hay `/san-pham/{category}` công khai** — chỉ xuất hiện dưới dạng card nhúng
trong bài viết qua token `[[block:product...]]`. Giữ nhất quán kiến trúc, tránh
xây thêm route/SEO/sitemap cho 1 mục đích chỉ cần nhúng ngữ cảnh.

## 3) Data model — Postgres (zinoflow, nguồn sự thật, KHÔNG đồng bộ SQL Server)

Khác Hotel/Tour (phải đồng bộ SQL Server vì có card render trực tiếp trên trang
điểm đến), Product **compile thẳng vào `ContentHtml` lúc build bài** — không
cần bảng riêng bên SQL Server, không cần job đồng bộ.

```sql
CREATE TABLE products (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          varchar(256) NOT NULL,
  category      varchar(64) NOT NULL,          -- 1 giá trị, dropdown quản lý sẵn (vd "Balo", "Lều trại", "Giày đi bộ")
  tags          text[] NOT NULL DEFAULT '{}',  -- nhiều, tự do — dùng để MATCH với token trong bài viết
  thumbnail_url varchar(512),
  price         numeric(12,0),
  provider      varchar(64) NOT NULL,          -- 'shopee' | 'lazada' | 'tiki' | 'other' — cấu hình rule sau (§6 #4)
  source_url    varchar(512) NOT NULL,
  affiliate_url varchar(512),
  link_status   varchar(20) NOT NULL DEFAULT 'no-rule',
  source        smallint NOT NULL DEFAULT 0,   -- 0 nhập tay, 1 cào
  status        smallint NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
```

**Phân biệt `category` vs `tags`** (điểm quan trọng nhất của thiết kế này):
- `category` — 1 giá trị có kiểm soát, dùng để **duyệt/lọc trong màn quản lý**
  (giống mục đích `DestinationType` cho điểm đến), KHÔNG dùng để match trong bài.
- `tags` — nhiều giá trị tự do, dùng để **match với tham số `tag=` trong token
  chèn vào bài viết**. Khác quyết định đã chốt cho Destination (không cần tag tự
  do vì `DestinationType` đã đủ) — ở Product, tag là bắt buộc vì mục đích chính
  là ghép nối tự do (1 đôi giày có thể vừa tag "phượt", "leo núi", "đi mưa").

**Affiliate**: dùng nguyên `affiliate_link_rules` đã có
(`dichoithoi-affiliate-link-conversion-spec.md`) — 4 field chuẩn
`{provider, sourceUrl, affiliateUrl, linkStatus}` y hệt ticketLinks/Hotel/Tour,
không tạo cơ chế mới.

## 4) Mở rộng cú pháp khối động trong bài viết (`dichoithoi-article-spec.md` §3)

Thêm 2 kind mới vào `BLOCK_KINDS`, theo đúng cặp số ít/số nhiều đã có
(`destination`/`destinations`):

```
[[block:products tag=leu-trai,giay-di-bo limit=4]]
[[block:products tag=phuot category=balo limit=3]]
[[block:product id=xxx-xxx-xxx]]              -- 1 sản phẩm cụ thể, card đơn lẻ inline
```

- `tag=a,b,c` → khớp **BẤT KỲ tag nào** (OR, đã chốt 07/2026) — không cần khớp
  tuyệt đối mọi tag, vì bài viết thường muốn "sản phẩm liên quan chủ đề này".
- `category=` (tuỳ chọn) → lọc thêm, thu hẹp kết quả trong 1 category.
- Sắp xếp: số tag khớp nhiều hơn lên trước, rồi tới `featured`/mới nhất — cùng
  quy ước `sort` các kind khác.
- Render: badge = `category`, meta = giá (`price.toLocaleString('vi-VN')đ`),
  href = `affiliateUrl ?? sourceUrl` — dùng nguyên `renderCardGrid`/`CardItem`
  đã có (`article-spec.md` §5), KHÔNG cần template card mới.
- 0 kết quả → warning + bỏ khối, dùng nguyên cơ chế chung của compiler (không
  render section rỗng) — không cần code riêng cho Product.

## 5) Nguồn dữ liệu: nhập tay hoặc cào (MVP nhập tay trước)

Giống nguyên tắc đã áp dụng cho Hotel/Tour (`hotel-spec.md`/`tour-spec.md` §7.1):
MVP nhập tay trước, xây job cào tự động sau khi khối lượng đủ lớn để đáng đầu
tư — rủi ro ToS của nguồn cào (Shopee/Lazada/Tiki...) là quyết định kinh doanh
của bạn, không phải giới hạn kỹ thuật.

## 6) UI trong AI tool

Thêm dưới khu "Dichoithoi", mục mới `Sản phẩm` (song song `Khách sạn`/`Tour`):
- Bảng danh sách: tên, category, tags, giá, provider, trạng thái link
  affiliate, nguồn (tay/cào).
- Form thêm/sửa: tên, category (dropdown), tags (multi-select/nhập tự do), ảnh,
  giá, dán `sourceUrl` → tự nhận diện provider + preview `affiliateUrl` (cơ chế
  affiliate chung).
- KHÔNG có panel "gán vào điểm đến" (khác Hotel/Tour) — sản phẩm không gắn theo
  địa lý, chỉ gắn theo tag dùng lúc chèn bài viết.

## 7) Chèn khối vào bài viết — AI gợi ý, người dùng quyết định (chốt 07/2026)

Áp dụng chung cho MỌI kind khối động (không riêng Product — giải quyết luôn
câu hỏi mở ở `article-spec.md` §10 #4): lúc AI generate bài, tool **tự gợi ý**
vị trí + tham số khối động phù hợp với nội dung (dựa chủ đề đoạn văn) và chèn
sẵn `[[block:...]]` vào outline draft, nhưng đây chỉ là **gợi ý** — người dùng
xem trong màn review, có thể giữ/sửa tham số/xoá trước khi Approve→Publish.
Không có nghĩa AI tự động publish thẳng khối chèn mà không qua duyệt.

Ghi chú đặc biệt cho Product: 1 đoạn nội dung có thể cần gắn **nhiều loại tag
khác nhau cùng lúc** (theo đúng ý bạn nêu) — vd 1 bài "Chuẩn bị gì cho chuyến
phượt Đà Lạt" có thể chèn cả `[[block:products tag=phuot]]` (dụng cụ),
`[[block:hotels province=lam-dong]]` (khách sạn), `[[block:tours
destination=da-lat]]` (tour) trong cùng 1 bài — đây là hành vi ĐÃ ĐÚNG THIẾT KẾ
sẵn (mỗi kind độc lập, không giới hạn số kind/số khối trong 1 bài), không cần
thêm cơ chế gì mới ngoài việc AI biết gợi ý đúng kind cho đúng ngữ cảnh.

## 8) Việc cần chốt trước khi build

1. ✅ OR khi nhiều tag trong 1 token (chốt 07/2026).
2. ✅ Không có trang catalog sản phẩm công khai (chốt 07/2026).
3. ✅ AI gợi ý chèn khối, người dùng quyết định — áp dụng chung mọi kind (chốt
   07/2026, xem §7).
4. Chọn sàn TMĐT nào cấu hình affiliate rule trước (Shopee/Lazada/Tiki...) — sẽ
   có NHIỀU sàn, phần cấu hình rule để sau (chốt hướng, chưa chọn thứ tự cụ thể
   — không chặn việc build phần còn lại, `affiliate_link_rules` đã hỗ trợ nhiều
   provider sẵn).
5. Danh sách `category` chuẩn hoá thế nào (tự do nhập hay danh sách cố định
   quản lý ở đâu) — cần chốt trước khi build form quản lý.
