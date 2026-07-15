# Dichoithoi — Nâng cấp quy trình bài viết Article/Cẩm nang (chưa build)

Ghi lại 15/07/2026, sau khi đối chiếu mô tả của người dùng về quy trình
Article với code thật — phát hiện 2 điểm cần nâng cấp: (1) chưa có field
"tag" thật cho bài viết, (2) auto-link + chèn sản phẩm chỉ resolve lúc
Publish, không resolve lúc xem trước bản nháp (khác nguyên tắc preview đã
áp dụng cho khối động ở Destination — destination-spec §4: "Preview: hiển
thị khối động ĐÃ RESOLVE ngay trong preview... người duyệt thấy đúng cái sẽ
lên web trước khi Approve"). **Chưa code — chỉ phân tích + ghi doc.**

## 0) Hiện trạng đã audit (15/07/2026)

- Article dùng chung bảng `ContentJob`/`ContentDraft` với các loại nội dung
  khác (không có entity Article riêng), lọc `siteCode="dichoithoi"` +
  `articleType="cam-nang"`.
- Field hiện có liên quan phân loại: chỉ `keywordSeed` (từ khoá SEO) +
  `metadata.internalLinkSuggestions` — KHÔNG có field tag/chủ đề nào.
- Auto-link (`ArticleAutoLinkService.linkHtml()`) và chèn khối động/sản phẩm
  (`ArticleBlockCompiler.compile()`) đều là hàm THUẦN ĐỌC (đã xác nhận đọc
  code trực tiếp `article-auto-link.service.ts`,
  `article-block-compiler.service.ts`) — không ghi gì, không side effect,
  chỉ được gọi 1 chỗ duy nhất: `PublishArticleUseCase.execute()`
  (`publish-article.usecase.ts:63,73`).
- `ArticleDestinationMap` (nối bài ↔ điểm đến) chỉ được ghi SAU KHI publish,
  dựa trên `addedLinks` do auto-link sinh ra lúc đó — không phải bước "gắn
  tay" độc lập lúc soạn thảo.

## 1) Field "tag" thật cho bài viết

**Đã điều tra kỹ trước khi thiết kế** (15/07/2026) — có 2 hệ thống tên gọi
liên quan tới "tag" trong dichoithoi, KHÔNG cái nào dùng lại được trực tiếp:

- **`Tag`/`TagController`** (bảng `Tag`: Id/Name/Group/Count) — API JSON
  `/api/tags` — **code chết, 0 nơi gọi** (không phải chỉ hết dùng sau khi
  xoá module Blog trước đó trong phiên này — grep xác nhận vốn đã không ai
  gọi). Không liên quan gì tới bài viết, không nên tái sử dụng.
- **`V2DestinationTag`** (bảng `v2.DestinationTag`: Id/Slug/Name/Description/
  Status, join qua `V2DestinationTagMap`) — đây mới là hệ "chủ đề" THẬT,
  đang sống, chính comment trong code ghi rõ: "Chủ đề cắt ngang nhiều loại
  điểm đến — Bộ từ vựng ĐỘNG, tạo tay trong CMS zinoflow, website CHỈ ĐỌC".
  Route `/chu-de/{slug}` (`TopicController.cs`) đọc đúng bảng này, hiển thị
  thật — **nhưng phát hiện thêm: trang này KHÔNG được link từ bất kỳ đâu
  trên site** (header/footer/card điểm đến/sitemap đều không trỏ tới) — tồn
  tại và hoạt động nếu vào thẳng URL, nhưng không ai tìm thấy qua điều
  hướng bình thường. Đây là phát hiện riêng, không phải lỗi của Article,
  ghi nhận để bạn biết — có thể cần xử lý sau (thêm link, hoặc xác nhận chủ
  đích chưa launch).

**Chốt 15/07/2026: Hướng A — dùng chung `V2DestinationTag`** cho cả
Destination lẫn Article (không tạo bảng tag riêng cho Article).

Việc cần làm khi build (chưa làm):
1. Bảng mới `v2.ArticleTagMap` (`ArticleId/JobId, TagId`) — join Article ↔
   `V2DestinationTag` đã có sẵn, không đổi schema bảng tag gốc.
2. Sửa comment/tài liệu mô tả `V2DestinationTag` — bỏ scope hẹp "điểm đến",
   ghi lại đúng là "chủ đề dùng chung Destination + Article".
3. UI editor Article: thêm ô chọn tag (multi-select, đọc danh sách
   `V2DestinationTag` hiện có qua endpoint đã tồn tại cho Destination —
   tái dùng, không viết endpoint mới).
4. `TopicController.GetTopicPageAsync` (dichoithoi) — mở rộng trả về CẢ
   điểm đến LẪN bài viết cùng tag, `Views/Topic/Detail.cshtml` hiện 2 khối
   (không chỉ điểm đến như hiện tại).
5. **Việc phụ phát hiện thêm, cân nhắc làm cùng đợt hoặc ghi riêng vào
   backlog**: trang `/chu-de/{slug}` hiện không được link từ đâu — sau khi
   mở rộng có cả bài viết, nên thêm link thật (vd. mỗi bài viết/điểm đến
   hiện danh sách tag của nó, mỗi tag link về `/chu-de/{slug}`) để trang
   này thực sự có traffic thay vì chỉ tồn tại trên lý thuyết.

## 2) Preview resolve đầy đủ (auto-link + chèn sản phẩm) trước khi Publish

**Mục tiêu**: người duyệt thấy ĐÚNG cái sẽ lên web (link điểm đến thật, thẻ
sản phẩm thật) TRƯỚC KHI Approve/Publish — nhất quán với nguyên tắc đã áp
dụng cho Destination, hiện Article chưa có.

**Vì sao an toàn để làm**: cả 2 service liên quan hoàn toàn không có side
effect (đã verify code, không ghi DB, không gọi AI) — chỉ đọc dữ liệu +
biến đổi text. Không cần đổi schema, không rủi ro dữ liệu.

Việc cần làm khi build:
1. Thêm use-case mới `PreviewArticleUseCase` (song song `PublishArticleUseCase`,
   tái dùng y hệt logic dòng 57-73 của `publish-article.usecase.ts`: lấy
   draft mới nhất → `compiler.compile(rawMarkdown)` → nếu có `errors` trả về
   luôn để UI hiện lỗi khối động NGAY trong preview (không phải chờ tới lúc
   bấm Publish mới biết) → `autoLink.linkHtml(compiled.html)` → trả về
   `{html, warnings, addedLinks}`. **KHÔNG gọi** `siteDb.upsertArticle`/
   `publications.upsert` — đây là khác biệt duy nhất so với Publish.
2. Endpoint mới (NestJS controller) gọi use-case trên, không mutate gì —
   an toàn gọi nhiều lần (mỗi lần bấm "Xem trước" hoặc tự động khi mở tab
   Preview trong editor).
3. UI editor Article (`apps/web/src/app/dichoithoi/articles/...`) — thêm
   tab/nút "Xem trước" render `html` trả về từ endpoint mới, thay vì hiện
   markdown thô có token `[[block:...]]` chưa resolve như hiện tại (nếu UI
   hiện đang làm vậy — cần xác nhận lại khi bắt tay build, có thể UI đã có
   sẵn khung tab Preview chỉ cần đổi nguồn dữ liệu).
4. Hiện rõ trong preview: nếu `warnings.length > 0` (khối hợp lệ nhưng 0 kết
   quả, đã tự động bỏ khối) — cảnh báo ngay, đúng cách Destination preview
   đang làm cho khối động của nó.

**Không đổi hành vi Publish** — `PublishArticleUseCase` giữ nguyên, chỉ thêm
use-case preview song song dùng chung 2 service đã có.
