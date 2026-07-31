# Dichoithoi — Backlog tổng hợp (cập nhật 07/2026)

Gộp mọi "việc cần chốt"/"để giai đoạn sau" đang rải rác trong các spec riêng lẻ
(destination/hotel/tour/article/affiliate/content-seo-ux/database) thành 1 chỗ
duy nhất — đọc trước khi bắt tay build phần tiếp theo. Danh sách nguồn: xem
`dichoithoi-system-overview.md` để biết thứ tự đọc toàn bộ tài liệu.

## ⚠️ MỤC KHẨN — Audit sâu 07/2026: "CHỐT thiết kế" ≠ "đã build"

Người dùng phản hồi (07/2026): "hôm qua thảo luận và chốt rất nhiều, nhưng
kiểm tra thì chưa thấy làm" (ví dụ cụ thể: cách hiển thị trang Đà Lạt/Biệt
Thự Hằng Nga). Rà lại bằng cách đối chiếu THẲNG từng mục "CHỐT" trong mọi doc
với code thật (không chỉ so doc-với-doc như đợt dọn dẹp trước) — xác nhận
đây là vấn đề CÓ THẬT VÀ LỚN, không phải cảm giác: nhiều quyết định thiết kế
đã "CHỐT" (tức là đã bàn xong, chọn phương án) nhưng **chưa từng được viết
thành code**, và một số dòng còn ghi nhầm hẳn "✅ ĐÃ XONG" (đã sửa 3 chỗ khẩn
cấp nhất — xem lịch sử git — nhưng danh sách dưới đây rộng hơn nhiều).

### 3 lỗ hổng gốc — cập nhật 23/07/2026: CẢ 3 MỤC ĐỀU ĐÃ ĐÓNG (2 build, 1 bị bác)

Rà lại bằng code thật (không chỉ đọc doc) xác nhận mục 1 và 2 dưới đây **đã
lỗi thời** — cả hai đã được build xong ở các Phase sau (25/26). Mục 3 cũng
đã lỗi thời theo hướng khác: **không phải "chưa build" mà là "đã cân nhắc và
CHỦ Ý TỪ CHỐI"** — `implementation-plan.md` Phase 27 (07/2026, có code+test
thật) ghi rõ khi thêm `SouvenirProductsJson`: "cùng pattern `HotelCardsJson`/
`TourCardsJson` — đã cân nhắc và loại `DynamicBlocksJson` hợp nhất". Tham
chiếu "xem mục Quyết định KHÔNG làm ở plan gốc" trong dòng đó trỏ tới 1 mục
KHÔNG tồn tại ở bất kỳ doc nào (grep 0 kết quả toàn `docs/dichoithoi/`) — lý
do gốc đã thất lạc, chỉ còn kết luận. Rủi ro kỹ thuật thấy rõ nếu gộp:
Hotel/Tour/Product đổi giá/tag là 3 trigger ĐỘC LẬP có thể chạy đồng thời;
nếu cùng ghi vào 1 cột JSON dùng chung mà không có read-modify-write chặt
chẽ → key ghi sau đè mất key ghi trước (lost update) — pattern cột riêng
hiện tại tránh hoàn toàn rủi ro này. Giữ nguyên văn cũ (gạch ngang) để biết
vì sao từng chặn, tránh lặp lại vòng lặp "chốt ≠ đã build" ngược lại (nghĩ
việc đã bị bác lại tưởng còn phải làm).

1. ~~Cột `ContentTier` (Flagship/Standard) chưa từng tồn tại trong DB/code~~ —
   **✅ ĐÃ XONG (Phase 25, 07/2026)**: migration `1782010000000-DestinationContentTier.ts`
   (cột `content_tier` trên `dichoithoi_destinations`), dùng thật trong
   `coverage-score.ts`, `prompt-builder.ts` (chọn khung outline theo tier),
   `destination-metadata-form.tsx`. Field `ExternalReviewUrls` cũng đã build
   xong (`update-external-review-urls.usecase.ts` + editor UI
   `destination-external-review-urls-editor.tsx`), không còn "0% code" như
   ghi trước đây.
2. ~~Bảng `ArticleDestinationMap` chưa từng tồn tại~~ — **✅ ĐÃ XONG
   (Phase 26, 07/2026)**: `save/get-article-destination-map.usecase.ts` +
   UI `article-destination-map-panel.tsx` (`apps/web/src/app/content/[id]/page.tsx`).
3. ~~`DynamicBlocksJson` (thiết kế gộp 1 cột JSON cho mọi khối động) vẫn CHƯA
   build~~ — **✅ ĐÃ ĐÓNG (23/07/2026) — KHÔNG PHẢI TODO, đã CHỦ Ý TỪ CHỐI ở
   Phase 27**. Pattern thật đang dùng và sẽ tiếp tục dùng: 1 cột JSON RIÊNG
   cho mỗi loại khối động — `HotelCardsJson`, `TourCardsJson`,
   `SouvenirProductsJson` (Phase 27) — không phải cột gộp chung. Khi module
   vé máy bay/xe khách thật sự được chốt xây (hiện `flight-spec`/`bus-spec`
   vẫn ghi "chưa chốt"), thêm 1 cột riêng kiểu `TransportCardsJson` theo
   ĐÚNG pattern này, KHÔNG gộp vào cột chung.

### Phát hiện nghiêm trọng khác (độc lập với 3 lỗ hổng trên)

- ✅ **`RelatedJson` — ĐÃ NỐI DÂY (07/2026)**. Trước đây zinoflow tính đúng +
  ghi vào DB nhưng website không đọc, vẫn tự tính "điểm liên quan" bằng code
  cũ (`GetRelationDestinationAsync`, join `ParentId` + sort CSV `Type`) — dead
  code với người dùng cuối. Đã sửa: `DestinationExtrasModel`/
  `DestinationExtrasRepository` (dichoithoi) đọc thẳng `RelatedJson` (model
  mới `RelatedRefModel`); `DestinationController.Detail` ưu tiên dùng
  `extras.Related` khi có, chỉ fallback gọi `GetRelationDestinationAsync` cho
  điểm CHƯA relink (`RelatedJson` rỗng — an toàn, không breaking); partial
  mới `_RelatedDestinationList.cshtml` (đọc `Thumbnail` trực tiếp, không suy
  từ `Id+".webp"` như partial cũ). Đã chạy `POST /destinations/recompute-related`
  backfill 271/271 điểm trên `dichoithoi_dev`, test qua Playwright thật:
  `/diem-den/biet-thu-hang-nga-dalat` hiện đúng "Điểm đến liên quan" đọc từ
  RelatedJson (badge khoảng cách "cách 527 m"), `/diem-den/da-lat` (cluster)
  không bị ảnh hưởng (vẫn dùng "Các khu trong Đà Lạt" qua `ChildrenJson` như
  cũ), build `dotnet build` sạch, 0 lỗi console.
- ✅ **`SlugRedirect` — ĐÃ XONG cả 2 chiều (Phase 24, 07/2026)**. Chiều ĐỌC:
  website (`DestinationController.Detail`) check `SlugRedirect` trước khi
  404, 301 sang slug mới nếu có. Chiều GHI: tính năng "Đổi slug" riêng biệt
  (`RenameDestinationSlugUseCase` — cascade Postgres mirror + hotel/tour map +
  products.tags, cascade SQL Server (`v2.Destination.Slug` +
  `v2.ArticleDestinationMap`) + ghi `v2.SlugRedirect`, recompute Ancestors/
  Children/Related, enqueue relink), UI panel cảnh báo riêng trên trang chi
  tiết. Xem chi tiết `dichoithoi-implementation-plan.md` Phase 24.
- ✅ **Product "Quà mang về" — ĐÃ NỐI DÂY (Phase 27, 07/2026, dòng "0%
  wiring" ở trên đã lỗi thời)**: `Detail.cshtml` render khối "Quà mang về từ
  {tên}" (grid card ảnh/tên/giá/link affiliate) ở cuối mọi trang điểm đến khi
  `extras.SouvenirProducts.Count > 0`, đọc từ `SouvenirProductsJson` — xem
  Phase 27.
- ✅ **Bài loại `cam-nang` tạo bằng AI — ĐÃ XONG (Phase 22, 07/2026, dòng
  "không thể" ở trên đã lỗi thời)**: nút "🤖 Tạo bằng AI" ở form
  `/dichoithoi/articles/new` (prompt pack `cam-nang.outline/section/frame.vi`)
  - ô "Tư liệu tham khảo" — xem Phase 22.
- ✅ **Auto-link — 2 rào an toàn ĐÃ XONG (xác nhận qua code 23/07/2026, dòng
  "thiếu" ở trên đã lỗi thời)**: `shared/text/auto-link.ts` — hằng số
  `MAX_AUTO_LINKS_PER_ARTICLE = 10` chặn spam link/bài, và
  `findAmbiguousNames()` bỏ qua hoàn toàn tên trùng giữa nhiều slug khác nhau
  (vd "Bãi Dài" Phú Quốc vs Cam Ranh — không tự đoán bừa) trước khi chèn link.
  Engine dùng chung cho cả bài điểm đến lẫn bài cẩm nang nên áp dụng cho cả
  hai. Test: `auto-link.spec.ts` ("gioi han toi da 10 link...", "bo qua ten
  trung giua nhieu diem khac nhau...").
- ✅ **`DestinationReview` — ĐÃ ĐIỀU TRA (07/2026, Phase 21.4), KHÔNG PHẢI
  BUG.** Xác nhận grep cả 2 repo: không có write path nào (không endpoint
  public, không UI admin) — nhưng đây là quyết định đã ghi rõ ở
  `dichoithoi-seo-principles.md` (mục "KHÔNG review/rating giả"): dữ liệu
  review cũ là admin tự nhập (`IsAdmin`), đã CHỦ Ý gỡ UI + JSON-LD
  `AggregateRating`/`Review` (Phase 9) vì vi phạm chính sách Google. "Cơ chế
  review khách THẬT" được chính doc ghi "chưa chốt, phân tích sau" — không
  phải việc bị bỏ sót, để nguyên chờ quyết định sản phẩm (thiết kế form +
  chống spam) trước khi build.
- ✅ **Mục lục 2 lớp — ĐÃ XONG (Phase 28.1, 07/2026, dòng ở trên đã lỗi
  thời)**: nút "Mục lục ▾" (bottom-sheet mobile/`<nav>` sidebar desktop) +
  chip nav 6 mục KHÁC nhau theo `ContentTier` (Flagship vs POI, tính động từ
  section thực tế tồn tại) — xem Phase 28.1.
- **Hệ thống card dùng chung** (§10.6.5) — không có partial `_CardItem`
  thống nhất; mỗi loại (Hotel/Tour/Destination/Article) vẫn 1 partial riêng.
- **Trục vùng/miền** (`/vung/{slug}`) — ĐÃ build nhưng KHÁC kiến trúc đã
  chốt: dùng danh sách hard-code trong C# util (`RegionUtil`) thay vì bảng DB
  `Region` + `Province.RegionId` FK như thiết kế — hoạt động đúng, chỉ lệch
  kỹ thuật, ghi nhận để biết khi cần mở rộng (thêm vùng mới phải sửa code).
- ✅ **DestinationTag — ĐÃ XONG (23/07/2026)**: trang `/dichoithoi/chu-de` nay
  có form tạo tag mới + sửa tên inline + bật/tắt trạng thái + xoá (chặn xoá
  nếu đang gán cho điểm đến) — không cần seed thẳng SQL nữa. Endpoint mới
  `POST/PATCH/DELETE /destination-tags`, port `createTag`/`updateTag`/
  `deleteTag`.
- ✅ **Nâng cấp liên kết "Điểm đến liên quan" theo nhiều tiêu chí — ĐÃ BUILD +
  VERIFY XONG TOÀN BỘ 4 GIAI ĐOẠN A→B→C→D (17/07/2026)**. Thuật toán chấm
  điểm (type-overlap > cluster/tỉnh > khoảng cách 2 tầng > ưu tiên biên
  tập), taxonomy Type/Tag đã chuẩn hoá (Giai đoạn B là điều kiện chặn cứng
  đã hoàn thành trước khi bật Giai đoạn C), trang bản đồ tổng quan
  (`/dichoithoi/ban-do`, lớp quan hệ + nối tay/loại trừ), nhãn tiêu chí
  hiển thị trên website + JSON-LD ItemList riêng cho khối liên quan. Chi
  tiết đầy đủ + verify từng giai đoạn ở
  `dichoithoi-destination-relations-plan.md`. Còn B4 (rà soát tay taxonomy
  qua Kanban `/dichoithoi/phan-loai`) là việc vận hành dài hơi người dùng
  tự làm dần, không chặn gì.
- **Nâng cấp quy trình bài viết Article/Cẩm nang (15/07/2026, CHƯA BUILD hết)**
  — plan ở `dichoithoi-article-workflow-plan.md`: (1) thêm field tag thật
  cho bài viết, dùng CHUNG vocabulary `V2DestinationTag` với Destination
  (đã chốt hướng, chưa build) — kèm mở rộng trang `/chu-de/{slug}` hiện cả
  bài viết lẫn điểm đến, và fix phát hiện phụ: trang này hiện KHÔNG được
  link từ đâu trên site (orphaned). (2) ✅ **ĐÃ XONG (23/07/2026)** — tách
  auto-link + chèn khối sản phẩm ra 1 use-case Preview riêng
  (`PreviewArticleUseCase`, dry-run không ghi DB, cùng pattern preview của
  Destination) — nút "Xem trước" ở `content/[id]/page.tsx`. Ngoài ra phát
  hiện `Tag`/`TagController` (API `/api/tags`) là code chết, 0 nơi gọi —
  ✅ **ĐÃ XOÁ (23/07/2026, repo dichoithoi commit `432a36d`)**, cùng phạm vi
  đợt xoá module Blog (`4e1a6de`): `TagController`, `ITagService`/
  `TagService`, `ITagRepository`/`TagRepository`, entity `Tag`, `TagModel`,
  `DbSet<Tag>` (2 DbContext) + DI registration trong `Program.cs`. Không
  đụng `v2.DestinationTag`/`DestinationTagMap` (bảng khác, đang dùng thật
  cho `/chu-de/{slug}`). Build `dotnet build` sạch. (3) Audit
  SEO Article
  — ✅ **3/4 mục ĐÃ XONG (20/07/2026)**, mục còn lại cố ý để sau (quyết định
  qua AskUserQuestion):
  - ✅ **Thumbnail null lúc publish** — thêm field `coverImageId` (nullable)
    trên `content_jobs` (migration `1782400000000-ArticleCoverImage`, chỉ
    có nghĩa với `articleType=cam-nang`), CMS `content/[id]/page.tsx` có
    panel "Ảnh đại diện (og:image)" chọn tay từ Thư viện ảnh nội dung có
    sẵn (`SetArticleCoverImageUseCase`, `PUT /articles/:jobId/cover-image`
    — không ép chọn, không chặn đăng bài). `PublishArticleUseCase` resolve
    `coverImageId` → URL thật qua `resolveImageUrl` (tái dùng của module
    content-image) ghi vào `v2.Article.Thumbnail` thay vì `null` cứng.
  - ✅ **JSON-LD Article thiếu author/publisher** — site không có khái niệm
    "tác giả cá nhân" (bài AI/biên tập nội bộ) nên dùng chính `Organization`
    (brand "Đi chơi thôi") làm cả `author` lẫn `publisher`
    (`SchemaUtil.CreateArticleJsonLD`, Google chấp nhận Organization làm
    author, không bắt buộc phải là Person).
  - ✅ **Breadcrumb thiếu hoàn toàn trên Article** — thêm
    `BreadcrumbUtils.CreateArticleDetailBreadcrumb` (Trang chủ → Cẩm nang →
    tên bài, theo đúng pattern `CreateDestinationDetailBreadcrumb`), wire
    vào `ArticleController.Detail` (breadcrumb UI hiện + JSON-LD
    `BreadcrumbList`).
  - ⏸️ **Ảnh thân bài thiếu width/height — CỐ Ý ĐỂ SAU**. Khảo sát lại phát
    hiện mô tả cũ SAI: ảnh chèn qua token `[[block:image]]` đã CÓ
    width/height đúng từ trước (không phải bug) — sanitize-html không hề
    xoá gì. Chỉ ảnh markdown tự do (`![alt](url)` gõ tay) thiếu, vì cú
    pháp markdown không mang được kích thước, không phải do sanitize xoá.
    Rủi ro CLS thấp + khó sửa triệt để (không biết trước kích thước ảnh
    ngoài) — quyết định bỏ qua, ưu tiên việc khác có giá trị SEO rõ hơn.
  - Verify: 27 suites/202 test jest sạch (module ai-content/article/
    content-image), `tsc --noEmit` api+web sạch, `dotnet build` sạch,
    migration chạy thật trên Postgres dev. Test thật end-to-end trên
    `dichoithoi_dev`: tạo bài cẩm nang test → upload ảnh vào Thư viện ảnh →
    chọn làm ảnh đại diện → duyệt → đăng → xác nhận `v2.Article.Thumbnail`
    có URL thật (không null), trang `/cam-nang/{slug}` render đúng
    breadcrumb (UI + JSON-LD `BreadcrumbList`), JSON-LD `Article` có
    `image`/`author`/`publisher` đầy đủ qua HTML server-render thật. Đã
    xoá sạch dữ liệu test (bài, ảnh, job) khỏi cả Postgres và SQL Server.
- ✅ **Thư viện ảnh nội dung + token chèn ảnh — MỨC A ĐÃ BUILD + VERIFY XONG
  (17/07/2026)** — `dichoithoi-content-image-library-plan.md`. Bảng
  `content_images` (Postgres), token `[[block:image id=...]]` resolve
  trong `ArticleBlockCompiler`, trang `/dichoithoi/thu-vien-anh` (upload/
  sửa/xoá/copy token). Verify thật: publish 1 bài test lên site LocalDB,
  ảnh hiện đúng. Mức B (mang token sang Destination) vẫn để riêng, chưa
  cần — `publish-destination.usecase.ts` vẫn chưa compile `[[block:...]]`,
  đánh giá lại khi có nhu cầu thật.
- ✅ **Tự động tìm ảnh minh hoạ cho nội dung — ĐÃ BUILD + VERIFY XONG VỚI
  PEXELS API THẬT (17/07/2026)** — `dichoithoi-auto-image-search-plan.md`.
  Quét bài cẩm nang thiếu ảnh → sinh từ khoá thuần chuỗi (không AI) → gọi
  Pexels thật → lưu `pending` → tab "Chờ duyệt" trong `/dichoithoi/
thu-vien-anh` (Duyệt/Từ chối, nhớ từ khoá bị từ chối). Đã verify full
  vòng đời với `PEXELS_API_KEY` thật do người dùng cung cấp: Pexels trả
  đúng ảnh khớp chủ đề, duyệt/từ chối cập nhật DB đúng. 2 nguyên tắc bắt
  buộc (chỉ Pexels có giấy phép thương mại; chỉ tìm ảnh minh hoạ CHUNG,
  không tự tìm ảnh cho 1 địa điểm cụ thể) đã áp dụng đúng trong code. Kèm
  skill `dichoithoi-find-content-images` để chạy thủ công qua chat.
- **Giải thích tính năng ngay tại chỗ dùng — RETROFIT CÒN NỢ (15/07/2026)**
  — quy tắc mới bắt buộc cho MỌI trang CMS (ghi trong
  `.github/copilot-instructions.md`, mục "Giải thích tính năng ngay tại chỗ
  dùng"): mỗi trang/panel phải có phần giải thích công dụng + cách dùng
  hiện ngay trên trang, không dựa doc ngoài. Áp dụng NGAY cho trang mới.
  Trang ĐÃ CÓ trong `apps/web` (destination detail form, export/import
  modal, trang bản đồ/Kanban dự kiến ở các plan khác, v.v.) CHƯA được bổ
  sung — làm dần khi đụng lại từng trang, hoặc khi người dùng yêu cầu làm
  hàng loạt, không tự ý sửa hết 1 lượt.
- ✅ **Claude trích xuất thông tin điểm đến từ Google Maps + web tham khảo,
  người dùng duyệt — ĐÃ XONG Giai đoạn 1-3 (16/07/2026)** — plan ở
  `dichoithoi-destination-ai-extraction-plan.md` (đã GỘP + thay thế plan
  tóm tắt tham khảo cũ `dichoithoi-reference-summary-plan.md`). Người dùng
  chỉ cung cấp tên điểm đến + link Google Maps + web tham khảo (dùng đúng
  field `aiReferenceUrls` có sẵn) — Claude (qua VS Code, skill
  `dichoithoi-extract-destination-info`) đọc, trích xuất 11 field (tên/địa
  chỉ/SĐT/website/giờ mở cửa/mô tả ngắn/meta title/link đánh giá ngoài/tóm
  tắt cho AI viết bài/giá vé theo đối tượng/đánh giá biên tập), lưu vào
  bảng staging riêng `dichoithoi_destination_ai_extractions`; CMS hiện bảng
  so sánh cũ/mới trong popup, tick chọn field muốn áp dụng rồi "Chấp nhận".
  Đã test end-to-end bằng dữ liệu thật ("dalat-fairytale-land", Google Maps +
  Klook qua Playwright, web khác qua WebFetch), người dùng đã tự kiểm tra và
  xác nhận OK. Quy tắc mâu thuẫn nguồn đã ĐỔI so với thiết kế ban đầu: Claude
  tự chọn 1 giá trị hợp lý nhất (không liệt kê cả 2), lý do chuyển vào `note`.
  Giờ mở cửa lưu dạng JSON có cấu trúc (không phải HTML) để sau này build
  được JSON-LD `openingHoursSpecification` chuẩn SEO — **Giai đoạn 4, cross-
  repo, CHƯA làm, không phải ưu tiên hiện tại**.
- ✅ **MỞ RỘNG — trích xuất tự động qua Gemini 3.x + Google Search Grounding
  — Giai đoạn A-D ĐÃ BUILD + test thật 25/07/2026** (Giai đoạn E rollout
  hàng loạt còn mở, không phải ưu tiên) — cùng file
  `dichoithoi-destination-ai-extraction-plan.md` §5-6. Bối cảnh: chỉ
  87/275 POI có sẵn `google_maps_url` và 1/275 có `ai_reference_urls` —
  phần lớn điểm đến không đủ input để chạy skill thủ công; GSG tự tìm
  nguồn chỉ cần tên điểm đến. Chạy SONG SONG skill thủ công (không thay
  thế) — mỗi điểm đến sẽ có 2 dòng staging phân biệt theo cột `source`
  ("skill"/"gsg"), CMS có 3 nút (Xem Skill/Xem GSG/So sánh 4 cột — chọn
  nguồn để ghi), `aiReferenceSummary` tách 2 cột riêng (Skill/GSG) cùng
  đưa vào prompt viết bài (khác `userNotes` — 3 nguồn song song, không
  gộp). Temperature khác nhau theo tác vụ: trích xuất GSG `0.1`, viết bài
  nâng từ `0.3` lên `0.5-0.6` (cần quyết định áp dụng toàn site hay chỉ
  dichoithoi — xem §6 Giai đoạn D3). Rủi ro đã xác định: grounding +
  structured output làm rỗng `grounding_chunks` nên nhánh GSG không xác
  minh được nguồn cụ thể như Skill — gắn nhãn độ tin cậy thấp hơn trong
  UI/prompt. Kế hoạch triển khai theo giai đoạn A (schema+hạ tầng dùng
  chung) → B (use case Gemini+GSG) song song D (sửa prompt viết bài) → C
  (UI 3 nút) → E (rollout hàng loạt, sau) — đọc §6 trước khi bắt đầu code,
  có 2 quyết định cần người dùng chốt trước (model Flash vs Pro cho B —
  đã có cơ sở chọn Flash; scope temperature D3 — còn mở).
- ✅ **DDL lệch — ĐÃ SỬA (07/2026, Phase 21.5)**: xoá cột chết `BookingUrl`
  khỏi `v2.Destination` (SQL Server + entity `V2Destination.cs` — đã xác nhận
  0 nơi đọc/ghi trước khi xoá) + thêm cột `ContactFacebook varchar(256)` còn
  thiếu theo `database-redesign.md` §4.2. Script idempotent trong
  `scripts/dichoithoi-sqlserver/01-create-new-schema.sql`. **Phạm vi hẹp có
  chủ ý**: chỉ sửa DDL/entity, CHƯA nối dây field `ContactFacebook` vào
  contract/UI nhập liệu/website hiển thị — đó là 1 tính năng nhập liệu mới
  đầy đủ (khác "dọn schema lệch"), để làm riêng khi cần.
- **Ingest ảnh URL ngoài** (destination-spec §14.5) — chạy ĐỒNG BỘ (không
  qua pg-boss như thiết kế "async"), và module Product hoàn toàn CHƯA có
  ingest ảnh nào dù spec ghi áp dụng cho "mọi record" (Hotel/Tour có, Product
  không).
- ✅ **Dashboard "Việc cần làm" — ĐÃ XONG (Phase 23, 07/2026)** (destination-
  spec §7.2). `GetDichoithoiDashboardAlertsUseCase` mới tổng hợp 5/8 cảnh báo
  spec mô tả (độ phủ thấp, tag dưới ngưỡng, draft chờ duyệt, job lỗi, ảnh
  gallery thiếu) — chỉ hiện mục có count > 0. **Phạm vi cắt bớt có chủ ý**:
  chưa có "bài Chủ lực chưa có bài cẩm nang" (cần `ArticleDestinationMap`,
  Phase 26) và "link affiliate no-rule/chết" (trải nhiều module, để riêng).
  Card render trên hub `/dichoithoi`, tách `Card`/`ActionRow` thành
  `shared/ui/card.tsx` dùng chung với dashboard tổng.

### Việc CHƯA sửa (chờ bạn quyết định ưu tiên — xem cuối cuộc trò chuyện)

Danh sách trên CHƯA được sửa vào từng file spec riêng (chỉ mới sửa 3 dòng
"ĐÃ XONG" sai khẩn cấp nhất ở A#2/A#3/A#9) — cần bạn chọn hướng ưu tiên
trước khi vừa sửa doc vừa lên kế hoạch build, tránh sửa 2 lần.

## 0) Đang phân tích — CHƯA vào lộ trình build chính thức

- ✅ **Vé xe khách (CMS + hiển thị website) — ĐÃ BUILD + VERIFY END-TO-END
  (31/07/2026)**: plan đầy đủ ở `dichoithoi-transport-vexekhach-plan.md`.
  Bảng Postgres `transports` hợp nhất (cột `mode`, sẵn cho Flight sau) +
  `transport_stops` (destination_slug + role origin/destination/waypoint +
  seq_order) — 1 tuyến chọn **điểm đầu, điểm cuối, điểm trung gian** (node
  cụm/tỉnh thật, picker tái dùng kiểu `AddTicketDestinationPicker`). CMS
  mới `/dichoithoi/van-chuyen` (sidebar "Vận chuyển" — đổi từ `xe-khach`
  31/07/2026 vì bảng đã thiết kế sẵn cho nhiều phương tiện, tránh đổi URL
  sau này). Publish thẳng SQL Server
  `v2.Transport`+`v2.TransportStop`. Hiển thị: bake `DestinationContent.
  TransportCardsJson` (đúng pattern `HotelCardsJson`/`TourCardsJson` Phase
  15 đã có sẵn — audit lúc code phát hiện Hotel/Tour KHÔNG live-query như
  tưởng ban đầu, đã sửa theo đúng pattern) cho cả điểm đầu/cuối lẫn mọi POI
  con qua `ParentId` (fan-out khi tuyến đổi). Điểm trung gian không hiện
  card. Đã verify thật: tạo tuyến qua API → xác nhận bake đúng SQL Server →
  mở trang web thật thấy card đúng cho điểm đầu/cuối + POI con kế thừa, ẩn
  hoàn toàn khi không có dữ liệu. Commit zinoflow `c4cc07b`, dichoithoi
  `d1dd00b` (branch develop). Còn lại: chỉ Vé máy bay (mode=1) chưa build UI
  (bảng đã sẵn sàng nhận), và job cào tự động (MVP nhập tay).

- ⏳ **Cẩm nang gộp Tour/Vé/Vận chuyển + Danh mục bài cẩm nang — MỘT PHẦN
  ĐÃ BUILD (31/07/2026)**: plan ở `dichoithoi-camnang-affiliate-overflow-plan.md`.
  Quyết định chiến lược: không xây hub/search riêng cho Hotel/Tour/Vé/Vận
  chuyển (sẽ phải đấu SEO trực diện với Klook/Traveloka/Vexere, site chưa
  đủ authority) — điểm đến vẫn là trục SEO chính, phần overflow ngoài Top-N
  bake sẵn gộp vào 1 bài cẩm nang có content biên tập thật + card list full.
  Vận chuyển viết bài theo ĐIỂM ĐẾN (Mức A, không theo tuyến). **Giai đoạn
  1-4 (query full-list Tour/Vé/Vận chuyển + CMS gắn card list + hiển thị
  "Xem thêm" trên trang điểm đến) VẪN CHƯA BUILD.** Việc §6 (Danh mục bài
  cẩm nang, độc lập với phần trên) **ĐÃ BUILD XONG HOÀN TOÀN** (schema+CMS
  zinoflow + website dichoithoi: hub `/cam-nang/danh-muc/{slug}`, chip lọc
  trên `/cam-nang`, badge + bài liên quan trên trang chi tiết). Commit
  zinoflow (contracts/CMS) + dichoithoi `86acc32`+`ae17fd2` (branch develop).

- ✅ **Nâng chất lượng prompt + bài viết điểm đến — ĐÃ BUILD GĐ0-5 (29/07/2026),
  GĐ6 CHỜ REVIEW/ACTIVATE THỦ CÔNG** — plan ở
  `dichoithoi-destination-prompt-quality-plan.md`: audit job Thác Triệu Hải, prompt active DB,
  source context, contract/gate/editor/renderer và đề xuất Gemini. Ưu tiên bảo vệ prompt version
  khỏi bị migration ghi đè, bổ sung Type/Tag/hierarchy/provenance, tách strategy POI/Flagship,
  bỏ mục tiêu 800 từ rập khuôn và thêm gate style/redundancy/grounding. Đã chọn Mức B, migration
  local và full test/build pass; bốn prompt candidate vẫn inactive, chờ chạy corpus bằng provider
  thật + blind review trước khi activate batch nhỏ. Không tự publish hoặc tự activate.

- ✅ **Redesign toàn bộ Nhóm/Type/Tag điểm đến — ĐÃ MIGRATE + ĐÃ GÁN DỮ LIỆU
  THẬT (24/07/2026)**: audit dữ liệu thật trên `dichoithoi_dev` phát hiện
  overlap nặng `cong-trinh-kien-truc`/`di-tich-lich-su` (18/49 và 18/32 điểm
  trùng). Nhờ Gemini phân tích lại + Claude review/sửa lỗi (chính tả, cột
  `SecondaryTypeId` không có thật trong schema, thêm luật cứng phân định
  dựa trên xếp hạng di tích chính thức) → bản chốt 4 Nhóm/18 Type/17 Tag ở
  `phan-tich/dichoithoi-taxonomy-chuan-hoa.md`. Đã chạy script
  `scripts/dichoithoi-sqlserver/03-taxonomy-redesign-reseed.sql` xoá sạch
  taxonomy cũ + seed lại, sau đó gọi AI (Gemini — `ANTHROPIC_API_KEY` chưa
  cấu hình ở dev) gán Type/Tag hàng loạt cho toàn bộ 247 POI qua chính API
  `/destination-types/suggest`+`/destination-tags/suggest` đã có sẵn:
  **238/247 có Type, 244/247 có Tag** (áp dụng thẳng theo yêu cầu người
  dùng, không qua bước duyệt tay từng dòng như quy trình chuẩn destination-
  spec §2.4). Mọi Type/Tag đều có ≥1 điểm; 2 mục dưới ngưỡng ≥5 (vẫn
  `noindex`): Type `khoang-nong-onsen-spa` (1), Tag `nhom-ban-teambuilding` (1).
  **Bug phát hiện + đã sửa cùng đợt**: `replaceTypeAssignments`
  (`mssql-site-db.adapter.ts`) chưa bao giờ set `Destination.PrimaryTypeId`
  khi gán qua Kanban/AI — badge/breadcrumb web đọc thẳng cột này sẽ trống dù
  đã có Type. Đã sửa để tự set từ nay; 238 điểm gán đợt này được set tạm qua
  UPDATE 1 lần (chọn `TypeId` nhỏ nhất, không phải suy luận "loại chính"
  thật sự — có thể cần rà tay lại sau).
  ✅ **Đã đồng bộ mirror Postgres (24/07/2026)** — bấm "Đồng bộ từ website",
  cột `types` dùng cho `related-builder.ts` hết stale, verify qua
  `GET /destinations/dalat-fairytale-land` (`assignedTypes`/`assignedTags`
  đúng dữ liệu mới).

  ⚠️ **Đã THỬ vá luật cứng §2.1 vào prompt AI — KHÔNG đáng tin, còn mở**
  (24/07/2026, lần 2): thêm đoạn luật "chỉ gán `di-tich-lich-su` khi có xếp
  hạng chính thức" vào SYSTEM prompt (`suggest-taxonomy-types.usecase.ts`),
  xoá bảng nháp `dichoithoi_taxonomy_suggestions` (Postgres) để re-eval lại
  toàn bộ 25 cụm. Kết quả: overlap `di-tich-lich-su`/`cong-trinh-kiet-tac`
  đổi 18→33/247 — nhưng đọc trực tiếp cột `reason` AI ghi lại thì **luật
  KHÔNG được tuân thủ đáng tin**: điểm `bai-da-co-sapa` được AI tự viết rõ
  "tuy chưa có thông tin xếp hạng chính thức" nhưng vẫn gán
  `di-tich-lich-su` — vi phạm thẳng luật vừa thêm; nhiều điểm khác
  (`cau-long-bien-ha-noi`, `buu-dien-trung-tam-sai-gon`, `cho-ben-thanh`...)
  đoán đúng nhưng lý do không hề trích dẫn xếp hạng, chỉ tường thuật lịch sử
  chung chung — đoán đúng cảm tính, không phải do tuân luật.
  **Nguyên nhân gốc, chưa giải quyết được**: AI chỉ có tối đa 500 ký tự nội
  dung mô tả (nhiều điểm còn trống), hoàn toàn không có nguồn dữ liệu thật
  về quyết định xếp hạng để tra — sửa câu chữ prompt là không đủ, phải cấp
  THÊM dữ liệu xếp hạng thật làm input (đúng lo ngại đã ghi ở
  `dichoithoi-taxonomy-chuan-hoa.md` mục 4 phần "căn cứ xếp hạng"). Coi
  toàn bộ Type AI gán (cả đợt 1 lẫn đợt 2) là **dữ liệu khởi tạo thô, CHƯA
  đáng tin để coi là xong** — ưu tiên rà tay qua `/dichoithoi/phan-loai` cho
  các điểm có `di-tich-lich-su`/`cong-trinh-kiet-tac` trước, việc còn lại
  làm dần.

- ✅ **Soạn + ghi mô tả 300-450 từ cho 17 Tag — ĐÃ XONG NỘI DUNG, CÒN CHỜ
  PUBLISH TỪNG TAG** (24/07/2026): bản đầu bị phát hiện bịa hàng loạt địa
  danh không có trong dữ liệu gán thật (vd "Thảo Cầm Viên", "Yoko Onsen",
  "Hẻm Tu Sản" — không tồn tại trong `dichoithoi_dev`) + dùng markdown
  bullet/bold không tương thích view hiện tại (`Topic/Detail.cshtml` chỉ
  render 1 thẻ `<p>` phẳng). Đã viết lại toàn bộ 17 mô tả thành văn xuôi
  thuần, mọi địa danh đối chiếu lại với danh sách gán tag thật, và **ghi
  `Description` vào DB** (script `update-tag-descriptions.sql`, verify dấu
  tiếng Việt nguyên vẹn qua CMS `/dichoithoi/chu-de`). Nội dung Nhóm (4/4) +
  Type (18/18) + Tỉnh có dữ liệu (19/34) cũng đã ghi trước đó — meta
  description các trang `/loai`, `/tinh` tự cắt từ các đoạn này (SeoTextUtil).
  **Việc còn mở**: CHƯA đổi `Status` tag nào (vẫn draft) — bấm "mở trên
  site" từng tag qua CMS sau khi bạn duyệt xong nội dung; tag
  `nhom-ban-teambuilding` chỉ có 1 điểm gán (dưới ngưỡng ≥5) nên dù mở site
  vẫn `noindex`, cần gán thêm điểm trước khi có ý nghĩa publish.

- ✅ **Auto-link + cột `MetaDescription` riêng cho Type + Tag — XONG 24/07/2026**
  (content-seo-ux-plan §10.3a): `Description` (nguồn sạch, CMS sửa) tách khỏi
  `DescriptionHtml` (bản đã auto-link, server tự sinh lại mỗi lần lưu, chỉ link
  tới điểm đến đã gán cho đúng Type/Tag đó) và `MetaDescription` (field riêng
  cho `<meta>`, không bao giờ dính markup — đúng tiền lệ `Destination.
MetaDescription`). Verify end-to-end qua HTTP thật: PATCH type `bien-dao` và
  tag `phu-hop-gia-dinh` → 6/6 và 2/2 tên điểm đến tự thành `<a href="/diem-den/
...">`, meta description trên trang live đọc đúng `MetaDescription` riêng
  (không đọc `DescriptionHtml`). CMS `/dichoithoi/danh-muc` (dòng Loại) và
  `/dichoithoi/chu-de` đều có thêm ô nhập Meta description + ghi chú auto-link.
  Cùng đợt phát hiện + sửa 1 bug route có từ trước: `PATCH /destinations/:slug`
  đăng ký trước `PATCH /destinations/taxonomy-content` khiến mọi PATCH
  taxonomy-content qua HTTP thật bị nuốt nhầm (chỉ lộ ra khi test bằng HTTP
  thật — trước đó toàn ghi thẳng qua sqlcmd).
  **Việc còn mở**: Group + Tỉnh mới có `MetaDescription`, CHƯA có auto-link
  (`DescriptionHtml`) — làm sau nếu thấy giá trị, cùng cách đã làm cho Type/Tag
  (không cần thiết kế lại, chỉ thêm cột `DescriptionHtml` + gọi lại
  `buildTaxonomyDescriptionHtml` với target đổi thành group/province).

- **Tạo node gốc `Kind=1` cho Lào Cai + Khánh Hoà rồi gán `Province.DestinationId`**
  (phát hiện 24/07/2026 khi làm SEO trang danh mục): 2 tỉnh này có POI thật
  (Lào Cai 18, Khánh Hoà 12) nhưng `v2.Province.DestinationId` NULL vì chưa
  từng có node tỉnh trong cây `v2.Destination` — nội dung đang treo dưới
  cluster nằm ở root (`sapa` id 218, `mu-cang-chai` id 171, `nha-trang` id 187) + 7 POI Yên Bái cũ mồ côi (`ParentId` NULL: Hồ Thác Bà, La Pán Tẩn,
  Tú Lệ, Mường Lò, Lìm Mông, Suối Giàng, Thác Pú Nhu). Hệ quả: trang
  `/tinh/lao-cai`, `/tinh/khanh-hoa` rỗng (đang noindex đúng), mất 2 landing
  tỉnh giá trị cao. Việc cần làm: INSERT 2 node `Kind=1` (chú ý ChildrenJson/
  AncestorsJson/ChildCount nếu có), reparent các cluster + POI mồ côi vào,
  UPDATE `Province.DestinationId`, rồi POST `/api/destinations/sync`.
  KÈM bug đã sửa cùng ngày (`DestinationTaxonomyRepository`): tỉnh
  `DestinationId` NULL trước đây match `ParentId IS NULL` → 15 trang tỉnh
  rỗng hiển thị nhầm toàn bộ 29 node gốc cả nước (duplicate content) — giờ
  trả danh sách rỗng + noindex.

- **Sửa 2 tên điểm đến sai chính tả trong DB** (phát hiện 24/07/2026):
  `Bảo tàng chiến tích chiến tranh` → đúng là "Bảo tàng **Chứng tích** Chiến
  tranh"; `Khu di tích Pác Pó` → đúng là "Pác **Bó**". Sửa `v2.Destination.Name`
  (cân nhắc giữ slug cũ + redirect nếu đổi slug) rồi sync mirror.

- **Cho phép chỉnh ngưỡng `MAX_AUTO_LINKS_PER_ARTICLE` (auto-link) qua trang
  quản lý** (ghi nhận 23/07/2026, phân tích xong nhưng CHỦ Ý CHƯA làm): hiện
  là hằng số cứng trong `shared/text/auto-link.ts` (=10) — không có bảng
  cấu hình chung nào trong hệ thống, trang `/settings` hiện tại chỉ bật/tắt
  AI provider qua cột `isEnabled` có sẵn. Quyết định: **chưa đủ giá trị để
  làm ngay** — đây là ngưỡng chống spam link, không phải tham số cần chỉnh
  qua lại thường xuyên như AI provider on/off; sửa hằng số + chạy lại vẫn
  nhanh vì là tool nội bộ tự vận hành. Làm khi có nhu cầu thật (thấy 10 quá
  chặt/lỏng nhiều lần).
  - Khi bắt tay làm: cần (1) chỗ lưu cấu hình (bảng mới hoặc mở rộng), (2)
    truyền giá trị xuyên qua 3 nơi gọi `autoLinkContent()`
    (`publish-destination.usecase.ts`, `relink-all.usecase.ts`,
    `article-auto-link.service.ts`) thay vì đọc hằng số trực tiếp, (3) ô
    nhập số trên `/settings`.
  - **Bắt buộc kèm theo** (quy tắc "Giải thích tính năng ngay tại chỗ dùng",
    `.github/copilot-instructions.md`): ô nhập trên CMS phải có hướng dẫn cụ
    thể ngay tại chỗ — giải thích ngưỡng này LÀM GÌ (chặn spam link nội bộ
    khi bài nhắc nhiều tên điểm đến), DÙNG KHI NÀO (tăng nếu thấy bài dài bị
    cắt bớt link hợp lệ, giảm nếu thấy link tràn lan), và ẢNH HƯỞNG gì (áp
    dụng cho cả bài điểm đến lẫn bài cẩm nang vì dùng chung 1 engine) — không
    để trống chỉ có ô số không giải thích.

- ✅ **Nút "Xem trên Google Maps" — ĐÃ XONG (23/07/2026, repo `dichoithoi`
  commit `1ff637d`)**: thêm property `GoogleMapsUrl` vào `V2Destination.cs`
  - `DestinationDetailModel`, hiện link gốc (giữ Place ID đầy đủ) cạnh link
    "Chỉ đường" (chỉ Lat/Lng) ở cả `_QuickDecisionCard` (POI/cluster có
    `HasOwnVisitInfo`) và khối "Vị trí" độc lập (cluster không có visit info).
    Verify thật qua `dotnet run` trên `dichoithoi_dev`: POI có `GoogleMapsUrl`
    hiện đúng link Place ID, POI/cluster không có ẩn đúng nút, không lỗi log.

- **Bản đồ minh hoạ "điểm đến liên quan" trên website công khai** (ý tưởng
  21/07/2026, TÍNH NĂNG NÂNG CAO — xem xét/phân tích/làm SAU, chưa lên plan):
  ngoài danh sách text hiện tại, hiển thị thêm 1 khung bản đồ nhiều-điểm
  (điểm đang xem + các điểm liên quan) trên trang chi tiết `dichoithoi.com`
  để khách du lịch dễ lên lộ trình. Đã phân tích sơ bộ (chưa chốt hướng):
  - Lợi ích thật: khác bản đồ 1-điểm đã CHỦ Ý bỏ trước đó (`content-seo-ux-
plan.md` — "GeoCoordinates đã có sẵn JSON-LD, iframe không thêm giá trị
    SEO mà tốn Core Web Vitals"), bản đồ NHIỀU điểm phục vụ đúng nhu cầu
    trip-planning (không chỉ "ở đâu") — không tự động áp lại kết luận cũ.
  - Chi phí thật: `RelatedItem` (`packages/contracts/src/dichoithoi/
destination.ts`) hiện KHÔNG mang lat/lng (bị loại bỏ lúc build JSON,
    xem `related-builder.ts` — `RelatedCandidate` nội bộ có toạ độ nhưng
    `RelatedItem` cuối cùng thì không) — cần mở schema trước. Website hiện
    tại 0 dependency ngoài (`Detail.cshtml` chỉ 1 file JS nội bộ) — thêm thư
    viện bản đồ (Leaflet/Google Maps) sẽ là dependency ngoài ĐẦU TIÊN, đi
    ngược cam kết "stack nhẹ" Phase 18. Cần chọn nhà cung cấp tile (Google
    Maps JS cần billing; Leaflet+OSM free nhưng không khuyến khích dùng trực
    tiếp cho traffic production).
  - Hướng giảm chi phí nếu làm: lazy-load (chỉ tải khi cuộn tới/bấm xem) +
    GIỮ NGUYÊN danh sách text (bản đồ chỉ bổ trợ, không thay thế — danh sách
    vẫn cần cho crawlability/internal-link SEO).
  - CMS nội bộ (`/dichoithoi/ban-do`) đã có bản đồ quan hệ dạng tương tự cho
    admin từ trước (relations-plan Giai đoạn C4) — ý tưởng này chỉ mới cho
    PHÍA WEBSITE CÔNG KHAI.

- **SEO ảnh cho gallery hero (đánh giá 07/2026, sau khi build xong tính năng
  gallery ảnh — CMS quản lý nhiều ảnh + hero site thành carousel)**: đánh giá
  theo checklist SEO-owner (`dichoithoi-seo-principles.md`) phát hiện 5 lỗ
  hổng, đã CHỐT hướng sửa. **#2/#3/#5 ĐÃ XONG (xác nhận qua code 23/07/2026,
  dòng "chưa code" ở trên đã lỗi thời — làm ở `ff384d5`/`c2fa3b3` bên repo
  `dichoithoi`, chỉ chưa cập nhật doc này lúc đó)**: 2. ✅ **Structured data đủ ảnh** — MỌI `<img>` server-render trong gallery
  (carousel mobile, collage desktop, dải "Hình ảnh {tên}") đều đã có
  `itemprop="image"` (`Detail.cshtml`), không chỉ hero gốc. 3. ✅ **Caption/credit hiện đủ** — caption hiện inline trên cả carousel
  mobile (đè trên ảnh, giống hero) lẫn lightbox/collage desktop. 5. ✅ **Responsive `srcset`** — ảnh gallery mới có 3 size (`ThumbUrl`/
  `MediumUrl`/`HeroUrl`) qua `srcset`, ảnh cũ (1 size, chưa backfill) vẫn
  dùng `<img>` đơn, không lỗi.

  Còn mở, **cần bàn UX/luồng nhập liệu trước khi code**:
  1. **Alt text sẽ gần như luôn trùng nhau** — CMS mặc định `altText: null`
     lúc upload (`destination-gallery-editor.tsx`), không ép nhập → mọi ảnh
     kể cả hero đều rơi về fallback `"Hình ảnh về {tên}"` giống hệt nhau nếu
     người dùng bỏ qua (khả năng cao vì không bắt buộc). Hướng sửa: chặn nút
     "Lưu thư viện ảnh" nếu còn ảnh thiếu alt riêng, hoặc gợi ý placeholder
     theo ngữ cảnh thay vì để trống. Rủi ro: ép nhập alt có thể gây khó chịu
     nếu người dùng chỉ muốn upload nhanh nhiều ảnh — cần quyết định trước.
  2. **Tên file ảnh gallery không mang từ khoá** — `{slug}-{timestamp}.webp`
     (vd. `da-lat-1752345678901.webp`), Google có tính (yếu nhưng có thật) tên
     file mô tả nội dung. Sửa: slug hoá từ alt text lúc lưu — phụ thuộc #1
     (cần có alt thật trước khi slug hoá được).

  ✅ **#2 và #3 ĐÃ XONG (20/07/2026, repo dichoithoi commit `ff384d5`)** —
  thuần `Detail.cshtml`, không đổi zinoflow/schema. `itemprop="image"` giờ
  gắn đủ cho MỌI ảnh gallery (carousel mobile, collage desktop, dải "Hình
  ảnh {tên}"), không chỉ hero — verify qua HTML server-render thật
  (`dalat-fairytale-land`): 10 thẻ `itemprop="image"` (trước chỉ 2). Slide
  gallery trong carousel mobile (khác hero, vốn đã có) giờ hiện caption
  overlay inline giống style collage desktop, không cần mở lightbox — verify
  3 caption thật hiện đúng ("Trang trí halloween", "Cổng vào Fairy land",
  "Đêm ở Fairy land").

  ✅ **#1/#4/#5 ĐÃ XONG (20/07/2026)** — quyết định qua AskUserQuestion: #1 tự
  gợi ý placeholder alt lúc upload (`"{tên điểm đến} - ảnh {số thứ tự}"`,
  không còn để `null`) + cảnh báo mềm (không chặn) trước khi bấm "Lưu thư viện
  ảnh" nếu còn alt trống/trùng nhau; #4 tên file slug hoá từ chính alt gợi ý
  (tái dùng `slugifyVietnamese()` có sẵn, không viết slugify mới); #5
  `AddDestinationGalleryImageUseCase` đổi từ `toWebp()` 1 size sang
  `toWebpVariants()` 3 size (hero/medium/thumb, giống ảnh đại diện) — `path`
  lưu DB đổi thành BASE NAME không đuôi file, website (`GalleryItemModel.cs`)
  dùng đuôi `.webp` có/không trong `path` làm cờ phân biệt ảnh CŨ (1 file, y
  nguyên hành vi) / ảnh MỚI (3 size, render `srcset`) — **không cần backfill
  dữ liệu cũ**. Verify qua API + DB thật (`dalat-fairytale-land`): upload ảnh
  test → alt tự động "Dalat Fairytale Land - ảnh 4", 3 file
  `-hero/-medium/-thumb.webp` sinh đúng, HTML render đủ `srcset` 3 size cho
  ảnh mới, 3 ảnh cũ giữ nguyên `<img>` đơn không đổi. Đã xoá ảnh test + phục
  hồi đúng dữ liệu 3 ảnh cũ sau khi verify.

  **ĐÃ XONG 19/07/2026**: ảnh hero chính (`detail.HeroImage`, "Ảnh đại diện")
  giờ có field mô tả riêng `heroImageMeta` (altText/caption/credit, cùng cấu
  trúc 1 phần tử "Thư viện ảnh" nhưng không có `path`) — chọn hướng (a) thay
  vì tái dùng `shortDescription`. CMS: ô nhập trong `destination-image-uploader.tsx`.
  DB: cột `hero_image_meta` jsonb (Postgres) + `HeroImageMetaJson` nvarchar
  (SQL Server, `v2.DestinationContent`). Website: `Detail.cshtml` đè
  alt/caption lên ảnh hero ở cả carousel mobile, collage desktop, fallback
  không-gallery, và lightbox slide 0.

  **Việc mới phát sinh #2, CHƯA làm (quyết định 07/2026 — người dùng đồng ý để
  sau)**: ảnh chèn trong nội dung bài viết qua token `[[block:image]]` (thư
  viện ảnh nội dung, khác bảng `extras.Gallery`) hiện KHÔNG mở được lightbox
  — biên dịch ra `<img>` trơn không `data-lightbox-index`
  (`article-block-compiler.service.ts:179`). Cách làm nếu muốn: quét
  `.rich-content img` bằng JS phía client sau khi trang load, gắn thêm vào
  cuối mảng ảnh lightbox hiện có — không cần đổi backend/compiler. Đánh giá:
  lợi ích thấp (ảnh trong bài là minh hoạ theo đoạn văn, khác bản chất với
  ảnh gallery để browse tổng thể — gộp chung 1 chuỗi lightbox dễ gây lộn xộn
  ngữ nghĩa), chỉ nên làm nếu sau này có bài dài nhiều ảnh minh hoạ thực sự
  cần phóng to.

- ✅ **Gate "originality" (thứ 5) cho quality gates AI content — ĐÃ XONG
  (20/07/2026)** (`dichoithoi-seo-principles.md` §3.3/§3.4). Quyết định qua
  AskUserQuestion: dùng so khớp văn bản thuần Postgres `pg_trgm`
  `similarity()` (không embedding — tránh phải thêm provider/DB extension
  mới chỉ cho 1 gate), và **chỉ cảnh báo, KHÔNG chặn Approve** (severity
  `warning`, lần đầu có khái niệm severity khác 4 gate error cũ — thêm field
  `severity` vào `QualityCheck` contract, `assertAllGatesPass` chỉ throw khi
  còn check `severity=error` fail).
  - So sánh phần TRÍCH XUẤT rủi ro thật (mở bài + section "câu chuyện văn
    hoá"/"mùa-thời điểm"), không so nguyên `draftMarkdown` (tránh false-
    positive từ bảng giá/giờ mở cửa vốn giống nhau tự nhiên) —
    `originality-excerpt.ts` (domain, pure function, tái dùng keyword-list
    có sẵn của structure gate).
  - Phạm vi so sánh = cùng tỉnh (`content_jobs.comparison_key` = mã tỉnh,
    copy 1 lần lúc tạo job, cùng pattern `content_tier` Phase 28.3) + cùng
    `articleType`, chỉ so với job khác đã `Approved`
    (`originality_excerpt` ghi lúc Approve, migration
    `1782250000000-ContentJobOriginality` thêm `pg_trgm` extension + 2 cột
    `content_jobs` + cột `severity` cho `content_quality_results`).
  - Port `IOriginalityCorpusRepository` (module `ai-content`, KHÔNG reach
    sang module `destination` — giữ ranh giới clean architecture, dữ liệu so
    sánh nằm sẵn trong `content_drafts`/`content_jobs`).
  - UI (`content/[id]/page.tsx`, `dichoithoi/[slug]/page.tsx`): gate fail do
    severity=warning hiện ⚠️ vàng riêng biệt với ❌ đỏ (error), không chặn nút
    Approve.
  - Verify: 64 suites/400 test jest sạch (thêm `originality-excerpt.spec.ts`,
    `originality-gate.spec.ts`, `review-draft.usecase.spec.ts` mới — case
    warning không chặn/error vẫn chặn), `tsc --noEmit` api+web sạch, migration
    chạy thật trên Postgres dev.
  - Đồng thời chốt (giữ nguyên từ phân tích gốc): KHÔNG dùng AI-detector
    (GPTZero/Originality.ai) làm tiêu chuẩn pass/fail — không phải cơ chế
    Google dùng, chỉ tham khảo phụ.

- ✅ **Khoảng cách đường bộ thật (OpenRouteService) cho gợi ý liên quan —
  Giai đoạn 1-3 ĐÃ XONG (21/07/2026)** — `dichoithoi-poi-distance-plan.md`.
  Thay/bổ sung Haversine bằng ORS cho `DistanceFromCenter` (con→cha) + bảng
  mới `dichoithoi_poi_distances` (con↔con) — verify thật với API key ORS thật
  - dữ liệu Đà Lạt (45 con, 990 cặp = C(45,2), cascade Postgres+SQL Server
    khớp nhau). Nút "Tính khoảng cách" theo cụm/tỉnh (Công cụ, chọn Select) +
    nút riêng 1 điểm ở tab "Quan hệ" (bán kính vật lý, tự relink điểm đó ngay).
    `related-builder.ts` ưu tiên đọc `poiDistances` trước Haversine (fallback
    graceful). 64 suites/402 test jest sạch, `tsc --noEmit` sạch. **Còn lại
    Giai đoạn 4 (TUỲ CHỌN, chưa chốt)**: nối khoảng cách vào `sourceContext` khi
    tạo job AI viết bài — cần bạn xác nhận trước khi code.
- ✅ **Giai đoạn 5 — Khoảng cách cụm↔cụm/tỉnh↔tỉnh sang ORS thật — ĐÃ XONG
  (23/07/2026)** — cùng file `dichoithoi-poi-distance-plan.md`. Đổi
  `RecomputeClusterDistancesUseCase` từ Haversine sang gọi
  `IDistanceMatrixProvider` (adapter ORS có sẵn từ Giai đoạn 1), không đổi UI
  (giữ nguyên nút "Tính lại khoảng cách cụm/tỉnh"). **Phát hiện + sửa 1 bug
  thật lúc verify**: ORS trả `null` cho 47/300 cặp (2 node `lam-dong`/
  `quang-binh` không tìm được tuyến đường bộ, có thể do toạ độ centroid rơi
  vào vùng không có đường số hoá gần đó) — code cũ `Math.round(null)` ÂM THẦM
  ghi `0m` sai (0m bị hiểu nhầm là 2 điểm trùng nhau, nghiêm trọng hơn không
  có dữ liệu). Đã sửa: bỏ qua cặp lỗi (không ghi), thêm field `failedPairs`
  vào report + cảnh báo vàng trên UI. Verify thật trên `dichoithoi_dev`:
  `{"nodes":25,"pairs":253,"failedPairs":47,...}`, query Postgres xác nhận 0
  dòng còn giá trị 0m. 5 test mới, 23 suites/130 test jest sạch.

- ✅ **Chế độ xem theo cụm/tỉnh cụ thể trên `/dichoithoi/ban-do` — ĐÃ XONG
  (23/07/2026)** — `dichoithoi-map-cluster-view-plan.md`, giai đoạn A→E đầy
  đủ. Select "Xem cụm/tỉnh cụ thể" (A, tự fit bounds) + tắt marker clustering
  (B) + tên điểm thường trực (C) khi đã chọn cụm; endpoint
  `relations-map-data` trả thêm `poiDistances` + vẽ đường xanh lá con↔con
  kèm range slider lọc ngưỡng km, mặc định vẽ hết (D); bảng liệt kê toàn bộ
  cặp+km trong cụm, dùng `DataTable` có sẵn (E). Verify qua Playwright thật
  trên `dichoithoi_dev`: chọn "Đà Lạt" → 72/300 điểm, marker riêng lẻ kèm
  tên, kéo slider 308,5km→49,3km số cặp/đường giảm đúng (2485→2331), bảng
  sort đúng tăng dần; bỏ chọn cụm → quay lại hành vi cũ (gộp cụm dạng số),
  không lỗi console mới. `tsc --noEmit` sạch api+web+contracts.

- **Sim du lịch — gợi ý/gắn link sản phẩm liên quan** (repo `dichoithoi`, ghi
  nhận 07/2026, CHƯA phân tích): mục đích gợi ý và gắn link sản phẩm liên quan
  tới sim du lịch — dự kiến có thể tái dùng chính module Article/Product mới
  đang plan ở đây (`dichoithoi-product-spec.md`, `dichoithoi-article-spec.md`)
  thay vì xây riêng. Trạng thái hiện tại: code Controller/Service/View (Sim,
  FixedProduct) đã có sẵn trong repo `dichoithoi` (nhánh `develop`), nhưng menu
  "SIM DU LỊCH" đã ẩn khỏi header công khai (`_Header.cshtml`, commit
  `43444aa`) — KHÔNG hiển thị cho người dùng cho tới khi phân tích xong hướng
  đi. Khi có thời gian: phân tích lại có nên gộp vào Product/Article hay giữ
  module Sim riêng.

- **Vé máy bay + vé xe** (`dichoithoi-flight-spec.md`, `dichoithoi-bus-spec.md`,
  phân tích 07/2026): 2 kênh mới trả lời "tới điểm đến bằng cách nào", song song
  Hotel/Tour nhưng gắn theo TUYẾN ở cấp tỉnh/thành (không theo POI, không có
  bảng `*_destination_map`) — POI con kế thừa qua `ProvinceId` sẵn có. Giá là
  tham khảo tĩnh, cập nhật định kỳ (không phải meta-search real-time). ✅ **Cách
  hiển thị trên trang detail ĐÃ CHỐT** (`content-seo-ux-plan.md` §5.8, Phase A
  bước 3 07/2026 — chỉ là `flight-spec`/`bus-spec §6` trước đó ghi sót "chưa
  chốt", đã đồng bộ lại): 2 card "✈️ Vé máy bay"/"🚌 Vé xe khách" cạnh nhau
  trong mục "Cách tới đây" (sau lịch trình gợi ý, trước Điểm tham quan gần
  đây), ẩn card rỗng, gộp 1 bảng `transports` (cột `mode`) không tách bảng
  riêng, bake HTML vào `DynamicBlocksJson`. Khi quyết định BUILD (đổi tên
  bảng, đồng bộ SQL Server): thêm vào §B dưới đây + `system-overview.md` +
  `implementation-plan.md`. Cách nhập: 2 màn quản lý riêng trong zinoflow
  (giống Hotel/Tour) — nhập tay hoàn toàn hoặc cào định kỳ, KHÔNG có panel gán
  vào từng điểm đến (chỉ chọn tỉnh đích), trang chi tiết điểm đến chỉ đọc theo
  `ProvinceId` (flight-spec §5, bus-spec §5).

- **4 khối nội dung mới cho trang điểm đến** (`dichoithoi-content-seo-ux-plan.md`
  §5.4-§5.7) — ✅ **3/4 ĐÃ XONG (xác nhận qua code + DB thật, 07/2026, Phase 12)**:
  giá vé theo đối tượng (§5.5a, cột `PriceBreakdownJson` đã có trên
  `v2.DestinationContent`, form `destination-price-breakdown-editor.tsx` +
  use-case `update-practical-notes`/`get-destination-detail` đọc/ghi đầy đủ);
  khối "Lưu ý thực tế" (§5.7, cột `PracticalNotesJson` đã có, form
  `destination-practical-notes-editor.tsx`); câu chuyện văn hoá - lịch sử
  (§5.6, đã vào structure gate — `destination-gates.ts` bắt buộc section này,
  `CULTURAL_STORY_HEADING_KEYWORDS`). **Còn thiếu duy nhất**: giá theo nhà
  cung cấp booking (§5.5b, field `price` trong `ticketLinks[]` — chưa sửa
  `affiliateLinkItemSchema`), và chi phí ước tính (§5.4) chưa xác nhận có
  render tự tính lúc hiển thị hay chưa.
  Cách nhập từng khối (bổ sung 07/2026, hỏi "có cần nhập ở zinoflow không"):
  giá cố định (a) + giá theo nhà cung cấp (b) → **nhập tay** trong màn sửa
  điểm đến (AI không được bịa số); câu chuyện văn hoá - lịch sử → **AI viết,
  người duyệt** (như mọi section văn xuôi khác, không form riêng); chi phí
  ước tính → **không nhập gì**, tự tính lúc render; lưu ý thực tế → **AI gợi ý
  draft, bắt buộc người dùng duyệt/sửa** trước khi lưu (ảnh hưởng an toàn).
  Xem chi tiết content-seo-ux-plan §5.4-§5.7.

- **Layout mobile-first — đập đi làm lại toàn bộ** (`dichoithoi-content-seo-
ux-plan.md` §10, phân tích 07/2026): thiết kế mới hoàn toàn cho menu (drawer +
  mega-menu), trang chủ, trang danh mục (Loại/Tỉnh), trang chi tiết điểm đến —
  mobile-first (CSS base cho mobile, desktop thêm bằng `min-width`), có wireframe
  ASCII chi tiết từng loại trang, thanh CTA dính đáy trên mobile ở trang chi
  tiết, `<details>` gốc HTML cho khối dài (không JS ẩn/hiện, giữ SEO). ✅ **ĐÃ
  XONG (xác nhận qua code 07/2026)** — vào implementation-plan làm Phase 18
  (18.0-18.5), đã build và deploy.

  ⚠️ **Cần bạn xác nhận 1 điểm**: mục "thời điểm đẹp" (mùa/giờ nên đi) trước đó
  đã CHỐT giữ dạng văn xuôi trong `ContentHtml`, không tạo field cấu trúc riêng
  (database-redesign §4.2, "chưa có nhu cầu landing theo mùa cụ thể") — phân
  tích lần này KHÔNG đổi quyết định đó (không đề xuất field mới cho "mùa nên
  đi"), chỉ thêm mục MỚI "câu chuyện văn hoá" (khác nội dung, không phải mở
  rộng field mùa). Nếu bạn thực ra muốn có field mùa cấu trúc (vd để lọc/landing
  theo mùa sau này), cần chốt lại riêng — không nằm trong phạm vi phân tích lần
  này.

- ✅ **Nhập toạ độ qua link Google Maps — ĐÃ XONG (xác nhận qua code 23/07/2026,
  dòng "sẵn sàng đưa vào code" ở trên đã lỗi thời)** (`dichoithoi-destination-spec.md`
  §2.1.1): form sửa điểm đến (`destination-metadata-form.tsx`) đã có ô "Link
  Google Maps" (lat/lng đổi thành read-only, chú thích "tự tính khi lưu"),
  server parse bằng `ParseMapsLinkUseCase`/`google-maps-link.ts` (ưu tiên
  `!3d!4d`, fallback `@lat,lng`, lấy match CUỐI khi link nhiều toạ độ — bugfix
  23/07/2026), wire vào cả `upsert-destination`, `import-destinations`,
  `bulk-update-destination-fields`. Các thông tin khác của điểm đến vẫn nhập
  tay như cũ, KHÔNG tự điền từ Google Maps ở scope này.

  ⚠️ **Ý tưởng nâng cao — Google Places API** (destination-spec §2.1.2,
  **ƯU TIÊN THẤP, chỉ ghi lại mục đích, chưa làm**): tự điền field trống (giờ mở
  cửa, địa chỉ...), lấy thêm rating/số review của Google (khác nguồn review nội
  bộ), gợi ý điểm đến con trong cùng khu qua Nearby Search (vd Suối Tiên có
  nhiều khu nhỏ), lưu `place_id` để tái sử dụng. Ảnh Google Maps: KHÔNG tải/lưu
  về server (rủi ro bản quyền) — chỉ link-out "Xem trên Google Maps". Cần tài
  khoản Google Cloud + billing, chỉ gọi khi người dùng chủ động bấm nút (không
  job nền tự động) — xem lại khi có nhu cầu/ngân sách thật.

- **`AncestorsJson`/`ChildrenJson` cho cây phân cấp tỉnh → khu vực → điểm con**
  (`dichoithoi-database-redesign.md` §3.4/§4.3, phân tích 07/2026, vd Lâm Đồng →
  Đà Lạt/Di Linh/Đức Trọng → điểm cụ thể): cây `kind`(`province`/`cluster`/`poi`)
  - `ParentId`/`ProvinceId` hiện có đã đủ mô hình hoá đúng, KHÔNG cần đổi cấu
    trúc — chỉ thêm 2 cột precompute mới tính trong `RecomputeRelatedService`:
    `AncestorsJson` (breadcrumb, không query đệ quy) và `ChildrenJson` (danh sách
    đầy đủ con trực tiếp, khác `RelatedJson` chỉ cắt 8 mục gợi ý). 1 điểm đến chỉ
    thuộc 1 cha duy nhất ở trục địa lý (đúng bản chất vật lý); trục phân loại
    (`DestinationTypeMap`) đã hỗ trợ nhiều-nhiều sẵn. ~~Tag tự do: chưa cần~~ →
    **ĐÃ MỞ LẠI 07/2026** — nhu cầu chủ đề cắt ngang (vd "Kiến trúc") đã phát
    sinh thật: chốt bảng `DestinationTag`/`DestinationTagMap` + trang
    `/chu-de/{slug}` (bộ từ vựng ĐÓNG quản lý trong CMS, không phải tag nhập tự
    do — database-redesign §3.2.1, destination-spec §2.4). ✅ **Toàn bộ đã build
    và xác nhận qua DB thật (07/2026)**: cột `AncestorsJson`/`ChildrenJson` ĐÃ
    có trên `v2.DestinationContent` (builder `ancestors-children-builder.ts`,
    ghi khi publish/relink — chỉ cần chạy `relink` để backfill cho các điểm
    cũ chưa có); bảng `DestinationTag`/`DestinationTagMap` + trang `/chu-de`
    đã build (xem Phase B/C). Dòng "CHƯA thêm vào DDL" trước đó đã lỗi thời.

- **URL điểm đến giữ PHẲNG, không theo cấp bậc** (`content-seo-ux-plan.md`
  §10.7, **CHỐT 07/2026**): `/diem-den/{slug}` giữ nguyên như hiện tại, KHÔNG
  đổi sang nested theo tỉnh/cụm — lý do: Google không tính độ sâu URL là yếu
  tố xếp hạng, breadcrumb+`AncestorsJson` đã truyền tải cấp bậc, URL phẳng ổn
  định hơn khi tổ chức lại cây. Không cần code gì thêm (đã đúng hiện trạng).

  **Trang chi tiết theo `kind` (poi/cluster/province) + trục vùng/miền**
  (`content-seo-ux-plan.md` §10.6, **CHỐT 07/2026**, đưa vào Phase 18 của
  implementation-plan): cluster có 2 biến thể render khác nhau (có/không vé
  riêng); `kind=province` KHÔNG có trang riêng, redirect sang `/tinh/{slug}`
  đã build (tránh duplicate content); vùng/miền là trục phân loại mới (bảng
  `Region`, trang `/vung/{slug}`) chứ không phải tầng thứ 4 trong cây `kind`.

- **Website chỉ đọc, KHÔNG xử lý logic — rà soát tốc độ phát hiện vi phạm**
  (`dichoithoi-database-redesign.md` §3.4/§4.3, `dichoithoi-system-design.md`
  §5 mục 1, phân tích 07/2026): nguyên tắc "ghi đắt đọc rẻ" phát biểu lại rõ
  ràng hơn — zinoflow xử lý TOÀN BỘ (join/sort/aggregate), website chỉ SELECT +
  render. Rà soát code thật phát hiện 2 chỗ ĐANG VI PHẠM cần sửa: (1) trang
  detail JOIN+ORDER BY+TAKE bảng Hotel/Tour SỐNG lúc render
  (`DestinationExtrasRepository.GetExtrasBySlugAsync`) → thêm `HotelCardsJson`/
  `TourCardsJson` precompute (2 trigger: lúc publish destination, và lúc
  Hotel/Tour đổi giá/rating/mapping); (2) tính `AvgRating` bằng `.Average()`
  toàn bộ list review MỖI LẦN RENDER → sửa thành UPDATE 2 cột cache
  `AvgRating`/`ReviewCount` (đã có sẵn trên `V2Destination`) ngay lúc website
  ghi review mới, trang detail đọc thẳng cột cache. Mục tiêu: từ 7 query rời
  rạc hiện tại/trang detail → còn 1 query chính + tối đa 1 query phụ. ✅ **CẢ 2
  VI PHẠM ĐÃ SỬA (xác nhận qua code thật 07/2026, Phase 15)**:
  `DestinationExtrasRepository` giờ đọc thẳng `HotelCardsJson`/`TourCardsJson`
  (precompute, không JOIN sống) và đọc thẳng cột cache `AvgRating`/`ReviewCount`
  trên `Destination` (không còn `.Average()` mỗi lần render).

- **Tối ưu hạ tầng cho hosting SmarterASP .NET Advance** (`content-seo-ux-
plan.md` §10.5.1, `system-design.md` §5 mục 9, phân tích 07/2026 — rà soát
  toàn diện thêm sau khi đã có thiết kế precompute/mobile-first/stack nhẹ):
  (1) cache 2 tầng — `OutputCache` in-memory + Cloudflare free làm CDN/edge
  cache (bắt buộc vì IIS App Pool recycle làm mất cache tầng 1 trên shared
  hosting), invalidate cả 2 khi publish (mở rộng endpoint invalidate cache có
  sẵn, thêm gọi Cloudflare Purge API); (2) resize ảnh ở zinoflow — ĐÃ có kế
  hoạch từ trước (`destination-spec.md` §14), không phải việc mới, chỉ xác
  nhận lại; (3) đo Lighthouse thực tế qua GitHub Actions/PageSpeed API từ bên
  ngoài, không phụ thuộc hosting; (4) `noindex`/canonical cho tổ hợp filter;
  (5) sitemap chia nhỏ theo ngưỡng 40.000 URL/file; (6) CẦN BẠN KIỂM TRA: gói
  Advance có tính năng Task Scheduler/Cron trong control panel không (để
  warm-up app pool sau recycle) — chưa xác nhận được từ xa.

- **Module Sản phẩm (affiliate, chèn qua tag trong bài viết)** —
  **ĐÃ BUILD XONG (Phase 16, 07/2026)**, xem implementation-plan.md Phase 16 để
  biết chi tiết đầy đủ. Quyết định `category`: tự do nhập + gợi ý autocomplete
  từ giá trị đã dùng, không bảng quản lý riêng (đã hỏi người dùng khi build).
  Phát hiện lúc build: prompt mặc định cho `cam-nang.*` (bài cẩm nang, nơi
  chèn khối Product) chưa tồn tại trong `DEFAULT_PROMPTS` — thuộc khoảng trống
  Phase 8, chưa xử lý.

- **Thiết kế lại trang chủ + footer (ghi nhận ý tưởng 23/07/2026, CHƯA PHÂN
  TÍCH)** — người dùng dự tính làm sau, chỉ mới ghi lại ý định, chưa audit
  code/chưa chạy checklist SEO-owner. Phạm vi nêu ra: nội dung, màu sắc,
  trang chủ, footer. File liên quan (repo `dichoithoi`, chưa đọc kỹ, chỉ xác
  định vị trí): `DiChoiThoi.Web/Views/Home/Index.cshtml` (trang chủ),
  `DiChoiThoi.Web/Views/Shared/_Footer.cshtml` (footer),
  `DiChoiThoi.Web/Views/Shared/_Layout.cshtml` (layout chung, màu sắc/theme
  có thể nằm ở CSS dùng chung layout này). Khi bắt tay làm: chạy
  `dichoithoi-seo-check` trước (trang chủ/footer có internal-link + JSON-LD
  ảnh hưởng SEO), và tham khảo nguyên tắc "flat/modern UI" đã chốt cho UI
  CMS zinoflow (`dichoithoi-flat-modern-ui`) — cân nhắc có áp dụng tinh thần
  tương tự cho website công khai hay đây là gu riêng, cần hỏi lại.

- ✅ **Chuẩn hoá dữ liệu Tỉnh/Cụm/Điểm theo Atlas 34 tỉnh — 257 cụm (GĐ1-7
  ĐÃ BUILD + VERIFY DỮ LIỆU THẬT 27/07/2026 trên `dichoithoi_dev`; GĐ8 đang
  vận hành liên tục; GĐ9 CHƯA CHẠY — chờ xác nhận)** — plan đầy đủ +
  kết quả build ở `chuan-hoa-du-lieu/plan-lam-moi-du-lieu-atlas.md` (mục
  "Kết quả build" cuối file). Tóm tắt: wipe & restore qua bảng backup tạm
  `dichoithoi_destinations_backup` + thư mục ảnh tạm → dựng lại 34 node
  tỉnh (`tinh-<x>`/`thanh-pho-<x>` cho 6 TP trực thuộc TW) → nạp 257 cụm từ
  sheet Atlas (90 flagship/167 standard, khớp đúng) → tính năng "Tìm điểm
  con trong cụm" nâng cấp thêm `matchType: "backup-match"` (khôi phục
  nguyên bài viết/ảnh/toạ độ cũ, mặc định giữ bản backup, có tuỳ chọn dùng
  bản AI mới) → trang `/dichoithoi/backup-con-lai` (màn "Backup còn lại",
  điều kiện cứng chống chết dữ liệu âm thầm — khôi phục tay hoặc bỏ hẳn).
  Verify thật: cụm Bảo Lộc ra 17 backup-match qua Gemini + accept đúng cả 2
  nhánh; khôi phục ảnh thật (thác Triều Hải, 8 ảnh gallery); Playwright
  UI trang Backup còn lại; script GĐ9 (`atlas-cleanup-backup.ts`) đã test
  guard (chặn đúng khi còn dòng chưa xử lý) nhưng **TUYỆT ĐỐI CHƯA CHẠY
  THẬT** — chỉ chạy khi người dùng xác nhận đã tìm xong điểm cho các cụm.
  5 script one-time nằm ở `apps/api/scripts/atlas-*.ts`.
  Câu hỏi cụm liên tỉnh cũ đã ĐÓNG từ lúc phân tích (1 cụm 1 tỉnh + quan hệ
  "Tiếp giáp" ghi vào `ai_notes` cụm, không lưu relation, không mở schema
  đa-tỉnh). GĐ4 phát hiện đính chính: mã tỉnh SỐ trong cây destination
  vốn ĐÃ là mã 34-tỉnh-mới (không lệch với `admin_provinces` như phân
  tích ban đầu tưởng) — chỉ cần join qua `province_code`, không cần
  migration đổi hệ mã.

- ✅ **Tìm điểm con trong cụm bằng AI (27/07/2026, ĐÃ BUILD + VERIFY dữ liệu
  thật trên `dichoithoi_dev`)** — plan đầy đủ
  ở `docs/dichoithoi/dichoithoi-cluster-poi-discovery-plan.md`. Tóm tắt:
  Gemini + Google Search Grounding sinh danh sách điểm cho 1 cụm ĐÃ CÓ SẴN
  (không tạo cụm mới), duyệt qua bảng trước khi ghi — mỗi ứng viên gắn
  `matchType` (new/existing-in-cluster/orphan-match, tính bằng fuzzy-match
  lỏng) quyết định hành động khi Chấp nhận: tạo draft Postgres-only qua
  `UpsertDestinationUseCase.create()` (giống tạo tay) hoặc gán lại
  `parentSlug` qua `.update()` cho điểm orphan — KHÔNG dùng
  `MssqlSiteDbAdapter.createDestination()` (publish thẳng, sai ngữ cảnh).
  Kèm nút "Xem trước prompt" (có block cấu hình model/GSG/temperature).

## A) Quyết định CẦN BẠN CHỐT trước khi code (không phải việc kỹ thuật thuần)

| #   | Việc                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Ảnh hưởng                                                                 | Nguồn                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | ~~CHỐT — URL bài cẩm nang = `/blog/{slug}`~~ → **SỬA LẠI (07/2026)**: quyết định ban đầu SAI, `/blog` là route legacy v1 đang chạy thật (`BlogController`), không thể đè lên. Route thật đã build = `/cam-nang/{slug}` (`ArticleController.cs`, entity `V2Article`) — xem Phase D mục 1                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Route website + SEO                                                       | article-spec §10.1, implementation-plan Phase D#1             |
| 2   | ✅ **ĐÃ XONG (Phase 21.1, 07/2026)** — khối `food-spots` (tái dùng bảng `products` lọc theo `FOOD_SPOT_CATEGORIES`: Quán ăn/Ẩm thực/Nhà hàng/Đặc sản, tham số `tag=` bắt buộc) đã có đủ trong compiler (`article-block-compiler.service.ts`) + UI palette (`insert-dynamic-block-panel.tsx`) — dòng này trước đây bị ghi nhầm "chưa code", commit `243b5ee` đã làm                                                                                                                                                                                                                                                                                                                                                                        | Độ phức tạp compile engine                                                | article-spec §3.1/§10.3                                       |
| 3   | ✅ **ĐÃ XONG (Phase 22, 07/2026)** — thêm 3 prompt `cam-nang.outline/section/frame.vi` (`default-prompts.ts`, dạy AI cú pháp `[[block:...]]` + liệt kê kind khả dụng), form Article `/dichoithoi/articles/new` thêm nút "🤖 Tạo bằng AI" (Select provider/model, giữ nguyên nút "Viết tay"). Test thật qua Playwright: tạo job AI thành công (DraftReady, gemini-2.5-flash-lite, ~12s). **Quan sát thêm**: model nhỏ (flash-lite) có xu hướng THẬN TRỌNG, không tự chèn token dù có gợi ý rõ trong "Tư liệu tham khảo" — không phải bug (cơ chế parse/compile token đã test đúng ở Phase 21.1), có thể cần model mạnh hơn (pro) hoặc tinh chỉnh prompt thêm nếu muốn AI chèn khối tích cực hơn.                                           | Độ phức tạp prompt pack                                                   | article-spec §10.4, product-spec §7                           |
| 4   | Chọn OTA nào cào khách sạn trước (Booking.com/Agoda/Traveloka)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Parser đầu tiên cần build                                                 | hotel-spec §7.1                                               |
| 5   | Chọn nguồn cào tour trước (Klook/TripVision/khác)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Parser đầu tiên cần build                                                 | tour-spec §7.1                                                |
| 6   | Mạng affiliate đang/sẽ tham gia đã cấp rule/deep-link dạng nào (theo từng khách sạn/tour hay chỉ link chung)?                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Thiết kế `affiliate_link_rules`, ảnh hưởng CTA                            | hotel-spec §7.2, tour-spec §7.2, affiliate-conversion-spec §2 |
| 7   | Ngưỡng khối lượng khách sạn/tour cần có trước khi đáng xây job cào tự động                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | MVP nhập tay hay xây crawler ngay                                         | hotel-spec §7.3, tour-spec §7.3                               |
| 8   | ✅ **XONG (07/2026, vòng 2)** — rà lại TOÀN BỘ 246 điểm published (không chỉ "Di tích lịch sử" như vòng 1 ở Phase B bước 1) → phát hiện + sửa 5 lỗi gán sai/thiếu thật: Cao nguyên đá Đồng Văn (gán nhầm "Di tích lịch sử" cho cảnh quan tự nhiên, cùng loại lỗi Bãi đá cổ Sa Pa), Khu di chỉ Óc Eo An Giang (gán "Khu vui chơi" cho 1 di chỉ khảo cổ — sai hoàn toàn), Khu Thất Sơn An Giang (thiếu "Núi - Cao nguyên"), Nhà thờ Lớn Hà Nội (thiếu type "Nhà thờ"), Phố cổ Đồng Văn (thiếu "Phố cổ - phố đi bộ"). Script `scripts/address-migration/phase-b-04-fix-typemap-round2.sql`, đã chạy + xác nhận idempotent trên `dichoithoi_dev`. 3 case khác (Chùa Cầu Hội An/Ga Hà Nội/Chợ Đồng Xuân) độ tin cậy thấp hơn, để ngỏ chưa sửa. | Chất lượng taxonomy ảnh hưởng trang `/loai` (SEO) + khối động theo `type` | destination-spec §2.4                                         |
| 9   | ✅ **ĐÃ XONG (Phase 22, 07/2026)** — ô "Tư liệu tham khảo" (textarea, map vào `sourceContext`) đã thêm vào form `/dichoithoi/articles/new`, đi kèm nút "🤖 Tạo bằng AI" mới.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Chất lượng bài Article + tín hiệu Who/How/Why                             | article-spec §1.2                                             |
| 10  | ✅ **CHỐT 07/2026** — Khoá phụ UPSERT = slug + tên chuẩn hoá (bỏ dấu, lowercase) + tỉnh/tuyến; nghi trùng → để nháp chờ người dùng xác nhận gộp, KHÔNG tự động ghi đè                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Import sheet không tạo trùng với data nhập tay                            | product-spec §5.1                                             |
| 11  | Chọn sàn TMĐT nào cấu hình affiliate rule trước (Shopee/Lazada/Tiki...) — sẽ có NHIỀU sàn, chưa chọn thứ tự cụ thể (không chặn build phần còn lại, `affiliate_link_rules` đã hỗ trợ nhiều provider sẵn)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Thứ tự cấu hình rule Product                                              | product-spec §8.4                                             |

## B) Lộ trình thực hiện theo PHASE (viết lại 07/2026 sau đợt rà toàn bộ — thứ tự theo PHỤ THUỘC, không theo thứ tự nghĩ ra)

**Phase A — Làm được NGAY, không chờ code gì** (toàn bộ là việc phân tích/
dữ liệu, output đổ vào migration Phase B — làm sau là phải migrate 2 lần):

1. ✅ **ĐÃ DUYỆT 07/2026 — Thiết kế bộ chủ đề (tag) + rà taxonomy Type**: đọc
   thật 271 điểm đến từ `dichoithoi_dev`, phát hiện 10 điểm chưa có Type +
   loại "Di tích lịch sử" bị gán quá rộng (35 điểm, lẫn cả Vịnh Hạ Long/Biệt
   thự Hằng Nga không phải di tích) + đề xuất 7 tag chủ đề (kèm tiêu chí +
   đếm thật) — chi tiết đầy đủ + 2 tag theo dõi thêm ở destination-spec §2.4
   bước 0. Áp dụng khi seed migration v2 (Phase B), không cần hỏi lại.
2. ✅ **XONG (07/2026, theo phạm vi đã chốt) — migration địa chỉ cũ→mới**
   (plan riêng `~/.claude/plans/nifty-purring-waterfall.md`): sửa lỗi thuật
   toán so khớp (bỏ tiền tố Xã/Phường) + sửa `ProvinceName` sai (Phan Thiết→
   Bình Thuận, Hội An→Quảng Nam) — kết quả cuối: 114 match tự tin cấp
   phường/xã, 121 chấp nhận cấp tỉnh (quyết định người dùng, không chặn tiến
   độ), 36 cần xem tay khi rảnh (không chặn Phase B). Chuẩn hoá format địa
   chỉ (mục cũ) để lại làm lúc chạy migration v2 thật.
3. ✅ **XONG (07/2026) — Cách hiển thị Flight/Bus trên trang detail**: hoá ra
   đã chốt sẵn từ trước ở `content-seo-ux-plan.md` §5.8, chỉ do `flight-spec`/
   `bus-spec §6` chưa cập nhật nên tưởng còn mở — đã đồng bộ lại 3 file. Không
   còn là điều kiện chặn Pilot (Phase E) nữa, chỉ còn chờ BUILD module.
4. ✅ **PHẦN LÀM ĐƯỢC XONG (07/2026)** — 4/8 mục A quyết được ngay: URL Article
   = `/blog/` (A#1), thêm khối `foodSpots` (A#2), ô tư liệu Article (A#9), khoá
   UPSERT sheet (A#10). **Còn 4 mục A#4-7 (chọn OTA khách sạn/tour cào trước,
   dạng rule mạng affiliate, ngưỡng khối lượng xây crawler) — CHƯA quyết được**
   vì cần thông tin kinh doanh thật (bạn đã/đang đàm phán mạng affiliate nào,
   OTA nào có API) mà Claude không có — để mở, hỏi bạn khi bắt tay build đúng
   module đó (Phase C bước 3), không phải việc phân tích giấy giải quyết được.

**Phase B — Đại tu nền** (`system-overview.md` §5):

1. ✅ **XONG (07/2026) — Gộp output Phase A vào schema v2 trên `dichoithoi_dev`**
   (LocalDB, KHÔNG đụng production). Phát hiện lúc bắt tay: core migration
   §7 bước 1-5 (bảng `v2.Destination`/`DestinationContent`/`Province`/
   `DestinationType*` + 271 dòng dữ liệu) **đã được dựng và chạy sẵn từ
   trước** (không rõ lúc nào) — không phải làm lại từ đầu, chỉ còn thiếu
   đúng phần Phase A tạo ra:
   - Tạo bảng `v2.DestinationTag`/`DestinationTagMap` (database-redesign.md
     §3.2.1) + seed 7 tag đã duyệt (chỉ định nghĩa tag, CHƯA gán vào điểm đến
     nào — việc đó là Bước 1 quy trình AI-gán-duyệt ở destination-spec §2.4,
     cần UI, chưa build).
   - Sửa `v2.DestinationTypeMap`: gán Type cho 8/10 POI trước đó thiếu hẳn
     Type (Hà Tiên/Mũi Cà Mau giữ nguyên không ép Type theo đúng ghi chú
     Phase A); gỡ Type "Di tích lịch sử" gán sai cho Biệt thự Hằng Nga/Vịnh
     Hạ Long/Bãi đá cổ Sa Pa (Bãi đá cổ được gán thay bằng "Núi - Cao
     nguyên" vì nếu gỡ suông sẽ về 0 type). Kết quả: 239→247/271 điểm có
     `PrimaryTypeId`.
   - `UPDATE AddressNew/AddressOld` từ `dry-run-report-v2.csv` (Phase A bước 2) cho 235/271 dòng (114 match tự tin + 121 chấp nhận cấp tỉnh) — 36
     dòng "nhiều phường/xã trùng" CHỦ Ý để `AddressNew=NULL`, chờ người dùng
     xem tay từng dòng trước khi ghi (đúng quyết định đã chốt, không tự
     đoán ward có rủi ro sai).
   - Script SQL: `dichoithoi/scripts/address-migration/phase-b-0{1,2,3}-*.sql`
     (idempotent, có thể chạy lại an toàn — dùng `IF NOT EXISTS`/kiểm tra
     trước khi INSERT).
   - ✅ **XONG thêm (07/2026, vòng 3)** — `phase-b-04-fix-typemap-round2.sql`:
     rà lại TOÀN BỘ 246 điểm published (không chỉ nhóm "Di tích lịch sử"),
     sửa 5 ca gán sai/thiếu Type thêm (chi tiết: `dichoithoi-backlog.md` §A.8).
     `phase-b-05-standardize-format.sql`: chuẩn hoá format `AddressNew`/
     `AddressOld` (bỏ hậu tố "Việt Nam"/"Vietnam", "Tp." → "Thành phố", bỏ
     tiền tố "tỉnh " thừa) + sửa tay 2 ca dữ liệu sai (`bai-dai-phu-quoc`
     nhầm tỉnh Khánh Hòa↔Kiên Giang; `bao-tang-my-thuat-cung-dinh-hue` địa chỉ
     lặp cấu trúc "Thành phố Huế"/"Thừa Thiên–Huế"). Đã chạy + xác nhận
     idempotent trên `dichoithoi_dev`. Còn lại: 36 dòng "nhiều phường/xã
     trùng" vẫn để `AddressNew=NULL` (xem tay khi rảnh, không chặn gì) +
     áp dụng lên production (việc người dùng tự làm sau).
2. 🔄 **ĐANG LÀM (07/2026) — Website .NET đọc schema mới** (repo dichoithoi,
   song song). Khảo sát thực tế cho thấy đã v2-hoá SẴN 1 phần trước đây:
   `/loai/...` + `/tinh/{slug}` (100% v2), trang chi tiết `/diem-den/{slug}`
   (dữ liệu bổ sung — review/FAQ/gallery/hotel-tour/breadcrumb — đã đọc v2 qua
   `DestinationExtrasRepository`, nhưng field CHÍNH — Address/Type — vẫn đọc
   bảng v1 cũ). ✅ Đã làm xong đợt này: field `AddressNew`/`AddressOld` (output
   Phase A/B bước 1) nối vào `DestinationExtrasModel`/`DestinationExtrasRepository`,
   hiển thị đúng theo destination-spec §13.3 (địa chỉ mới làm chính, địa chỉ cũ
   chỉ hiện khi khác địa chỉ mới) trên `_QuickDecisionCard.cshtml` + JSON-LD
   (`SchemaUtil.cs`) — build sạch, test bằng dev server thật trên
   `dichoithoi_dev`, spot-check 2 điểm (Biệt thự Hằng Nga — không đổi, Hoàng Su
   Phì — Hà Giang→Tuyên Quang, hiện đúng cả 2 dòng).

   ✅ **Đợt 2 cùng ngày** — nối luôn `Types` (v2 `DestinationTypeMap` join
   `DestinationType`/`DestinationTypeGroup`) vào `DestinationExtrasModel`,
   thay CSV `Type` v1 ở 3 chỗ hiển thị trên trang chi tiết: chip loại (link
   thẳng `/loai/{groupSlug}/{typeSlug}` đã build sẵn, thay vì `/search?q=`
   không còn đúng nghĩa), JSON-LD `touristType`, và `firstType` dùng trong
   title/meta — đều fallback về CSV v1 khi điểm chưa có Type nào trong v2.
   **Kết quả trực tiếp nhìn thấy được**: kết quả rà taxonomy ở Phase A bước 1
   (gỡ "Di tích lịch sử" sai cho Biệt thự Hằng Nga) giờ mới thật sự hiện đúng
   trên web — trước đợt sửa này, dù đã sửa `DestinationTypeMap` trong DB, trang
   chi tiết vẫn hiện "Di tích lịch sử" vì đọc CSV `Type` v1 chưa đụng tới, hoàn
   toàn tách biệt với cột đã sửa. Test dev server thật: title đổi từ "...Di
   tích lịch sử" → "...Công trình kiến trúc", JSON-LD `touristType` đúng, chip
   link đúng `/loai/van-hoa-lich-su/cong-trinh-kien-truc`.

   ~~⚠️ Cố ý CHƯA đụng: logic sắp xếp "điểm liên quan" theo loại trùng nhau~~
   → ✅ **ĐÃ SỬA (đợt 4 cùng ngày)**. Sau đợt 3 migrate `DestinationRepository.cs`,
   vế ứng viên (`GetRelationDestinationAsync` → `ToShortModel`) đã tự động đổi
   sang đọc `TypeNames` từ v2 — khiến vế còn lại (`detail.Type`, CSV v1 từ
   `GetDetailAsync` chưa migrate) bị LỆCH "từ điển" so khớp thật sự (không
   còn là "để nguyên an toàn" như ghi chú cũ, mà đã thành bug sống). Sửa
   `DestinationController.cs`: dời fetch `extras` lên TRƯỚC khối tính
   "điểm liên quan", dùng `extras.Types` (v2, cùng vocabulary với candidate)
   thay `detail.Type` CSV khi so khớp `type1`/`type2`, fallback CSV nếu điểm
   chưa có Type nào ở v2. Build sạch, test dev server thật: `/diem-den/biet-
thu-hang-nga-dalat` (cụm Đà Lạt, 45 con → rơi đúng nhánh >9 ứng viên cần
   sắp xếp) trả về đúng 8 điểm liên quan hợp lệ, không lỗi.

   ✅ **Đợt 3 cùng ngày — migrate nốt phần "còn lại" nêu trên sang v2**:
   viết lại toàn bộ `DestinationRepository.cs` (`GetListAsync`,
   `GetChildDestinationAsync`, `GetRelationDestinationAsync`, `GetTopListAsync`,
   `GetDesForHotelAsync`) đọc từ `v2.Destination` + join `DestinationTypeMap`/
   `DestinationType` (thay CSV Type) — dùng lại đúng pattern cache-RAM đã có
   (`SEARCH_INDEX_CACHE_KEY`), tận dụng cột `NameUnaccented` đã precompute sẵn
   ở v2 thay vì tính lại. Quan hệ cha-con dùng `ParentId` (self-join) thay
   `DestinationGroupId` CSV cũ. `/diem-den` (list), `/search`, trang chủ (top
   list), `destination-sitemap.xml` (dùng chung `GetListAsync` nên tự động ăn
   theo, không cần sửa riêng), `/map`, cross-ref `/khach-san/{id}` — TẤT CẢ
   giờ đọc v2. Test dev server thật, tất cả trả 200 đúng dữ liệu (VD `/diem-den`
   hiện đúng 25 nhóm = 17 tỉnh + 8 cụm; sitemap ghi đúng 272 URL).

   Phát hiện + sửa 1 bug thật khi test (không phải do đợt sửa này gây ra —
   đã có sẵn từ trước): `MapController.Index` gọi `GetListAsync(null)` nhưng
   hàm không null-guard `param` trước khi truy cập `param.q` → NRE. Đã thêm
   `param = param ?? new DestinationListParameter();` (cùng pattern
   `DestinationController.Search` đã dùng).

   ⚠️ **Cố ý CHƯA đụng** (ngoài phạm vi hợp lý của đợt này):
   - `GetDetailAsync` — nội dung chính (Content/OpeningTime/TicketPrice/Food/
     Transport/Tip/Hotel/Phone) vẫn đọc `dbo.DestinationDetail` — CÓ THỂ
     migrate sang `v2.DestinationContent` (đã có field tương ứng đầy đủ,
     `ContentHtml`/`HotelText`...) nhưng là 1 đợt riêng, rủi ro cao hơn (nội
     dung hiển thị chính, không chỉ field phụ) — để dành khi cần.
     **Xác nhận rủi ro cụ thể (07/2026)**: so `LEN()` của `Content` (v1) vs
     `ContentHtml` (v2) trên mẫu 5 dòng + đếm coverage 271/271 cả 2 bên —
     giống hệt nhau (v2 là bản mirror copy của v1 từ lần migrate trước, chưa
     rõ thời điểm). NHƯNG `CmsDiChoiThoi.Service/Repositories/Destination/
DestinationRepository.cs` (CMS cũ) vẫn còn nguyên luồng import Google
     Sheet kiểu xoá-trắng-rồi-nạp-lại (`DeleteAllAsync`+`AddListAsync`+
     `AddDetailListAsync`) nhắm thẳng vào `dbo.Destination`/`DestinationDetail`
     (v1) — module Destination CMS cũ CHƯA tắt (kế hoạch tắt nằm ở Phase D
     mục 3, chưa tới). Nếu migrate `GetDetailAsync` sang v2 NGAY BÂY GIỜ:
     lần tới admin re-import từ Google Sheet qua CMS cũ sẽ ghi đè v1, v2
     đứng yên — website sẽ âm thầm hiện nội dung CŨ vĩnh viễn, không có lỗi
     nào báo hiệu. Kết luận: **giữ nguyên quyết định trì hoãn**, chỉ migrate
     khi module Destination CMS cũ đã tắt HOẶC M4 destination (Phase C) đã
     build xong và ghi thẳng vào v2 thay Google Sheet import.
   - Thiếu entity `V2DestinationRelation`/`V2SlugRedirect` — không cần tới vì
     dùng `ParentId` self-join thay thế được, nhưng nếu sau này muốn dùng
     đúng bảng quan hệ curated (`nearby`/`related`/`mentioned` — database-
     redesign §3.3) thì vẫn cần tạo 2 entity này.
   - ~~`/map` vẫn lỗi 500... bảng `Ad` KHÔNG tồn tại...~~ / ~~`/update-sitemap`
     lỗi 500 vì bảng `Phuot`...~~ → ✅ **ĐÃ XOÁ HẲN (đợt 5, theo yêu cầu người
     dùng "xóa Ad với phượt đi")**. Xác nhận phạm vi trước khi làm (AskUser-
     Question): người dùng chọn xoá hẳn khỏi code (không chỉ tắt 2 route lỗi),
     vì khảo sát cho thấy Ad/Phuot đang chạy thật trên nhiều trang khác
     (`/blog`, `/phuot`) — không phải code chết, tắt 2 chỗ lẻ tẻ sẽ để sót
     `/blog`+`/phuot` vẫn 500 cùng lỗi. Đã gỡ toàn bộ 2 tính năng khỏi
     `DiChoiThoi.Web`/`DiChoiThoi.Service`/`DiChoiThoi.Common` (entity,
     repository, service, model, parameter, enum, `AdUtils`, `_Ad.cshtml`,
     `PhuotController` + view, DI ở `Program.cs`, `DbSet`/modelBuilder ở
     `DiChoiThoiDbContext`/`TestDbContext`, nav link Footer, breadcrumb util,
     cache key) — build gặp lỗi vì `CmsDiChoiThoi.*` (CMS admin, project khác
     trong cùng solution) cũng tham chiếu entity `Phuot`/`PhuotDetail` (module
     quản lý Phượt qua Google Sheet import) nên phải gỡ tiếp bên đó để cả
     solution build sạch (không có Ad trong CMS, chỉ Phuot). Tiện thể sửa 1
     bug copy-paste có sẵn từ trước lộ ra khi gỡ: `CmsDiChoiThoi.Web/Views/
Tour/Index.cshtml` có form search trỏ nhầm `asp-controller="Phuot"` (đáng
     lẽ "Tour") và include nhầm bundle JS `phuotList.js` — sửa cả hai vì nếu
     không sẽ vỡ khi Phuot bị xoá. Build cả `dichoithoi.sln` sạch (0 lỗi), test
     dev server thật: `/map`, `/map/{slug}`, `/update-sitemap`, `/diem-den`,
     trang chủ đều 200. Phát hiện thêm khi test `/blog`: lỗi 500 `Invalid
object name 'Post'` — bảng `Post`/`PostDetail` (nội dung blog cũ) CŨNG
     không tồn tại trong `dichoithoi_dev`, CÙNG loại gap script clone như
     Ad/Phuot trước đây, không liên quan tới đợt xoá này — để ngoài phạm vi,
     ghi nhận thêm vào danh sách gap của `pnpm clone:dichoithoi`.

**Phase C — CMS zinoflow (các module, theo thứ tự phụ thuộc):**

⚠️ **SỬA LẠI TOÀN BỘ (07/2026)** — mục này TỪNG ghi "chưa xây", nhưng đó là
SAI: audit code thật (`apps/api/src/modules/*`, `apps/web/src/app/dichoithoi/*`,
git log) cho thấy phần lớn đã build xong từ trước (M4 Phase A/B/C, Phase
12-20 trong `dichoithoi-implementation-plan.md`) — tài liệu Phase C này chỉ
đơn giản KHÔNG được cập nhật sau khi việc đã xong (giống 2 lần phát hiện
tương tự trước đó trong phiên này: schema v2 "đã migrate từ trước", note
"người dùng tự làm" sai). **Từ nay coi `dichoithoi-implementation-plan.md`
(Phase 0-20, có gắn nhãn "ĐÃ XONG 07/2026") là nguồn sự thật cho "cái gì đã
xong", KHÔNG dùng mục Phase C này nữa.** Giữ lại bảng dưới chỉ để tra cứu
lịch sử + 2 gap thật còn sót:

| #   | Việc                                                                         | Trạng thái thật (audit 07/2026)                                                                                                                                                        |
| --- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | M4 destination: mirror + generate + review + publisher                       | ✅ XONG — `publish-destination.usecase.ts` UPSERT thẳng vào `v2.Destination`/`DestinationContent` qua `mssql-site-db.adapter.ts`, có auto-link + cache purge + RelatedJson.            |
| 2   | Affiliate link conversion trước/cùng Hotel/Tour                              | ✅ XONG — module `affiliate/` đầy đủ, Hotel/Tour upsert gọi `ResolveAffiliateLinkUseCase` khi lưu.                                                                                     |
| 3   | Hotel+Tour+Product kèm pipeline ảnh (sharp/FTP) + import Google Sheet        | ✅ **XONG (07/2026, đợt tự động)** — pipeline ảnh + Sheet import (dry-run/upsert/fallback) VÀ trang web UI paste-link-Sheet cho cả 3 module đều đã build. Xem chi tiết ngay dưới bảng. |
| 4   | "Viết tay thủ công" (`sourceType=Manual`) trong `ai-content`                 | ✅ XONG — `create-manual-draft.usecase.ts`, đi qua đủ gate review/publish như bài AI.                                                                                                  |
| 5   | Article: khối động + publisher + auto-link engine DÙNG CHUNG với destination | ✅ **XONG (07/2026, đợt tự động)** — xem chi tiết ngay dưới bảng.                                                                                                                      |
| 6   | UI Chủ đề (tag) + Coverage Score                                             | ✅ **XONG (07/2026, đợt tự động)** — xem chi tiết ngay dưới bảng. Flight/Bus vẫn CHƯA XÂY (lý do dưới, spec tự ghi chưa chốt).                                                         |
| 7   | Khối "Việc cần làm" trên hub                                                 | ✅ XONG — `dashboard-home.tsx` có block `Card title="Việc cần làm"` + `get-dashboard-summary.usecase.ts`.                                                                              |

**✅ Mục 5 — Auto-link Article (07/2026, tự động, không cần hỏi lại):**
`shared/text/auto-link.ts` (dọn từ `destination/domain/auto-link.ts`, dùng
chung 100% — không 2 bản sao) nối vào `PublishArticleUseCase` và
`RefreshDynamicBlocksUseCase` qua `ArticleAutoLinkService`
(`article/application/services/article-auto-link.service.ts`, inject
`DESTINATION_MIRROR_REPOSITORY` lấy danh sách điểm đến đã publish làm target).
Bài cẩm nang giờ tự chèn link nội bộ tới điểm đến được nhắc trong thân bài,
cùng engine/quy tắc với `publish-destination.usecase.ts`/`relink-all.usecase.ts`.
Build + test sạch (`article-auto-link.service.spec.ts` — 2 case: có link, bỏ
qua điểm chưa publish).

**🔄 Mục 3 — Pipeline ảnh Hotel/Tour/Product (07/2026, tự động — nửa đầu xong):**

- ✅ Đã xây: pipeline ảnh dùng chung (`shared/media/` — dọn từ `destination/`:
  `image-processor.port.ts`/`SharpImageProcessor`, `image-uploader.port.ts`/
  `FtpsImageUploader` nay nhận thêm `baseDirEnvVar` để mỗi module dùng 1 thư
  mục FTP gốc riêng — biến mới `DICHOITHOI_FTP_{HOTEL,TOUR,PRODUCT}_BASE_DIR`,
  không đổi hành vi cũ của destination). Thêm
  `IngestExternalImageUseCase` (`shared/media/application/`) — tải ảnh URL
  ngoài (Booking/Agoda/Shopee...) → validate content-type/kích thước → resize
  3 cỡ WebP → FTP, đúng destination-spec §14.5. Nối vào `UpsertHotelUseCase`/
  `UpsertTourUseCase`/`UpsertProductUseCase`: `thumbnailUrl`/`images` là URL
  http(s) thì tự ingest và thay bằng path nội bộ, giữ URL gốc ở cột mới
  `thumbnailSourceUrl`/`imageSourceUrls` (migration
  `1782000000000-HotelTourProductImageSourceUrls.ts`). Ingest lỗi → log cảnh
  báo + giữ tạm URL ngoài, KHÔNG chặn lưu bản ghi (never-block, đúng tinh
  thần "MVP trước" của hotel-spec/tour-spec §7). Test: `upsert-hotel.usecase.
spec.ts` (3 case: ingest thành công/bỏ qua path nội bộ/ingest lỗi vẫn lưu
  được) + `ingest-external-image.usecase.spec.ts` (4 case biên: HTTP lỗi,
  sai content-type, ảnh quá nhỏ, thành công). Toàn bộ 266 test + typecheck
  API/web sạch.
  - Tour/Product áp y hệt logic Hotel (cùng pattern).
- ✅ **Đã xây tiếp (07/2026, cùng đợt tự động) — backend Sheet import cho cả
  3 module, theo đúng product-spec §5.1**:
  - `SHEET_CSV_FETCHER`/`GoogleSheetCsvFetcher` dọn từ `destination/` sang
    `shared/sheet-import/` (generic, không đổi hành vi — chỉ đổi vị trí file
    để Hotel/Tour/Product dùng chung mà không phải import cả `DestinationModule`
    nặng nề, riêng Product vốn không phụ thuộc Destination).
  - `shared/sheet-import/import-matcher.ts` (`matchImportRow` + test) — hàm
    thuần so khớp: `sourceUrl` trùng → `update`; không trùng nhưng
    tên-chuẩn-hoá + tỉnh trùng → `needsConfirm` (không tự ghi đè); không
    trùng gì → `create`. **Chỉ áp dụng khoá phụ cho Hotel/Tour** — Product
    CHỦ Ý bỏ qua khoá phụ (chỉ so `sourceUrl`) vì spec §5.1 chỉ ghi
    "áp dụng chung cho Hotel/Tour", sản phẩm không có địa lý để phân biệt,
    trùng tên hoàn toàn không đủ chắc chắn để tự gợi ý gộp — tránh gộp nhầm
    2 sản phẩm khác nhau cùng tên.
  - `ImportHotelsUseCase`/`ImportToursUseCase`/`ImportProductsUseCase` +
    contracts (`import{Hotels,Tours,Products}RequestSchema`/`...ResultSchema`
    trong `packages/contracts`) + endpoint `POST /hotels|tours|products/
{fetch-sheet,import}` — cùng hình dạng response với destination (dry-run
    trả báo cáo create/update/needsConfirm/lỗi từng dòng, `dryRun=false` mới
    ghi thật; dòng `needsConfirm` CHỈ ghi khi client gửi kèm
    `confirmMergeIds[sourceUrl] = matchedId` đúng — không bao giờ âm thầm ghi
    đè bản ghi nhập tay trước đó). Test: `import-hotels.usecase.spec.ts` (4
    case) + `import-tours.usecase.spec.ts` (2 case) + `import-products.
usecase.spec.ts` (2 case) + `import-matcher.spec.ts` (4 case). Toàn bộ
    278 test + typecheck API/web sạch.
- ✅ **XONG (07/2026, cùng đợt tự động) — trang web UI paste-link-Sheet cho cả
  3 module**: `apps/web/src/app/dichoithoi/{khach-san,tour,san-pham}/nhap/
page.tsx` — dán link Google Sheet (hoặc CSV/JSON), gọi `POST .../fetch-sheet`
  rồi `POST .../import` với `dryRun:true` để xem trước từng dòng (badge Tạo
  mới/Cập nhật/Cần xác nhận + lý do), tick xác nhận riêng cho dòng
  `needsConfirm` (Hotel/Tour) rồi mới `dryRun:false` ghi thật — không bao giờ
  tự động gộp khi chưa tick. Product bỏ nhánh `needsConfirm` (đúng thiết kế
  backend). Phần parse CSV/JSON dùng chung qua
  `features/dichoithoi/sheet-import-csv.ts` (tách từ trang import destination
  có sẵn, tránh copy 3 lần), phần field/preview riêng từng module do khác
  field. Thêm link "Nhập từ Sheet →" trên 3 trang danh sách + route mới. Web
  typecheck + lint sạch.

**✅ Mục 6 — UI Chủ đề (tag) (07/2026, tự động, không cần hỏi lại):**
Xây đủ 3 bước destination-spec §2.4, đọc/ghi thẳng SQL Server (bảng
`v2.DestinationTag`/`DestinationTagMap` đã tạo + seed 7 tag từ trước qua
`phase-b-01-seed-tags.sql` — không cần mirror Postgres riêng, giống pattern
taxonomy group/type/province).

- Contracts: `packages/contracts/src/dichoithoi/destination-tag.ts` (tag,
  suggestion, apply, reverse-check, generate/update description).
- `dichoithoi-site-db.port.ts` + `mssql-site-db.adapter.ts` thêm
  `fetchTags`/`fetchTagAssignments`/`replaceTagAssignments`/
  `updateTagDescription`.
- **Bổ sung 23/07/2026 — CRUD tag ngay trong CMS**: form tạo tag mới (slug
  kebab-case + tên), sửa tên inline, nút bật/tắt `Status`, xoá tag (use case
  chặn xoá bằng `countTagUsage` đếm trên MỌI điểm đến kể cả chưa published —
  KHÔNG dùng `fetchTagAssignments` vì nó chỉ lấy điểm Status=1, đếm thiếu).
  Ý nghĩa `Status` đã chốt: 1 = trang public `/chu-de/{slug}` mở, 0 = site
  trả 404 (TopicController); AI gợi ý/rà soát dùng MỌI tag bất kể Status —
  đúng quy trình "gán tag trước, đủ điểm rồi mới mở trang". Unit test
  create/delete đã có.
- Buoc 1 — `SuggestTagAssignmentsUseCase`: AI (Haiku, đi qua
  `IContentAIProvider` như mọi call AI khác) gợi ý tag cho các điểm CHƯA có
  tag nào (hoặc danh sách chỉ định), kèm `reasoning` 1 câu; lọc bỏ mọi
  slug tag/điểm đến AI bịa ra không có thật trước khi trả về — CHỈ gợi ý,
  không ghi DB.
- `ApplyTagAssignmentsUseCase`: ghi đè toàn bộ tag của từng điểm sau khi
  người dùng tick duyệt/bỏ trên UI.
- Buoc 2 — `ReverseCheckTagAssignmentsUseCase`: 2 loại phát hiện — "dưới
  ngưỡng" tính thuần (tag có <3 điểm gán, không cần AI) + "có thể gán sai"
  do AI đọc lại toàn bộ gán-tag hiện tại và chỉ ra cặp nghi ngờ (lọc bỏ cặp
  AI bịa không tồn tại thật).
- Buoc 3 — `GenerateTagDescriptionUseCase`: tái dùng `IContentAIProvider`
  soạn đoạn giới thiệu cho `/chu-de/{slug}`, CHỈ trả gợi ý; `UpdateTagDescriptionUseCase`
  lưu sau khi người dùng duyệt/sửa tay (cùng pattern `ManageTaxonomyContentUseCase`).
- Trang web `apps/web/src/app/dichoithoi/chu-de/page.tsx` (thêm mục sidebar
  "Chủ đề"): 4 khối — danh sách 7 tag (sửa/AI soạn mô tả), gợi ý AI hàng loạt
  kèm tick duyệt từng tag/điểm trước khi áp dụng, chạy rà soát ngược hiển thị
  badge theo mức độ, bảng tag đang gán (tham khảo).
- Test: 5 file usecase mới (10 test case) — toàn bộ 42 suite/288 test +
  typecheck API/web sạch.

**✅ Coverage Score (07/2026, tự động, không cần hỏi lại):** destination-spec
§2.2.2 tự ghi "trọng số/ngưỡng chốt lúc build, không chốt cứng ở spec" — nên
xây thẳng thay vì hỏi lại. Phạm vi ĐÃ làm (dùng đúng dữ liệu có thật trong
code, không bịa schema mới):

- Domain thuần `destination/domain/coverage-score.ts` (`computeCoverageScore`)
  — 10 mục checklist chung (địa chỉ/toạ độ/ảnh/nội dung chính/giờ mở cửa/giá
  vé/FAQ/mẹo thực tế/link vé/chủ đề) + 1 mục riêng tier "flagship" (có điểm
  con `IsFeatured`). Test 5 case.
- `mssql-site-db.adapter.ts` thêm `fetchContentCoverageRows()` — 1 câu SQL
  tính sẵn cờ cho TẤT CẢ điểm đã published (tránh N+1 query trên ~271 điểm).
- `GetCoverageScoresUseCase` gộp mirror Postgres (địa chỉ/toạ độ/ảnh/tag qua
  `fetchTagAssignments` đã có từ Tag UI/con `IsFeatured`) + cờ content SQL
  Server, tính điểm % cho từng điểm, sắp xếp điểm thấp trước (ưu tiên bổ
  sung). Endpoint `GET /destinations/coverage-scores`. Test 2 case.
- Trang web `apps/web/.../dichoithoi/do-phu` (thêm mục sidebar "Độ phủ nội
  dung") — danh sách badge % (đỏ/vàng/xanh theo mức), bấm mở rộng xem
  checklist ✅/⚠️ từng mục.
- ✅ **Phạm vi trước đây "CHỦ Ý CẮT BỚT" — ĐÃ LẤP ĐỦ (Phase 28.6, 07/2026)**:
  `coverage-score.ts` nay dùng cột `contentTier` THẬT (Phase 25) thay vì
  proxy qua `kind`; 2 mục Flagship-only từng ghi "chưa tính được" nay đã có
  hạ tầng: "độ phủ bài cẩm nang theo topic" tính từ `ArticleDestinationMap`
  (Phase 26), "đánh giá biên tập + external review" tính từ Phase 28.0.
  "Lịch trình gợi ý" không còn là mục checklist riêng — gộp vào
  `blockKey: "lich-trinh"` trong `sections[]`, tính chung với "main-content"
  như mọi khối khác thay vì cần 1 field JSON riêng.
- Test: 44 suite/295 test + typecheck/lint API+web sạch.

**❌ Flight/Bus — CHƯA làm (07/2026, quyết định có chủ ý, không phải quên):**
`dichoithoi-flight-spec.md`/`dichoithoi-bus-spec.md` tự ghi banner "⚠️ đây là
tài liệu PHÂN TÍCH — chưa chốt để build". Xây mù 1 thiết kế DB/UI cho thứ
chính spec của nó nói "chưa chốt" thì rủi ro làm sai hướng người dùng thật sự
muốn — để nguyên, chờ người dùng xem lại và chốt spec trước khi có đợt code
tiếp theo.

**Phase D — Website .NET (routes/views mới):**

1. Route/view: ~~Article `/blog/`~~, `/chu-de/{slug}`, khối Flight/Bus trên
   detail — ưu tiên theo SEO ROI (landing loại/tỉnh đã build Phase 18).
   **Sửa lại (07/2026)**: mục "`/blog/`" trong dòng này bị SAI — website đã có
   sẵn hệ bài cẩm nang v2 tại `/cam-nang/{slug}` (`ArticleController.cs`,
   entity `V2Article`), không phải `/blog` (đó là route legacy v1
   `BlogController` vẫn còn sống, không liên quan). Không tạo route `/blog`
   mới đè lên route legacy đang chạy.
   - ✅ **`/chu-de/{slug}` XONG (07/2026, đợt tự động)** — mirror đúng pattern
     `/tinh/{slug}` đã có (`ProvinceController`/`IDestinationTaxonomyService`/
     `IDestinationTaxonomyRepository`): thêm entity `V2DestinationTag`/
     `V2DestinationTagMap` (EF, đọc SQL Server, KHÔNG ghi — zinoflow ghi qua
     `mssql-site-db.adapter.ts`), `TopicDetailPageModel`, `GetTopicPageAsync`
     trong repo/service có sẵn (không tạo interface mới), `TopicController`
     (`Controllers/TopicController.cs`) + view `Views/Topic/Detail.cshtml`
     (dùng lại `_DestinationCardList`/`_Pagination` partial). Gate SEO đúng
     database-redesign §3.2.1: `Status != 1` → 404 (tag chưa duyệt/chưa mở);
     `Status == 1` nhưng thiếu `Description` HOẶC < 5 điểm gán → vẫn hiện
     trang bình thường nhưng thêm `noindex` (dùng `PageInfo.NoIndex` có sẵn,
     không phải cơ chế mới). `dotnet build` sạch (0 lỗi CS — chỉ có lỗi copy
     file do 1 tiến trình `DiChoiThoi.Web` cũ đang chạy giữ khoá DLL, không
     liên quan code, tắt tiến trình đó rồi build lại là hết).
   - **CHỦ Ý CHƯA làm**: (a) link "Chủ đề" trong mega-menu/footer — hoãn vì
     tag hiện chưa có điểm nào được gán qua Tag UI, đưa link vào menu chính
     lúc trang còn rỗng/`noindex` không có lợi, nên bật SAU khi đã gán tag
     thật; (b) chip tag trên trang chi tiết điểm đến (destination-spec §2.4
     có nhắc) — cần sửa `DestinationDetailModel`/`DestinationController`/
     repository liên quan, phạm vi lớn hơn 1 trang mới nên tách việc riêng;
     (c) khối Flight/Bus trên trang chi tiết — vẫn chờ chốt spec như đã ghi.
2. Faceted search — hợp nhất `/diem-den` + `/search` (§9.3): đợt 1 facet
   Tỉnh/Khu vực/Loại; facet Chủ đề bật khi tag đã seed.
   **✅ Phần lõi XONG (07/2026, đợt tự động)** — `DestinationController.Index`
   (`/diem-den`) nay là trang Khám phá duy nhất: `q` + 3 facet Tỉnh/thành,
   Khu vực (cụm — node `Kind=Cluster`), Loại (OR trong nhóm, VÀ giữa nhóm),
   đếm số cạnh từng lựa chọn (tính theo điều kiện các nhóm KHÁC đang chọn,
   đúng ngữ nghĩa faceted search chuẩn), chip đã-chọn + "Xoá hết", banner
   "Xem trang đầy đủ" khi chọn đúng 1 facet Tỉnh hoặc Khu vực, phân trang
   (`_Pagination.cshtml` sửa để nối `&trang=` khi base path đã có query
   string — sửa chung, không hỏng các trang cũ vốn không có query string).
   `/search` → 301 sang `/diem-den` giữ nguyên querystring (dọn luôn bug `q`
   rỗng bỏ dở cũ). SEO: không tham số = index bình thường; có
   `q`/facet = `noindex, follow`. Mở rộng search-index thêm tỉnh + địa chỉ
   không dấu (sửa lỗi "gõ Lâm Đồng bị trượt"). Đã test qua HTTP thật (dry-run
   dev server, không phải chỉ đọc code): lọc 1 facet, lọc 2 facet cùng lúc
   (AND đúng), banner single-facet, noindex, `/search` redirect, phân trang
   giữ facet, `/map`/`/tinh/{slug}` (dùng chung search-index) không bị ảnh
   hưởng — đều đúng. `dotnet build` toàn solution sạch.
   **Đợt 2 — ĐÃ XONG (a)-(d), xem chi tiết đầy đủ ở mục "SEO/UX đi kèm" §C
   bên dưới** (autocomplete header, banner Loại, live client-side instant
   filter, bottom-sheet mobile thật). Chỉ còn (e) facet Chủ đề (tag) — đợi
   tag được gán qua Tag UI trước, đúng như spec ghi.
3. Tắt module Destination + Hotel + Tour trên CMS cũ. ❌ CHƯA làm — đây là
   việc tắt chức năng admin đang chạy thật (`CmsDiChoiThoi.Web`), nên hỏi lại
   trước khi làm thay vì tự ý tắt.

**Phase E — PILOT kiểm thử end-to-end: Đà Lạt (Flagship) + Biệt Thự Hằng Nga
(POI) với FULL dữ liệu** (yêu cầu 07/2026 — chạy SAU khi Phase B-D xong;
người dùng sẽ RA LỆNH khi tới lúc, không tự khởi động). Mục tiêu: 2 trang
mẫu đầy đủ mọi khối đã thiết kế (article gắn topic, vé xe/máy bay,
hotel/tour/product, tag chủ đề, coverage score đạt ngưỡng...) để duyệt chất
lượng trước khi scale. Claude làm giúp, KHÔNG cần người dùng tự tạo/tự viết:
a. **Rà + tự tạo dữ liệu còn thiếu** cho 2 điểm: chạy checklist Coverage
Score (destination-spec §2.2.2), field nào thiếu thì Claude tự điền
bằng suy luận + tra cứu thật — field SỰ THẬT (giá vé, giờ mở cửa,
địa chỉ, SĐT) phải lấy từ nguồn thật (website chính thức qua cơ chế
§2.2.1, Google Maps), KHÔNG bịa; field nội dung (mô tả, ghi chú tham
khảo) dùng kiến thức thật của Claude. Mọi thứ ghi ở trạng thái
nháp/chờ duyệt.
b. **Viết sẵn bộ bài cẩm nang mặc định** cho 2 điểm (đủ các topic
article-spec §8.1: lịch trình, ẩm thực, quà lưu niệm, buổi tối,
poi-guide...) qua pipeline ai-content → dừng ở trạng thái CHỜ DUYỆT,
người dùng chỉ việc review/sửa/approve — không tự publish.
c. **Ảnh còn thiếu: tự tìm → tải → cập nhật**, NHƯNG chỉ từ nguồn giấy
phép an toàn (Wikimedia Commons, Flickr CC, Unsplash... — ghi rõ
nguồn + license vào caption/credit `destination_images` §14.4);
KHÔNG lấy ảnh bản quyền báo chí/blog cá nhân. Ảnh nào không tìm được
nguồn sạch → liệt kê ra cho người dùng tự chụp/tự tạo. Ảnh vào DB ở
trạng thái chờ duyệt trước khi lên web.
d. Kết thúc pilot: báo cáo 2 trang đạt bao nhiêu % coverage, mục nào
còn chờ người dùng quyết — làm chuẩn mẫu (playbook) để scale các
điểm còn lại.

**Phase F — Scale sau pilot**: trước khi nhân rộng playbook ra các điểm còn
lại, build **gate "originality"** (mục 0 đầu tài liệu — so trùng lặp nội bộ
giữa các bài cùng loại/tỉnh) — pilot 2 trang chưa cần, scale hàng trăm trang
thì bắt buộc, đúng rủi ro "scaled content abuse" đã phân tích.

**SEO/UX đi kèm** (`content-seo-ux-plan.md` §7, đã sắp ưu tiên — cập nhật
23/07/2026: đã bỏ 3 mục hoá ra đã xong/không còn áp dụng khỏi danh sách gốc,
xem lý do ở trên): ~~bật lại Review/Rating + JSON-LD AggregateRating~~
(KHÔNG áp dụng — Phase 9 đã CHỦ Ý gỡ vĩnh viễn theo chính sách Google, xem
mục "`DestinationReview`" ở trên, không phải việc đang chờ làm); ~~render
FAQ + JSON-LD FAQPage~~ (✅ đã có, `SchemaUtil.cs`/`Detail.cshtml`); ~~render
`ticketLinks[]` thành nhiều nút~~ (✅ đã có, `_QuickDecisionCard.cshtml`).
~~trang landing Loại+Tỉnh~~ (✅ đã có từ lâu — `DestinationTypeController`
`/loai`, `/loai/{group}[/{type}]`; `ProvinceController` `/tinh/{slug}`);
~~SSR khối khách sạn/tour giữa bài (không AJAX)~~ (✅ đã có —
`Detail.cshtml` render thẳng `_HotelCardList.cshtml`/`_TourCardList.cshtml`
qua `Html.PartialAsync`, không phải AJAX). → **Toàn bộ mục "Cao" của §7 đã
xong, không còn gì mở ở mức ưu tiên này.**

- Trung bình: ~~gallery ảnh (`GalleryJson` + bảng `destination_images`)~~
  (✅ đã có, `Detail.cshtml` đọc `extras.Gallery` cho hero + lightbox);
  ~~`rel=sponsored`~~ (✅ đã có trên mọi link affiliate — hotel/tour/vé/sản
  phẩm). Còn mở thật: bản đồ nhúng (site hiện chỉ có nút "Xem trên Google
  Maps"/"Chỉ đường" mở tab ngoài, KHÔNG có iframe nhúng tại chỗ); disclosure
  (chưa xác nhận lại, giữ nguyên).
- Sau: mini lịch trình; so sánh giá tại quầy vs online; sitemap.xml + Search
  Console; critical CSS cho LCP; phân trang `/diem-den` có URL riêng từng trang.
- **Faceted search — hợp nhất `/diem-den` + `/search` thành trang Khám phá**
  (CHỐT 07/2026, thiết kế đầy đủ `content-seo-ux-plan.md` §9.3): facet
  Tỉnh/Khu vực/Loại (+Chủ đề đợt 2), tick nhiều — OR trong nhóm, AND giữa
  nhóm, đếm số sống, lọc client-side tức thì, autocomplete header,
  `/search` 301 về `/diem-den?q=`; có tham số = noindex. Repo dichoithoi (.NET).
  **Cập nhật 07/2026 — đợt 2 ĐÃ HOÀN TẤT TOÀN BỘ (trừ facet Chủ đề chờ dữ liệu)**:
  - ✅ Autocomplete header: `GET /api/search-suggest?q=` (tái dùng search-index
    RAM có sẵn), dropdown JS thuần (`nav.ts`, debounce 250ms, phím mũi tên/
    Enter/Escape, bấm ra ngoài đóng) tối đa 8 gợi ý (tên+tỉnh+loại+thumbnail),
    bấm 1 dòng đi thẳng `/diem-den/{slug}`, dòng cuối "Xem tất cả kết quả →"
    mới đổ về `/diem-den?q=`. Đã smoke-test qua Playwright (dropdown hiện đúng,
    click điều hướng đúng, không còn lỗi 404 ảnh — bug thumbnail thiếu tiền tố
    `/diem-den/thumbnail/` phát hiện + sửa ngay lúc test bằng trình duyệt thật).
  - ✅ Banner landing cho facet Loại đơn lẻ: `DestinationService.GetFacetedSearchAsync`
    tra `GroupSlug` qua `ITaxonomyService.GetAllTypesAsync()` (đã cache sẵn từ
    Phase 18.0, không thêm query) để tính `/loai/{group}/{type}` — trước đây
    chỉ có Tỉnh/Khu vực có banner, thiếu Loại. Verify qua curl thật:
    `?loai=thac-ho-suoi` → banner `/loai/thien-nhien/thac-ho-suoi` (200 OK).
  - ✅ **Cập nhật tiếp (đợt 2, phần 2/2 — cũng đã xong)**: live client-side
    instant filter + mobile bottom-sheet thật.
    - `GET /api/diem-den/facet-index?q=` trả index JSON CHỈ điểm lẻ (Poi) đã
      lọc sẵn theo `q` hiện tại (client không cần biết logic bỏ dấu — 1 nguồn
      thật duy nhất cho "thế nào là khớp q" vẫn là `MatchesKeyword` phía
      server); client chỉ so khớp slug Tỉnh/Khu vực/Loại (OR trong nhóm, AND
      giữa nhóm — y hệt `GetFacetedSearchAsync`).
    - `destination.ts` (bundle mới, trước đây tồn tại nhưng KHÔNG được nạp ở
      trang nào — chỉ import 1 file scss Bootstrap chết, đã bỏ): tick facet
      lọc tức thì (grid + đếm số cạnh + chip + phân trang đều cập nhật không
      reload), đồng bộ URL qua `history.pushState` (back/forward hoạt động
      đúng — đã test qua Playwright), tiến cường dần đúng nghĩa (mọi link vẫn
      là `<a href>` thật tính sẵn ở server, JS tắt vẫn điều hướng đúng).
    - Bottom-sheet mobile thật thay `<details>`: trượt lên từ dưới, nút chốt
      dính đáy ghi số sống "Xem N kết quả" (cập nhật live theo tick), tái
      dùng `wireOverlay` (tách từ `nav.ts` sang `overlay.ts` dùng chung).
    - Banner landing 1-facet-đơn-lẻ: ẩn ngay khi có tương tác JS (không cố
      tính lại phía client vì facet Loại cần thêm `GroupSlug` không có trong
      index nhẹ) — chỉ hiện đúng lúc SSR ban đầu, tránh hiện link sai/lệch.
    - **Bug thật phát hiện + sửa lúc test bằng Playwright**: chip bị dính dư
      ký hiệu "✕" tích luỹ dần sau mỗi lần tick (2 lần tick → "Tên ✕ ✕ ✕") —
      do chip cũng mang `data-facet-group`/`data-facet-slug` (để tái dùng
      logic toggle khi bấm xoá chip), nên hàm đọc tên gốc `labelFor()` +
      `updateGroupCounts()` lỡ khớp nhầm vào CHÍNH chip thay vì mục facet-list
      gốc. Sửa bằng cách giới hạn 2 hàm này chỉ tìm trong khối
      `[data-facet-group-block]` (sidebar/sheet), không đụng tới chip.
    - Verify: `dotnet build` sạch, `npm run prod` sạch, test qua Playwright
      trên dev server thật (dev DB) — tick tỉnh/loại cùng lúc (AND đúng, kể cả
      case 1 điểm có NHIỀU tag loại như Thác Prenn vừa "Sông-Suối-Hồ-Thác" vừa
      "Check-in sống ảo"), thứ tự kết quả client khớp 100% với SSR cùng bộ
      lọc, phân trang client + nút back trình duyệt khôi phục đúng trạng
      thái, bottom-sheet mobile (viewport 390×844) hoạt động đúng.
  - Facet Chủ đề vẫn chờ tag được gán qua Tag UI (không đổi so với trước) —
    đây là phần DUY NHẤT còn lại của toàn bộ faceted-search đợt 2.

## C) Rủi ro/lưu ý vận hành (không phải task, nhưng đừng quên)

0. ⚠️ **Checklist đầy đủ khi release lên production**: xem
   `docs/dichoithoi/dichoithoi-release-checklist.md` (07/2026) — chiến lược
   đã chốt là XOÁ SẠCH production + đưa nguyên code/database mới từ local
   lên (không migrate-tại-chỗ như `dichoithoi-golive-runbook.md` mô tả, file
   đó giờ chỉ còn là tài liệu tham khảo). Checklist gồm: chuẩn bị/backup
   trước khi xoá, thao tác đưa code+DB lên, smoke test, SEO tổng quát, đo tốc
   độ, rà data, theo dõi sau release.
1. ⚠️ **Sau go-live phải khoá nút import Destination + Hotel + Tour trên CMS
   cũ** — tránh wipe dữ liệu AI tool vừa ghi (destination-spec §9.2,
   system-overview §1).
2. Encoding tiếng Việt khi ghi `nvarchar` qua driver `mssql` — test sớm 1
   record thật trước khi ghi hàng loạt (destination-spec §9.3).
3. Backup 2 bảng gốc trước lần publish thật đầu tiên (destination-spec §8,
   system-overview §6.4).
4. Dev/test hằng ngày dùng LocalDB clone (`dichoithoi_dev`), KHÔNG trỏ thẳng
   production — script `pnpm clone:dichoithoi` đã có sẵn (system-overview §6.6).
5. Cào dữ liệu khách sạn/tour: ưu tiên API/affiliate feed chính thức nếu nhà
   cung cấp có, tần suất thấp nếu phải cào HTML — rủi ro ToS là quyết định
   kinh doanh của bạn, không phải giới hạn kỹ thuật (hotel-spec §1, tour-spec §1).
6. ⚠️ **`v2.SlugRedirect` cần mở rộng trước khi dùng cho redirect release
   (làm sát lúc release, không cần gấp bây giờ)** — bảng hiện có
   (`DiChoiThoi.Common/DbEntities/V2/V2SlugRedirect.cs`, Phase 24 07/2026)
   chỉ hỗ trợ case "đổi slug tại chỗ của 1 điểm đến vẫn tồn tại"
   (`OldSlug` → `DestinationId` bắt buộc, non-nullable). Không khớp nhu cầu
   redirect khi release (xoá sạch production + đưa DB mới — xem
   `dichoithoi-release-checklist.md` mục 1 + mục 3 "So DB cũ vs DB mới"):
   - `DestinationId` cũ trong backup không còn ý nghĩa gì ở DB mới (ID sinh
     lại) — không thể copy thẳng bảng cũ, phải build lại từ so sánh DB.
   - Case "điểm đến đã gộp/xoá, redirect về trang tỉnh/danh mục gần nhất"
     (đã chốt khi phân tích 27/07/2026) không map được vào 1 `DestinationId`
     cụ thể — bảng cần thêm cột đích redirect không bắt buộc là 1 điểm đến
     (ví dụ `RedirectUrl` nullable, đổi `DestinationId` thành nullable, ưu
     tiên `DestinationId` nếu có).
   - `DestinationController.Detail` (`DiChoiThoi.Web/Controllers/DestinationController.cs`
     dòng ~140-154) và `DestinationExtrasRepository.FindRedirectSlugAsync`
     cũng cần sửa theo cho khớp cột mới.

7. ⚠️ **Còn 7 view khác dùng đúng pattern hardcode thumbnail bị lỗi vừa fix ở
   `/diem-den` (29/07/2026)** — `src="/diem-den/thumbnail/{slug}.webp"`,
   bỏ qua hẳn cột `Thumbnail` thật, chỉ đúng cho ảnh flat kiểu cũ (v1).
   Điểm đến tạo qua luồng Atlas mới lưu `Thumbnail` dạng
   `"{slug}/{slug}-thumb.webp"` nên sẽ tiếp tục 404 ở các chỗ này khi có
   thêm điểm đến mới hiển thị qua đó. Đã sửa `Index.cshtml` (+ `destination.ts`
   nhánh JS render khi tick facet) dùng `CommonUtils.DestinationCardThumbnailUrl()`
   mới — CHƯA sửa các chỗ còn lại (không tự ý sửa hàng loạt, một số model
   hiện chưa có sẵn field `Thumbnail` nên cần đổi cả model, rủi ro cao hơn 1
   dòng view):
   - `Views/Destination/_ChildDestination.cshtml` — model `DestinationShortModel`
     KHÔNG có field `Thumbnail`, cần bổ sung field + query trước khi sửa view.
   - `Views/Shared/_DestinationGroup.cshtml` — tương tự `_ChildDestination`.
   - `Views/Shared/_DestinationCardList.cshtml` — model đã có `Thumbnail`
     (`ChildRefModel`/`RelatedRefModel`?) — kiểm tra rồi áp `DestinationCardThumbnailUrl`.
   - `Views/Shared/_DestinationListDetail.cshtml`, `Views/Destination/_DestinationList.cshtml`,
     `Views/Destination/_RelatedDestinationGrid.cshtml` — cùng dạng, cần rà
     model từng cái trước khi sửa.
   - `src/ts/nav.ts` (dropdown gợi ý tìm kiếm header) — có sẵn field
     `thumbnail` trong `DestinationSuggestionModel`, sửa tương tự `destination.ts`.
   - Bổ sung: nên rà xem `_ChildDestination.cshtml`/`DestinationShortModel`
     còn được dùng thật không (có thể là code cũ trước redesign, đã bị thay
     bằng `ChildRefModel`/`_RelatedDestinationGrid` — Detail.cshtml dùng cả 2
     đường, cần xác nhận đường nào đang active).
8. ✅ **ĐÃ BUILD + VERIFY (29/07/2026)** — `dichoithoi-content-freshness-plan.md`:
   tín hiệu "cập nhật nội dung" thật thay cho dòng `updateNotice` AI viết
   cứng lúc generate cũ (đã xoá hẳn khỏi contract/prompt/renderer/gate). Đã
   implement đủ 6 giai đoạn A-F cả 2 repo: 2 cột `ContentUpdatedAt`/
   `LastVerifiedAt` tách biệt trong `v2.DestinationContent`, gate so sánh giá
   trị cho field số liệu + AI (Haiku) phân loại `ContentHtml` + nút override,
   nút "Đã kiểm tra, vẫn đúng", badge động ẩn sau 6 tháng, `dateModified`
   JSON-LD (`WebPage` riêng) + sitemap `lastmod` đổi nguồn, dashboard alert
   `stale-content` (5 tháng). Verify: 468 test zinoflow xanh, `dotnet build`
   dichoithoi xanh, migration đã chạy trên `dichoithoi_dev`. Căn cứ chính
   sách Google (trích dẫn "date change without substantive content change" +
   `<lastmod>` verifiably-accurate) xem
   `docs/dichoithoi/dichoithoi-google-seo-guidelines.md` §4/§7.

## D) Đã làm rõ / không còn là việc mở (tránh làm lại)

- ~~Bộ `DestinationType` chuẩn~~ → đã thành 2 tầng thật trong DB
  (`DestinationTypeGroup` + `DestinationType`, database-redesign §3.2/§4.4/§9.2).
- ~~Quy tắc trộn khối "liên quan"~~ → đã duyệt, xem destination-spec §12.3 pha 2.
- ~~Website mới giữ .NET hay đổi stack~~ → giữ .NET, chỉ đổi tầng đọc.
- ~~Module Hotel/Tour làm ở giai đoạn nào~~ → Giai đoạn 1 (cùng Destination),
  không phải giai đoạn 3 như dự kiến ban đầu (database-redesign §9 mục 5).
- ~~Cách 1 vs Cách 2 cho khối động (precompute vs render-time)~~ → chọn Cách 1
  (precompute lúc publish), xem article-spec §2.
- ~~Hotel/Tour có cần trang chi tiết riêng không~~ → KHÔNG, chỉ card gợi ý.
- ~~Vé điểm đến 1 link hay nhiều link~~ → nhiều link (`ticketLinks[]`), mỗi
  link tự sinh affiliate URL theo rule chung.
- ~~Contact mở rộng (Zalo/Facebook) / BestMonths có cấu trúc~~ → không cần,
  giữ schema Destination gọn (database-redesign.md §4.2, quyết định 07/2026).
- ~~Hotel render theo HotelGroupId hay bảng map riêng~~ → `HotelDestinationMap`
  (thay `HotelGroupId`, nhất quán với `TourDestinationMap` của Tour) —
  hotel-spec.md §4, sửa 07/2026 (mâu thuẫn với bản đầu đã phát hiện + sửa khi rà lại).
- ✅ **Bug ảnh thumbnail vỡ toàn site (25/07/2026)** → phát hiện khi kiểm tra
  `/chu-de/phu-hop-gia-dinh`: cột `Destination.Thumbnail` trong DB là dữ liệu
  cũ dạng `{slug}/{slug}-thumb.webp` (271/272 điểm đã publish bị sai), trong
  khi file thật trên đĩa (`contents/diem-den/thumbnail/`) nằm phẳng, đặt tên
  `{slug}.webp`. Các view/JS build URL từ cột `Thumbnail` (không phải từ
  `Slug`) nên vỡ ảnh: `_DestinationCardList.cshtml` (dùng ở /loại, /tỉnh,
  /chu-de), `Destination/Index.cshtml` (trang /diem-den), `destination.ts`
  (facet AJAX), `nav.ts` (gợi ý tìm kiếm header). Đã sửa cả 4 chỗ để build
  URL từ `Slug` thay vì cột `Thumbnail` (khớp quy ước đã đúng sẵn ở
  `_DestinationGroup.cshtml`/`_ChildDestination.cshtml`). Cột `Thumbnail`
  trong DB coi như bỏ (không xoá, chỉ không dùng để render nữa).
- ✅ **Markdown-lite cho Description Type/Tag (25/07/2026)** → phân tích 3
  hướng (văn xuôi thuần / markdown-lite / markdown đầy đủ), chốt markdown-lite
  — tái dùng đúng pipeline `marked` + `sanitize-html` đã có sẵn cho bài điểm
  đến (`destination-publish-html.renderer.ts`), KHÔNG thêm dependency mới.
  `taxonomy-description-autolink.util.ts`: parse markdown → sanitize allowlist
  hẹp (`p,br,strong,em,ul,ol,li` — chặn heading/ảnh/bảng/link thủ công, các
  the đó bị bóc bỏ giữ lại text) → auto-link chạy sau cùng, đúng thứ tự pipeline
  bài điểm đến. CMS `/chu-de` + `/danh-muc` (dòng Loại) cập nhật placeholder/
  FeatureIntro ghi rõ cú pháp (dòng trống = đoạn mới, `- ` = gạch đầu dòng,
  `**chữ**` = in đậm). Tiện thể sửa `generate-tag-description.usecase.ts` —
  phát hiện prompt AI cũ sai lệch hoàn toàn so với spec hiện tại (đòi "2-4
  câu, KHÔNG liệt kê tên điểm đến" trong khi Tag cần 300-500 từ VÀ auto-link
  cần tên điểm đến thật) — sửa lại đúng yêu cầu + truyền kèm danh sách điểm
  đến đã gán tag (fetchDestinationsForTag) để AI không bịa tên.
- .cshtml wrapper ngoài của `DescriptionHtml` đổi từ `<p>` sang `<div
class="rich-content">` (Type: `TypeList.cshtml`, Tag: `Topic/Detail.cshtml`)
  — nội dung giờ tự chứa nhiều `<p>`/`<ul>` riêng, lồng trong `<p>` ngoài là
  sai HTML. CSS `.rich-content > * + * { margin-top }` đã có sẵn, không cần
  thêm CSS mới cho khoảng cách đoạn/list.

- ✅ **Format lại 17 mô tả Tag bằng Markdown (25/07/2026)** → sau khi có pipeline
  markdown đầy đủ, rà lại toàn bộ 17 tag (đang là văn xuôi thuần từ đợt sửa
  fabrication trước đó) — thêm gạch đầu dòng cho phần liệt kê điểm đến theo
  vùng/nhóm + in đậm từ khoá quan trọng (khung giờ, nguyên tắc an toàn...),
  KHÔNG đổi/thêm/bớt bất kỳ tên điểm đến hay fact nào đã verify. Ghi qua API
  thật (`PATCH /destination-tags/{slug}/description`, không sqlcmd tay) nên
  DescriptionHtml tự sinh lại đúng qua auto-link. Đồng bộ lại
  `docs/dichoithoi/phan-tich/dichoithoi-nhom-type-tag-desc.md` PHẦN 3 khớp DB.
- ✅ **Sửa 2 tên điểm đến sai chính tả (25/07/2026)** → "Khu di tích Pác Pó"
  → "Pác Bó", "Bảo tàng chiến tích chiến tranh" → "Bảo tàng Chứng tích Chiến
  tranh" — lỗi đã biết từ trước nhưng chưa sửa trong DB (chỉ dùng tên đúng khi
  soạn văn bản), giờ mới lộ hậu quả cụ thể: tag "Lịch sử chiến tranh" nhắc 2
  tên này bằng chính tả đúng nên auto-link KHÔNG khớp được tên sai trong DB
  (regex so khớp chính xác `Destination.Name`) — verify trước/sau bằng
  `DescriptionHtml LIKE '%{slug}%'`: 0/0 → 1/1 sau khi sửa Name + lưu lại tag.
  Sửa `Name` gốc lan tự động ra mọi nơi hiển thị (H1 trang điểm đến,
  breadcrumb, JSON-LD), không cần sửa nơi khác.
- ✅ **Soạn MetaDescription cho 17 Tag (25/07/2026)** → trước đó đều `NULL`
  (trang lấy fallback tự động từ Description qua `SeoTextUtil`, không phải nội
  dung biên tập riêng cho kết quả tìm kiếm). Soạn tay dựa trên nội dung
  Description đã format, 129-159 ký tự (≤160 chuẩn Google), nêu 3-4 điểm tiêu
  biểu + lý do bấm vào — không đụng `Description` gốc. Ghi qua API thật.

- ✅ **Sửa "AI hỗ trợ từng khối" bỏ sót dữ liệu đã trích xuất (25/07/2026)** →
  người dùng yêu cầu rà lại chất lượng skill trích xuất
  (`dichoithoi-extract-destination-info`) cho "dalat-fairytale-land" — nội
  dung trích xuất (`aiReferenceSummary`/`editorialReview`/giá vé/giờ mở cửa)
  bản thân RẤT TỐT (facts cụ thể: hồ Ước Nguyện, hầm rượu Vĩnh Tiến, mẹo giờ
  chụp ảnh...), nhưng phát hiện `GenerateDestinationBlockUseCase` (nút "AI gợi
  ý" cho RIÊNG 1 khối ở tab Nội dung) có `buildSourceContext()` THIẾU hẳn
  `aiReferenceSummary`, khoảng cách POI thật, giá vé, giờ mở cửa — lệch hẳn so
  với `CreateDestinationJobUseCase` (sinh cả bài) vốn có đủ. Nghĩa là bấm "AI
  gợi ý" cho 1 khối lẻ (vd sau khi đã có bài, muốn viết lại riêng "Trải
  nghiệm") sẽ KHÔNG thấy dữ liệu đã trích xuất công phu qua skill — lãng phí
  công trích xuất. Đã sửa để 2 use-case dùng chung logic
  (`poiDistanceRepo`/`aiReferenceSummary`/`editorialReview`/giá vé/giờ mở cửa).
  Verify qua log `ai_usage_logs.promptText` thật (không chỉ đọc code): prompt
  gửi AI nay có đủ "Giờ mở cửa", "Giá vé", "Tóm tắt nguồn tham khảo" (đúng nội
  dung hồ Ước Nguyện/hầm rượu), khoảng cách km thật tới các điểm liên quan.

- ✅ **Audit toàn site + sửa 7 bug ưu tiên cao (25/07/2026)** → theo yêu cầu rà
  soát toàn bộ code liên quan dichoithoi (zinoflow + web .NET), chạy 3 agent
  song song audit SEO + bug zinoflow + bug .NET, tổng hợp báo cáo phân loại
  BUG/RISK/CLEANUP. Đã sửa nhóm bug xác nhận thật, ưu tiên cao:
  1. Ảnh grid "điểm tham quan/khu vực con" trang chi tiết dùng cột `Thumbnail`
     cũ, dùng như đường dẫn TƯƠNG ĐỐI (sai) — `Detail.cshtml:685,727,755`,
     `_RelatedDestinationGrid.cshtml:10`. Sửa dùng `Slug` + đường dẫn tuyệt đối
     `/diem-den/thumbnail/{slug}.webp`, khớp quy ước đã đúng nơi khác.
  2. Gợi ý tìm kiếm header (`nav.ts`) quyết định ẩn/hiện ảnh dựa vào
     `item.thumbnail` cũ dù URL đã sửa đúng trước đó — bỏ điều kiện, luôn hiện.
  3. Ảnh hero 404 khi cột `Thumbnail` claim quy ước "-thumb.webp" nhưng file
     "-hero.webp" chưa từng được tạo (`DestinationDetailModel.cs`) — thêm
     `File.Exists` check that + fallback 3 tầng: hero → `{slug}.webp` phẳng →
     giá trị gốc. Verify sống: `chua-linh-an-dalat` từ 404 → 200; điểm có hero
     thật (`dalat-fairytale-land`) vẫn dùng đúng bản 1600px (không regress).
  4. `<title>` trang chi tiết không giới hạn độ dài (có case 102-106 ký tự) —
     thêm `TextUtil.Truncate(title, 70)`, verify sống title dài bị cắt còn "...".
  5. AI gợi ý riêng 1 khối (`GenerateDestinationBlockUseCase`) thiếu dòng "Loại
     điểm đến" mà AI sinh cả bài đã có (thêm ở commit f2bed13 nhưng sibling
     use-case không được cập nhật theo — CÙNG LỚP BUG với vụ thiếu
     aiReferenceSummary/distance đã sửa trước đó) — chuyển `KIND_LABELS` vào
     domain layer (`destination-mirror.ts`) dùng CHUNG giữa 2 use-case, tránh
     drift lần 3. Verify qua log prompt thật.
  6. Trang facet lọc `noindex` (`/diem-den?tinh=...`) vẫn phát `<link
rel="canonical">` trỏ về `/diem-den` (không filter) — tín hiệu mâu thuẫn.
     Sửa `_Layout.cshtml`: trang noindex không tự đặt Canonical thì BỎ HẲN thẻ
     canonical thay vì tự fallback về URL hiện tại.
  7. `robots.txt` thiếu dòng `Sitemap:` (tiện thể bỏ luôn BOM đầu file).
     ⚠️ **Sự cố phụ khi sửa**: 2 lần vô tình làm gián đoạn `dotnet watch` của
     DiChoiThoi.Web (lần 1: kill nhầm process cũ không tự restart; lần 2: 2 lần
     sửa liên tiếp cùng `_Layout.cshtml` làm hot-reload corrupt state, phải
     restart cứng) — cả 2 lần đã tự phát hiện + khôi phục qua `run-watch.ps1`,
     không mất code, chỉ gián đoạn tạm thời quá trình verify.

- ✅ **6 việc SEO/security nhỏ còn treo — ĐÃ BUILD + verify sống 25/07/2026**
  (repo dichoithoi, tiếp nối đợt audit ở trên):
  1. **Twitter Card** — `MetaTagUtil.ConvertOpenGraphToTwitterCardList` (tái
     dùng data từ `OpenGraphMetaTag`) + render trong `_Layout.cshtml`.
  2. **Article og:image thiếu host prefix** — thêm `CommonUtils.ToAbsoluteImageUrl`
     (giữ nguyên nếu đã là URL tuyệt đối, tránh double-prefix — Thumbnail hiện
     tại thực ra ĐÃ tuyệt đối qua `resolveImageUrl` bên zinoflow, fix này chỉ
     là phòng hờ dữ liệu cũ/nguồn khác).
  3. **Sitemap lastmod thật** — trước đây MỌI URL dùng `DateTime.Now` (sai lệch
     hoàn toàn ý nghĩa lastmod). Article: đổi `PublishedAt` → `UpdatedAt`
     (phản ánh đúng lần sửa gần nhất). Destination: thêm
     `IDestinationTaxonomyService.GetUpdatedAtBySlugAsync()` (tra cứu
     `v2.Destination.UpdatedAt`, KHÔNG đổi nguồn danh sách URL hiện tại để
     tránh rủi ro thiếu/thừa URL) — verify sống: `lastmod` của
     `dalat-fairytale-land` ra đúng `2026-07-22` (ngày sửa thật), không phải
     ngày chạy sitemap. Hotel/Type/Group/Province: KHÔNG có cột `UpdatedAt`
     trong schema — không sửa được nếu không thêm migration DB (ghi nhận,
     chưa làm).
  4. **`/vung/{slug}` thiếu JSON-LD** — thêm `BreadcrumbUtils.CreateRegionBreadcrumb`
     - `SchemaUtil.CreateDestinationListJsonLD` (tái dùng đúng pattern
       `ProvinceController`). Verify sống: có cả `BreadcrumbList` lẫn `ItemList`.
  5. **Sanitize HTML cho `Html.Raw`** — thêm package `HtmlSanitizer` 9.0.967
     (bản mới nhất, tránh bản 8.1.870 có CVE mức trung bình) + util
     `HtmlContentSanitizer.Sanitize()` (cấu hình mặc định — chặn
     script/event-handler/`javascript:`-url, giữ định dạng cơ bản). Áp dụng
     tại 5 controller trước `return View(...)`: `ArticleController.ContentHtml`,
     `DestinationController.Content/Food/Transport/Tip/Hotel`,
     `DestinationTypeController.Type.DescriptionHtml`,
     `TopicController.Tag.DescriptionHtml`, `SimController.TopContent/
TopGoiCuocContent/GoiCuocs[].Content/NhaMangs[].Content`. Tiện thể phát
     hiện + sửa thêm: `_Layout.cshtml` dùng `Html.Raw` cho `<title>`/meta
     description (field text thuần, không nên bypass encode) — đổi về Razor
     encode bình thường. Verify sống: nội dung rich-content vẫn hiển thị
     nguyên vẹn sau sanitize (không mất định dạng), title/description hiện
     đúng tiếng Việt có dấu.
  6. **OutputCache thiếu VaryByQuery** — `DestinationDetailCachePolicy` thêm
     `CacheVaryByRules.QueryKeys = Array.Empty<string>()` tường minh (trang
     chi tiết không đọc query param nào, tránh phân mảnh cache vì link có
     UTM/tracking param).
     Build sạch 0 lỗi (`dotnet build`), verify qua trang chạy `dotnet watch`
     thật (không chỉ đọc code) cho cả 6 mục. Mật khẩu DB production bị commit
     plaintext trong `appsettings.Release.json` VẪN CÒN MỞ — cần người dùng tự
     đổi, không phải việc code sửa được.

- ✅ **Trang `/content` — bỏ tạo bài trực tiếp, thêm filter — ĐÃ BUILD
  (25/07/2026)**:
  1. Bỏ form tạo job AI ở `/content` (laruki/dochoi3s đã có trang riêng
     `/laruki/new`, `/dochoi3s/new` tạo cùng loại `ContentJob` qua
     `CreateCmsContentJobUseCase` → `CreateContentJobUseCase`).
  2. Form "Tạo draft VIẾT TAY" **GIỮ LẠI** (thu gọn trong `<details>`) — chưa
     có nơi khác thay thế cho laruki/dochoi3s, tự quyết theo hướng an toàn
     (không xoá tính năng chưa có thay thế).
  3. Filter thật (Website/Loại bài viết/AI Provider) — thêm
     `listContentJobsQuerySchema` (contracts), `ContentJobFilters` (port),
     sửa `findAll()` cả TypeORM lẫn in-memory repo, `GET /content/jobs` nhận
     query param thật. Verify trên data thật: 39 job → lọc `siteCode=dichoithoi`
     còn 28 (100% đúng site), lọc `aiProvider=gemini` còn 19 (100% đúng
     provider).
- ✅ **Link nhanh tab "AI hỗ trợ" (dichoithoi) → trang Content job — ĐÃ BUILD
  (25/07/2026)**: thêm link `/content/{activeContentJobId}` cạnh dòng trạng
  thái (`[slug]/page.tsx`). Verify: trang `/content/[id]` load 200 cho job
  thật của `dalat-fairytale-land`.
- ✅ \*\*Cho phép gán Tag/Type/xem quan hệ cho điểm đến CHƯA publish — ĐÃ BUILD
  - verify sống 26/07/2026\*\* (phát hiện qua cụm "Đạ Tẻh" mới tạo, siteId=null):
    Tag Kanban, Type Kanban, gợi ý+xem trước prompt AI, list tổng trang Chủ đề,
    rà soát ngược, trang chi tiết điểm đến (badge Tag/Type), tab "Quan hệ" —
    tất cả trước đây chỉ đọc SQL Server (`WHERE Status=1`) nên bỏ sót/hiện sai
    điểm draft. Gán Tag/Type cho điểm draft giờ lưu tạm vào mirror Postgres
    (cột `tags`/`types`), tự động đẩy sang `DestinationTagMap`/`TypeMap` thật
    khi publish lần đầu. Xem chi tiết code tại commit `8606009`.
  * ✅ **2/3 việc phụ còn lại — ĐÃ BUILD + verify sống 26/07/2026**:
    1. `generate-tag-description.usecase.ts` — prompt AI soạn mô tả
       `/chu-de/{slug}` giờ gồm cả điểm draft đã gán tag qua mirror.tags, để
       AI biết đủ ngữ cảnh khi viết. **Không đổi** `preview-tag-description.usecase.ts`/
       `update-tag-description.usecase.ts` (bước sinh link `<a href>` thật) —
       vẫn CHỈ link tới điểm đã publish, verify sống: mention tên điểm draft
       trong mô tả KHÔNG bị biến thành link (đúng, tránh 404).
    2. `get-dichoithoi-dashboard-alerts.usecase.ts` — đếm "chủ đề dưới ngưỡng"
       giờ gồm cả điểm draft gán tag qua mirror, khớp đúng số trang Rà soát ngược.
  * ❌ **1/3 việc phụ — XÁC NHẬN KHÔNG PHẢI BUG, giữ nguyên**: `manage-taxonomy-content.usecase.ts`
    (auto-link mô tả Type/Group/Tỉnh) dùng cùng cơ chế sinh link thật với mục
    1 phần preview/update ở trên — PHẢI giữ published-only để không tạo link
    chết trên trang `/loai`, `/tinh` công khai. Đánh giá "cosmetic gap" trong
    audit 26/07/2026 trước đó là sai — đây là hành vi đúng, không sửa.

## Việc CŨ hơn — đã lỗi thời, cần rà lại khi đụng tới

- destination-spec §10 nhắc "Viết bài Post/Phượt/Tour của dichoithoi (chỉ làm
  Destination trước)" — **lưu ý**: chữ "Tour" ở đây (12/06/2026) nói về bài
  viết dạng CMS cũ, KHÁC với module Tour mới (07/2026, dữ liệu đặt tour affiliate,
  không phải bài viết). Post/Phượt (CMS cũ) vẫn ngoài phạm vi, chưa có kế hoạch
  migrate cụ thể (system-overview §5 Giai đoạn 3 — chưa chốt thời điểm).
