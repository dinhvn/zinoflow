# Dichoithoi — Nâng cấp quy trình bài viết Article/Cẩm nang (chưa build)

Ghi lại 15/07/2026, sau khi đối chiếu mô tả của người dùng về quy trình
Article với code thật — phát hiện 2 điểm cần nâng cấp: (1) chưa có field
"tag" thật cho bài viết, (2) auto-link + chèn sản phẩm chỉ resolve lúc
Publish, không resolve lúc xem trước bản nháp (khác nguyên tắc preview đã
áp dụng cho khối động ở Destination — destination-spec §4: "Preview: hiển
thị khối động ĐÃ RESOLVE ngay trong preview... người duyệt thấy đúng cái sẽ
lên web trước khi Approve"). **Chưa code — chỉ phân tích + ghi doc.**

Mục 3 (bài viết tự hiện trong mục "Ăn gì"/"Lịch trình"... của điểm đến) đã
được xác nhận **hoạt động đầy đủ, không cần build** — chỉ ghi lại quy trình
đúng để dùng, cùng 1 phát hiện lệch tài liệu (spec vs code) không ảnh hưởng
chức năng.

Mục 4 (thêm 15/07/2026) — audit SEO đầy đủ cho Article theo checklist
SEO-owner: phát hiện `Thumbnail` bị hardcode `null` lúc publish là **lỗ
hổng gốc** kéo theo `og:image` và JSON-LD `image` luôn rỗng; JSON-LD
`Article` thiếu `author`/`publisher` (dưới mức tối thiểu Google yêu cầu cho
rich result); breadcrumb thiếu hoàn toàn (khác mọi controller khác trên
site); ảnh thân bài thiếu `width`/`height` (rủi ro CLS thật, bị
`sanitize-html` xoá dù nguồn có sẵn).

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

## 3) `ArticleDestinationMap` — đã hoạt động đầy đủ, không cần build thêm

Đào sâu 15/07/2026, ví dụ cụ thể người dùng đưa ra: bài "5 món ăn nổi tiếng
nhất định phải thử khi đi Đà Lạt" muốn tự hiện trong mục "Ăn gì ở Đà Lạt".
**Xác nhận: tính năng này đã có sẵn, hoạt động đúng, KHÔNG cần xây gì mới**
— khác với field tag `V2DestinationTag` ở mục 1 (2 khái niệm khác nhau, đừng
nhầm). Quy trình đã hoạt động thật:

1. `ArticleDestinationMap` gán 1 bài viết vào 1+ điểm đến kèm **topic**
   (`itinerary`/`food`/`nightlife`/`souvenir`/`poi-guide`/`general`).
2. Cả 4 topic đã render thật trên `Views/Destination/Detail.cshtml`:
   `food` → đúng mục "Ăn gì ở {Tên}" (dòng 451-463, đọc
   `extras.FoodArticles`), tương tự cho 3 topic còn lại.
3. Trang detail điểm đến **query sống** (`DestinationExtrasRepository.cs:176-203`,
   EF join `V2ArticleDestinationMaps` mỗi lần tải trang) — không phải cache,
   nên gán xong hiện ngay, không cần publish lại trang điểm đến.
4. Auto-link chèn link TRONG THÂN bài (chữ "Đà Lạt" → link) đã tự động
   100% lúc Publish, không cần thao tác gì thêm.
5. Việc gán topic (bước tick "Đà Lạt" + chọn `food` + Lưu trong panel
   `ArticleDestinationMapPanel`) là **thao tác tay bắt buộc, có chủ đích**
   — spec ghi rõ "KHÔNG bao giờ tự gán im lặng" để tránh gán sai khi bài chỉ
   nhắc thoáng qua 1 điểm đến không phải trọng tâm.

**Phát hiện phụ (không phải lỗi, chỉ lệch tài liệu)**: `dichoithoi-article-spec.md`
§8.1 mô tả cơ chế DỰ ĐỊNH là "bake vào `DynamicBlocksJson` lúc publish, website
chỉ echo HTML không query sống" — nhưng code thật lại query sống mỗi lần tải
trang (mục 3 ở trên). Chức năng vẫn đúng, thậm chí có lợi hơn (gán xong hiện
ngay không cần publish lại) — chỉ cần sửa lại mô tả trong spec cho khớp thực
tế, không phải sửa code.

### Ý tưởng "tự động gán topic" — ĐÃ GHI NHẬN, ƯU TIÊN THẤP

Người dùng xác nhận (15/07/2026): quy trình chính vẫn là **gán tay**, không
cần đầu tư cơ chế tự động ở giai đoạn này. Ghi lại ý tưởng đã phân tích để
tham khảo sau này nếu khối lượng bài viết tăng nhiều, không phải việc cần
làm sớm:

- Điều kiện đề xuất (nếu làm sau): tên điểm đến xuất hiện NGUYÊN VĂN trong
  TIÊU ĐỀ bài viết (dùng lại engine match tên của auto-link, không viết lại
  logic) + AI (model nhẹ, Haiku) phân loại topic từ tiêu đề/mở bài → tự ghi
  `ArticleDestinationMap` lúc Publish, đánh dấu riêng "Tự động" trong panel
  để vẫn xem lại/sửa/xoá được (không tự gán rồi giấu đi).
- Nếu tên trùng nhiều điểm (nhập nhằng) → không tự đoán, giữ luồng gợi ý
  tay như hiện tại. Mention trong THÂN bài (không phải tiêu đề) vẫn giữ tay
  hoàn toàn — tín hiệu yếu hơn nhiều, rủi ro gán sai cao hơn nếu tự động.

## 4) SEO cho Article — audit đầy đủ + việc cần bổ sung (15/07/2026)

Áp dụng checklist SEO-owner (`dichoithoi-seo-principles.md`) — audit toàn bộ
tín hiệu SEO hiện có trên `/cam-nang/{slug}`, phát hiện 1 lỗ hổng gốc kéo
theo 2 lỗ hổng khác, cộng 3 lỗ hổng độc lập.

### 4.1 Đã có, hoạt động đúng (không cần đụng vào)

- Title/meta description: `ArticleController.cs:51-57` fallback
  `MetaTitle→Title`, `MetaDescription→ShortDescription` — đúng.
- `dateModified`: `SchemaUtil.cs:133` dùng `article.UpdatedAt` (cột riêng,
  khác `PublishedAt`) — tín hiệu "bài mới cập nhật" đã đúng chuẩn.
- Slug sạch, có trong `articles-sitemap.xml`, canonical tự set theo URL
  request (`_Layout.cshtml`).

### 4.2 LỖ HỔNG GỐC: `Thumbnail` bị hardcode `null` lúc publish

`publish-article.usecase.ts:83` — `thumbnail: null` hardcode, không có bước
upload/chọn ảnh nào trong editor Article hiện tại. Đây là **gốc rễ kéo theo
2 lỗ hổng khác** (§4.3, §4.4) — không có field nào phía sau sửa được nếu
gốc vẫn null, phải sửa từ đây trước.

Việc cần làm khi build (chưa làm), theo 3 tầng fallback — LUÔN dùng ảnh
THẬT, không bịa:
1. **Tầng 1 (chính, cần làm trước)**: thêm ô nhập/tải ảnh thumbnail thật
   trong editor Article (đơn giản nhất trước mắt: ô nhập URL ảnh, không cần
   dựng nguyên hạ tầng upload như Destination — có thể nâng cấp sau).
2. **Tầng 2 (fallback tự động khi tầng 1 trống)**: nếu bài đã gán
   `ArticleDestinationMap` (mục 3) → tự lấy thumbnail của điểm đến ĐẦU TIÊN
   được gán làm ảnh đại diện — ảnh THẬT, có sẵn, hợp lý về ngữ cảnh (bài
   "5 món ăn Đà Lạt" tự lấy ảnh Đà Lạt nếu chưa có ảnh riêng).
3. **Tầng 3 (fallback cuối)**: logo site (`CommonUtils.Logo`, đã dùng cho
   trang chủ) — đảm bảo `og:image` không bao giờ rỗng hoàn toàn, dù xấu hơn
   ảnh thật riêng cho bài.

### 4.3 Open Graph thiếu `og:image` (hệ quả trực tiếp của §4.2)

Sau khi §4.2 xong, `og:image` tự có giá trị (không cần sửa gì thêm ở
`ArticleController.cs:58-65`, code đọc `detail.Thumbnail` đã đúng, chỉ là
input luôn null). Bổ sung thêm (độc lập, effort thấp): `og:site_name`, và
cặp Twitter Card cơ bản (`twitter:card=summary_large_image`,
`twitter:title/description/image`) — hiện `_Layout.cshtml` chưa có dòng nào
cho Twitter Card.

### 4.4 JSON-LD `Article` thiếu `author`/`publisher` + `image` luôn rỗng

`SchemaUtil.CreateArticleJsonLD` (`SchemaUtil.cs:124-147`) hiện thiếu 2
field **bắt buộc** để đủ điều kiện Google Article rich result (headline +
image + datePublished + author là mức tối thiểu Google yêu cầu — hiện có
headline/datePublished, thiếu author, image luôn rỗng vì §4.2):

1. Thêm `author`: `{"@type":"Organization","name":"Đi Chơi Thôi","url":"https://dichoithoi.com"}`
   — dùng ĐÚNG tổ chức xuất bản thật (không tạo tác giả cá nhân giả, đúng
   tinh thần "Who/How/Why" minh bạch AI content đã bàn trước đó trong dự
   án) — bài do AI hỗ trợ + con người duyệt, tác giả hợp lý là chính site.
2. Thêm `publisher`: `{"@type":"Organization","name":"Đi Chơi Thôi","logo":{"@type":"ImageObject","url":"{logo that}"}}`
   — dùng lại `CommonUtils.Logo` đã có.
3. `image` tự có giá trị sau khi §4.2 xong.

### 4.5 Breadcrumb thiếu hoàn toàn (khác biệt so với MỌI controller khác)

Xác nhận: `DestinationController`, `DestinationTypeController`,
`ProvinceController`, `SimController`, `TopicController`, `HotelController`
đều gọi `SetBreadcrumbs(...)` + `SchemaUtil.CreateBreadcrumbJsonLD` —
**riêng `ArticleController.Detail` không gọi cái nào cả**, không có
breadcrumb hiển thị lẫn JSON-LD `BreadcrumbList`. Việc cần làm: thêm 2 dòng
gọi giống hệt pattern các controller khác đang dùng — "Trang chủ → Cẩm nang
→ {Title bài viết}". Effort thấp, đây là thiếu sót đơn giản nhất trong danh
sách, không phải thiết kế mới.

### 4.6 Ảnh trong thân bài thiếu `width`/`height` — rủi ro CLS thật

`ArticleBlockCompiler` (`article-block-compiler.service.ts:34-49`)
`SANITIZE_ALLOWLIST.allowedAttributes.img` chỉ có `["src","alt","title","loading"]`
— **`width`/`height` KHÔNG nằm trong allowlist, bị `sanitize-html` XOÁ dù
nguồn markdown có sẵn** — không có bảo vệ CLS nào cho ảnh trong thân bài
(khác nguyên tắc Core Web Vitals bắt buộc của dự án). Việc cần làm: thêm
`"width", "height"` vào allowlist; cân nhắc thêm bước tự động chèn
`loading="lazy"` cho mọi `<img>` trong thân bài khi compile (hero image ở
đầu trang đã tự set `loading="eager"` riêng, không đụng tới).

### Thứ tự đề xuất khi build mục 4

§4.2 (thumbnail, gốc) → §4.3+§4.4 (tự động ăn theo, gần như không tốn thêm
việc) → §4.5 (breadcrumb, độc lập, dễ nhất, có thể làm bất kỳ lúc nào kể cả
trước §4.2) → §4.6 (ảnh thân bài, độc lập).
