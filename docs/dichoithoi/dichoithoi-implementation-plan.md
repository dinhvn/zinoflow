# Dichoithoi — Kế hoạch triển khai (Implementation Plan, 07/2026)

Kế hoạch build cụ thể, theo thứ tự phụ thuộc thật (không phải danh sách ước
muốn) — dựa trên bản đồ hệ thống ở
[dichoithoi-system-design.md](dichoithoi-system-design.md) và danh sách quyết
định/rủi ro ở [dichoithoi-backlog.md](dichoithoi-backlog.md). Mỗi phase có:
mục tiêu, việc cụ thể, **Definition of Done (DoD)**, phụ thuộc phase trước.

Nguyên tắc lập kế hoạch: build từng lát mỏng kiểm chứng được (không big-bang
đại tu toàn bộ rồi mới test), ưu tiên ROI cao trước, không chặn phase sau bởi
việc chưa cần dùng ngay.

## Phase 0 — Môi trường dev an toàn (làm TRƯỚC MỌI THỨ)

**Mục tiêu**: không ai code/test chạm production trong lúc build.
- Chạy `pnpm clone:dichoithoi` → tạo `dichoithoi_dev` LocalDB.
- Đổi `.env` local sang `DICHOITHOI_DB_HOST=(localdb)\MSSQLLocalDB`.
- **DoD**: `apps/api` chạy dev với connection trỏ LocalDB, health check xác
  nhận kết nối `dichoithoi_dev`, KHÔNG còn connection string production trong
  `.env` của bất kỳ máy dev nào.

## Phase 1 — Schema v2 (chạy trên LocalDB clone trước)

**Phụ thuộc**: Phase 0. **Nguồn**: `dichoithoi-database-redesign.md`.
1. Chạy `01-create-new-schema.sql` trên `dichoithoi_dev` — tạo toàn bộ bảng
   §4 (bao gồm `DestinationTypeGroup` 2 tầng, `GalleryJson`/`TicketPriceFrom`
   đã vá).
2. Chạy `02-migrate-data.sql` — migrate data cũ (đã clone) sang schema mới.
3. Seed `admin_provinces`/`admin_wards`/`admin_ward_mappings` (dvhcvn,
   destination-spec §13.1) vào Postgres.
4. Seed 3 `DestinationTypeGroup` + 18 `DestinationType` con (database-redesign §9.2).
5. Checklist an toàn (database-redesign §7 cuối): so `COUNT(*)` trước/sau,
   spot-check 10 URL, sitemap diff = 0 URL mất.
- **DoD**: Query thử `SELECT` mọi bảng mới trên `dichoithoi_dev` ra đúng số
  dòng kỳ vọng; chưa chạm production.

## Phase 2 — Module `destination` (lõi M4)

**Phụ thuộc**: Phase 1. **Nguồn**: `dichoithoi-destination-spec.md`.
1. `domain/`: entity mirror, engine auto-link (unit test kỹ — escape regex,
   không replace trong thẻ `<a>`, sort tên dài→ngắn), quality gates travel
   (kèm ngưỡng ≥800 từ mới vá 07/2026).
2. `application/`: `SyncDestinationsFromSite`, `CreateDestinationJob`
   (mode create/update), `PublishDestination`, `RelinkAllDestinations`.
3. `infrastructure/`: TypeORM mssql DataSource (lazy connect), publisher
   adapter, mirror repository (Postgres), pg-boss worker relink.
4. `presentation/`: controller `/api/destinations` (§4 system-design).
5. UI: menu "Dichoithoi" (destination-spec §7) — hub, 4 tab chi tiết, form job,
   review draft (tái dùng `/content/[id]`), màn Công cụ.
- **DoD**: tạo 1 điểm đến mới bằng AI → generate → duyệt → publish → thấy bài
  thật trên `dichoithoi_dev` (chưa lên web thật); chạy `relink` không lỗi;
  chạy 2 lần liên tiếp không đổi thêm gì (idempotent).

## Phase 3 — Module `affiliate` (nền tảng, TRƯỚC Hotel/Tour)

**Phụ thuộc**: Phase 1 (chỉ cần Postgres, không phụ thuộc destination xong).
**Nguồn**: `dichoithoi-affiliate-link-conversion-spec.md`.
1. Bảng `affiliate_link_rules` (Postgres).
2. Service `AffiliateLinkResolver`: nhận `sourceUrl` (+ `provider` tuỳ chọn) →
   trả `{affiliateUrl, linkStatus}` theo thuật toán §3.
3. Job "Áp dụng lại" (pg-boss) — nhận danh sách entity cần update qua callback/
   port do module gọi cung cấp (không tự biết Destination/Hotel/Tour).
4. UI: màn "Quy tắc affiliate" ở Công cụ (thêm/sửa/tắt rule, nút áp dụng lại).
- **DoD**: nhập 1 rule Klook mẫu → dán `sourceUrl` bất kỳ khớp domain → trả
  đúng `affiliateUrl` theo template; đổi rule → bấm áp dụng lại → link cũ đổi
  theo, trừ những cái đã `manual-override`.

## Phase 4 — `ticketLinks[]` cho Destination (phụ thuộc Phase 2+3)

Đổi `bookingUrl` (1 link, code hiện tại) → `ticketLinks[]` (nhiều link):
1. Contracts: sửa Zod schema (`packages/contracts/src/dichoithoi/destination.ts`).
2. Mirror entity + migration Postgres.
3. Publisher/adapter SQL Server: ghi `TicketLinksJson` (DestinationContent),
   gọi `AffiliateLinkResolver` (Phase 3) trước khi lưu.
4. UI form: nhiều dòng provider/label/sourceUrl + preview affiliateUrl.
- **DoD**: thêm 2 link Klook + TripVision cho 1 điểm đến → publish → cả 2 có
  `affiliateUrl` đúng, field cũ `bookingUrl` không còn dùng.

## Phase 5 — Module `hotel`

**Phụ thuộc**: Phase 3 (affiliate). **Nguồn**: `dichoithoi-hotel-spec.md`.
1. Bảng `hotels`/`hotel_destination_map` (Postgres) + `Hotel`/`HotelDestinationMap`
   (SQL Server, MỚI — thay `HotelGroupId` legacy).
2. `IHotelPublisher`, nhập tay trước (MVP), crawler sau khi chọn OTA (backlog A.4).
3. Job gán tự động theo khoảng cách (haversine, tái dùng công thức recompute related).
4. UI: mục "Khách sạn" — bảng, form (dán sourceUrl → preview affiliateUrl).
- **DoD**: thêm 1 khách sạn tay, gán vào 1 điểm đến → publish → query
  `HotelDestinationMap JOIN Hotel WHERE DestinationSlug=@slug` ra đúng card data.

## Phase 6 — Module `tour`

**Phụ thuộc**: Phase 3. **Nguồn**: `dichoithoi-tour-spec.md`. Giống hệt cấu
trúc Phase 5 (Hotel), khác field đặc thù (`duration_days/nights`,
`departure_from`) + map nhiều-điểm-đến (`tour_destination_map`).
- **DoD**: thêm 1 tour gán 2 điểm đến khác nhau → publish → cả 2 trang điểm
  đến đều query ra đúng tour đó.

## Phase 7 — Năng lực "Viết tay" ở lõi `ai-content`

**Phụ thuộc**: không phụ thuộc Hotel/Tour, có thể làm song song Phase 5-6.
**Nguồn**: `dichoithoi-article-spec.md` §1.1, đồng bộ
`docs/specs/ai-content-technical-spec.md` §4.1/§5.
1. Thêm `sourceType=Manual` vào contract + entity `ContentJob`.
2. State machine: transition mới `Created→DraftReady` CHỈ khi `sourceType=Manual`.
3. `CreateManualDraftUseCase`: tạo job + `ContentDraftEntity` version 1 (template
   khởi tạo gợi ý cấu trúc), KHÔNG enqueue pg-boss, KHÔNG gọi AI provider.
4. UI: màn tạo bài có 2 lựa chọn "Tạo bằng AI" / "Viết tay".
- **DoD**: bấm "Viết tay" → có ngay `DraftReady` không qua job pg-boss nào,
  sửa/review/Approve/Publish chạy y hệt bài AI (không có đường tắt bỏ gate).

## Phase 8 — Module `article`

**Phụ thuộc**: Phase 7 (viết tay) + Phase 2/5/6 (destination/hotel/tour đã có
data để khối động query vào). **Nguồn**: `dichoithoi-article-spec.md`.
1. Bảng `Article` (SQL Server, mới hoàn toàn).
2. Engine compile khối động (`[[block:...]]` → HTML), validate + báo lỗi/0 kết
   quả (§4 article-spec), template card DÙNG CHUNG (không để AI tự sinh markup).
3. `IArticlePublisher`; 2 hành động tách biệt: "Cập nhật bài" (AI, qua review)
   vs "Làm mới khối động" (không AI, publish thẳng).
4. Quality gate mới: mỗi khối động phải có H2/H3 giới thiệu ngay trên (vá 07/2026).
5. UI: nút "Chèn khối động" (palette + form tham số), preview đã resolve,
   cảnh báo token lỗi/rỗng trước Approve.
- **DoD**: viết 1 bài "Các con thác đẹp tại Việt Nam" (AI hoặc tay), chèn
  `[[block:destinations type=thac-ho-suoi limit=6]]` → publish ra đúng 6 card
  thác; thêm 1 thác mới sau đó → bấm "Làm mới khối động" → bài cập nhật không
  cần viết lại văn bản.

## Phase 9 — Website .NET (song song, không chặn phase AI tool)

**Nguồn**: `dichoithoi-content-seo-ux-plan.md` §4, §7; `dichoithoi-web-page-audit.md`.
Ưu tiên theo ROI (đã sắp ở content-seo-ux-plan §7):
1. **Cao**: bật lại Review/Rating + JSON-LD AggregateRating; render FAQ +
   JSON-LD FAQPage; route `/loai/{group}[/{type}]` + `/tinh/{slug}`; SSR khối
   khách sạn/tour giữa bài (bỏ AJAX); route mới `/cam-nang/{slug}` cho Article.
2. **Trung bình**: gallery ảnh (đọc `GalleryJson`); bản đồ nhúng; `rel=sponsored`
   + disclosure; render `TicketLinksJson` thành nhiều nút.
3. **Sau**: mini lịch trình; so sánh giá; sitemap.xml + Search Console; critical
   CSS cho LCP; phân trang `/diem-den` có URL riêng từng trang (không noindex).
- **DoD**: mỗi mục có thể ship độc lập, không cần đợi toàn bộ xong mới release.

## Phase 10 — Go-live cutover

**Phụ thuộc**: Phase 1-9 đã test ổn trên LocalDB + staging.
1. Backup 2 bảng gốc thật trên production (destination-spec §8).
2. Chạy migration schema v2 THẬT trên production (sau backup, đã tập dượt Phase 1).
3. Đổi `.env` production sang connection thật (chỉ lúc này).
4. Đồng bộ mirror lần đầu → re-link toàn bộ → recompute related toàn bộ
   (thứ tự bắt buộc, destination-spec §12.4).
5. **Khoá nút import Destination + Hotel + Tour trên CMS cũ NGAY** (tránh wipe).
6. Website .NET trỏ schema mới, chạy song song kiểm tra 1-2 tuần trước khi bỏ
   bảng cũ (database-redesign §7 bước 8).
- **DoD**: gate M4 pass (bài AI lên web thật, update đè bài cũ, re-link chạy
  ổn) + khối khách sạn/tour/vé đọc đúng data zinoflow ghi.

## Phase 11 — Giai đoạn 2 (sau go-live, không cần làm ngay)

Theo lộ trình `dichoithoi-system-overview.md` §5: duyệt review chuyển hẳn về
AI tool, tự động cập nhật content theo lịch, UI quản lý taxonomy, tab "Ảnh"
(upload → convert/resize → FTP, xây `destination_images` — cũng là lúc điền
`GalleryJson` thật thay vì để trống), watermark/caption ảnh, job cào tự động
Hotel/Tour nếu khối lượng đủ lớn (backlog A.7).

---

# Phase 12+ — Tổng hợp phân tích 07/2026 (chưa commit lúc viết phase này)

Toàn bộ Phase 12-18 dưới đây tổng hợp các phân tích MỚI trong phiên làm việc
07/2026 (sau khi Phase 9 website đã chạy phần lớn) — đang ở dạng doc/spec,
CHƯA có dòng code nào. Nguyên tắc bắt buộc cho MỌI phase dưới: **mỗi phase phải
đổi ĐỒNG BỘ cả zinoflow (nơi tính/ghi) VÀ website dichoithoi (nơi đọc/hiển thị)
trong cùng 1 lần merge** — không rơi vào tình trạng đã phát hiện ở backlog
(cột `RelatedJson` zinoflow ghi đúng nhưng website chưa đọc, gây lệch 2 bên).
DoD của mỗi phase PHẢI kiểm tra được cả 2 đầu, không chỉ 1 bên.

## Phase 12 — Giá vé 2 nguồn + 3 khối nội dung mới cho Destination (ĐÃ XONG 07/2026)

**Phụ thuộc**: Phase 2 (destination), Phase 4 (ticketLinks) đã xong.
**Nguồn**: `content-seo-ux-plan.md` §5.4-§5.7, `destination-spec.md` §2.2,
`database-redesign.md` §4.3, `affiliate-link-conversion-spec.md` §2.

**Đã build**: contracts (`priceBreakdownItemSchema`, `practicalNoteItemSchema`,
`price` trong `affiliateLinkItemSchema`) + migration Postgres
`1781950000000-DestinationPriceBreakdownPracticalNotes` + cột SQL Server
(`scripts/dichoithoi-sqlserver/01-create-new-schema.sql`) + use-cases
(`update-price-breakdown`, `update-practical-notes`, `suggest-practical-notes`
— goi y RULE-BASED theo tu khoa ten/mo ta, chua goi LLM, xem
`domain/practical-notes-suggester.ts`) + prompt pack bat buoc heading
"văn hoá - lịch sử" + structure gate check heading nay + UI 2 editor moi
(`destination-price-breakdown-editor.tsx`, `destination-practical-notes-editor.tsx`)
+ website .NET (`DestinationExtrasModel`/`DestinationExtrasRepository`/
`Detail.cshtml`) render bảng giá, giá riêng ticketLinks, so sánh 2 số thật,
"Chi phí tham khảo", khối "Lưu ý thực tế".

- **Đồng bộ zinoflow**: thêm cột `PriceBreakdownJson`/`PracticalNotesJson`
  (Postgres mirror + migration + SQL Server `DestinationContent`); thêm field
  `price` (nullable) vào `affiliateLinkItemSchema` (chỉ ảnh hưởng
  `ticketLinks[]`, KHÔNG lan sang Hotel/Tour — đã xác nhận qua grep); form sửa
  điểm đến thêm khối "Giá vé theo đối tượng" (nhập tay, bảng {đối tượng, giá,
  ghi chú}) + ô giá cho từng `ticketLinks[]` item; prompt pack thêm mục bắt
  buộc "câu chuyện văn hoá - lịch sử" (không cột mới, chỉ prompt + structure
  gate); khối "Lưu ý thực tế" — AI gợi ý draft trong form, người dùng duyệt
  trước khi lưu.
- **Đồng bộ website**: render bảng giá theo đối tượng dưới `TicketPrice`; hiện
  giá riêng từng nút CTA ticketLinks nếu có; sửa §5.3 so sánh giá tại quầy vs
  online dùng 2 số thật (`PriceBreakdownJson` vs `ticketLinks[].price`) thay
  so sánh định tính hiện tại; render khối "Lưu ý thực tế" (đọc
  `PracticalNotesJson`); tính "Chi phí ước tính cho 1 chuyến" (thuần Razor,
  cộng `TicketPriceFrom`/Hotel/Tour `PriceFrom` đã đọc sẵn, KHÔNG cột DB mới).
- **DoD**: nhập giá theo đối tượng + giá 2 ticketLinks cho 1 điểm đến → publish
  → trang detail hiện đúng bảng giá + 2 nút CTA có giá riêng + dòng so sánh
  đúng 2 số thật + dòng chi phí ước tính đúng tổng.

## Phase 13 — Nhập toạ độ qua link Google Maps (chỉ zinoflow) (ĐÃ XONG 07/2026)

**Phụ thuộc**: không phụ thuộc phase nào khác, làm độc lập bất kỳ lúc nào.
**Nguồn**: `destination-spec.md` §2.1.1.

- **Đồng bộ zinoflow**: ô "Dán link Google Maps" trong form sửa điểm đến, parse
  regex (`!3d!4d` ưu tiên, fallback `@lat,lng`), resolve link rút gọn qua
  theo-redirect (1 HTTP request), điền vào 2 ô lat/lng có sẵn (vẫn sửa tay
  được).
- **Đồng bộ website**: KHÔNG đổi gì — lat/lng đã đồng bộ sẵn qua cột hiện có.
- **DoD**: dán link Suối Tiên mẫu ở đầu bài này → 2 ô lat/lng tự điền đúng
  `10.8661916, 106.8005929` (ưu tiên đọc từ `!3d!4d` nếu link mẫu có).

## Phase 14 — `AncestorsJson`/`ChildrenJson` (breadcrumb + danh sách con precompute) (ĐÃ XONG 07/2026)

**Phụ thuộc**: Phase 2 (destination, đã có `kind`/`ParentId`/`ProvinceId`).
**Nguồn**: `database-redesign.md` §3.4/§4.3.

- **Đồng bộ zinoflow**: thêm cột SQL Server `DestinationContent.AncestorsJson`/
  `ChildrenJson` (idempotent, không cột Postgres mirror — cùng pattern
  `RelatedJson`: precompute, ghi thẳng SQL Server, không cần user sửa tay);
  domain `ancestors-children-builder.ts` (`buildAncestors` đi từ `parentSlug`
  lên gốc có guard chu trình, `buildChildren` toàn bộ con trực tiếp ĐÃ PUBLISH,
  không cắt 8 như `RelatedJson`); `RecomputeRelatedService.run()` tính thêm 2
  khối này mỗi lần recompute; trigger MỚI
  `affectedSlugsForParentChange()` (BFS toàn bộ con cháu + cha cũ/cha mới) gọi
  từ `UpsertDestinationUseCase.update()` khi `parentSlug` đổi.
- **Đồng bộ website**: `BreadcrumbUtils.CreateDestinationDetailBreadcrumb` nhận
  thêm `ancestors` (ưu tiên dùng khi có — chính xác theo cây `ParentId`/`kind`
  thật, không suy từ `ProvinceId`/`DestinationGroupId` cũ nữa); breadcrumb hiện
  có sẵn qua `SetBreadcrumbs`/`_Layout.cshtml` nên chỉ cần đổi nguồn dữ liệu.
  **`ChildrenJson` CHƯA render thành lưới riêng trên website**: trang cluster/
  province hiện đã lấy đủ danh sách con (không cắt) qua query schema v1 cũ
  (`childs = childDes` khi `IsGroup`/`IsProvince`, xem
  `DestinationController.cs`) — thêm 1 lưới trùng dữ liệu từ `ChildrenJson` lúc
  này sẽ là nội dung trùng lặp vô ích. `ChildrenJson` đã sẵn sàng ở DB, sẽ dùng
  thay query v1 khi Phase 10 (go-live cutover) bỏ hẳn schema cũ.
- **DoD**: đổi 1 điểm từ cụm A sang cụm B → publish → breadcrumb đúng cụm mới
  (đã test `ancestors-children-builder.spec.ts` cho builder, build .NET sạch
  cho phần đọc/render); `ChildrenJson` của CẢ cụm A và cụm B đều cập nhật đúng
  trong DB (xác nhận qua `RecomputeRelatedService`, chưa có UI hiển thị riêng
  như nêu trên).

## Phase 15 — Tối ưu tốc độ trang detail (bỏ query sống Hotel/Tour + cache review) (ĐÃ XONG 07/2026)

**Phụ thuộc**: Phase 5 (hotel), Phase 6 (tour) đã xong.
**Nguồn**: `database-redesign.md` §3.4/§4.3, phát hiện từ
`DestinationExtrasRepository.GetExtrasBySlugAsync`.

- **Đã build — đồng bộ zinoflow**: cột `HotelCardsJson`/`TourCardsJson`
  (`DestinationContent`, idempotent); `RecomputeHotelCardsUseCase`/
  `RecomputeTourCardsUseCase` (module hotel/tour, ghi qua `DICHOITHOI_SITE_DB`
  đã export sẵn từ `DestinationModule`) tính lại 2 CHIỀU: `forDestination`
  (gán/gỡ hotel-tour khỏi 1 điểm đến) và `forHotel`/`forTour` (đổi giá/rating
  → quét NGƯỢC mọi điểm đến đang gán qua `findDestinationSlugsForHotel/Tour`
  rồi tính lại từng điểm) — wire vào `AssignHotelToDestinationUseCase`,
  `AssignTourToDestinationUseCase`, `UpsertHotelUseCase.update()`,
  `UpsertTourUseCase.update()`. `HOTEL_CARD_TAKE`/`TOUR_CARD_TAKE = 6` khớp
  đúng hằng số cũ bên website (`DestinationExtrasService.cs`).
- **Đã build — đồng bộ website**: `DestinationExtrasRepository.GetExtrasBySlugAsync`
  bỏ hẳn JOIN+ORDER BY+TAKE sống với `V2HotelDestinationMap`/
  `V2TourDestinationMap`, đọc thẳng `HotelCardsJson`/`TourCardsJson`; bỏ tham
  số `hotelTake`/`tourTake` (không còn ý nghĩa, số lượng đã cố định lúc
  precompute); `AvgRating`/`ReviewCount` đọc thẳng từ `V2Destination` (đã có từ
  Phase migrate v1→v2) thay vì `.Average()`/`.Count()` trên toàn bộ danh sách
  review mỗi lần render — danh sách review (nội dung bình luận hiển thị) vẫn
  đọc như cũ, chỉ bỏ phần tổng hợp lại.
- **Lưu ý phát sinh khi build**: rà `DiChoiThoi.Web`/`DiChoiThoi.Service` xác
  nhận **CHƯA có endpoint nào ghi `V2DestinationReview` mới** (không tìm thấy
  `[HttpPost]` review/rating nào) — vế "sửa luồng ghi review cập nhật
  AvgRating/ReviewCount ngay lúc insert" trong bản kế hoạch gốc giả định 1
  tính năng chưa tồn tại trong repo; hoãn tới khi tính năng "khách gửi đánh
  giá" thực sự được xây, lúc đó bắt buộc phải update 2 cột này ngay trong cùng
  transaction insert review (không được để lại tính `.Average()` mỗi render).
- **DoD**: đổi giá 1 hotel đã gán cho 1 điểm đến (không đụng destination đó)
  → trang detail hiện giá mới KHÔNG cần publish lại destination (xác nhận qua
  `RecomputeHotelCardsUseCase.forHotel`, build .NET sạch cho phần đọc); số
  query SQL cho khối Hotel/Tour/Review-aggregate của 1 lần load trang detail
  giảm từ 3 query sống (2 JOIN Hotel/Tour + 1 review list để tính Average)
  xuống 0 — chỉ còn đọc thẳng cột đã precompute.

## Phase 16 — Module Sản phẩm (affiliate qua tag trong bài viết) (ĐÃ XONG 07/2026)

**Phụ thuộc**: Phase 3 (affiliate), Phase 8 (article + block compiler) đã xong.
**Nguồn**: `dichoithoi-product-spec.md`.

**Quyết định chốt lúc build** (mục #5 "còn treo" của spec — đã hỏi người dùng):
danh sách `category` = **tự do nhập + gợi ý autocomplete** từ giá trị đã dùng
(`GET /products/categories`, `DISTINCT category`), KHÔNG bảng quản lý riêng —
đúng tinh thần MVP nhập tay của cả module.

- **Đã build — đồng bộ zinoflow**: module `product` đủ 4 lớp (domain
  `product-matcher.ts` — match tag OR + lọc category + sort theo số tag khớp
  rồi mới nhất, có unit test; application: `ListProductsUseCase`,
  `UpsertProductUseCase`, `ListProductCategoriesUseCase`; infrastructure:
  `ProductEntity` + `TypeOrmProductRepository`, bảng `products` Postgres-only,
  KHÔNG đồng bộ SQL Server; presentation: `products.controller.ts`); thêm
  `products`/`product` vào `BLOCK_KINDS` (`block-token.ts`) + resolver trong
  `article-block-compiler.service.ts` (validate tham số bắt buộc `tag`/`id`,
  card dùng `renderCardGrid` có sẵn — không cần template mới); UI màn "Sản
  phẩm" (`/dichoithoi/san-pham`) — list + form tên/category (datalist gợi ý)/
  tags (nhập phẩy)/giá/link gốc; thêm vào sidebar nhóm Dichoithoi (Phase 20).
- **AI gợi ý chèn khối (áp dụng chung mọi kind)**: xác nhận cơ chế `BLOCK_KINDS`
  + compiler đã tổng quát cho MỌI kind (không đặc thù Product); việc "AI tự
  gợi ý" là do prompt của từng `articleType` quyết định — `PromptBuilder` đã
  ưu tiên đọc prompt từ DB (`/prompts` UI) trước khi rơi về `DEFAULT_PROMPTS`,
  nên không cần cơ chế mới. Rà soát phát hiện: `cam-nang.outline/section/frame.vi`
  (bài cẩm nang — nơi chèn khối Product) **CHƯA có prompt mặc định nào trong
  `DEFAULT_PROMPTS`** lẫn migration seed — nếu chưa từng tạo qua `/prompts` UI,
  generate bài cẩm nang sẽ throw lỗi "No prompt template". Đây là khoảng trống
  thuộc Phase 8 (module article), không phải lỗi của Phase 16 — ghi nhận lại,
  chưa xử lý (không mở rộng scope phase này).
- **Đồng bộ website**: KHÔNG cần đổi gì — card sản phẩm nằm sẵn trong
  `ContentHtml` đã compile lúc publish bài, website chỉ render HTML như mọi
  bài khác.
- **DoD**: thêm 2-3 sản phẩm mẫu (tag `phuot`) qua UI → viết bài chèn
  `[[block:products tag=phuot limit=4]]` → compiler test (`article-block-
  compiler.service.spec.ts`) xác nhận render đúng card kèm giá + badge category;
  248→255 test API pass, `tsc` sạch api+web, migration `ProductModule` đã chạy
  DB dev.

## Phase 17 — Cache hạ tầng cho hosting SmarterASP .NET Advance (ĐÃ XONG 07/2026)

**Phụ thuộc**: Phase 9 (website) đã có route chính; nên làm SAU Phase 14/15
(tránh cache dữ liệu sắp đổi cấu trúc).
**Nguồn**: `content-seo-ux-plan.md` §10.5.1, `system-design.md` §5 mục 9.

**Phát hiện lúc rà soát**: endpoint invalidate-cache "hiện có" mà plan nhắc tới
là có thật — `GET /api/remove-cache/{id}` trong `HomeController.cs`, trước giờ
chỉ xoá vài named key cố định (`top_destination`, `top_hotel`,...) qua link bấm
tay trong CMS cũ (`CmsDiChoiThoi.Web`), KHÔNG có xác thực, và KHÔNG có endpoint
nào được zinoflow gọi tự động cả — đây là phần mới hoàn toàn của phase này.

- **Đồng bộ website (.NET)**:
  - Bật `OutputCache` middleware (`Program.cs`) — chính sách `"DestinationDetail"`
    (`DiChoiThoi.Web/Caching/DestinationDetailCachePolicy.cs`) áp cho route
    `/diem-den/{id}`: TTL 6 giờ, GẮN TAG `"destination:{slug}"` (route value
    `id`) để purge đúng 1 URL, không xoá nhầm toàn bộ.
  - Mở rộng `RemoveDestinationCache` (đã đổi tên hiệu ứng, giữ nguyên route) —
    thêm nhánh `id` dạng `"destination:{slug}"` gọi
    `IOutputCacheStore.EvictByTagAsync`. Các key cũ (`top_destination`,...) giữ
    nguyên hành vi, không phá vỡ các nút bấm tay trong CMS cũ.
  - **Canonical cho filter**: rà lại toàn bộ route hiện có (`/loai`, `/tinh`,
    `/search`,...) — `_Layout.cshtml` ĐÃ tự build canonical từ
    `Context.Request.Path` (bỏ query string) khi `PageInfo.Canonical` không set,
    và không route nào hiện dùng query-string filter (trừ `/search` đã
    `NoIndex=true` sẵn) → mục này ĐÃ đạt từ trước, không cần sửa gì.
  - **Sitemap chia file khi vượt ngưỡng**: thêm `WriteChunkedUrlset` (ngưỡng
    40.000 URL/file) trong `HomeController.cs`, áp cho
    `CreateDestinationSiteMapAsync` (loại duy nhất có khả năng vượt ngưỡng ở quy
    mô hiện tại) — tự sinh `destination-sitemap-1.xml`, `-2.xml`,... và đưa đúng
    số file vào `sitemap_index.xml` khi vượt; dưới ngưỡng vẫn ra đúng 1 file
    `destination-sitemap.xml` như cũ.
- **Đồng bộ zinoflow**: `CachePurgePort`/`CACHE_PURGE`
  (`modules/destination/application/ports/cache-purge.port.ts`) +
  `HttpCachePurgeAdapter` (`infrastructure/cache/http-cache-purge.adapter.ts`) —
  `purgeDestination(slug)` gọi ĐỒNG THỜI (a) endpoint
  `/api/remove-cache/destination:{slug}` của website (tầng 1) và (b) Cloudflare
  Purge Cache API cho URL `{DICHOITHOI_PUBLIC_BASE_URL}/diem-den/{slug}` (tầng
  2, CHỈ gọi khi đã cấu hình `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ZONE_ID` — bỏ
  qua nếu chưa có, không chặn publish). Lỗi purge chỉ log cảnh báo, KHÔNG throw
  (publish đã xong trước đó, cache tự hết hạn theo TTL dù sao). Gọi ở 2 chỗ:
  `PublishDestinationUseCase` (slug vừa publish, vì ContentHtml đổi mà
  RelatedJson/Ancestors/Children có thể KHÔNG đổi) và `RecomputeRelatedService`
  (mọi slug bị ảnh hưởng có `relatedChanged || treeChanged`, vd khi đổi cha,
  gán/gỡ Hotel-Tour, publish điểm khác kéo theo).
  Config mới trong `.env.example`: `DICHOITHOI_SITE_BASE_URL` (bắt buộc để bật
  tầng 1), `DICHOITHOI_PUBLIC_BASE_URL`/`CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ZONE_ID`
  (tầng 2, để trống = tắt).
- **Việc CẦN BẠN tự làm (ngoài khả năng của AI tool)**:
  1. Tạo Cloudflare account (free tier) + trỏ DNS `dichoithoi.com` qua Cloudflare
     + bật Page Rule/Cache Rule "Cache Everything" cho `/diem-den/*`, `/tinh/*`,
     `/loai/*`, rồi điền `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ZONE_ID` vào `.env`
     production — chưa làm, cần tài khoản thật của bạn.
  2. Kiểm tra gói SmarterASP Advance có Task Scheduler/Cron trong control panel
     không (warm-up app pool sau recycle) — vẫn CHƯA xác nhận được từ xa.
- **DoD đã xác nhận**: `dotnet build` sạch; publish 1 điểm đến qua zinoflow (dev,
  `DICHOITHOI_SITE_BASE_URL=http://localhost:5176`) gọi đúng
  `/api/remove-cache/destination:{slug}`, các slug khác không bị đụng tới (tag
  theo slug, không xoá `all`); 257 test API vẫn pass, `tsc` sạch api+web.
  Lighthouse trước/sau và test Cloudflare thật CHƯA đo được — phụ thuộc việc cần
  bạn tự làm ở trên.

## Phase 18 — Đập đi làm lại UI website (mobile-first, stack nhẹ, theme mới)

**Phụ thuộc**: Phase 14 (cần `AncestorsJson`/`ChildrenJson` cho breadcrumb +
danh sách con). Nên làm SAU Phase 17 (cache) để không phải cache lại 2 lần.
**Nguồn**: `content-seo-ux-plan.md` §10 (toàn bộ), `seo-principles.md`
(bắt buộc áp dụng checklist 3 câu hỏi cho từng mảnh UI khi code).

- **Đồng bộ website (module này gần như thuần website, zinoflow không đổi)**:
  bỏ Bootstrap/jQuery/icon font hiện tại; dựng pipeline Tailwind compile-time
  (purge) + theme 7 màu (§10.5); vanilla JS cho drawer/carousel/accordion;
  SVG inline; layout mobile-first cho trang chủ (§10.2), trang danh mục
  (§10.3), trang chi tiết theo `kind` — RIÊNG phần render khác nhau theo
  `kind=poi`/`cluster` (2 biến thể)/`province` (redirect) **CHƯA xác nhận
  cuối** (§10.6) — cần bạn chốt lại trước khi code đúng phần này, có thể tách
  build sau các phần đã chắc chắn (§10.1/10.2/10.3/10.5/10.7).
- **DoD**: Lighthouse Performance ≥ 90 trên 3 trang mẫu (chủ, danh mục, chi
  tiết); mọi nội dung quan trọng có mặt đầy đủ trên mobile (không ẩn khỏi DOM
  chỉ vì hẹp màn hình, trừ `<details>` gấp — vẫn nằm trong DOM).

## Phase 19 — Search trong RAM (thay live `LIKE` query)

**Phụ thuộc**: không phụ thuộc phase nào, có thể làm bất kỳ lúc nào — độc lập
với 12-18. **Nguồn**: `database-redesign.md` §1.3/§6.

Phát hiện lúc rà soát 07/2026: `/search` hiện tại
(`DestinationRepository.GetListAsync`) chạy `SearchKeyword.Contains(keyword)`
→ dịch ra SQL `LIKE '%keyword%'` (có `%` đầu, KHÔNG dùng được index, full table
scan mỗi lần search) + `RemoveUnicode()` tính lại mỗi request — chậm dần khi số
điểm đến tăng, độc lập với việc tách bảng nóng/lạnh đã làm.

- **Đồng bộ zinoflow**: đảm bảo cột `NameUnaccented` đã ghi sẵn lúc publish
  (đã có trên `Destination` — chỉ cần xác nhận không NULL cho dữ liệu cũ).
- **Đồng bộ website**: load 1 lần lúc app start (hoặc lúc cache invalidate)
  đúng 6 cột nhẹ (`Id, Slug, Name, NameUnaccented, Kind, ProvinceId,
  Thumbnail`) vào `IMemoryCache`/static list; sửa `/search` chạy prefix/contains
  TRÊN RAM, bỏ hẳn query `LIKE` xuống SQL Server; refresh danh sách khi có
  publish mới (dùng cùng cơ chế invalidate cache đã có — Phase 17).
- **DoD**: search 1 từ khoá bất kỳ → không có query SQL nào chạy (xác nhận qua
  log/profiler); thêm 1 điểm đến mới + publish → search ra ngay sau khi cache
  refresh, không cần restart app; đo thời gian phản hồi `/search` trước/sau.

---

## Phase 20 — Điều hướng CMS: sidebar-first, không nhét vào header trang (ĐÃ XONG)

**Phụ thuộc**: không phụ thuộc phase nào — chỉ sửa `apps/web` (zinoflow), không
đụng website dichoithoi.

Phát hiện lúc rà soát 07/2026: trang `/dichoithoi` (hub Điểm đến) nhét cả link
điều hướng module con ("Khách sạn", "Tour", "Quy tắc affiliate") lẫn nút hành
động ("+ Thêm điểm đến", "Nhập từ file", "Đồng bộ từ website") chung 1 hàng ở
đầu trang → hàng nút phình to, khó phân biệt "đi tới trang khác" với "thực
hiện hành động trên trang này".

- **Đồng bộ zinoflow**: chuyển 3 mục điều hướng module con
  (`/dichoithoi/khach-san`, `/dichoithoi/tour`, `/dichoithoi/affiliate`) từ
  hàng nút trong `app/dichoithoi/page.tsx` sang nhóm "Dichoithoi" trong
  `shared/sidebar.tsx` (cạnh Điểm đến/Tra cứu địa chỉ/Quy trình); hàng nút đầu
  trang chỉ còn giữ hành động thật trên chính trang đó (thêm mới, nhập file,
  bài cẩm nang, đồng bộ).
- **Đồng bộ website**: không áp dụng — đây là điều hướng nội bộ công cụ CMS,
  không phải website dichoithoi.com.
- **Quy tắc áp dụng cho MỌI trang sau này** (không chỉ phase này): nếu một
  link dẫn sang 1 trang/module khác (xem danh sách, quản lý 1 thực thể khác)
  → luôn là mục trong sidebar trái, KHÔNG phải nút trong page header; page
  header chỉ chứa hành động thực hiện ngay trên trang đang xem (tạo mới, nhập
  file, đồng bộ, lưu...). Khi thêm trang/module mới cho dichoithoi (Phase
  16 Sản phẩm, Phase 18 UI mới, v.v.) phải thêm mục sidebar tương ứng ngay khi
  tạo route, không để dồn lại nhét vào header như đã xảy ra ở đây.
- **DoD**: mở `/dichoithoi` → sidebar trái nhóm "Dichoithoi" có đủ Điểm đến/
  Tra cứu địa chỉ/Khách sạn/Tour/Quy tắc affiliate/Quy trình; hàng nút đầu
  trang chỉ còn nút hành động; `tsc --noEmit` sạch.

---

## Còn treo — CHƯA đủ điều kiện đưa vào phase code (cần bạn quyết định trước)

- **`kind=cluster` 2 biến thể + trục vùng/miền** (§10.6) — chưa xác nhận cuối,
  chặn 1 phần Phase 18.
- **Rà soát lại `DestinationType`/`DestinationTypeMap`** đã gắn cho từng điểm
  đến (backlog §A.8) — chưa chọn AI đánh giá hay tự tay chuẩn hoá.
- **Chuẩn hoá danh sách `category` cho Product** (product-spec §8.5) — chặn 1
  phần nhỏ Phase 16 (màn quản lý), không chặn phần block compiler.

---

## Bảng tổng hợp phụ thuộc (đọc nhanh)

```
Phase 0 (dev env)
  └─ Phase 1 (schema v2, LocalDB)
       ├─ Phase 2 (destination) ──────┬─ Phase 4 (ticketLinks, cần Phase 3)
       │                              │
       ├─ Phase 3 (affiliate) ────────┼─ Phase 5 (hotel)
       │                              └─ Phase 6 (tour)
       └─ Phase 7 (viết tay, độc lập) ─── Phase 8 (article, cần 2+5+6+7)

Phase 9 (website .NET)  — song song từ sớm, không chặn ai
Phase 10 (go-live)      — cần 1-9 ổn định
Phase 11 (giai đoạn 2)  — sau go-live

Phase 12 (giá vé + 4 khối content)  — cần 2+4, độc lập với 13-18
Phase 13 (Google Maps link parser)  — độc lập hoàn toàn
Phase 14 (Ancestors/ChildrenJson)   — cần 2 (kind/ParentId có sẵn)
Phase 15 (bỏ query sống Hotel/Tour) — cần 5+6
Phase 16 (module Sản phẩm)          — cần 3+8
Phase 17 (cache hạ tầng)            — nên sau 14+15, ĐÃ XONG (07/2026)
Phase 18 (đập đi làm lại UI)        — cần 14, nên sau 17
  └─ 1 phần bị CHẶN bởi quyết định "kind=cluster 2 biến thể + vùng/miền"
     chưa xác nhận (xem mục "Còn treo" phía trên)
Phase 19 (search trong RAM)         — độc lập, làm bất kỳ lúc nào
Phase 20 (sidebar-first nav CMS)    — độc lập, ĐÃ XONG (07/2026)
```
