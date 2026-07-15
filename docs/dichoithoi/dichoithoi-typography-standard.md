# Dichoithoi — Quy chuẩn font-size & font-family (typography standard)

Áp dụng cho toàn bộ `DiChoiThoi.Web` (Views/*.cshtml). Mục tiêu: đạt ngưỡng dễ
đọc tối thiểu mà Google/Lighthouse yêu cầu, và phân cấp thị giác (heading
hierarchy) rõ ràng như các trang lớn (VnExpress, Klook, Traveloka, Medium).

Cơ sở: `docs/dichoithoi/dichoithoi-seo-principles.md` (ưu tiên cao nhất),
hạng mục Core Web Vitals / mobile-first / structured data không đổi — quy
chuẩn này chỉ bổ sung phần font-size.

## Nguyên tắc

1. **Thân bài (nội dung đọc dài) tối thiểu 16px** (`text-base`). Không dùng
   `text-sm` (14px) cho nội dung chính — 14px chỉ dành cho text phụ (badge,
   caption, meta info như khoảng cách/số điện thoại/breadcrumb).
2. **Phân cấp heading rõ rệt, cách thân bài ít nhất 1 bậc Tailwind:**
   - `h1` (tiêu đề trang, xuất hiện đúng 1 lần/trang): `text-3xl font-bold`.
   - `h2` (tiêu đề mục lớn): `text-xl font-semibold`.
   - `h3`/tiêu đề mục nhỏ hơn hoặc `<summary>` đóng vai trò heading trong
     `<details>`: cùng cấp `text-xl font-semibold` nếu đang đứng ngang hàng
     H2 về mặt nội dung (vd. accordion "Mẹo & lưu ý"), hoặc `text-lg
     font-semibold` nếu thực sự là mục con của H2.
3. **Không dùng class heading nếu chưa định nghĩa CSS cho nó.** Tailwind
   Preflight set `h1..h6 { font-size: inherit }` — một `<h1>` không có class
   Tailwind cụ thể sẽ trông y hệt đoạn văn thường, mất tín hiệu heading cho
   SEO/accessibility. Luôn viết trực tiếp class Tailwind (`text-3xl
   font-bold text-text`), không tạo class CSS riêng mới (đúng §10.5 —
   giữ CSS tối giản, không phát sinh thêm design token ngoài bảng màu 7 màu
   cố định).
4. **Nội dung HTML thô từ CMS/AI** (`Html.Raw(...)`, các field `Content`,
   `Food`, `Transport`, `Hotel`, `Tip`, `ContentHtml`...) luôn bọc bằng class
   `rich-content` (định nghĩa tại `src/scss/common.scss`) + `text-base
   text-text` để vừa có spacing giữa các thẻ (Preflight xoá hết margin mặc
   định) vừa đạt cỡ chữ tối thiểu.
5. **Không phân biệt mobile/desktop cho cỡ chữ nội dung** (giữ nguyên quy
   ước hiện tại của site — không thêm biến thể `sm:`/`lg:` cho font-size trừ
   khi có lý do UX cụ thể), vì 16px/18px/30px đều đã đọc tốt trên mọi màn
   hình và tránh CLS do đổi cỡ chữ theo breakpoint.

## Font-family

Quyết định 15/07/2026: **giữ font hệ thống (system-ui stack), không tải web
font riêng.** Lý do:

- 0 request mạng cho font → không có nguy cơ CLS/FOUT, không làm chậm LCP —
  đúng nguyên tắc Core Web Vitals ưu tiên hàng đầu của site.
- Đúng tinh thần tối giản CSS/asset đã chọn cho site (§10.5 — không thêm
  plugin/dependency ngoài khi không bắt buộc).
- Đánh đổi: mỗi hệ điều hành hiển thị 1 font khác (Segoe UI/San Francisco/
  Roboto...), không có bộ nhận diện thương hiệu riêng — chấp nhận được vì ưu
  tiên tốc độ hơn brand font ở giai đoạn này.

Đã khai báo tường minh trong `tailwind.config.js` (`theme.fontFamily.sans`)
thay vì để ngầm định theo default của Tailwind, để không ai nhầm là "chưa
cấu hình" và vô tình thêm web font sau này mà không cân nhắc lại đánh đổi
trên. Nếu sau này cần đổi sang web font riêng (vd. Be Vietnam Pro — hỗ trợ
dấu tiếng Việt tốt), phải tự-host + `font-display: swap` + `<link
rel="preload">` cho weight dùng ở above-the-fold, không dùng Google Fonts
CDN trực tiếp (thêm 1 DNS lookup + round-trip, ảnh hưởng LCP).

## Bảng quy chuẩn

| Vai trò | Class Tailwind | Kích thước | Ghi chú |
|---|---|---|---|
| H1 (tiêu đề trang) | `text-3xl font-bold text-text` | 30px | Đúng 1 lần/trang |
| H2 (tiêu đề mục) | `text-xl font-semibold text-text` | 20px | |
| Thân bài / rich-content | `rich-content text-base text-text` | 16px | Bọc mọi `Html.Raw` nội dung dài |
| Đoạn mô tả ngắn dưới H1 | `text-base text-muted` | 16px | vd. short description bài viết |
| Text phụ (meta, badge, breadcrumb, label) | `text-xs` / `text-sm` | 12–14px | Chỉ dùng cho nội dung phụ, không phải nội dung chính |

## Đã áp dụng (15/07/2026)

- Toàn bộ H1 site-wide (`text-2xl font-semibold` → `text-3xl font-bold`):
  Destination/Detail, Destination/Index, DestinationType/Index,
  DestinationType/TypeList, Home/Index, Province/Detail, Region/Detail,
  Topic/Detail, Article/Detail, Article/Index.
- Toàn bộ H2 (+ `<summary>` đóng vai trò heading) trong Destination/Detail
  và Home/Index (`text-lg font-semibold` → `text-xl font-semibold`).
- `rich-content` trong Destination/Detail (Content/Food/Transport/Hotel/Tip)
  từ `text-sm` (14px) → `text-base` (16px).
- Article/Detail, Article/Index: viết lại hoàn toàn bằng Tailwind — 2 view
  này trước đó dùng class Bootstrap không tồn tại trong bundle CSS thực tế
  (`.h1-t`, `.container`, `.row`, `.card`...) nên H1 và layout coi như không
  có style (chỉ dùng chung `common.css` Tailwind-only, xem `_Layout.cshtml`).

## Đã biết nhưng CHƯA sửa (cần quyết định riêng, không thuộc phạm vi font-size)

- `Views/Blog/*.cshtml` + `Views/Partial/_RelatedPost.cshtml` (route
  `/blog`, `/blog/{id}`) là module cũ hơn, cũng dùng class Bootstrap chết
  tương tự Article trước khi sửa, và không có `itemscope
  itemtype="Article"` như Article module. Có khả năng đây là nội dung trùng
  lặp/tiền thân của Article — cần hỏi người dùng có còn dùng `/blog` không
  trước khi sửa font hay gộp/xoá, để tránh vừa sửa xong lại phải dọn duplicate
  content.
