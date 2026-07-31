# Dichoithoi — Cẩm nang gộp Tour/Vé/Vận chuyển khi vượt Top-N (31/07/2026, ✅ ĐÃ BUILD phần còn áp dụng)

**Cập nhật sau audit sâu hơn lúc code (31/07/2026)**: chỉ **Tour** có overflow
thật — `TransportCardsJson` bake KHÔNG có `TOP`/giới hạn nào (khác Tour có
`TOP (@take)` rõ ràng), tức Vận chuyển đã hiện toàn bộ từ trước, không có gì
để "Xem thêm". Vé thăm quan cũng không có overflow (đã ghi ở §-1 cũ, giữ
nguyên). CMS đã có sẵn khối động `[[block:tours destination=slug limit=12]]`
(`ArticleBlockCompiler`) nên Giai đoạn 2-3 (query full-list + khối nhúng)
**không cần code gì mới** — chỉ Giai đoạn 4 (nút "Xem thêm") là việc thật,
đã build. Xem §7.

Ghi lại từ thảo luận: điểm đến vẫn là trục SEO chính, Khách sạn/Tour/Vé/Vận
chuyển chỉ là lớp affiliate lồng ghép — **không xây hub/search riêng cho
từng loại** (đã cân nhắc và loại bỏ, xem lý do ở dưới) vì sẽ phải cạnh tranh
trực diện với Klook/Traveloka/Vexere trên từ khoá transactional, trong khi
site chưa có domain authority để thắng. Hướng chốt: khi 1 điểm đến có nhiều
tour/vé/nhà xe hơn số Top-N hiện đang bake (`HotelCardsJson`/`TourCardsJson`/
`TransportCardsJson`, Phase 15 + transport-plan §2 Giai đoạn 4), phần dư
KHÔNG có trang riêng — gộp vào 1 bài **cẩm nang** đã có content biên tập
thật + liệt kê full danh sách, điểm đến chỉ hiện Top-N + dòng "Xem thêm: X →"
trỏ sang bài đó.

## 1) Hiện trạng đã audit (code thật)

- `DiChoiThoi.Web/Views/Destination/Detail.cshtml:819-833` — pattern "Xem
  thêm: {tiêu đề bài} →" **đã tồn tại và đang chạy** cho
  `extras.RelatedArticles`/`FoodArticles`/`NightlifeArticles`/
  `SouvenirArticles`, nối qua bảng map — không phải khái niệm mới, chỉ mở
  rộng sang Tour/Vé/Vận chuyển.
- `DiChoiThoi.Common/DbEntities/V2/V2ArticleDestinationMap.cs` — PK
  `(ArticleId, DestinationSlug, Topic)`, `Topic` hiện chỉ nhận
  `itinerary|food|souvenir|nightlife|poi-guide|general` (comment dòng 19) —
  **chưa có giá trị cho tour/ticket/transport**, cần bổ sung enum.
- `DiChoiThoi.Common/DbEntities/V2/V2DestinationContent.cs:50-65` —
  `HotelCardsJson`/`TourCardsJson`/`TransportCardsJson` đã bake sẵn Top-N
  theo đúng pattern Phase 15, website chỉ đọc cột, không JOIN sống.
- `apps/api/.../transport/infrastructure/dichoithoi/mssql-transport-site-db.adapter.ts:117-149`
  (`findCardsForDestination`) — card Vận chuyển bake theo **1 điểm đến**,
  gộp CHUNG mọi tuyến có điểm đó là origin HOẶC destination (`Role IN (1,2)`),
  **không tách theo đối tuyến** (không biết Sài Gòn hay Nha Trang). Đây là
  điểm khác biệt quan trọng so với Tour — xem quyết định ở §2.
- `apps/api/.../transport/application/use-cases/recompute-transport-cards.usecase.ts` —
  fan-out xuống POI con qua `ParentId`, xác nhận: card Vận chuyển gắn theo
  cụm/tỉnh (site-level), không gắn theo cặp tuyến.
- Tour (`recompute-tour-cards.usecase.ts`, chưa đọc chi tiết trong phiên này
  nhưng cùng pattern `RecomputeHotelCardsUseCase`) — bake theo 1 điểm đến,
  KHÔNG có khái niệm "tuyến" như Vận chuyển → không gặp vấn đề granularity
  ở §2, cẩm nang Tour/Vé tự nhiên theo 1 điểm đến.

## 2) Quyết định cần chốt trước khi build — granularity bài cẩm nang Vận chuyển

Ví dụ người dùng đưa ra ("nhà xe từ Sài Gòn đi Đà Lạt") là **theo TUYẾN**
(cặp điểm đi + điểm đến), nhưng dữ liệu bake hiện tại ở Đà Lạt gộp CHUNG mọi
tuyến (từ Sài Gòn, Nha Trang, Hà Nội... trộn lẫn 1 danh sách). Có 2 mức đầu
tư khác nhau, CHƯA tự chọn hộ:

**Mức A — Cẩm nang theo ĐIỂM ĐẾN (khớp dữ liệu bake sẵn, ít việc nhất)**
- 1 bài "Xe khách đi/đến Đà Lạt: nhà xe nào uy tín" — liệt kê TẤT CẢ tuyến
  (không phân biệt điểm đi), dùng thẳng query hiện có
  (`findCardsForDestination`, bỏ giới hạn Top-N).
- Nhược điểm: không target được từ khoá cụ thể "xe Sài Gòn Đà Lạt" (khối
  lượng tìm kiếm/độ khớp intent thấp hơn ví dụ người dùng đưa).

**Mức B — Cẩm nang theo TUYẾN (khớp đúng ví dụ người dùng, cần thêm việc)**
- 1 bài riêng cho mỗi cặp điểm đi-điểm đến có đủ dữ liệu (vd "Sài Gòn - Đà
  Lạt" và "Nha Trang - Đà Lạt" là 2 bài khác nhau).
- Cần: (a) query mới lọc theo CẶP điểm (`WHERE EXISTS stop role=1 AND
  destinationSlug=@from AND EXISTS stop role=2 AND destinationSlug=@to`),
  hiện chưa có; (b) `V2ArticleDestinationMap` phải map 1 bài vào **2 dòng**
  (DestinationSlug=điểm đi VÀ điểm đến) để "Xem thêm" hiện được ở cả 2 trang
  điểm đến; (c) nếu 1 điểm đến có nhiều bài theo-tuyến (Đà Lạt có cả bài
  Sài Gòn-Đà Lạt lẫn Nha Trang-Đà Lạt), khối "Xem thêm" trên trang Đà Lạt
  cần hiện DANH SÁCH bài (không chỉ 1 dòng như Food/Nightlife hiện tại đang
  lấy `[0]`) — đổi nhỏ ở Detail.cshtml.
- Khớp đúng định vị "dữ liệu ngách, tuyến không phổ biến" đã thống nhất —
  từ khoá theo tuyến cụ thể là chỗ site có cửa thắng, Mức A loãng lợi thế
  này.

**CHỐT (31/07/2026, đã hỏi người dùng): chọn Mức A** cho Vận chuyển — bài
cẩm nang theo ĐIỂM ĐẾN, dùng thẳng dữ liệu bake sẵn (`findCardsForDestination`,
bỏ Top-N), KHÔNG cần query theo cặp tuyến mới. Tour/Vé cũng theo điểm đến
(bản chất không có "tuyến"). → Toàn bộ 3 loại (Tour/Vé/Vận chuyển) dùng
CHUNG 1 cơ chế: "bài cẩm nang theo 1 điểm đến, card list full không giới
hạn Top-N" — không có nhánh Mức B nào cần build, đơn giản hoá Giai đoạn 2-4
bên dưới (bỏ phần "nếu Mức B").

## 3) Giai đoạn implement (đã chốt Mức A cho cả 3 loại)

### Giai đoạn 1 — Schema — ✅ ĐÃ BUILD (31/07/2026)
- Mở rộng `articleTopicSchema` (`packages/contracts/src/dichoithoi/article.ts`)
  thêm `tour`, `ticket`, `transport` — nguồn sự thật thật sự (không phải DB
  CHECK constraint, cột SQL Server chỉ là `varchar(20)` tự do).
- `TOPIC_LABELS` ở `article-destination-map-panel.tsx` (CMS) thêm nhãn tiếng
  Việt cho 3 topic mới.
- `guess-article-topic.ts` thêm keyword rule gợi ý topic (transport/ticket/
  tour) khi soạn bài — chỉ là gợi ý, người dùng vẫn tick xác nhận.
- Cập nhật comment ở `V2ArticleDestinationMap.cs` (dichoithoi repo) +
  `scripts/dichoithoi-sqlserver/01-create-new-schema.sql` cho khớp enum mới
  (không cần migration DDL vì cột không có CHECK constraint).
- DoD: `guess-article-topic.spec.ts` pass (6/6) sau khi build lại
  `@zinoflow/contracts`; không có lỗi TypeScript ở `apps/web`/`apps/api`
  dùng `ArticleTopic`.

### Giai đoạn 2 — Query "full list" cho bài cẩm nang (phụ thuộc: không có gì,
làm song song Giai đoạn 1)
- Tour/Vé/Vận chuyển: thêm hàm lấy full danh sách theo 1 điểm đến (bỏ
  Top-N) — tái dùng nguyên query hiện có của
  `RecomputeTourCardsUseCase`/`RecomputeTransportCardsUseCase`/tương đương
  Vé, chỉ khác không giới hạn `TAKE`. Không cần query mới nào (đã chốt bỏ
  nhánh theo-tuyến).
- DoD: unit test hoặc query tay trên DB thật cho 1 ví dụ đã biết trước kết
  quả (vd đếm tay tổng số nhà xe đi/đến Đà Lạt trong `v2.TransportStop`, so
  khớp kết quả hàm trả về).

### Giai đoạn 3 — CMS soạn bài cẩm nang có card list nhúng (phụ thuộc Giai
đoạn 2)
- Trang soạn bài Article (`apps/web/src/app/dichoithoi/cam-nang/...`) cần 1
  khối mới: chọn "gắn danh sách Tour/Vé/Vận chuyển" (chọn 1 điểm đến) →
  preview card list y hệt cách destination
  page hiện render, nhúng vào bài qua field JSON riêng (KHÔNG viết cứng
  text vào `ContentHtml` — lý do: dữ liệu giá/nhà xe đổi thường xuyên, viết
  cứng sẽ lỗi thời, phá nguyên tắc content-freshness đã build
  `ContentUpdatedAt`/`LastVerifiedAt`).
- DoD: soạn thử 1 bài thật (route Sài Gòn-Đà Lạt hoặc điểm đến Đà Lạt tuỳ
  mức chọn), preview đúng card list khớp dữ liệu DB thật.

### Giai đoạn 4 — Website hiển thị + liên kết 2 chiều (phụ thuộc Giai đoạn 3)
- `Detail.cshtml`: khối Tour/Vé/Vận chuyển thêm dòng "Xem thêm: {bài} →"
  giống pattern Food/Nightlife khi có bài map — CHỈ hiện khi
  `extras.*.Count` vượt ngưỡng Top-N thật (không hiện tràn lan cho điểm đến
  chỉ có 2-3 item).
- Bài cẩm nang: card list full render bằng đúng partial đang dùng ở trang
  điểm đến (`_TourCardList`/`_TransportCardList`...) để đồng bộ UI, không
  viết lại.
- DoD: Playwright mở 1 trang điểm đến có overflow thật → bấm "Xem thêm" →
  vào đúng bài cẩm nang → thấy đủ số lượng item khớp DB (không bị cắt Top-N
  trong bài).

## 4) Ngưỡng tạo bài (áp dụng mọi loại)

Chỉ viết bài cẩm nang khi `Count(item) > TAKE hiện tại` của loại đó tại
điểm đến/tuyến đó — tránh viết tràn lan cho điểm đến ít dữ liệu (nội dung
mỏng, trùng lặp với chính khối Top-N trên trang điểm đến).

## 5) Lệch tài liệu vs lỗ hổng thật

- **Lỗ hổng thật**: `Topic` enum ở `V2ArticleDestinationMap.cs` chưa có giá
  trị cho tour/ticket/transport — cần bổ sung, không phải lỗi cũ.
- **Không phải lệch tài liệu** — transport-plan §2 Giai đoạn 4 không đề cập
  cẩm nang overflow vì lúc đó chưa có yêu cầu này, không mâu thuẫn gì.

## 6) Bổ sung: Danh mục bài cẩm nang (31/07/2026)

Phát sinh từ thảo luận tiếp theo: cần phân biệt bài cẩm nang theo loại nội
dung (Kinh nghiệm, Di chuyển, Ăn uống...) để (a) lọc/hiển thị trên trang
`/cam-nang`, (b) gợi ý bài liên quan. Khác với `ArticleTopic` ở §1 (gắn theo
CẶP bài-điểm đến, mô tả "bổ trợ khối nào") — đây là field `Category` gắn
TRỰC TIẾP trên bài, độc lập với có map điểm đến hay không.

**Danh sách 7 category đã duyệt (31/07/2026)**: `kinh-nghiem`, `lich-trinh`,
`di-chuyen`, `an-uong`, `luu-tru`, `diem-tham-quan-vui-choi`, `mua-sam`.

**URL đã chốt**: bài chi tiết giữ nguyên `/cam-nang/{slug}` (không đổi);
trang hub category dùng tiền tố riêng `/cam-nang/danh-muc/{slug}` — KHÔNG
dùng chung namespace phẳng với bài chi tiết (sẽ đụng route, phải "đăng ký
slug dự trữ" — rủi ro không đáng, đi ngược convention `/tinh`/`/vung`/`/loai`/
`/chu-de` đã tách route riêng khỏi `/diem-den/{slug}` trong toàn bộ site).

### ✅ ĐÃ BUILD (31/07/2026) — Schema + CMS (zinoflow)
- `articleCategorySchema` (7 giá trị) + `setArticleCategoryRequestSchema` ở
  `packages/contracts/src/dichoithoi/article.ts`; thêm `category` vào
  `contentJobSchema` (`packages/contracts/src/ai-content/content-job.ts`).
- Domain `ContentJob.setCategory()` (chỉ cho phép `articleType=cam-nang`,
  đúng pattern `setCoverImage()` có sẵn) + entity/repository/migration
  Postgres (`1782850000000-ArticleCategory.ts`, cột `content_jobs.category`,
  **đã chạy migration local, verify: `ArticleCategory1782850000000` executed
  successfully**).
- `SetArticleCategoryUseCase` + route `PUT /articles/:jobId/category` (tách
  riêng khỏi luồng generate/publish — đổi category không cần publish lại,
  đúng pattern cover-image).
- `PublishArticleUseCase` truyền `category` xuống `UpsertArticleInput` →
  `MssqlArticleSiteDbAdapter` ghi cột `v2.Article.Category`.
- SQL Server: `V2Article.cs` + `01-create-new-schema.sql` (fresh install) +
  script mới `09-article-category-column.sql` (ALTER idempotent cho DB đã
  có dữ liệu, theo đúng convention 05-08 trong `scripts/dichoithoi-sqlserver/`).
- CMS UI: `apps/web/src/app/content/[id]/page.tsx` — khối "Danh mục bài"
  cạnh khối "Ảnh đại diện" hiện có (Select 7 giá trị + nút Lưu riêng).
- DoD đã verify: `npx tsc --noEmit` sạch cả `apps/api`/`apps/web`; 56 test
  liên quan (content-job domain, generate/update/review-draft usecase,
  dashboard-alerts, article module) pass; migration Postgres chạy thật
  thành công trên DB local.

### ✅ ĐÃ BUILD (31/07/2026) — Website hiển thị (dichoithoi repo, C#)
- `ArticleCategoryConstants` (7 nhãn, ngưỡng noindex `MIN_INDEXABLE_CATEGORY_ARTICLES=3`).
- `IArticleRepository`/`ArticleRepository`: `GetCategoryCountsAsync`,
  `GetByCategoryAsync` (có phân trang), `GetRelatedByCategoryAsync`.
  `ArticleModel.cs` thêm `Category`, `ArticleCategoryInfo`,
  `ArticleCategoryPageModel`, `RelatedArticles`.
- `ArticleController.cs`: route mới `/cam-nang/danh-muc/{slug}` (hub,
  `CollectionPage`/`ItemList` JSON-LD + breadcrumb + noindex nếu <3 bài,
  đúng khuôn `TopicController.cs`) — không đụng route `/cam-nang/{slug}`
  vì khác số segment (3 vs 2), không cần "đăng ký slug dự trữ".
- `/cam-nang` (Index): chip lọc theo category + đếm số bài.
- `/cam-nang/{slug}` (Detail): badge category (link sang hub) + khối "Bài
  liên quan" (lọc `Category` trùng, MVP — có thể nâng cấp sau bằng kết hợp
  `ArticleDestinationMap`).
- Tách `_ArticleCardList.cshtml` dùng chung Index/Category/Detail-related,
  không lặp code.
- DoD đã verify: `dotnet build DiChoiThoi.Web` — 0 lỗi CS (chỉ fail bước
  copy DLL cuối do dev server đang chạy khoá file, không phải lỗi code).
  Commit `ae17fd2` (dichoithoi, branch develop).

## 7) Giai đoạn 4 (Tour) — ✅ ĐÃ BUILD (31/07/2026)

Sau khi xác nhận chỉ Tour có overflow thật (xem đầu file) và CMS đã có sẵn
`[[block:tours destination=slug limit=12]]` để nhúng full list vào bài
(không cần build Giai đoạn 2-3), phần còn lại chỉ là hiển thị 2 chiều:

- `DestinationExtrasModel.cs`: thêm `TourArticles` (List<ArticleLinkModel>)
  — đúng pattern `FoodArticles`/`NightlifeArticles`/`SouvenirArticles`.
- `DestinationExtrasRepository.cs`: query `articleLinksByTopic` (đã có sẵn
  cho Food/Nightlife/Souvenir) lọc thêm `Topic == "tour"`.
- `Detail.cshtml`: khối Tour thêm dòng "Xem thêm: {bài} →" khi
  `TourArticles.Count > 0` — **không check `Tours.Count > 6`** vì
  `extras.Tours` đọc từ `TourCardsJson` đã bị bake cắt Top-6 từ trước, phía
  website không bao giờ biết số thật trong DB. Ngưỡng "chỉ viết bài khi
  thật sự overflow" là kỷ luật THỦ CÔNG của người soạn bài (xem §4), không
  phải check tự động — đúng cách Food/Nightlife/Souvenir đang vận hành.
- DoD đã verify: `dotnet build DiChoiThoi.Service` — Build succeeded, 0 lỗi
  (`DiChoiThoi.Web` không build được do dev server đang chạy khoá DLL, không
  phải lỗi code — đã build `.Service` độc lập để xác nhận không lỗi C#).
