# Dichoithoi — Tự động tìm ảnh minh hoạ cho nội dung

**ĐÃ BUILD + VERIFY XONG HOÀN TOÀN 17/07/2026** — Giai đoạn 1-4, kể cả gọi
API Pexels THẬT (người dùng đã tự đăng ký + điền `PEXELS_API_KEY` cùng
ngày). Đã test full vòng đời trên dữ liệu thật: quét ra bài "Các con thác
đẹp tại Đà Lạt" đang thiếu ảnh → chạy tìm → Pexels trả về 4 ảnh thật khớp
chủ đề (kể cả 1 ảnh thác nước Việt Nam) → duyệt 1 ảnh (thác nước, đúng chủ
đề nhất) → từ chối 3 ảnh còn lại → xác nhận Postgres đúng ở mọi bước (ảnh
duyệt chuyển `active`, ảnh từ chối bị xoá + ghi 1 dòng
`content_image_rejected_keywords`) → ảnh đã duyệt hiện đúng ở tab "Thư
viện", dùng bình thường (Copy token/Xoá). Không còn việc gì tồn đọng cho
plan này.

Ghi lại 15/07/2026, từ ý tưởng người dùng: muốn có 1 nút trong zinoflow —
bấm là hệ thống tự quét xem tag/bài viết nào chưa có ảnh, tự tìm ảnh phù
hợp, tự tải về + upload lên thư viện ảnh (đã thiết kế ở
`dichoithoi-content-image-library-plan.md`), rồi người dùng duyệt. Mục
tiêu: làm nhanh, giảm thao tác thủ công. Phụ thuộc trực tiếp vào Mức A của
`dichoithoi-content-image-library-plan.md` (bảng `content_images` + pipeline
upload) — đã build xong trước (17/07/2026 cùng phiên).

## 0) Hiện trạng đã audit (15/07/2026)

- Không có tích hợp API tìm ảnh nào trong repo (grep `UNSPLASH`/`PEXELS`/
  `PIXABAY` trong `.env.example` và `apps/api/src` — 0 kết quả). Đây là
  tính năng hoàn toàn mới, không có gì để tái dùng ngoài hạ tầng upload
  (`ImageUploader` port) đã có từ plan thư viện ảnh.
- `dichoithoi-content-image-library-plan.md` đã thiết kế bảng
  `content_images` + token `[[block:image id=...]]` — plan này CHỈ thêm 1
  NGUỒN sinh ra bản ghi trong bảng đó (tự động tìm), không thay đổi cách
  lưu trữ/resolve token đã thiết kế.

## 1) 2 rủi ro thật phải xử lý trước khi thiết kế — không phải chi tiết kỹ thuật phụ

### 1.1 Rủi ro bản quyền

"Tự tìm ảnh" nếu hiểu là tìm trên web mở (Google Images...) rồi tải về dùng
— phần lớn ảnh tìm được KHÔNG có quyền sử dụng thương mại. Site có kiếm
tiền (affiliate) → dùng ảnh không rõ giấy phép là rủi ro pháp lý thật
(khiếu nại bản quyền, gỡ ảnh đột ngột, ảnh hưởng uy tín).

**Quyết định**: CHỈ tìm ảnh qua API ảnh miễn phí có giấy phép thương mại rõ
ràng — không search web mở. Ứng viên: **Pexels** (giấy phép không yêu cầu
credit, an toàn nhất — đề xuất mặc định), Unsplash (miễn phí nhưng khuyến
khích/1 số điều khoản API yêu cầu ghi nguồn + gọi tracking khi dùng ảnh —
cần đọc kỹ điều khoản hiện hành lúc build, không giả định), Pixabay (tương
tự Pexels). Lưu `source`/`sourceUrl`/`photographer` trong `content_images`
để có bằng chứng nguồn gốc, phòng khi cần tra lại.

### 1.2 Rủi ro sai địa điểm — QUAN TRỌNG, quyết định phạm vi tính năng

Ảnh MINH HOẠ CHUNG (món ăn, cảnh sinh hoạt, khung cảnh chung) dùng ảnh stock
là hợp lý. Nhưng ảnh cho **1 địa điểm cụ thể** (vd "Biệt Thự Hằng Nga") cần
ĐÚNG LÀ ảnh công trình đó — ảnh stock tìm theo từ khoá gần đúng
("kiến trúc độc đáo Việt Nam") sẽ KHÔNG phải ảnh thật của địa điểm, gây
hiểu lầm cho người đọc (khác nguyên tắc "không bịa dữ liệu" — ở đây là
không bịa hình ảnh đại diện sai sự thật).

**Quyết định phạm vi**: tính năng tự động tìm CHỈ áp dụng cho nhu cầu ảnh
MINH HOẠ CHUNG (Article nói chung, các đoạn mô tả không gắn với 1 địa điểm
cụ thể). KHÔNG tự tìm ảnh cho field gắn trực tiếp với 1 địa điểm có tên
riêng (vd ảnh hero/gallery của Destination) — những chỗ đó giữ nguyên yêu
cầu upload tay như thiết kế hiện có, tính năng này không đụng vào.

## 2) Thiết kế

### 2.1 Bước "quét thiếu ảnh"

Truy vấn thuần DB (không cần AI) — Article nào (job/draft `articleType=cam-nang`)
KHÔNG có bất kỳ tham chiếu `content_images` nào trong `draftMarkdown`/
`ContentHtml` → liệt kê "chưa có ảnh minh hoạ". Không cần suy đoán, chỉ đếm
số lần token `[[block:image` xuất hiện.

### 2.2 Bước tìm + tải + upload (auto, nhưng luôn ở trạng thái CHỜ DUYỆT)

**Quyết định 16/07/2026 — bản đầu giữ đơn giản, KHÔNG dùng AI ở bước này**:
sinh từ khoá bằng cách tách thuần từ tiêu đề/chủ đề bài viết (string, không
gọi model) — chấp nhận đánh đổi từ khoá có thể chưa chuẩn (vd lệch không khí
Việt Nam) để đổi lấy chi phí = 0 và không thêm phụ thuộc AI provider ở bước
quét. Người dùng lọc lại bằng mắt ở màn duyệt (§2.3) — đây là lưới an toàn
cuối, không cần bước AI chọn lọc tự động ngay từ đầu.

*Có thể nâng cấp sau* (không phải việc của phiên bản đầu — chỉ ghi lại để
không quên): dùng `claude-haiku-4-5` qua `IContentAIProvider` sẵn có để (a)
sinh từ khoá tốt hơn, và/hoặc (b) tự chọn ảnh phù hợp nhất trong 3-5 ứng
viên API trả về thay vì để người dùng tự lọc toàn bộ — chi phí cực nhỏ (dưới
$0.001/bài, ước tính vài đô cho hàng nghìn bài) nên KHÔNG phải rào cản kỹ
thuật/chi phí nếu sau này muốn làm — chỉ hoãn vì ưu tiên đơn giản trước.

1. Sinh từ khoá tìm kiếm từ tiêu đề/chủ đề bài viết (vd bài "5 món ăn Đà
   Lạt" → từ khoá "món ăn Việt Nam", "ẩm thực Đà Lạt" — từ khoá CHUNG, không
   dùng tên riêng địa điểm cụ thể, đúng §1.2).
2. Gọi API ảnh miễn phí (Pexels mặc định), lấy 3-5 ảnh ứng viên/bài.
3. Tải về, convert WebP qua `ImageUploader` sẵn có, ghi vào `content_images`
   với **`status = "pending"`** (field mới so với thiết kế gốc — chưa có
   trong plan thư viện ảnh, cần bổ sung khi build cả 2 cùng lúc) + lưu
   `source`/`sourceUrl`/`photographer` (§1.1).
4. **Ảnh `pending` KHÔNG hiện trong danh sách chọn ảnh bình thường của
   editor** (tránh nhầm với ảnh đã duyệt) — chỉ hiện trong màn "Ảnh chờ
   duyệt" riêng.

### 2.3 Màn "Ảnh chờ duyệt"

Trang/khu vực riêng trong `/dichoithoi/thu-vien-anh` (đã thiết kế ở plan
thư viện ảnh) — tab "Chờ duyệt": grid ảnh `status=pending`, kèm bài viết
liên quan + từ khoá đã dùng để tìm. Duyệt (chuyển `status=active`, dùng
được bình thường) hoặc Từ chối (xoá + không tìm lại từ khoá đó nữa trong
lần quét sau — tránh lặp lại đề xuất đã bị từ chối).

### 2.4 Nút kích hoạt

Nút "Tự động tìm ảnh còn thiếu" ở trang thư viện ảnh hoặc trang danh sách
Article — chạy đồng bộ hoặc qua job queue (pg-boss, đã có sẵn hạ tầng job
trong dự án) nếu số lượng bài lớn, tránh block UI khi quét nhiều bài cùng
lúc.

## 3) Kế hoạch triển khai theo giai đoạn

**Phụ thuộc cứng**: Giai đoạn 1-3 của Mức A
(`dichoithoi-content-image-library-plan.md`) phải xong trước — không có
bảng `content_images`/pipeline upload thì không có gì để tính năng này ghi
vào.

### Giai đoạn 1 — Hạ tầng API ảnh (độc lập, có thể làm song song lúc chờ plan thư viện ảnh)

- Đăng ký tài khoản Pexels (miễn phí, cần API key thật — người dùng tự làm,
  giống các việc cần tài khoản thật khác trong dự án).
- Port mới `StockImageSearchPort` (interface, tương tự cách `ImageUploader`
  đã được bọc qua interface — dễ đổi provider sau nếu cần, đúng bài học từ
  quyết định KHÔNG tách token lưu trữ riêng ở plan thư viện ảnh, nhưng lần
  này search-provider có lý do chính đáng hơn để bọc vì rủi ro provider đổi
  điều khoản/tắt API).

**DoD**: gọi thử API Pexels qua script, xác nhận trả về ảnh + license info
đúng định dạng mong đợi.

✅ **Xong 17/07/2026, verify VỚI KEY THẬT** — `StockImageSearchPort` +
`PexelsStockImageSearchAdapter` (`GET api.pexels.com/v1/search`, header
`Authorization: <key>`). Thiếu `PEXELS_API_KEY` → adapter trả về `[]` +
log warning, KHÔNG ném lỗi (đúng convention `IMAGE_UPLOADER` khi thiếu FTP
config) — đã verify cả 2 nhánh: lúc đầu thiếu key (trả `[]` đúng), sau khi
người dùng điền `PEXELS_API_KEY` thật đã gọi lại và nhận đúng 4 ảnh thật
khớp chủ đề "thác đẹp Đà Lạt" (kèm URL nguồn + tên photographer thật).

### Giai đoạn 2 — Bổ sung `status` vào `content_images` (phụ thuộc plan thư viện ảnh Giai đoạn 1)

- Thêm cột `status` (`active`/`pending`) — SỬA lại thiết kế bảng đã có ở
  plan thư viện ảnh, không phải bảng mới. Nếu plan thư viện ảnh đã build
  xong TRƯỚC khi làm tới đây → cần 1 migration thêm cột, không phá dữ liệu
  cũ (mặc định `active` cho ảnh đã có).

**DoD**: migration chạy sạch trên dữ liệu đã có (nếu có); UI editor/thư
viện ảnh hiện tại không bị ảnh hưởng (mặc định vẫn hiện đúng ảnh active).

✅ **Xong sớm hơn kế hoạch** — cột `status` đã có sẵn từ Mức A (thêm luôn
lúc thiết kế bảng `content_images` ban đầu, không phải sửa lại). Giai đoạn
này chỉ còn việc bổ sung metadata nguồn (`source`/`source_url`/
`photographer`/`related_job_id`/`search_keyword`) — migration
`1782210000000-AutoImageSearch.ts`, cùng đợt tạo bảng
`content_image_rejected_keywords` (job_id + keyword, PK kép) cho §2.3.

### Giai đoạn 3 — Job quét + tìm + tải + upload

- 2.1 (quét) → 2.2 (tìm/tải/upload pending) — nên tách 2 bước rõ ràng
  (quét trước, xác nhận danh sách bài thiếu ảnh đúng, rồi mới tốn quota API
  để tìm) tránh gọi API lãng phí nếu bước quét sai.

**DoD**: chạy thử trên 5 bài test — xác nhận đúng bài được chọn (không bỏ
sót bài đã có ảnh, không chọn nhầm bài đã đủ), ảnh tải về đúng chủ đề (spot
check bằng mắt), ghi đúng `status=pending` + đủ metadata nguồn.

✅ **Xong 17/07/2026** — `ScanArticlesMissingImagesUseCase` (query
`content_jobs`+`content_drafts`, lọc `articleType=cam-nang`, status
`DraftReady`/`Approved`, `draftMarkdown` không rỗng và không chứa
`[[block:image`). `generateSearchKeyword()` (domain, pure function, có unit
test `generate-search-keyword.spec.ts`) — tách từ, bỏ stop-word tiếng Việt
không dấu ("kinh nghiem", "review", "o"...), thêm hậu tố "vietnam travel".
`AutoSearchContentImagesUseCase` — với mỗi jobId: sinh từ khoá → kiểm tra
`isKeywordRejected` (bỏ qua nếu đã bị từ chối trước đó cho đúng bài này) →
gọi Pexels (tối đa 4 ứng viên) → tải/resize/upload từng ảnh → ghi
`content_images` với `status=pending`. Verify thật bằng dữ liệu thật trên
dev DB (KHÔNG mock): gọi `GET /content-images/missing-articles` → trả
đúng 4 bài cẩm nang thật đang thiếu ảnh; gọi
`POST /content-images/auto-search` → chạy đúng, không lỗi, trả note rõ
ràng "PEXELS_API_KEY chưa cấu hình" (vì chưa có key thật) thay vì crash —
xác nhận toàn bộ luồng xử lý lỗi graceful đúng thiết kế.

### Giai đoạn 4 — Màn duyệt + nút kích hoạt

- 2.3 + 2.4.

**DoD**: Playwright xác nhận luồng đầy đủ — bấm nút → job chạy → ảnh pending
xuất hiện trong tab chờ duyệt → duyệt 1 ảnh → ảnh chuyển active, dùng được
ngay trong editor bài viết.

✅ **Xong 17/07/2026** — thêm 2 tab "Thư viện"/"Chờ duyệt" (badge số lượng)
vào trang `/dichoithoi/thu-vien-anh`, modal "Tự động tìm ảnh còn thiếu"
(quét → tick chọn bài → chạy → xem tóm tắt kết quả từng bài, tách 2 bước
đúng thiết kế §3 Giai đoạn 3 để tránh gọi Pexels lãng phí nếu bước quét sai).
Ảnh pending hiện card riêng (viền cam, không cho sửa alt/copy token — chỉ
Duyệt/Từ chối, tránh nhầm với ảnh đã duyệt). Verify Playwright thật trên
dev server + dev DB thật:
- Modal quét ra đúng 4 bài thật đang thiếu ảnh, tick 1 bài → chạy → hiện
  đúng note "PEXELS_API_KEY chưa cấu hình" (không crash).
- Chèn 2 bản ghi `content_images` giả lập `status=pending` qua SQL (mô
  phỏng kết quả Pexels thật, vì chưa có key) để test trọn luồng duyệt còn
  lại: tab "Chờ duyệt" hiện đúng metadata (bài liên quan/từ khoá/nguồn/
  photographer) → bấm Duyệt → Postgres xác nhận `status` chuyển `active`
  → ảnh xuất hiện đúng ở tab "Thư viện" dùng bình thường (Copy token/Xoá).
  Bấm Từ chối ở ảnh còn lại → Postgres xác nhận: ảnh bị xoá VÀ ghi đúng 1
  dòng vào `content_image_rejected_keywords`.
- Gọi lại `/content-images/auto-search` với cùng jobId sau khi từ chối
  đúng từ khoá thật đã sinh ra — xác nhận trả về note "Từ khoá này đã bị
  từ chối trước đó cho bài viết này — bỏ qua" (không gọi lại Pexels lãng
  phí cho từ khoá đã bị từ chối, đúng yêu cầu §2.3).
- Đã dọn sạch toàn bộ dữ liệu test (`content_images`,
  `content_image_rejected_keywords`) sau khi verify.

**Cập nhật 17/07/2026 — verify LẦN 2 với `PEXELS_API_KEY` thật (người dùng
tự đăng ký + điền)**: gọi lại đúng luồng trên với API thật thay vì dữ liệu
giả lập — quét ra bài "Các con thác đẹp tại Đà Lạt" → chạy tìm → Pexels trả
về đúng 4 ảnh thật (kèm URL nguồn + tên photographer thật, 1 trong 4 ảnh là
thác nước Việt Nam khớp chủ đề) → duyệt 1 ảnh (thác nước) → Postgres xác
nhận `active`, ảnh hiện đúng ở tab "Thư viện" → từ chối 3 ảnh còn lại →
Postgres xác nhận đã xoá + ghi đúng 1 dòng `content_image_rejected_keywords`
(3 lần từ chối cùng 1 job dùng cùng 1 từ khoá nên chỉ có 1 dòng, đúng
`ON CONFLICT DO NOTHING`). Không có lỗi console, file WebP tải+resize đúng
trên đĩa. Đã dọn sạch dữ liệu + file test.

## Ghi chú quan trọng khi build

KHÔNG bỏ qua §1.1/§1.2 dù muốn làm nhanh — đây là lý do plan này tách biệt
với plan thư viện ảnh gốc thay vì gộp chung, để 2 rủi ro này luôn được nhắc
lại rõ ràng mỗi khi đọc plan, không bị lẫn vào chi tiết kỹ thuật. §1.2 được
tuân thủ đúng trong code: `generateSearchKeyword()` chỉ nhận `topic` (chủ đề
bài cẩm nang chung), KHÔNG có đường nào truyền tên địa điểm cụ thể vào —
tính năng chỉ áp dụng cho Article, không đụng vào ảnh hero/gallery Destination.

### Tổng thứ tự: 1 → 2 → 3 → 4 — TOÀN BỘ ĐÃ XONG + VERIFY VỚI API THẬT (17/07/2026)
