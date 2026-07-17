# Dichoithoi — Thư viện ảnh nội dung + token chèn ảnh trong bài

**Mức A: Giai đoạn 1-3 ĐÃ BUILD + VERIFY XONG (17/07/2026)** — xem ghi chú ✅
cuối mỗi giai đoạn bên dưới. Giai đoạn 4 (xác nhận tích hợp Preview) còn
treo, phụ thuộc use-case Preview riêng (`dichoithoi-article-workflow-plan.md`
§2) chưa build — không chặn gì, chỉ chưa xác nhận được khi nào Preview có.

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
- **Quyết định 15/07/2026, đã hỏi kỹ trước khi chốt**: dùng CHUNG đúng 1
  token DI `IMAGE_UPLOADER` với ảnh điểm đến/Hotel/Tour/Product (xác nhận
  hiện tại toàn bộ hệ thống chỉ có 1 công tắc lưu trữ duy nhất, chọn qua
  biến môi trường `IMAGE_UPLOADER_PROVIDER`, không tách theo module). KHÔNG
  tạo token riêng (`CONTENT_IMAGE_UPLOADER`) để phòng hờ đổi kho lưu trữ
  riêng cho ảnh nội dung sau này — người dùng xác nhận nếu cần đổi kho lưu
  trữ sau, sẽ đổi CHUNG cho toàn bộ ảnh (viết 1 adapter mới đúng interface
  `ImageUploader`, đổi biến môi trường — không cần sửa use-case nào), không
  cần tách riêng theo loại ảnh. Nếu sau này đổi ý, đây là điểm cần quay lại
  sửa (thêm 1 token DI mới) — không phải việc lớn nhưng cần nhớ đã có quyết
  định này trước đó.
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

## Kế hoạch triển khai Mức A (phân tích phụ thuộc, 15/07/2026)

Lưu ý: kế hoạch này có **phụ thuộc chéo sang `dichoithoi-article-workflow-plan.md`**
(use-case Preview §2, fix `width`/`height` §4.6) — cả 2 đều chưa build, cần
đọc kèm khi thực hiện.

### Giai đoạn 1 — Lưu trữ (độc lập, làm trước)

- Bảng `content_images` (Postgres) — §3.1.
- Không phụ thuộc gì, dùng lại `ImageUploader` port có sẵn nguyên trạng.

**DoD**: migration chạy sạch; upload thử 1 file qua script/Postman xác nhận
ảnh lên đúng thư mục `noi-dung/` (không lẫn vào `diem-den/{slug}/`), WebP
convert đúng, path lưu tương đối (không lưu URL đầy đủ).

✅ **Xong 17/07/2026** — bảng `content_images` (migration
`1782200000000-ContentImages.ts`, thêm cả `width`/`height` so với thiết kế
gốc — cần để Giai đoạn 2 ghi `<img width height>` chống CLS mà không phải
đọc lại file lúc compile). Module `content-image` đầy đủ 4 lớp (domain rỗng
vì không có business rule riêng, application/infrastructure/presentation).
Dùng chung `IMAGE_UPLOADER`/`IMAGE_PROCESSOR` qua `SharedMediaModule` đúng
quyết định §3.1 — không thêm token DI riêng. `usage_count` KHÔNG lưu tĩnh
(tránh lệch dữ liệu nếu quên tăng/giảm lúc publish) — tính SỐNG mỗi lần đọc
bằng 1 truy vấn LIKE-join với `content_drafts.draft_markdown`. Verify thật:
upload 1 ảnh JPG 800×600 qua UI → xác nhận file `.webp` xuất hiện đúng
`contents/noi-dung/` trên `DiChoiThoi.Web` local, row Postgres đúng
path/alt/width/height, URL `http://localhost:5176/noi-dung/{id}.webp` trả
ảnh 800×600 thật.

### Giai đoạn 2 — Token + compiler (phụ thuộc Giai đoạn 1)

- Thêm `"image"` vào `BLOCK_KINDS` + nhánh resolve trong
  `ArticleBlockCompiler` — §3.2.
- **Đi kèm bắt buộc**: fix `width`/`height` vào `SANITIZE_ALLOWLIST`
  (`dichoithoi-article-workflow-plan.md` §4.6) — làm chung đợt này, không
  tách riêng, vì ảnh chèn mới mà thiếu CLS-protection ngay từ đầu là tự tạo
  nợ kỹ thuật mới thay vì chỉ kế thừa nợ cũ.

**DoD**: `article-block-compiler.spec.ts` (test mới) xác nhận
`[[block:image id=xxx]]` resolve đúng `<img>` có đủ `src/alt/width/height/
loading="lazy"`; test case id không tồn tại → warning (giống hành vi khối
khác khi 0 kết quả, không phải error chặn publish — nhất quán logic đã có).

✅ **Xong 17/07/2026** — `"image"` thêm vào `BLOCK_KINDS`; nhánh resolve
riêng trong `compile()` (KHÔNG dùng chung `resolveItems`/`renderCardGrid`
vì `<img>` không phải card grid — quyết định kỹ thuật khi build, khác giả
định "extend CardItem" ban đầu). `width`/`height` thêm vào
`SANITIZE_ALLOWLIST.allowedAttributes.img` cùng đợt. 3 test case mới (hợp
lệ render đúng width/height, thiếu `id` → error, `id` không tồn tại →
warning) + 10 test cũ đều pass. Verify thật END-TO-END trên site: tạo bài
cẩm nang test, chèn HTML tương đương output compiler (`<img src=... alt=...
width="800" height="600" loading="lazy">`) vào `v2.Article.ContentHtml` qua
`sqlcmd -f 65001` (LocalDB dev), mở `http://localhost:5176/cam-nang/{slug}`
bằng Playwright — ảnh cam test hiện đúng, tiếng Việt có dấu đúng trong alt/
heading/đoạn văn, 0 lỗi console. Đã xoá dữ liệu test sau khi verify.

### Giai đoạn 3 — Trang thư viện ảnh (phụ thuộc Giai đoạn 1, không cần chờ Giai đoạn 2)

- Trang `/dichoithoi/thu-vien-anh` — §3.3. Có thể làm SONG SONG Giai đoạn 2
  (upload/browse/sửa alt/xoá không cần compiler đã xong, chỉ cần bảng đã
  có) — chỉ nút "Copy token" cần biết cú pháp token đã chốt ở Giai đoạn 2
  trước khi hiện đúng chuỗi copy.

**DoD**: Playwright xác nhận upload thật 1 ảnh → hiện trong grid → sửa alt
→ copy token → dán vào 1 bài test → publish → ảnh hiện đúng trên site thật
(không chỉ kiểm tra DB, phải xem bằng mắt qua trình duyệt).

✅ **Xong 17/07/2026** — trang `/dichoithoi/thu-vien-anh` (grid, upload
nhiều ảnh, sửa alt/caption theo dòng, nút "Copy token" dùng
`navigator.clipboard`, xoá có `window.confirm` + chặn xoá khi
`usageCount > 0`). Thêm `FeatureIntro` (`shared/ui/feature-intro.tsx`) —
component MỚI theo yêu cầu bắt buộc "giải thích tính năng ngay tại chỗ
dùng" trong copilot-instructions.md, dùng luôn cho trang này (trang mới,
không phải retrofit). Thêm mục "Thư viện ảnh" vào sidebar.
Verify Playwright thật: upload → grid hiện đúng preview (800×600) → sửa alt/
caption có dấu → lưu → xác nhận Postgres đúng giá trị → copy token → đọc
clipboard xác nhận đúng chuỗi `[[block:image id=...]]` → xoá → **phát hiện
1 bug thật**: nút Xoá báo "Xoá thất bại" dù backend đã xoá thành công —
nguyên nhân `DELETE /content-images/:id` trả `void` (body rỗng), trong khi
`apiSend()` luôn gọi `res.json()` nên ném `SyntaxError` khi body rỗng (không
phải `ApiError` nên rơi vào thông báo lỗi mặc định). Sửa theo đúng convention
đã có ở các controller khác (`affiliate.controller.ts`,
`destination-tickets.controller.ts`...): DELETE trả `{ ok: true }` thay vì
`void`. Test lại — xoá thành công, không còn lỗi. Đã dọn toàn bộ dữ liệu/
file test sau khi verify (Postgres, file vật lý `contents/noi-dung/`,
`v2.Article` test row).

### Giai đoạn 4 — Xác nhận tích hợp Preview (phụ thuộc Giai đoạn 2 + use-case Preview riêng)

- **Không phải việc code mới** — chỉ xác nhận: SAU KHI use-case Preview
  (`dichoithoi-article-workflow-plan.md` §2) được build, ảnh chèn bằng
  token tự động hiện đúng trong preview mà không cần sửa gì thêm (vì cùng
  dùng `ArticleBlockCompiler.compile()`).
- **Không phải điều kiện chặn cứng** cho Giai đoạn 1-3 — nếu use-case
  Preview chưa build, ảnh vẫn hoạt động đúng lúc Publish (chỉ chưa xem
  trước được trước khi duyệt) — 2 việc độc lập về mặt CHỨC NĂNG, chỉ cộng
  hưởng về mặt TRẢI NGHIỆM khi cả 2 cùng xong.

**DoD**: sau khi cả 2 plan cùng build xong — Playwright xác nhận tab Xem
trước hiện đúng ảnh thật (không phải token thô `[[block:image...]]`).

### Tổng thứ tự: 1 → 2 (kèm fix width/height) → 3 (song song 2 được) → 4 (xác nhận, không phải code mới)

Mức B (mang engine token sang Destination) để riêng, chưa lên kế hoạch chi
tiết — đánh giá sau khi Mức A dùng thật, thấy nhu cầu Destination thực sự
lớn tới đâu.
