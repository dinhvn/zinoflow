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

## Phase 12 — Giá vé 2 nguồn + 3 khối nội dung mới cho Destination

**Phụ thuộc**: Phase 2 (destination), Phase 4 (ticketLinks) đã xong.
**Nguồn**: `content-seo-ux-plan.md` §5.4-§5.7, `destination-spec.md` §2.2,
`database-redesign.md` §4.3, `affiliate-link-conversion-spec.md` §2.

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

## Phase 13 — Nhập toạ độ qua link Google Maps (chỉ zinoflow)

**Phụ thuộc**: không phụ thuộc phase nào khác, làm độc lập bất kỳ lúc nào.
**Nguồn**: `destination-spec.md` §2.1.1.

- **Đồng bộ zinoflow**: ô "Dán link Google Maps" trong form sửa điểm đến, parse
  regex (`!3d!4d` ưu tiên, fallback `@lat,lng`), resolve link rút gọn qua
  theo-redirect (1 HTTP request), điền vào 2 ô lat/lng có sẵn (vẫn sửa tay
  được).
- **Đồng bộ website**: KHÔNG đổi gì — lat/lng đã đồng bộ sẵn qua cột hiện có.
- **DoD**: dán link Suối Tiên mẫu ở đầu bài này → 2 ô lat/lng tự điền đúng
  `10.8661916, 106.8005929` (ưu tiên đọc từ `!3d!4d` nếu link mẫu có).

## Phase 14 — `AncestorsJson`/`ChildrenJson` (breadcrumb + danh sách con precompute)

**Phụ thuộc**: Phase 2 (destination, đã có `kind`/`ParentId`/`ProvinceId`).
**Nguồn**: `database-redesign.md` §3.4/§4.3.

- **Đồng bộ zinoflow**: thêm 2 cột JSON (Postgres + SQL Server
  `DestinationContent`); mở rộng `RecomputeRelatedService`/`related-builder.ts`
  tính thêm `AncestorsJson` (đi từ `parentSlug` lên gốc) và `ChildrenJson`
  (toàn bộ con trực tiếp, không cắt 8 như `RelatedJson`); trigger tính lại khi
  publish HOẶC khi đổi `parentSlug` của chính nó/con nó.
- **Đồng bộ website**: render breadcrumb từ `AncestorsJson` (thay vì không có/
  query đệ quy nếu đang làm vậy); render lưới "Các khu/điểm trong [tên]" từ
  `ChildrenJson` trên trang cluster.
- **DoD**: đổi 1 điểm từ cụm A sang cụm B → publish → breadcrumb đúng cụm mới,
  `ChildrenJson` của CẢ cụm A (mất con) và cụm B (thêm con) đều cập nhật đúng.

## Phase 15 — Tối ưu tốc độ trang detail (bỏ query sống Hotel/Tour + cache review)

**Phụ thuộc**: Phase 5 (hotel), Phase 6 (tour) đã xong.
**Nguồn**: `database-redesign.md` §3.4/§4.3, phát hiện từ
`DestinationExtrasRepository.GetExtrasBySlugAsync`.

- **Đồng bộ zinoflow**: thêm cột `HotelCardsJson`/`TourCardsJson`
  (`DestinationContent`); job tính lại 2 CHIỀU — (a) lúc publish destination
  (như related), (b) MỚI: lúc 1 Hotel/Tour đổi giá/rating/mapping → quét mọi
  destination liên quan và tính lại (chiều ngược, khác cơ chế related hiện có).
- **Đồng bộ website**: SỬA `DestinationExtrasRepository.GetExtrasBySlugAsync`
  — bỏ hẳn JOIN+ORDER BY+TAKE sống với `V2HotelDestinationMap`/
  `V2TourDestinationMap`, đọc thẳng `HotelCardsJson`/`TourCardsJson`; sửa luồng
  ghi review (nơi website tự ghi, ngoại lệ single-writer) để UPDATE
  `AvgRating`/`ReviewCount` trên `V2Destination` ngay lúc insert, bỏ tính
  `.Average()` toàn bộ list mỗi lần render.
- **DoD**: đổi giá 1 hotel đã gán cho 1 điểm đến (không đụng destination đó)
  → trang detail hiện giá mới KHÔNG cần publish lại destination; đếm số query
  SQL cho 1 lần load trang detail giảm từ ~7 xuống 1 chính + tối đa 1 phụ.

## Phase 16 — Module Sản phẩm (affiliate qua tag trong bài viết)

**Phụ thuộc**: Phase 3 (affiliate), Phase 8 (article + block compiler) đã xong.
**Nguồn**: `dichoithoi-product-spec.md`.

- **Đồng bộ zinoflow**: module `product` mới đủ 4 lớp (domain/application/
  infrastructure/presentation); bảng `products` (Postgres, KHÔNG đồng bộ SQL
  Server); thêm kind `products`/`product` vào `BLOCK_KINDS`
  (`block-token.ts`) + resolver trong `article-block-compiler.service.ts`
  (match tag kiểu OR, sort theo số tag khớp); UI màn "Sản phẩm" (list, form
  category/tags/affiliate); AI gợi ý chèn khối lúc generate bài (áp dụng
  chung mọi kind, không riêng Product).
- **Đồng bộ website**: KHÔNG cần đổi gì — card sản phẩm nằm sẵn trong
  `ContentHtml` đã compile lúc publish bài, website chỉ render HTML như mọi
  bài khác.
- **DoD**: thêm 2-3 sản phẩm mẫu (tag `phuot`), viết bài chèn
  `[[block:products tag=phuot limit=4]]` → publish → bài hiện đúng card sản
  phẩm kèm giá + link affiliate.

## Phase 17 — Cache hạ tầng cho hosting SmarterASP .NET Advance

**Phụ thuộc**: Phase 9 (website) đã có route chính; nên làm SAU Phase 14/15
(tránh cache dữ liệu sắp đổi cấu trúc).
**Nguồn**: `content-seo-ux-plan.md` §10.5.1, `system-design.md` §5 mục 9.

- **Đồng bộ zinoflow**: mở rộng endpoint/job "invalidate cache" hiện có — gọi
  THÊM Cloudflare Purge Cache API (theo đúng URL vừa đổi) sau khi publish,
  cần thêm config API token Cloudflare.
- **Đồng bộ website**: bật ASP.NET Core `OutputCache` middleware (in-memory,
  TTL vài giờ) cho các route content-heavy; cấu hình Cloudflare (DNS + Page
  Rule "Cache Everything" cho `/diem-den/*`, `/tinh/*`, `/loai/*`); thêm
  `<link rel="canonical">` cho tổ hợp filter; sitemap tách file khi vượt
  ngưỡng 40.000 URL/file.
- **Việc cần bạn tự kiểm tra trước phase này**: gói SmarterASP Advance có tính
  năng Task Scheduler/Cron trong control panel không (warm-up app pool sau
  recycle) — chưa xác nhận được từ xa.
- **DoD**: publish 1 điểm đến → gọi thử URL đó thấy nội dung mới (cache đã bị
  xoá đúng URL ở cả 2 tầng); các URL KHÔNG liên quan vẫn giữ cache cũ (không
  xoá nhầm toàn bộ); đo Lighthouse trước/sau xác nhận Performance tăng.

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
Phase 17 (cache hạ tầng)            — nên sau 14+15
Phase 18 (đập đi làm lại UI)        — cần 14, nên sau 17
  └─ 1 phần bị CHẶN bởi quyết định "kind=cluster 2 biến thể + vùng/miền"
     chưa xác nhận (xem mục "Còn treo" phía trên)
Phase 19 (search trong RAM)         — độc lập, làm bất kỳ lúc nào
```
