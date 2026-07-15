# Dichoithoi — Thư viện ảnh nội dung + token chèn ảnh trong bài (chưa build)

Ghi lại 15/07/2026, từ ý tưởng người dùng: chèn ảnh vào nội dung Article/
Destination bằng token trỏ tới 1 ID ảnh, resolve thành ảnh thật lúc preview/
publish — kèm 1 trang thư viện ảnh độc lập hoàn toàn khỏi ảnh hero/thumb/
gallery hiện có của điểm đến. **Chưa code — chỉ phân tích + ghi doc.**

## 0) Hiện trạng đã audit (15/07/2026)

- **Hạ tầng lưu ảnh đã có, tái dùng được**: `ImageUploader` port (FTP/Local
  tuỳ env `IMAGE_UPLOADER_PROVIDER`), tự convert WebP, lưu path tương đối,
  resolve URL lúc đọc (`DICHOITHOI_IMAGE_BASE_URL`). Dùng cho ảnh hero/
  gallery điểm đến (`upload-destination-image.usecase.ts`,
  `add-destination-gallery-image.usecase.ts`) và ingest ảnh ngoài cho
  Product/Hotel/Tour (`IngestExternalImageUseCase`).
- **Có sẵn UI quản lý ảnh dạng gallery** (`destination-gallery-editor.tsx`)
  nhưng **scope theo TỪNG điểm đến**, không phải thư viện độc lập — tham
  khảo được pattern UI (upload nhiều file, sửa alt/caption, xoá, lưu hàng
  loạt) nhưng không dùng lại trực tiếp được vì khác mục đích.
- **Chưa có trang thư viện ảnh độc lập nào** — xác nhận grep cả `features`
  lẫn `app` không thấy.
- **Engine token `[[block:kind ...]]`** (`shared/text/block-token.ts`) —
  CHỈ hỗ trợ token chiếm NGUYÊN 1 DÒNG (`TOKEN_LINE_RE`), không hỗ trợ chèn
  giữa câu/đoạn văn. `kind` giới hạn trong `BLOCK_KINDS` cố định (chưa có
  `image`). Engine này **CHỈ được cắm vào Article** — `ArticleBlockCompiler`
  chạy nó lúc `PublishArticleUseCase`, tương tự `article-camnang-gates.ts`
  (quality gate).
- **Destination KHÔNG có bước resolve token nào** — xác nhận
  `publish-destination.usecase.ts:113` chỉ gọi `renderDestinationBodyHtml`
  (markdown→HTML + sanitize) rồi `autoLinkContent`, không có bước compile
  `[[block:...]]` nào. Cơ chế "khối động" của Destination hiện dùng cách
  khác hẳn Article — các cột JSON riêng theo key
  (`HotelCardsJson`/`TourCardsJson`, thiết kế `DynamicBlocksJson` dự định
  thay thế theo `database-redesign.md` nhưng **CHƯA thêm vào DDL thật**) —
  không phải token chèn giữa nội dung.

## 1) Quyết định đã chốt (15/07/2026)

- Ảnh là **khối riêng 1 dòng**, không chèn giữa câu — khớp đúng giới hạn kỹ
  thuật của engine hiện có, cũng là cách hầu hết trang nội dung vẫn làm.
- **AI KHÔNG tự chọn ảnh** ở bản đầu — tránh chọn sai ảnh không liên quan vì
  thư viện hữu hạn, AI phải đoán qua alt/caption text (rủi ro thật). Có thể
  gợi ý VỊ TRÍ nên có ảnh khi viết, nhưng chọn ảnh thật vẫn do người dùng.

## 2) Phạm vi — 2 mức đầu tư, cần bạn chọn

**Mức A — Chỉ Article** (nhỏ, tái dùng engine có sẵn): thêm loại `image`
vào `BLOCK_KINDS`, `ArticleBlockCompiler` thêm 1 nhánh resolve — không đụng
Destination. Việc chèn ảnh vào bài "5 món ăn Đà Lạt" hoạt động ngay.

**Mức B — Cả Article lẫn Destination** (lớn hơn nhiều): tách
`ArticleBlockCompiler` thành service dùng chung (`ContentBlockCompiler`),
cắm thêm vào `publish-destination.usecase.ts` (bước Destination hiện HOÀN
TOÀN CHƯA CÓ, đây là lần đầu mang cơ chế token vào Destination) — nghĩa là
không chỉ "thêm ảnh" mà còn "xây nền token cho Destination lần đầu", việc
lớn hơn nhiều so với hình dung ban đầu. Lợi ích đi kèm: sau khi có nền này,
các loại khối khác hiện Destination chưa hỗ trợ (product/hotel/tour chèn
tay trong `Content`, không chỉ qua cột JSON riêng) cũng có đường mở rộng.

**Đề xuất**: làm Mức A trước (giá trị ngay, effort nhỏ, dùng được cho ví dụ
cụ thể bạn đưa ra), đánh giá Mức B sau khi thấy nhu cầu chèn ảnh cho
Destination thực tế nhiều tới đâu — không nên gộp làm 1 đợt vì chênh lệch
effort quá lớn giữa 2 mức.

## 3) Thiết kế Mức A (Article)

### 3.1 Lưu trữ — bảng mới, độc lập hoàn toàn khỏi ảnh điểm đến

`content_images` (Postgres, KHÔNG mirror sang SQL Server — chỉ Postgres cần
biết, Destination/Article resolve ra HTML thật lúc publish nên site không
cần bảng riêng):
- `id (uuid)`, `path (varchar, tương đối, dùng lại ImageUploader)`,
  `alt_text`, `caption (nullable)`, `uploaded_at`, `usage_count (int,
  đếm số bài đang tham chiếu — biết ảnh nào đang dùng trước khi xoá)`.
- Dùng lại `ImageUploader` port có sẵn (chọn 1 kích thước web-tối-ưu, có
  thể thêm 1 bản thumbnail nhỏ riêng cho lưới thư viện) — không viết lại
  logic upload/convert WebP.
- Folder riêng, KHÔNG theo slug điểm đến (đúng yêu cầu độc lập) — vd.
  `noi-dung/{uuid}.webp`.

### 3.2 Token

Thêm `"image"` vào `BLOCK_KINDS` (`block-token.ts`) → cú pháp
`[[block:image id=<uuid>]]` (alt lấy từ `content_images.alt_text`, không
cần tham số riêng trong token — tránh trùng lặp nguồn sự thật cho alt text).
`ArticleBlockCompiler.resolveItems()` thêm nhánh `kind === "image"`: tra
`content_images` theo id → render `<img src="{url resolve}" alt="{alt_text}"
loading="lazy" width height>` — cần thêm `width`/`height` vào
`SANITIZE_ALLOWLIST.allowedAttributes.img` (đã đề xuất ở
`dichoithoi-article-workflow-plan.md` §4.6, 2 việc cộng hưởng, làm chung 1
đợt).

### 3.3 Trang thư viện ảnh

Trang mới (đề xuất `/dichoithoi/thu-vien-anh`): grid ảnh, upload nhiều file
1 lần, sửa alt/caption, xoá (cảnh báo nếu `usage_count > 0` — tránh xoá ảnh
đang dùng trong bài đã publish, vỡ ảnh), nút **"Copy token"** mỗi ảnh (copy
`[[block:image id=...]]` vào clipboard) — cách đơn giản nhất để chèn: duyệt
thư viện → copy token → dán vào đúng chỗ trong markdown đang soạn. Không
cần xây rich-editor tích hợp picker ảnh ngay từ đầu (có thể nâng cấp sau
nếu thao tác copy/dán thấy bất tiện khi dùng thật).

### 3.4 Preview

Vì đã nối use-case Preview riêng ở `dichoithoi-article-workflow-plan.md`
§2, ảnh chèn bằng token sẽ tự động hiện đúng trong preview cùng lúc với
auto-link + sản phẩm — không cần thêm gì riêng cho ảnh ở bước này.

## Thứ tự làm

Mức A: 3.1 (bảng + storage) → 3.2 (token + compiler) → 3.3 (trang thư
viện) → 3.4 (xác nhận preview tự động đúng, không cần code thêm vì đã có
nền từ plan Article). Mức B để riêng, đánh giá sau.
