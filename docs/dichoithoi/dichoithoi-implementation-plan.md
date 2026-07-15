# Dichoithoi — Kế hoạch triển khai (Implementation Plan, 07/2026)

Kế hoạch build cụ thể, theo thứ tự phụ thuộc thật (không phải danh sách ước
muốn) — dựa trên bản đồ hệ thống ở
[dichoithoi-system-design.md](dichoithoi-system-design.md) và danh sách quyết
định/rủi ro ở [dichoithoi-backlog.md](dichoithoi-backlog.md). Mỗi phase có:
mục tiêu, việc cụ thể, **Definition of Done (DoD)**, phụ thuộc phase trước.

Nguyên tắc lập kế hoạch: build từng lát mỏng kiểm chứng được (không big-bang
đại tu toàn bộ rồi mới test), ưu tiên ROI cao trước, không chặn phase sau bởi
việc chưa cần dùng ngay.

## Phase 0 — Môi trường dev an toàn (làm TRƯỚC MỌI THỨ) (PHẦN LỚN XONG — re-verify 07/2026: hạ tầng LocalDB đúng; `DICHOITHOI_DB_HOST` đã trỏ LocalDB an toàn; 4 tích hợp còn lại (FTP ảnh, SQL Server khuyến mãi, WordPress laruki/dochoi3s) CHƯA có sandbox riêng — giữ nguyên credential thật theo quyết định 07/2026 của user, đã thêm cảnh báo rõ ràng lúc khởi động thay vì âm thầm dùng — xem `modules/shared/observability/production-endpoint-warning.ts`)

**Mục tiêu**: không ai code/test chạm production trong lúc build.
- Chạy `pnpm clone:dichoithoi` → tạo `dichoithoi_dev` LocalDB.
- Đổi `.env` local sang `DICHOITHOI_DB_HOST=(localdb)\MSSQLLocalDB`.
- **DoD**: `apps/api` chạy dev với connection trỏ LocalDB, health check xác
  nhận kết nối `dichoithoi_dev`, KHÔNG còn connection string production trong
  `.env` của bất kỳ máy dev nào.

## Phase 1 — Schema v2 (chạy trên LocalDB clone trước) (ĐÃ XONG — re-verify 07/2026: đã chạy lại checklist row-count trên `dichoithoi_dev` — Province=34, Destination=271, DestinationContent=271, DestinationTypeGroup=3, DestinationType=18, DestinationTypeMap=399, khớp kỳ vọng; Hotel/Tour/Article=0 đúng vì chưa publish cái nào lên SQL Server thật)

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

## Phase 2 — Module `destination` (lõi M4) (ĐÃ XONG — re-verify 07/2026: gate ≥800 từ đã có sẵn từ trước (header cũ ghi nhầm "thiếu", đã sửa — xem commit `2aaedf4`); relink giờ đã qua pg-boss worker — xem mục dưới)

**Phụ thuộc**: Phase 1. **Nguồn**: `dichoithoi-destination-spec.md`.
1. `domain/`: entity mirror, engine auto-link (unit test kỹ — escape regex,
   không replace trong thẻ `<a>`, sort tên dài→ngắn), quality gates travel
   (kèm ngưỡng ≥800 từ — `destination-gates.ts` `MIN_TOTAL_WORDS`).
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

**Relink qua pg-boss (07/2026)**: `POST /destinations/relink` giờ CHỈ còn xem
trước (dryRun, đọc-only, chạy đồng bộ — cần trả báo cáo chi tiết ngay để admin
duyệt trước khi ghi). Ghi thật chuyển sang `POST /destinations/relink/apply`
(fire-and-forget qua queue `destination.relink`, `RelinkAllWorker` — cùng
pattern với `hotel.auto-assign`). UI: nút "Re-link (xem trước)" không đổi;
nút "Áp dụng N link" giờ gọi endpoint mới, hiện toast "Đã đưa vào hàng đợi"
thay vì chờ report — report đã hiện đủ ở bước xem trước ngay trước đó, không
mất thông tin. Verify thật: dry-run trước cho `changed=14`, gọi apply, dry-run
lại ngay sau đó cho `changed=0` — xác nhận worker đã ghi xong.

## Phase 3 — Module `affiliate` (nền tảng, TRƯỚC Hotel/Tour) (ĐÃ XONG — re-verify 07/2026: resolver + manual-override đúng; job "áp dụng lại" đã chuyển qua pg-boss (`affiliate.reapply`, `ReapplyAffiliateRuleWorker`), UI đã nhóm nút "Áp dụng lại TOÀN BỘ rule" dưới khối "Công cụ")

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

## Phase 4 — `ticketLinks[]` cho Destination (phụ thuộc Phase 2+3) (ĐÃ XONG — re-verify 07/2026: PASS đầy đủ, không còn bookingUrl sống ở đâu)

Đổi `bookingUrl` (1 link, code hiện tại) → `ticketLinks[]` (nhiều link):
1. Contracts: sửa Zod schema (`packages/contracts/src/dichoithoi/destination.ts`).
2. Mirror entity + migration Postgres.
3. Publisher/adapter SQL Server: ghi `TicketLinksJson` (DestinationContent),
   gọi `AffiliateLinkResolver` (Phase 3) trước khi lưu.
4. UI form: nhiều dòng provider/label/sourceUrl + preview affiliateUrl.
- **DoD**: thêm 2 link Klook + TripVision cho 1 điểm đến → publish → cả 2 có
  `affiliateUrl` đúng, field cũ `bookingUrl` không còn dùng.

## Phase 5 — Module `hotel` (ĐÃ XONG — re-verify 07/2026 (vòng 2): 2 mục ghi "còn thiếu" ở lần re-verify trước ĐÃ CÓ SẴN trong code, header cũ chỉ chưa cập nhật — `IHotelPublisher` chính là `HotelSiteDb` port (`hotel-site-db.port.ts`, đặt tên theo đúng convention `<Module>SiteDb` dùng chung toàn dự án thay vì "Publisher"), `AffiliateUrlPreview` đã render trong `khach-san/page.tsx` dòng 188 — không có gap thật nào cần code thêm)

**Phụ thuộc**: Phase 3 (affiliate). **Nguồn**: `dichoithoi-hotel-spec.md`.
1. Bảng `hotels`/`hotel_destination_map` (Postgres) + `Hotel`/`HotelDestinationMap`
   (SQL Server, MỚI — thay `HotelGroupId` legacy).
2. `IHotelPublisher`, nhập tay trước (MVP), crawler sau khi chọn OTA (backlog A.4).
3. Job gán tự động theo khoảng cách (haversine, tái dùng công thức recompute related).
4. UI: mục "Khách sạn" — bảng, form (dán sourceUrl → preview affiliateUrl).
- **DoD**: thêm 1 khách sạn tay, gán vào 1 điểm đến → publish → query
  `HotelDestinationMap JOIN Hotel WHERE DestinationSlug=@slug` ra đúng card data.

## Phase 6 — Module `tour` (ĐÃ XONG — re-verify 07/2026 (vòng 2): nhiều-điểm-đến (many-to-many) đúng; job tự gán theo khoảng cách KHÔNG áp dụng cho Tour theo đúng thiết kế (tour-spec xác nhận Tour không có lat/lng riêng, chỉ gắn qua bảng map — không phải gap); preview affiliateUrl UI ghi "còn thiếu" ở lần re-verify trước ĐÃ CÓ SẴN — `AffiliateUrlPreview` render trong `tour/page.tsx` dòng 178)

**Phụ thuộc**: Phase 3. **Nguồn**: `dichoithoi-tour-spec.md`. Giống hệt cấu
trúc Phase 5 (Hotel), khác field đặc thù (`duration_days/nights`,
`departure_from`) + map nhiều-điểm-đến (`tour_destination_map`).
- **DoD**: thêm 1 tour gán 2 điểm đến khác nhau → publish → cả 2 trang điểm
  đến đều query ra đúng tour đó.

## Phase 7 — Năng lực "Viết tay" ở lõi `ai-content` (ĐÃ XONG — re-verify 07/2026: PASS, 1 gap nhỏ không rủi ro thực tế — transition Created→DraftReady chưa được code chặn theo sourceType, chỉ đúng nhờ quy ước gọi hàm, không có đường gọi sai trong code hiện tại)

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

## Phase 8 — Module `article` (ĐÃ XONG — re-verify 07/2026 (vòng 2): backend (bảng, compile engine, 2 hành động publish, gate H2/H3) đúng đầy đủ; UI "Chèn khối động" ghi "CHƯA có" ở lần re-verify trước ĐÃ CÓ SẴN — `InsertDynamicBlockPanel` (nút + palette 7 loại khối + form tham số + chèn đúng vị trí con trỏ), wired vào `content/[id]/page.tsx` cho `articleType=cam-nang`. Verify thật qua Playwright: mở panel, điền tham số, bấm "Chèn vào bài" → token `[[block:destinations type=thac-ho-suoi ...]]` chèn đúng vào textarea tại vị trí con trỏ)

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

## Phase 9 — Website .NET (song song, không chặn phase AI tool) (PHẦN LỚN XONG (7/9 mục cao+trung) — re-verify 07/2026: AggregateRating/Review và nhúng bản đồ đã CHỦ Ý bỏ — quyết định ghi rõ trong SchemaUtil.cs và content-seo-ux-plan.md, không phải bug — nhưng DoD viết theo nghĩa đen thì 2 mục này chưa đạt)

**Nguồn**: `dichoithoi-content-seo-ux-plan.md` §4, §7; `archive/dichoithoi-web-page-audit.md` (lịch sử).
Ưu tiên theo ROI (đã sắp ở content-seo-ux-plan §7):
1. **Cao**: bật lại Review/Rating + JSON-LD AggregateRating; render FAQ +
   JSON-LD FAQPage; route `/loai/{group}[/{type}]` + `/tinh/{slug}`; SSR khối
   khách sạn/tour giữa bài (bỏ AJAX); route mới `/cam-nang/{slug}` cho Article.
2. **Trung bình**: gallery ảnh (đọc `GalleryJson`); bản đồ nhúng; `rel=sponsored`
   + disclosure; render `TicketLinksJson` thành nhiều nút.
3. **Sau**: mini lịch trình; so sánh giá; sitemap.xml + Search Console; critical
   CSS cho LCP; phân trang `/diem-den` có URL riêng từng trang (không noindex).
- **DoD**: mỗi mục có thể ship độc lập, không cần đợi toàn bộ xong mới release.

## Phase 10 — Go-live cutover (REHEARSAL local ĐÃ XONG 07/2026, production CHƯA chốt thời điểm)

**Phụ thuộc**: Phase 1-9 đã test ổn trên LocalDB + staging.

✅ **Đã rehearsal toàn bộ TRÊN LOCAL (`dichoithoi_dev`)** theo quyết định của
user ("làm hoàn chỉnh ở local trước, chỉ lên production sau") — xem
`dichoithoi-golive-runbook.md` (MỚI) để biết đúng lệnh + log rehearsal đầy
đủ. Phát hiện + vá lúc chuẩn bị:
- `scripts/dichoithoi-sqlserver/01-create-new-schema.sql` thiếu DDL
  `v2.DestinationTag`/`v2.DestinationTagMap` (tính năng tag `af73075` áp
  dụng tay, quên thêm script) — đã vá, verify idempotent (chạy 2 lần không
  đổi gì, dữ liệu 7 tag không mất).
- Script backup/restore 2 bảng gốc CHƯA từng tồn tại — đã viết
  `03-backup-legacy-tables.sql`/`04-restore-legacy-tables.sql` (kiểu
  `SELECT INTO`/`sp_rename`, không dùng `BACKUP DATABASE` vì hosting share
  khó có quyền ghi file), test thật trên `dichoithoi_dev` (row-count khớp
  100%, restore phục hồi đúng).
- **Sửa lại phạm vi khoá CMS cũ**: chỉ Destination + Tour có route import
  trên `CmsDiChoiThoi.Web` (`import_destination`/`import_tour`) — **Hotel
  không có**, câu "khoá Destination + Hotel + Tour" trước đây ghi sai.
- Thêm `AppSetting:IsLegacyImportLocked` (mặc định `false`, reversible,
  không xoá code) vào `CmsDiChoiThoi.Web` — check đầu 2 action trên, verify
  `dotnet build` sạch. **Không test chạy app thật** vì phát hiện
  `appsettings.Development.json`/`Release.json` của `CmsDiChoiThoi.Web` đều
  trỏ thẳng vào SQL Server production thật (`sql5059.site4now.net`) — không
  có profile local an toàn cho riêng app CMS này.
- Rehearsal full-chain: `02-migrate-data.sql` tự chặn đúng khi chạy lại
  (one-time guard), `sync`→`relink`(dry-run)→`relink/apply`→
  `recompute-related` chạy 2 lần liên tiếp đều idempotent — log chi tiết ở
  cuối runbook.

❌ **Production THẬT — chưa làm, chờ user chốt thời điểm**: backup + migrate
thật trên SQL Server production, đổi `.env`/`appsettings` production, bật
`IsLegacyImportLocked=true` thật, theo dõi song song 1-2 tuần + xoá bảng cũ.
Khi sẵn sàng, làm theo đúng thứ tự trong `dichoithoi-golive-runbook.md`.
- **DoD production**: gate M4 pass (bài AI lên web thật, update đè bài cũ,
  re-link chạy ổn) + khối khách sạn/tour/vé đọc đúng data zinoflow ghi.

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
  2. ~~Kiểm tra gói SmarterASP Advance có Task Scheduler/Cron~~ — **ĐỔI HƯỚNG
     15/07/2026**: gói Advance KHÔNG có Task Scheduler/Cron trong control panel
     (đã xác nhận). Người dùng quyết định dùng **Azure Function (Timer
     trigger)** thay thế để warm-up app pool — Function gọi HTTP GET định kỳ
     (đề xuất mỗi 15-20 phút, dưới ngưỡng recycle mặc định IIS) tới trang chủ
     `https://dichoithoi.com/` (chưa có endpoint health-check riêng, dùng
     trang chủ vì luôn tồn tại, tải nhẹ nhờ `IMemoryCache` đã cache top
     destination/hotel/article). Vẫn là việc CẦN BẠN tự làm (cần Azure
     subscription + tạo Function App) — AI tool chưa tạo hộ được vì cần tài
     khoản Azure thật, nhưng khác SmarterASP control panel (không cần kiểm
     tra gì phía hosting nữa, hướng đã chốt).
- **DoD đã xác nhận**: `dotnet build` sạch; publish 1 điểm đến qua zinoflow (dev,
  `DICHOITHOI_SITE_BASE_URL=http://localhost:5176`) gọi đúng
  `/api/remove-cache/destination:{slug}`, các slug khác không bị đụng tới (tag
  theo slug, không xoá `all`); 257 test API vẫn pass, `tsc` sạch api+web.
  Lighthouse trước/sau và test Cloudflare thật CHƯA đo được — phụ thuộc việc cần
  bạn tự làm ở trên.

## Phase 18 — Đập đi làm lại UI website (mobile-first, stack nhẹ, theme mới) (ĐÃ XONG 07/2026)

**Phụ thuộc**: Phase 14 (cần `AncestorsJson`/`ChildrenJson` cho breadcrumb +
danh sách con). Nên làm SAU Phase 17 (cache) để không phải cache lại 2 lần.
**Nguồn**: `content-seo-ux-plan.md` §10 (toàn bộ), `seo-principles.md`
(bắt buộc áp dụng checklist 3 câu hỏi cho từng mảnh UI khi code).

**Quyết định `kind=cluster`/`province`/vùng-miền (§10.6) — CHỐT 07/2026**:
duyệt đúng đề xuất, không sửa gì — không còn chặn phase này nữa:
- `kind=poi`: trang đầy đủ như §10.4 (giá vé, giờ mở cửa, câu chuyện, ăn uống,
  lưu trú, tour, lưu ý thực tế, FAQ, review, điểm gần đó).
- `kind=cluster` — 2 biến thể theo có/không `OpeningTime`/`TicketPrice`/
  `ContentHtml` thật (không cần cột mới): (1) Cụm CÓ vé/giờ riêng (vd Suối
  Tiên) → render như `poi` đầy đủ + thêm khối "Các khu trong [tên]"
  (`ChildrenJson`) sau "Trải nghiệm/chơi gì"; (2) Cụm THUẦN địa lý (vd Bảo
  Lộc, Di Linh) → ẩn khối "quyết định nhanh", cấu trúc gần trang danh mục
  (breadcrumb, H1 + giới thiệu, khối "Các điểm trong [tên]" toàn bộ
  `ChildrenJson`, rồi đặc sản/lưu trú/tour/FAQ cấp khu vực).
- `kind=province`: KHÔNG có trang riêng ở `/diem-den/{slug}` (trùng
  `/tinh/{slug}` đã build Phase 9 → duplicate content) — `/diem-den/{slug}`
  301 redirect sang `/tinh/{slug}` khi gặp node `kind=province`; node này
  trong cây chỉ giữ vai trò cấu trúc (gốc cho `parentSlug`/`AncestorsJson`/
  `ChildrenJson`).
- **`ContentTier` (thêm 07/2026, `content-seo-ux-plan.md` §10.6.1)** — độc
  lập với `kind`, cột mới `Flagship`/`Standard` gán tay cho `province`/`cluster`
  (vd Đà Lạt, TP.HCM = `Flagship`; Bảo Lộc = `Standard`). Node `Flagship` được
  cộng thêm nội dung "điểm đến" đầy đủ + JSON-LD `TouristAttraction` lai
  `ItemList` + đủ điều kiện vào `RelatedJson`/`IsFeatured` — không đổi cách
  query con cái (vẫn `ParentId`). CHƯA CODE — xem mục "⚠️ MỤC KHẨN" đầu
  `dichoithoi-backlog.md` (lỗ hổng gốc #1, chặn nhiều tính năng Flagship khác).
  ✅ **Bug đi kèm ĐÃ SỬA (07/2026, xác nhận qua audit sâu + test Playwright
  thật)**: `DestinationTaxonomyRepository.GetProvincePageAsync` trước đây
  query `WHERE ProvinceId=@provinceId` (trộn lẫn TOÀN BỘ cây, kể cả POI đã
  nằm trong 1 cụm con — vd `/tinh/lam-dong` hiện phẳng 56 điểm gồm cả POI bên
  trong Đà Lạt/Phan Thiết, gây trùng nội dung với `/diem-den/da-lat`). Đã sửa
  sang `WHERE ParentId=@provinceDestinationId` (con TRỰC TIẾP của node tỉnh)
  — verify qua Playwright: `/tinh/lam-dong` giờ chỉ hiện đúng 2 cụm (Đà Lạt,
  Phan Thiết), `/tinh/ho-chi-minh` (tỉnh không có cụm con) vẫn hiện đúng POI
  trực tiếp (Dinh Độc Lập, Nhà thờ Đức Bà...).
- **Vùng/miền**: KHÔNG thêm làm `kind` thứ 4 (không phải điểm vật lý, không
  giá vé/giờ/toạ độ) — trục phân loại độc lập, trang `/vung/{slug}` theo đúng
  pattern trang danh mục (§10.3). Dự tính ban đầu cần bảng `Region` mới +
  `Province.RegionId` FK — **lúc code (18.1) phát hiện KHÔNG cần**:
  `v2.Province` đã có sẵn cột `Region tinyint` (1/2/3) từ lúc migrate, chỉ
  website chưa dùng tới. Xem chi tiết ở Phase 18.1 dưới.

**Hiện trạng codebase đã khảo sát 07/2026** (trước khi tách sub-phase dưới):
`DiChoiThoi.Web` đã có `webpack.config.js`+`package.json` (webpack 5,
`ts-loader`+`sass-loader`, mỗi trang 1 entry TS/SCSS) — KHÔNG có Tailwind ở đâu
trong repo (kể cả `CmsDiChoiThoi.Web`), dựng từ đầu. Bootstrap 5.3.3 + jQuery
3.7.1 (chỉ dùng JS `dropdown.js`/`collapse.js`), 2 hệ icon song song (font
`dichoithoi.*` + `src/icons/*.svg` ~30 file rời — SVG rời dùng lại được ngay
cho hướng "SVG inline"). `_Layout.cshtml` rất gọn (77 dòng, không CDN) — nền
tốt để chuyển thẳng Tailwind. 5 route liên quan + partials ~1000 dòng: Home
`Index` (41d), Destination `Index` (29d), Destination `Detail` (**289d — lớn
nhất**), DestinationType `Index`+`TypeList` (15d+32d), Province `Detail` (14d)
— 2 cái sau dùng chung `_DestinationCardList.cshtml`. Nội dung đã có DATA
nhưng website CHƯA hiển thị đủ: FAQ đã có `FaqJson`+JSON-LD (Phase 12) nhưng
thiếu accordion hiển thị; Review/rating code fetch đang **comment out**;
Gallery/mini lịch trình (§5.1/§5.2) chưa có dữ liệu (để Phase 11) — Phase 18
chỉ dựng UI graceful-empty, KHÔNG tạo dữ liệu mới; so sánh giá (§5.3) đã xong
ở Phase 12, chỉ cần lên khuôn Tailwind.

**Chia sub-phase** (quá lớn làm 1 lần — mỗi sub-phase code+build+test+commit
riêng, DoD chi tiết từng phần xem
`C:\Users\dinhdv\.claude\plans\nifty-purring-waterfall.md` lúc lập breakdown,
tóm tắt lại đây):
1. **18.0 — Nền tảng Tailwind + layout shell (ĐÃ XONG 07/2026)**: thêm
   `tailwindcss`/`postcss`/`autoprefixer`/`postcss-loader` vào pipeline webpack
   sẵn có (KHÔNG cần entry riêng — chỉ thêm `postcss-loader` vào rule
   `\.s?css$/` hiện có, `common.scss` đổi thành 3 dòng `@tailwind`);
   `tailwind.config.js` 7 màu cố định + `content` glob `Views/**/*.cshtml` +
   `src/ts/**/*.ts`. Viết lại `_Layout`/`_Header`/`_Footer` bằng Tailwind:
   drawer mobile (`<details>`/JS thuần thay `collapse.js`) + mega-menu desktop
   dùng `group-hover` (KHÔNG cần JS cho hover) — mega-menu cột "Tỉnh/Thành"
   TẠM thời phẳng (chưa nhóm theo miền, chờ 18.1). SVG inline qua
   `IconTagHelper` mới (`TagHelpers/IconTagHelper.cs`, đọc
   `wwwroot/icons/*.svg` copy từ `src/icons` lúc build, cache RAM). Footer
   đổi từ `StaticLinkUtils` (danh sách cứng, không đồng bộ DB) sang dữ liệu
   thật (`IDestinationTaxonomyService`) — vì service này giờ gọi ở MỌI trang
   (header+footer), đã thêm `IMemoryCache` (TTL 6h, case `taxonomy` mới ở
   `/api/remove-cache`) để tránh query sống mỗi request — lỗ hổng chưa ai để ý
   trước đó vì trước giờ chỉ `/loai` mới gọi.
   **Quyết định đã hỏi + user chọn**: cắt hẳn `common.css` (Bootstrap) khỏi
   `_Layout` ngay trong 18.0 thay vì tải song song 2 file CSS — chấp nhận
   Trang chủ/Danh mục/Chi tiết (chưa viết lại) tạm mất style Bootstrap
   (`container`/`row`/`col`/`btn`...) cho tới khi 18.2-18.4 viết lại xong.
   `npm run prod` + `dotnet build` sạch, smoke test `/`, `/loai`, `/search`,
   `/api/remove-cache/taxonomy` chạy được không lỗi.
2. **18.1 — Trục vùng/miền (`/vung/{slug}`) (ĐÃ XONG 07/2026)**: **phát hiện lúc
   code** — giả định ban đầu (cần bảng `Region` + `Province.RegionId` FK mới,
   phải đổi zinoflow) SAI: `v2.Province` đã có sẵn cột `Region tinyint NOT NULL`
   (1 Bắc/2 Trung/3 Nam) từ lúc migrate (`02-migrate-data.sql`, gán tay trong
   generator lúc sinh 34 tỉnh) — CHỈ chưa có nơi nào ở website dùng tới. Vì vậy
   **KHÔNG cần đổi zinoflow/schema** — thuần website: thêm `Region` vào
   `ProvinceCardModel` + query (`DestinationTaxonomyRepository`); `RegionUtil`
   (`DiChoiThoi.Web/Utilities`) map CỐ ĐỊNH byte→slug/tên (3 miền không đổi
   theo thời gian, không cần quản lý qua UI); `RegionController` mới +
   `/vung/{slug}` (`Views/Region/Detail.cshtml`, Tailwind từ đầu — trang mới,
   không có Bootstrap cũ phải dọn); mega-menu (`_Header`) + `_Footer` đổi từ
   danh sách tỉnh phẳng sang nhóm theo miền; thêm `/vung/{slug}` vào
   `taxonomy-sitemap.xml`. `dotnet build` sạch, smoke test `/vung/mien-nam` +
   mega-menu render đúng 3 nhóm.
3. **18.2 — Trang danh mục** (`/loai`, `/loai/{group}`, `/loai/{group}/{type}`,
   `/tinh/{slug}`) theo §10.3 (ĐÃ XONG 07/2026): **phát hiện lúc code** — yêu
   cầu cốt lõi của §10.3 ("mỗi trang phải có đoạn văn bản riêng, tránh thin
   content") KHÔNG thể làm chỉ bằng UI: `DestinationTypeGroupModel`/
   `DestinationTypeCardModel`/`ProvinceCardModel` chưa từng có field mô tả nào
   (chỉ `Id`/`Slug`/`Name`) — khác các phase trước (18.0/18.1), lần này CÓ đổi
   schema + zinoflow, đã hỏi user chốt 2 quyết định trước khi code:
   - **Thêm cột `Description` (nvarchar(max), NULL, để trống trước)** cho
     `v2.DestinationTypeGroup`, `v2.DestinationType`, `v2.Province` (ALTER
     idempotent trong `scripts/dichoithoi-sqlserver/01-create-new-schema.sql`,
     cùng file/pattern đã dùng cho `Region` ở 18.1) + EF entities tương ứng.
     Trang ẨN khối giới thiệu nếu rỗng — không chặn 18.2, điền dần sau.
   - **Làm phân trang thật ngay** (không để dồn 1 trang): repository đổi
     `take` → `page`/`pageSize` + `CountAsync()`, model mới `PageInfoModel`
     (`Page`/`PageSize`/`TotalCount`/`TotalPages`); route nhận `?trang=N`;
     `PageInfo.Canonical` tự set kèm `?trang=N` khi `trang>1` (khác canonical
     mặc định ở `_Layout` — bỏ query string — vì đây là trang THẬT khác nhau,
     không phải biến thể filter).
   - **zinoflow**: vì group/type/province KHÔNG có dòng mirror Postgres riêng
     (chỉ đọc thẳng SQL Server qua `siteDb.fetchTypes()`), thêm thẳng vào
     `DichoithoiSiteDb` port: `fetchTaxonomyContent()` +
     `updateTaxonomyDescription(target, id, description)` (UPDATE trực tiếp
     `v2.DestinationTypeGroup`/`DestinationType`/`Province`, cùng adapter
     `MssqlSiteDbAdapter` dùng cho publish destination). Contracts mới:
     `TaxonomyContent`, `updateTaxonomyDescriptionRequestSchema`. Endpoint
     `GET/PATCH /destinations/taxonomy-content` (đặt trước `:slug` như
     `taxonomy`/`address-mappings`). Trang admin mới `/dichoithoi/danh-muc`
     (~59 dòng: 7 nhóm + 18 loại + 34 tỉnh, không cần phân trang/tìm kiếm) —
     liệt kê tất cả kèm textarea sửa Description, lưu qua PATCH; thêm primitive
     `Textarea` vào `shared/ui/` (chưa có trước đó).
   - **Website**: rewrite `DestinationType/Index.cshtml`, `TypeList.cshtml`,
     `Province/Detail.cshtml`, `_DestinationCardList.cshtml` (Tailwind, lưới
     card responsive `grid-cols-1 sm:2 lg:3 xl:4`, ảnh `aspect-[4/3]`,
     `line-clamp-2`); breadcrumb thật (4 hàm mới `BreadcrumbUtils.CreateType*`/
     `CreateProvinceBreadcrumb`, trước đây 2 trang này chưa set breadcrumb) +
     JSON-LD `BreadcrumbList`; partial `_Pagination.cshtml` dùng chung 3 trang
     (model tuple `(string BasePath, PageInfoModel Paging)`); badge lọc theo
     loại (`SiblingTypes`) tái dùng làm bộ lọc thay vì UI mới.
   - Verify: chạy `scripts/dichoithoi-sqlserver/01-create-new-schema.sql` qua
     `sqlcmd` lên LocalDB dev (`dichoithoi_dev`, KHÔNG phải tên trong
     `appsettings.json` gốc — đọc `appsettings.Development.json` mới ra tên
     đúng), `dotnet build` sạch, `npm run prod` sạch (`line-clamp`/
     `aspect-[4/3]` compile đúng), smoke test `/loai`, `/loai/{group}`,
     `/loai/{group}/{type}`, `/tinh/{slug}` + `?trang=2` (canonical/tiêu đề đổi
     đúng) + set thử 1 Description qua SQL trực tiếp để xác nhận đoạn giới
     thiệu hiện/ẩn đúng. zinoflow: `tsc --noEmit` (api+web+contracts, phải
     `pnpm --filter @zinoflow/contracts build` trước vì app dùng `dist`, không
     phải source) + `jest destination` (64 test, api) đều sạch.
4. **18.3 — Trang chủ** (`/`) theo §10.2 (ĐÃ XONG 07/2026) — thuần website,
   không đổi zinoflow/schema. Rewrite `Home/Index.cshtml` + các partial dùng
   chung với `Destination/Index.cshtml` (`_SearchCondition`, `_DestinationGroup`,
   `_HotelList`, `_HotelGroupList`, `Destination/_DestinationList`) sang
   Tailwind — carousel vuốt ngang mobile (`flex overflow-x-auto snap-x
   snap-mandatory`, KHÔNG cần JS) → lưới tĩnh desktop (`lg:grid lg:grid-cols-4
   lg:overflow-visible`). **Phát hiện lúc rà soát §10.2**: trang chủ đang thiếu
   2 khối spec yêu cầu — "Lưới danh mục" và "Cẩm nang mới" (tín hiệu
   freshness) — thêm cả 2:
   - **Khám phá theo loại**: tái dùng `GetAllTypesAsync()` đã cache sẵn (Phase
     18.0, không query riêng), group theo `GroupId` lấy danh sách nhóm duy
     nhất → lưới link `/loai/{group}` (style giống tile ở trang `/loai`, 18.2).
   - **Cẩm nang mới**: `IArticleService.GetListAsync()` (đã có sẵn, top 24 bài
     mới nhất theo `PublishedAt`) — thêm cache RAM riêng
     (`HOME_RECENT_ARTICLES_CACHE_KEY`, TTL 15 phút — ngắn hơn top destination
     vì đây là tín hiệu "mới" nên cần refresh nhanh hơn) + case
     `home_articles` mới ở `/api/remove-cache`. Ẩn khối nếu rỗng (dev DB hiện
     0 bài `v2.Article` published — graceful-empty, không phải lỗi).
   `TopViewModel` thêm `TypeGroups`/`RecentArticles`. Vì `_DestinationList.cshtml`
   dùng chung bởi `Destination/Index.cshtml` (trang `/search` + `/diem-den`),
   rewrite 1 lần áp dụng cho cả 2 route — tiện thể lên khuôn Tailwind luôn
   phần khung `Destination/Index.cshtml` (trước đó vẫn dùng class Bootstrap
   `container`/`d-flex` đã hỏng từ 18.0). `Hotel/Index.cshtml`/`Hotel/Detail.cshtml`
   cũng dùng chung `_HotelList`/`_HotelGroupList` nên được cải thiện lây —
   KHÔNG phải phạm vi 18.3 (khung trang Hotel vẫn Bootstrap hỏng, để sau).
   Verify: `dotnet build` sạch, `npm run prod` sạch (`snap-x`/`line-clamp-1`/
   `aspect-[4/3]` compile đúng), smoke test `/` (đủ 5 khối, lưới danh mục đúng
   3 nhóm duy nhất — không lẫn link cấp `type` từ mega-menu header), `/diem-den`,
   `/search?q=bien` đều 200 và render card mới.
5. **18.4 — Trang chi tiết điểm đến** (lớn nhất, ĐÃ XONG 07/2026) — thuần
   website, không đổi zinoflow/schema. **Phát hiện quan trọng lúc code**: `/diem-den/{slug}`
   VẪN đọc toàn bộ định danh chính (Name/Address/Content/OpeningTime/TicketPrice...)
   từ bảng v1 `dbo.Destination`/`DestinationDetail` (chưa cutover, Phase 10) —
   v1 chỉ có 2 cờ `IsGroup`/`IsProvince`, KHÔNG có khái niệm `Kind` 3 nhánh.
   Ban đầu tưởng có thể suy `Kind` từ `IsGroup`/`IsProvince` nhưng kiểm chứng
   trên dữ liệu thật thì SAI: cả `Kind=1` (province) lẫn `Kind=2` (cluster) đều
   có `IsGroup=1` ở v1 như nhau — 2 cờ v1 không phân biệt được province/cluster.
   Phải đọc thẳng `v2.Destination.Kind` (đã có sẵn field, không cần đổi
   schema) làm nguồn sự thật duy nhất cho 4 nhánh. Tương tự, review/rating
   **KHÔNG hề bị comment out** như audit cũ ghi nhận — đã wire đầy đủ qua
   `DestinationExtrasModel.AvgRating/ReviewCount/Reviews` (Phase 15/9), chỉ
   cần lên khuôn Tailwind.
   - **`DestinationExtrasModel`/`DestinationExtrasRepository`** thêm 3 field
     đọc thêm từ v2 (không tạo cột mới): `Kind` ("province"/"cluster"/"poi"),
     `ProvinceRedirectSlug` (chỉ set khi Kind=province — **PHẢI** tra
     `v2.Province.Slug` qua `Province.DestinationId`, KHÔNG được giả định
     trùng `Destination.Slug`: kiểm chứng thực tế có 4/17 tỉnh Kind=1 lệch
     slug với Province do sáp nhập hành chính 2025, vd Destination
     `ha-giang` nhưng Province tương ứng là `tuyen-quang`), `HasOwnVisitInfo`
     (bool — có `OpeningTime`/`TicketPrice` thật ở `v2.DestinationContent`
     hay không, tín hiệu phân biệt 2 biến thể cluster; dữ liệu thật có cả 2:
     `pho-co-hoi-an`/`phu-quoc` = biến thể 1 (có vé/giờ riêng),
     `da-lat`/`nha-trang`/`sapa` = biến thể 2 (cụm thuần địa lý)).
   - **`DestinationController.Detail`**: `Kind == "province"` → `RedirectPermanent("/tinh/" + ProvinceRedirectSlug)`.
   - **View** (`Detail.cshtml` viết lại hoàn toàn theo §10.4): hero ảnh full-width;
     chip nav vuốt ngang mobile (neo tới section, thuần CSS/HTML không JS);
     card "Quyết định nhanh" (`_QuickDecisionCard.cshtml` mới, dùng chung
     mobile-inline + desktop-sticky-sidebar) ẩn/hiện qua `showQuickDecision`
     (cluster: theo `HasOwnVisitInfo`; poi/null: giữ hành vi cũ `!IsGroup` —
     đây chính là sửa 1 bug thật: trước đây MỌI destination `IsGroup=1` đều ẩn
     khối giá vé/giờ mở cửa như nhau, kể cả Hội An/Phú Quốc có giá vé thật);
     `<details>` cho Lưu ý thực tế/Mẹo/FAQ (SEO đọc được DOM, gấp gọn UI);
     gallery + hotel + tour carousel vuốt ngang mobile → lưới desktop (CSS
     `scroll-snap`, không JS); layout desktop 2 cột (`lg:grid-cols-[1fr_320px]`,
     cột phụ `lg:sticky`) thay sticky-bottom-CTA (chỉ hiện mobile, ẩn hẳn khi
     `!showQuickDecision` — cụm thuần địa lý như Đà Lạt không có nút "Mua vé"
     vô nghĩa nữa). `kind=cluster` biến thể 2 (`!HasOwnVisitInfo`): thay
     block "liên quan" (top-8, dùng quan hệ v1) bằng lưới ĐẦY ĐỦ
     `extras.Children` (ChildrenJson precompute Phase 14) kiểu trang danh
     mục — fallback về block quan hệ v1 cũ nếu `Children` rỗng (dữ liệu dev
     hiện chưa precompute cho vài điểm, ví dụ `da-lat` — graceful, không lỗi).
     Thêm class `.rich-content` thủ công trong `common.scss` (không cài
     `@tailwindcss/typography` — giữ đúng §10.5 "không plugin ngoài") để
     phục hồi margin/list-style cơ bản cho `Html.Raw()` content (Tailwind
     preflight xoá hết mặc định).
   - Rewrite kèm theo: `_ChildDestination`/`_HotelCardList`/`_TourCardList.cshtml`
     (Tailwind, carousel/lưới card).
   - Verify: `dotnet build` sạch, `npm run prod` sạch; smoke test cả 4 nhánh
     trên dữ liệu dev thật — poi (`bai-bien-dai-lanh-nha-trang`), cluster biến
     thể 1 (`pho-co-hoi-an` — quyết định nhanh + sticky CTA hiện), cluster biến
     thể 2 (`da-lat` — ẩn quyết định nhanh + sticky CTA, fallback lưới quan hệ
     v1 vì Children rỗng), redirect province cả 2 trường hợp slug giữ nguyên
     (`da-nang` → `/tinh/da-nang`) và slug lệch do sáp nhập (`ha-giang` →
     `/tinh/tuyen-quang`).
6. **18.5 — Đo lường & polish** (ĐÃ XONG 07/2026, thuần website). **Phát hiện
   lúc code**: kế hoạch gốc ghi "GitHub Actions" nhưng repo `dichoithoi` thực
   tế host trên **Azure DevOps** (`dev.azure.com/dovandinh012/MMO`), KHÔNG
   phải GitHub — không dùng GitHub Actions được. Đã đổi sang Azure Pipeline
   YAML (`.azuredevops/lighthouse-check.yml`) tương đương: schedule trigger
   hàng tuần (thứ 2, 10h sáng giờ VN), gọi PageSpeed Insights API cho 3 trang
   mẫu (`/`, `/tinh/lam-dong`, `/diem-den/bai-bien-dai-lanh-nha-trang`), publish
   kết quả JSON làm artifact (giữ lịch sử theo từng lần chạy, xem "DoD tổng"
   để biết còn thiếu gì). **File YAML chưa tự chạy** — phải vào Azure DevOps
   UI tạo Pipeline mới trỏ tới file này (Pipelines > New pipeline > Existing
   YAML), việc này ngoài khả năng làm qua commit file, cần bạn tự làm 1 lần
   (ghi vào memory để nhắc, giống follow-up Cloudflare/SmarterASP Phase 17).
   - **Brotli**: kiểm tra thấy `Program.cs` chỉ đăng ký `GzipCompressionProvider`
     cho response nén động (trang HTML render server-side) — client gửi
     `Accept-Encoding: br` vẫn chỉ nhận gzip. Đã thêm `BrotliCompressionProvider`
     (ưu tiên trước Gzip). Asset tĩnh (CSS/JS/icon) đã tự có `.br`/`.gz` qua
     `MapStaticAssets()` từ trước (build-time), không cần sửa.
   - **Cache header dài hạn**: kiểm tra thấy mọi trang dùng
     `asp-append-version="true"` (kỹ thuật cache-bust bằng query string cũ) —
     `MapStaticAssets()` (.NET 9) chỉ áp `Cache-Control: max-age=31536000,
     immutable` cho URL đã fingerprint TÊN FILE (vd `common.gxnzgh52p1.css`),
     còn URL "trần" (`common.css?v=...`) vẫn trả `no-cache` bất kể môi trường.
     Đã bỏ `asp-append-version` ở TOÀN BỘ 8 chỗ dùng (CSS/JS mọi trang, không
     chỉ trang đã đụng ở 18.0-18.4) — verify qua `dotnet publish` + chạy
     `ASPNETCORE_ENVIRONMENT=Production`, request thẳng URL fingerprint lấy từ
     `*.staticwebassets.endpoints.json` xác nhận `Cache-Control: max-age=31536000,
     immutable` + `Content-Encoding: br` cùng lúc.
   - **SVGO**: chạy trên `src/images/logo.svg` (-10.1%, không phải ~20-30%
     như ước tính lúc lập kế hoạch — số liệu thực tế thấp hơn vì logo vốn đã
     gọn) và luôn thể trên toàn bộ `src/icons/*.svg` (~30 icon inline qua
     `IconTagHelper`, tiết kiệm nhỏ mỗi icon nhưng lặp lại ở mọi trang có
     header/footer — tức là mọi trang).

- **DoD tổng**: Lighthouse Performance ≥ 90 trên 3 trang mẫu (chủ, danh mục,
  chi tiết) — **CHƯA đo thực tế** (cần Pipeline chạy lần đầu sau khi bạn tạo
  trong Azure DevOps UI, xem 18.5); mọi nội dung quan trọng có mặt đầy đủ trên
  mobile (không ẩn khỏi DOM chỉ vì hẹp màn hình, trừ `<details>` gấp — vẫn nằm
  trong DOM); `kind=cluster` 2 biến thể + redirect `province` + trang
  `/vung/{slug}` hoạt động đúng như mô tả trên. **Phase 18 (đập đi làm lại UI)
  hoàn tất toàn bộ 6 sub-phase (18.0-18.5) 07/2026.**

## Phase 19 — Search trong RAM (thay live `LIKE` query) (ĐÃ XONG 07/2026)

**Phụ thuộc**: không phụ thuộc phase nào, có thể làm bất kỳ lúc nào — độc lập
với 12-18. **Nguồn**: `database-redesign.md` §1.3/§6.

Phát hiện lúc rà soát 07/2026: `/search` hiện tại
(`DestinationRepository.GetListAsync`) chạy `SearchKeyword.Contains(keyword)`
→ dịch ra SQL `LIKE '%keyword%'` (có `%` đầu, KHÔNG dùng được index, full table
scan mỗi lần search) + `RemoveUnicode()` tính lại mỗi request — chậm dần khi số
điểm đến tăng, độc lập với việc tách bảng nóng/lạnh đã làm.

**Phát hiện quan trọng lúc code (làm thay đổi cách tiếp cận)**: `/search`,
`/diem-den`, `/diem-den/{id}` **hiện KHÔNG đọc schema v2** — vẫn đọc thẳng
bảng CŨ `dbo.Destination`/`dbo.DestinationDetail` (đã ghi nhận từ trước ở
`archive/dichoithoi-web-page-audit.md` §0, "chưa migrate"). Bảng cũ **không có cột
`NameUnaccented`** (chỉ `V2Destination` mới có) và cột `SearchKeyword` hiện
**không có nơi nào trong code ghi giá trị** (rà toàn bộ repo, kể cả
`CmsDiChoiThoi.Web/Controllers/DestinationController.cs` nơi import Google
Sheet) — nghĩa là search theo `SearchKeyword` có thể đã âm thầm không khớp cho
nhiều điểm từ lâu. Vì vậy:
- KHÔNG cần zinoflow đảm bảo `NameUnaccented` (bullet gốc của plan nhắm nhầm
  bảng — cột đó thuộc `v2.Destination`, không phải bảng đang phục vụ `/search`
  thật). Zinoflow không cần đổi gì cho phase này.
- Tự tính "tên bỏ dấu" 1 LẦN lúc nạp vào RAM từ cột `Name` (luôn có giá trị,
  `[Required]`) thay vì phụ thuộc `SearchKeyword` — vừa nhanh hơn (không tính
  lại mỗi request) vừa sửa luôn lỗ hổng khớp thiếu do `SearchKeyword` rỗng.
- **Writer DUY NHẤT của `dbo.Destination`** là CMS cũ (`CmsDiChoiThoi.Web`,
  action `import_destination` — import từ Google Sheet, bấm tay) — đây là 1
  ỨNG DỤNG .NET RIÊNG, KHÁC process với `DiChoiThoi.Web` (website công khai),
  nên endpoint `/api/remove-cache` (Phase 17, cùng process với `IMemoryCache`
  của website) không tự được gọi từ đó. Zinoflow (publish qua schema v2) cũng
  KHÔNG ghi bảng này nên purge cache (Phase 17) không giúp gì cho search index.
  → Ngoài case `search_index` thủ công (gọi tay khi cần), index có TTL riêng
  30 phút (`CACHE_EXPIRATION_SEARCH_INDEX`) để tự làm mới, không cần restart
  app, thay vì cache vĩnh viễn như plan gốc kỳ vọng.

- **Đồng bộ website**: `DestinationRepository` (`DiChoiThoi.Service`) nạp toàn
  bộ `dbo.Destination` (`AsNoTracking`) + tính sẵn tên bỏ dấu 1 lần vào
  `IMemoryCache` (key `SEARCH_INDEX_CACHE_KEY`, TTL 30 phút); `GetListAsync`
  lọc hoàn toàn trên RAM (khớp tên bỏ dấu / `DestinationGroupId` / `Type`),
  không còn dịch ra SQL `LIKE` nữa. `/api/remove-cache/search_index` (và
  `all`) xoá cache này để nạp lại ngay khi cần, không đợi hết TTL.
- **DoD đã xác nhận**: `dotnet build` sạch; search giờ chỉ 1 query SQL lúc
  cache miss (nạp toàn bộ), các lần search tiếp theo trong TTL 0 query — xác
  nhận qua code (không còn `.Where(whereClause)` dịch ra SQL, `Where` giờ chạy
  trên `List<Destination>` đã nạp).
- **Gap phát hiện, KHÔNG thuộc phạm vi phase này (để dành Phase 10 go-live)**:
  điểm đến tạo HOÀN TOÀN MỚI qua zinoflow (chưa từng tồn tại ở `dbo.Destination`
  trước khi migrate sang v2) sẽ KHÔNG xuất hiện ở `/search`, `/diem-den` (top
  list/danh sách con), và **404 luôn ở `/diem-den/{slug}`** — vì
  `DestinationController.Detail` gọi `_destinationService.GetDetailAsync(id)`
  đọc bảng CŨ trước, `Extras` (v2) chỉ là lớp phủ thêm. Mọi điểm đã test thành
  công trước giờ (vd `cong-troi-bali-green-hills`) đều là điểm ĐÃ tồn tại từ
  trước khi chạy migration `02-migrate-data.sql` (seed `v2.Destination` từ
  `dbo.Destination`). Đây là hệ quả của việc CHƯA cắt hẳn sang schema v2
  (Phase 10), không phải lỗi do Phase 17/19 gây ra — cần nhớ khi test destination
  hoàn toàn mới qua "+ Thêm điểm đến" trước khi go-live.

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

## Phase 21 — Việc nhỏ độc lập phát hiện qua audit sau commit cbd15c9 (ĐÃ XONG 07/2026)

**Phụ thuộc**: không phụ thuộc phase nào — 5 mục độc lập nhau.

1. Khối `food-spots` (tái dùng `products` lọc category ẩm thực) — thêm
   `BLOCK_KINDS`/compiler/UI palette. Backend đã hỗ trợ sẵn `products`/
   `product` nhưng UI palette chưa mở — mở luôn cả 3 kind.
2. Auto-link an toàn hơn: cap tối đa 10 link/bài, bỏ qua tên trùng giữa
   nhiều điểm khác nhau (không tự chọn bừa).
3. Ingest ảnh Hotel/Tour chuyển từ đồng bộ (chặn request) sang job nền
   pg-boss (`hotel.image-ingest`/`tour.image-ingest`) — publish ngay với URL
   hiện có, ingest+publish lại trong worker. Product đã có sẵn ingest
   thumbnail đồng bộ từ trước (audit ban đầu báo sai là "chưa có").
4. Điều tra `DestinationReview` write path — xác nhận KHÔNG PHẢI bug, là
   quyết định đã chốt (seo-principles.md) hoãn cơ chế review thật.
5. DDL dọn lệch: xoá cột chết `BookingUrl`, thêm `ContactFacebook` còn thiếu.

**DoD**: jest 47/47 suites sạch, `dotnet build` sạch, test Playwright xác
nhận không lỗi console.

## Phase 22 — Article "Tạo bằng AI" cho `cam-nang` (ĐÃ XONG 07/2026)

**Phụ thuộc**: Phase 21.1 (khối `food-spots`, để liệt kê trong prompt).

Thêm 3 prompt `cam-nang.outline/section/frame.vi` (dạy AI cú pháp
`[[block:...]]`) + UI `/dichoithoi/articles/new` thêm Select AI Provider/
Model + ô "Tư liệu tham khảo" (map `sourceContext`) + nút "🤖 Tạo bằng AI" —
giữ nguyên nút "Viết tay". Không cần sửa core `generate-content.usecase.ts`
(pipeline đã tổng quát hoá qua `ArticleTypeProfile` registry).

**DoD**: test Playwright thật — tạo 2 job AI thành công (DraftReady, nội
dung tiếng Việt có dấu đầy đủ, đúng schema). Ghi nhận: model nhỏ (flash-lite)
thận trọng, không phải lúc nào cũng tự chèn token dù có gợi ý rõ — không
phải bug, có thể cần tinh chỉnh prompt/model mạnh hơn nếu muốn AI chèn khối
tích cực hơn.

## Phase 23 — Dashboard "Việc cần làm" trên hub CMS (ĐÃ XONG 07/2026)

**Phụ thuộc**: không phụ thuộc phase nào — dùng lại `GetCoverageScoresUseCase`
đã có.

`GetDichoithoiDashboardAlertsUseCase` mới tổng hợp 5 cảnh báo (destination-
spec §7.2): độ phủ thấp (<60%), tag dưới ngưỡng 3 điểm, draft chờ duyệt, job
lỗi (lọc riêng site dichoithoi), ảnh gallery thiếu (thêm cột `HasGallery` vào
`fetchContentCoverageRows`). Chỉ hiện mục có count > 0. Tách `Card`/
`ActionRow` từ `dashboard-home.tsx` thành `shared/ui/card.tsx` dùng chung.

**Phạm vi cắt bớt có chủ ý**: chưa có "bài Chủ lực chưa có bài cẩm nang"
(cần `ArticleDestinationMap`, Phase 26 chưa build) và "link affiliate
no-rule/chết" (trải nhiều module Hotel/Tour/Product, để riêng).

**DoD**: 4 test case mới + endpoint thật trả đúng số liệu + Playwright xác
nhận Card hiện đúng trên `/dichoithoi` và không phá dashboard tổng `/`.

## Phase 22-23 lưu ý chung: jest 48/48 suites, `tsc --noEmit` api+web sạch.

## Phase 24 — Nối dây `SlugRedirect` (ĐÃ XONG cả 2 chiều, 07/2026)

**Phụ thuộc**: không phụ thuộc phase nào.

✅ Chiều ĐỌC (07/2026): `DestinationController.Detail` (dichoithoi) check
`v2.SlugRedirect` trước khi 404, 301 sang slug mới nếu có (entity
`V2SlugRedirect` mới + `FindRedirectSlugAsync` qua repository/service). Test
Playwright thật: chèn 1 dòng redirect test, xác nhận 301 đúng, xoá sau khi
verify; slug không tồn tại thật vẫn 404 đúng (không regressive).

✅ Chiều GHI (07/2026) — tính năng "Đổi slug" riêng biệt, canh bao ro tren UI
(không gộp vào form sửa metadata thường):
- `RenameDestinationSlugUseCase` (`apps/api/.../destination/application/
  use-cases/rename-destination-slug.usecase.ts`) — validate slug mới hợp lệ/
  chưa tồn tại/khác slug cũ/không đổi khi đang có job AI soạn dở -> tính tập
  ảnh hưởng TRƯỚC khi đổi (`RecomputeRelatedService.affectedSlugsForRename`,
  BFS con cháu + cha + nguồn có quan hệ, cùng mẫu với
  `affectedSlugsForParentChange`) -> cascade Postgres
  (`TypeOrmDestinationMirrorRepository.renameSlug` — 1 transaction:
  `dichoithoi_destinations.slug`+`parent_slug`,
  `dichoithoi_destination_relations.source_slug`+`target_slug`,
  `hotel_destination_map`/`tour_destination_map.destination_slug`,
  `products.tags`) -> cascade SQL Server nếu đã publish
  (`MssqlSiteDbAdapter.renameSlug` — 1 transaction `SET XACT_ABORT ON`:
  `v2.Destination.Slug`, `v2.ArticleDestinationMap.DestinationSlug`, upsert
  `v2.SlugRedirect`) -> recompute Ancestors/Children/RelatedJson -> enqueue
  `destination.relink` (pg-boss) để tự sửa href nội bộ bài khác.
- Contract: `renameDestinationSlugRequestSchema`/`...ResponseSchema`
  (`packages/contracts/src/dichoithoi/destination.ts`). Endpoint
  `POST /destinations/:slug/rename-slug`.
- UI: panel "⚠️ Đổi slug (nâng cao)" riêng trên trang chi tiết điểm đến
  (`apps/web/.../dichoithoi/[slug]/page.tsx`) — mặc định đóng, cảnh báo rõ
  trước khi mở form, `window.confirm` trước khi gọi, điều hướng sang URL mới
  sau khi thành công.
- Ngoài phạm vi (đã biết, không phải bug): KHÔNG tự di chuyển ảnh vật lý trên
  FTP/disk; KHÔNG tự sửa token `[[block:...]]` trong markdown thô của bài
  cẩm nang chưa publish (compiler đã fail-safe: 0 kết quả → warning + bỏ
  khối); `content_jobs.source_ref` để nguyên (chỉ lịch sử, không tra lại).

Verify: `tsc --noEmit` api+web sạch, jest 18/18 destination suites (97/97
tests, gồm 2 spec mới `recompute-related.service.spec.ts` +
`rename-destination-slug.usecase.spec.ts`). Test thật trên `dichoithoi_dev`:
tạo cây test (cha `test-rename-cha` + con `test-rename-con`), publish thẳng
qua SQL Server (insert `v2.Destination` + sync), gọi `rename-slug` đổi cha
thành `test-rename-cha-v2` — xác nhận `v2.Destination.Slug` đổi đúng,
`v2.SlugRedirect` có dòng `test-rename-cha -> Id 274`, mirror Postgres cascade
đúng (`slug` + con `parent_slug` đều trỏ slug mới), API trả 422 cho slug cũ
(không còn tồn tại) và trả đúng `children` cho slug mới. Dọn sạch dữ liệu
test ở cả 2 DB sau khi verify.

---

## Phase 25 — Cột `ContentTier` — nền tảng, CHƯA đổi layout (ĐÃ XONG 07/2026)

**Phụ thuộc**: không phụ thuộc phase nào — tách khỏi Phase 28 vì rủi ro thấp.

Thêm cột `ContentTier` (`flagship` | `standard` | null, chỉ có ý nghĩa với
`kind IN (province, cluster)`) theo đúng `content-seo-ux-plan.md` §10.6.1 —
CHỈ nền tảng, chưa render nội dung Flagship 8 khối (để Phase 28):
- SQL Server: `v2.Destination.ContentTier varchar(16) NULL` (idempotent DDL,
  áp dụng `dichoithoi_dev` qua sqlcmd).
- Postgres mirror: cột `content_tier` (migration
  `1782010000000-DestinationContentTier`), entity + toàn bộ port/use-case/
  adapter cập nhật theo (`DestinationMetadataInput`, `SiteDestinationMeta`,
  `DestinationMirror`/`DestinationDetail` contract).
- Form sửa điểm đến (`destination-metadata-form.tsx`): Select "Độ ưu tiên nội
  dung" chỉ hiện khi `kind` là `province`/`cluster`.
- Website (.NET): `V2Destination.ContentTier` + `DestinationExtrasModel.
  ContentTier` đọc qua `DestinationExtrasRepository` — CHƯA dùng để đổi
  layout, chỉ đọc sẵn cho Phase 28.

Verify: `tsc --noEmit` api+web sạch, jest 48/48 suites (316/316 tests), `dotnet
build` sạch, xác nhận round-trip thật qua PATCH `/api/destinations/da-lat`
(`contentTier` -> Postgres mirror + SQL Server `v2.Destination.ContentTier`
đều cập nhật đúng), trang `/diem-den/da-lat` load 200 sau khi đổi (server
build lại, không phải process cũ) — đã gán Đà Lạt = `flagship` làm dữ liệu
thật đầu tiên (đúng ví dụ trong content-seo-ux-plan §10.6.1).

---

## Phase 26 — Bảng `ArticleDestinationMap` — nền tảng (ĐÃ XONG 07/2026)

**Phụ thuộc**: không phụ thuộc phase nào.

Quan hệ NGƯỢC Article → Destination (article-spec §8.1) — trang điểm đến biết
có bài cẩm nang nào viết về mình để hiện link. Phase này CHỈ xây nền tảng
(bảng + API ghi/đọc + UI gán cơ bản) — CHƯA bake vào `DynamicBlocksJson`/hiện
link trên trang điểm đến (để Phase 28, vì đó là việc của layout trang).

- SQL Server: `v2.ArticleDestinationMap` (PK `ArticleId+DestinationSlug+Topic`,
  đúng DDL trong article-spec §8.1, idempotent trong `01-create-new-schema.sql`,
  áp dụng `dichoithoi_dev`).
- `ArticleAutoLinkService.linkHtml()` đổi trả về cả `addedLinks` (trước đây
  tính rồi bỏ) — dùng làm nguồn gợi ý gán, không cần engine quét riêng.
  `PublishArticleResult` thêm field `addedLinks`.
- 2 use-case mới: `GetArticleDestinationMapUseCase` (đọc, resolve tên điểm đến
  qua mirror), `SaveArticleDestinationMapUseCase` (ghi đè toàn bộ theo tick
  xác nhận — KHÔNG bao giờ tự gán im lặng, đúng nguyên tắc xuyên suốt).
  `GET`/`PUT /articles/:jobId/destination-map`.
- `guessArticleTopic()` (domain, có unit test riêng) — đoán topic từ tiêu đề
  theo từ khoá, chỉ là gợi ý ban đầu.
- UI: `ArticleDestinationMapPanel` (`features/dichoithoi/`) hiện sau khi
  publish bài cẩm nang thành công — tick + chọn topic + Lưu.

Verify: `tsc --noEmit` api+web sạch, jest 51/51 suites (326/326 tests — thêm
10 test mới), round-trip thật qua GET/PUT `/api/articles/:jobId/destination-map`
(insert Article/publication test tạm qua script, xác nhận SQL Server
`v2.ArticleDestinationMap` ghi đúng, xoá dữ liệu test sau khi verify).

---

## Phase 27 — Product "Quà mang về" MVP (ĐÃ XONG 07/2026)

**Phụ thuộc**: không phụ thuộc phase nào — phạm vi cắt hẹp hơn thiết kế gốc để
tránh chờ Phase 28 (ContentTier/ArticleDestinationMap không cần cho MVP này).

Khối "Quà mang về" (content-seo-ux-plan §10.6.2 khối 8b) — card sản phẩm ở
CUỐI mọi trang điểm đến, KHÔNG giới hạn Flagship. Khác Hotel/Tour: không có
bảng map riêng — Product được gắn điểm đến qua chính `tags` (đúng field đã
dùng cho khối `[[block:products]]` trong bài, tái dùng `matchProducts()`).

- Cột mới `SouvenirProductsJson` trên `v2.DestinationContent` (cùng pattern
  `HotelCardsJson`/`TourCardsJson` — đã cân nhắc và loại `DynamicBlocksJson`
  hợp nhất, xem mục "Quyết định KHÔNG làm" ở plan gốc).
- `RecomputeSouvenirProductsUseCase` (module Product) — `forDestination` tính
  card cho 1 điểm đến; `forProduct` reverse-trigger khi sản phẩm đổi tag/giá/
  ảnh (hook vào `UpsertProductUseCase.create/update`, tự động phủ cả import
  hàng loạt vì import gọi lại usecase này).
- Website: `DestinationExtrasModel.SouvenirProducts` đọc thẳng JSON, render
  grid card đơn giản (ảnh/tên/giá, link thẳng affiliate — không có trang chi
  tiết sản phẩm) trong `Detail.cshtml`, sau khối FAQ.

Verify: `tsc --noEmit` api+web sạch, jest 52/52 suites (329/329 tests — thêm
3 test mới), `dotnet build` sạch. Test thật: tạo 1 sản phẩm tag `da-lat` qua
API, xác nhận `v2.DestinationContent.SouvenirProductsJson` ghi đúng và trang
`/diem-den/da-lat` render đúng khối — xoá dữ liệu test sau khi verify.

---

## Phase 28 — Nội dung đầy đủ trang Flagship/POI (tách sub-phase)

Việc lớn nhất còn lại — nội dung ĐẦY ĐỦ cho node `ContentTier=Flagship` (vd
Đà Lạt, 11 khối theo `content-seo-ux-plan.md` §10.6.2) và `kind=poi` (vd Biệt
Thự Hằng Nga, §10.6.3) — cộng 2-lớp chip nav/mục lục (§10.6.4). Tách 7
sub-phase (28.0-28.6), xem plan chi tiết đã duyệt tại thời điểm code (context
đầy đủ về khảo sát code thật trước khi viết plan, quyết định "Đánh giá biên
tập" = text + AI gợi ý).

### 28.0 — Nền tảng dữ liệu mới: `ItineraryJson`/`EditorialReview`/`ExternalReviewUrls` (ĐÃ XONG 07/2026)

3 field mới, CHƯA đổi layout hiển thị (để 28.2/28.4/28.5), đúng pattern
`PracticalNotesJson`/`PriceBreakdownJson` đã có:

- **`ItineraryJson`** (nhóm B — form theo ngày, không JSON thô): mảng mẫu
  lịch trình (vd "2N1D") → mảng ngày → mảng mục `{period, poiSlug, note}`.
  Nhập tay hoàn toàn, chỉ có ý nghĩa hiển thị với Flagship (không ràng buộc
  cứng ở tầng data).
- **`EditorialReview`**: text ngắn (≤500 ký tự) + nút "AI gợi ý" — gọi AI thật
  qua `IContentAIProvider` (operation `suggest-editorial-review`, model
  Haiku), đọc ngữ cảnh từ tên/mô tả ngắn + `Food`/`Transport`/`Tip` hiện có
  (`fetchDestinationContent`) — CHỈ gợi ý, người dùng duyệt/sửa trước khi lưu
  (không phải `AggregateRating`).
- **`ExternalReviewUrls`**: mảng `{label, url}` (Google Maps/TripAdvisor...),
  nhập tay, website sẽ render `rel="nofollow"` (Phase 28.5).
- SQL Server: 3 cột mới trên `v2.DestinationContent` (`ItineraryJson`,
  `EditorialReview` nvarchar(1000), `ExternalReviewUrlsJson`) — idempotent
  DDL, áp dụng `dichoithoi_dev`. `.NET`: `V2DestinationContent.cs` + models
  mới (`ItineraryPlanModel`/`ItineraryDayModel`/`ItineraryItemModel`,
  `ExternalReviewUrlModel`) + `DestinationExtrasRepository` đọc — **CHƯA sửa
  `Detail.cshtml`**.
- Postgres: migration `1782020000000-DestinationItineraryEditorialReview`,
  contract Zod (`itineraryPlanSchema`, `externalReviewUrlItemSchema`,
  request/response schemas), 4 usecase mới (`UpdateItineraryUseCase`,
  `UpdateEditorialReviewUseCase`, `SuggestEditorialReviewUseCase`,
  `UpdateExternalReviewUrlsUseCase`), 4 endpoint REST, 3 form React
  (`destination-itinerary-editor.tsx` — nested plan→day→item,
  `destination-editorial-review-editor.tsx` — textarea + gợi ý,
  `destination-external-review-urls-editor.tsx`).
- Stub AI provider (`stub-content-ai.provider.ts`) thêm case
  `suggest-editorial-review` để dev/test không cần API key thật.

Verify: `tsc --noEmit` api+web sạch, jest sạch, `dotnet build` sạch. Test
thật: ghi/đọc cả 3 field qua API thật cho Đà Lạt (itinerary + editorial
review AI gợi ý qua stub provider + external review URL), xác nhận SQL
Server `v2.DestinationContent` có đúng dữ liệu, trang `/diem-den/da-lat` load
200 (server rebuild, không phải process cũ) sau khi có dữ liệu — xoá dữ liệu
test sau khi verify (cả Postgres mirror lẫn SQL Server).

### 28.1 — Website: chip nav 2 lớp + mục lục + active-highlight (ĐÃ XONG 07/2026)

Áp dụng ngay cho bộ khối HIỆN CÓ (không chờ layout Flagship 28.2/28.4) —
`Detail.cshtml` + `destination-detail.ts` + `destination-detail.scss` (repo
dichoithoi):

- Chip nav mobile (đầu trang) rút còn 6 mục ưu tiên, khác nhau theo
  `ContentTier` (Flagship: Tổng quan|Di chuyển|Điểm tham quan|Ăn uống|Mẹo|FAQ;
  POI: Vị trí|Tổng quan|Ăn uống|Lưu trú|Mẹo|FAQ) — tính động trong Razor từ
  danh sách section thực tế tồn tại trên trang (`tocItems`), không hard-code
  chip theo tier khi section chưa tồn tại. **Lưu ý CHƯA khớp 100% spec**:
  "Lịch trình" (28.4) và 2-lớp "Điểm tham quan" thật (28.2) chưa build nên
  tạm dùng anchor gần nghĩa nhất đã có (`#lien-quan`) — sẽ tự đúng khi 2
  sub-phase đó lên code (cùng anchor, nội dung đổi).
- Nút "Mục lục ▾" (mobile: bottom-sheet tái dùng `wireOverlay()` có sẵn từ
  `overlay.ts`, đúng pattern bộ lọc `/diem-den`; desktop: `<nav>` tĩnh trong
  sidebar cạnh `_QuickDecisionCard`) liệt kê ĐỦ mọi section hiện có trên
  trang (không giới hạn 6 mục).
- Thêm id còn thiếu để có anchor hợp lệ: `#di-chuyen` (Transport), `#tour`,
  `#meo` (gộp Tip + PracticalNotes vào 1 container để có 1 anchor chung).
- `IntersectionObserver` active-highlight (`wireActiveTocHighlight()`) —
  thuật toán scrollspy chuẩn: browser chỉ báo entry LÚC ĐỔI trạng thái, phải
  tự lưu lại toàn bộ trạng thái intersecting qua các lần gọi rồi chọn section
  cuối cùng (theo thứ tự DOM) đang intersecting làm "đang đọc" — tránh bug 1
  section rất dài (vd lưới ~50 POI phẳng của Đà Lạt, cao hơn 4000px) vẫn coi
  là active dù đã cuộn qua section sau.

Verify: `npx webpack --mode=development` sạch, `dotnet build` sạch,
Playwright thật trên cả Flagship (Đà Lạt) và POI (Biệt thự Hằng Nga đúng ví
dụ user nêu ban đầu) — xác nhận chip nav đúng bộ theo tier, cuộn trang thật
đổi đúng chip active (test qua `window.scrollTo` từng nấc, KHÔNG dùng
`scrollIntoView` vì có thể nhảy qua section không tồn tại gây hiểu nhầm khi
debug), mở/đóng "Mục lục" đúng cả 2 breakpoint, 0 lỗi console.

### 28.2 — Website: layout Flagship — 2 lớp Điểm tham quan (ĐÃ XONG 07/2026)

`ChildrenJson` (zinoflow) mở rộng thêm 3 field lấy thẳng từ cột đã có sẵn
trên `v2.Destination` (`IsFeatured`, `[Order]`, `DistanceFromCenter` — cột
`DistanceFromCenter`/`Order` tồn tại từ trước nhưng CHƯA từng được website
đọc, đã có dữ liệu thật từ migrate v1→v2 cho phần lớn điểm):

- zinoflow: `RelatedCandidate`/`ChildRef` (`related-builder.ts`,
  `ancestors-children-builder.ts`) + `SiteDestinationRow`/`fetchAllDestinations()`
  (đọc thêm `d.[Order]`, `d.DistanceFromCenter`) + mirror Postgres (migration
  `1782030000000-DestinationOrderDistanceFromCenter`, cột `order`,
  `distance_from_center`) + `recompute-related.service.ts` `toCandidate()`
  (bổ sung luôn `isFeatured` — trước đây bị bỏ sót, related/children build ra
  chưa từng có field này dù entity đã có sẵn).
- `ChildRefModel.cs` thêm `IsFeatured`/`Order`/`DistanceFromCenter`.
- `Detail.cshtml`: khi `ContentTier == "flagship"` VÀ có ≥1 con — hiện 2 lớp
  THAY lưới phẳng cũ (`showFlagshipChildrenLayers`, ưu tiên trước
  `showClusterChildrenGrid` trong chuỗi `@if/else if`): lớp 1 "Nổi bật" (thẻ
  lớn 16:9, lọc `IsFeatured`, sort `Order` rồi tên) + lớp 2 "Theo khu vực"
  (nhóm theo `DistanceFromCenter`: <3km/3-15km/≥15km — thiếu dữ liệu khoảng
  cách rơi vào nhóm xa nhất, không bỏ sót; 3 cột luôn hiện đủ trên desktop
  qua `lg:block`, tab chip `wireAreaTabs()` lọc 1 cột trên mobile — TOÀN BỘ
  render sẵn trong DOM, không AJAX theo tab). Trùng lặp giữa 2 lớp là chủ
  đích. Node `Standard`/`ContentTier=null` giữ nguyên `showClusterChildrenGrid`
  (lưới phẳng cũ) — không đổi.
- Dữ liệu test thật: gán `IsFeatured=1` cho Hồ Xuân Hương (Order=1) và Thung
  Lũng Tình Yêu (Order=2) dưới Đà Lạt để verify lớp 1 — giữ lại vì đúng là 2
  điểm nổi bật thật (không phải placeholder cần dọn).

Verify: `tsc --noEmit` + `npx jest` (thêm test `buildChildren` mang theo 3
field mới) sạch, migration Postgres chạy thật, sync + recompute-related thật
qua API xác nhận `ChildrenJson` trong SQL Server có đủ field, `dotnet build`
+ `npx webpack` sạch, Playwright thật: Đà Lạt hiện đúng 2 lớp (2 thẻ nổi bật,
14/23/8 điểm ở 3 nhóm khoảng cách), tab chip mobile lọc đúng 1 nhóm, desktop
luôn hiện đủ 3 cột bất kể tab đang chọn; Nha Trang (Standard, 12 con) xác
nhận layout KHÔNG đổi so với trước (vẫn lưới phẳng "Các khu trong Nha
Trang", không có area-tabs); Biệt thự Hằng Nga (POI) không ảnh hưởng, 0 lỗi
console cả 3 trang.

### 28.3 — AI content: nhánh Flagship cho outline/section/frame + gate (ĐÃ XONG 07/2026)

Thêm dimension "tier" xuyên suốt pipeline generate — CHỈ ảnh hưởng khi
`articleType=guide-diem-den`, không đụng loại bài khác:

- `content_jobs.content_tier` (migration `1782040000000-ContentJobTier`,
  cột mới trên Postgres) — set 1 LẦN lúc tạo job
  (`CreateDestinationJobUseCase.execute()` đọc thẳng `destination.contentTier`
  từ mirror, không tự suy hay query lại), đi xuyên suốt vòng đời job
  (generate → quality-check → review) mà KHÔNG cần module `ai-content` phá vỡ
  ranh giới clean architecture để tự lookup ngược sang module `destination`.
- `PromptJobContext.contentTier` (`prompt-builder.ts`) — `stepKeys()` chèn 2
  key ứng viên `guide-diem-den-flagship.<step>.vi`
  (`<site>.guide-diem-den-flagship...` trước, rồi bản chung) NGAY TRƯỚC cặp
  key `guide-diem-den.<step>.vi` bình thường, CHỈ khi
  `articleType===guide-diem-den && contentTier==="flagship"` — tier
  `standard`/`null` đi thẳng qua nhánh cũ, không đổi hành vi.
- 3 prompt mặc định mới trong `default-prompts.ts`
  (`guide-diem-den-flagship.{outline,section,frame}.vi`) — khác khung POI
  đơn lẻ: outline bắt buộc 1 heading "mùa"/"thời điểm" (thay vì "văn hoá/lịch
  sử"), bỏ heading giờ mở cửa/giá vé riêng (node lớn không có 1 giá/giờ duy
  nhất), quickFacts.transport/food/hotel/tip viết ở tầm CẢ VÙNG thay vì 1
  điểm cụ thể — vẫn đúng y nguyên `destinationArticleFrameSchema` cũ, chỉ đổi
  nội dung prompt, không đổi schema/pipeline.
  Đăng ký thêm vào `prompt-catalog.ts` (`PromptArticleType` +
  `ARTICLE_TYPE_LABELS`) để màn quản lý prompt nhìn thấy 3 key mới.
- Gate mới: `evaluateDestinationStructureGate` nhánh theo
  `input.contentTier` — Flagship yêu cầu section "mùa/thời điểm"
  (`SEASON_HEADING_KEYWORDS`), Standard/null giữ nguyên yêu cầu "câu
  chuyện/ý nghĩa văn hoá - lịch sử" cũ. `evaluateGatesForArticle`
  (gate-dispatcher) + 2 nơi gọi (`run-quality-checks.usecase.ts`,
  `review-draft.usecase.ts`) đọc `job.toSnapshot().contentTier` và forward
  xuống gate.

Verify: `tsc --noEmit` (api+web) + `npx jest` (336 test, thêm test gate
Flagship/Standard + test PromptBuilder phân giải key theo tier) sạch;
migration Postgres chạy thật; tạo job thật cho Đà Lạt (Flagship,
`mode=update`) và Biệt thự Hằng Nga (POI, `contentTier=null`) qua API thật —
xác nhận `content_jobs.content_tier` lưu đúng (`flagship` vs `null`) và
quality-check của 2 job cho kết quả gate KHÁC NHAU đúng như thiết kế: bài
Đà Lạt không bị chặn ở gate "thiếu section văn hoá-lịch sử" (vì kiểm tra
"mùa/thời điểm" thay thế), bài Biệt thự Hằng Nga vẫn bị chặn đúng như trước
(gate cũ không đổi cho POI) — cả 2 job test đã reject dọn sạch sau verify.

### 28.4 — Website: Lịch trình + link bài cẩm nang theo topic (ĐÃ XONG 07/2026)

Quyết định kỹ thuật (điểm plan gốc để ngỏ): đọc `v2.ArticleDestinationMap` +
`v2.Article` bằng **live query** trực tiếp trong `DestinationExtrasRepository`
(EF Core), KHÔNG bake vào field precompute mới — cùng nhóm với cách trang đã
đọc Reviews/Types (query nhỏ, không cần cache riêng), khác nhóm
Hotel/Tour/Souvenir (JSON precompute, đổi nhiều/nặng hơn). Bảng
`ArticleDestinationMap` nhỏ, có index `(DestinationSlug, Topic)` sẵn từ Phase 26.

- `.NET`: entity mới `V2ArticleDestinationMap.cs` (`[PrimaryKey(ArticleId,
  DestinationSlug, Topic)]`, cùng pattern `V2TourDestinationMap`) + DbSet
  trong `DiChoiThoiDbContext`. `DestinationExtrasModel` thêm `ArticleLinkModel`
  + 4 list `ItineraryArticles/FoodArticles/NightlifeArticles/SouvenirArticles`
  — populate bằng 1 query JOIN `ArticleDestinationMap` × `Article` (Status=1)
  theo slug, group theo Topic tại tầng C#.
- `Detail.cshtml`: khối MỚI "Lịch trình gợi ý" (`#lich-trinh`, render
  `extras.Itinerary` đã có từ Phase 28.0 — CHƯA từng hiển thị trước đây) —
  mỗi ngày/mục hiện `period`+`note`, kèm link "Xem chi tiết →" tới POI nếu
  `poiSlug` có; mỗi plan có CTA "tour N ngày phù hợp" khớp
  `extras.Tours.DurationDays == plan.Days.Count`; cuối khối có link "Xem lịch
  trình chi tiết" nếu có bài `topic=itinerary`. Khối Ăn uống + Quà mang về
  thêm dòng "Xem thêm: {tên bài} →" khi có bài đúng topic (food/souvenir).
  Khối "Buổi tối" (`#buoi-toi`) HOÀN TOÀN mới, CHỈ hiện khi có bài
  `topic=nightlife` (không có nguồn nội dung tĩnh nào khác cho khối này).

**Phát hiện ngoài kế hoạch — lỗi encoding LocalDB dev (KHÔNG phải bug
zinoflow, KHÔNG ảnh hưởng production)**: khi verify bằng dữ liệu tiếng Việt
có dấu thật, phát hiện `MssqlSiteDbAdapter` ghi xuống `dichoithoi_dev`
(LocalDB qua driver `mssql/msnodesqlv8` + `ODBC Driver 17`) làm HỎNG dấu
tiếng Việt bất kể input đúng encoding hay khai báo tường minh kiểu
`NVarChar(MAX)` — đã test cả 2 cách đều hỏng, kết luận lỗi nằm sâu trong
native addon `msnodesqlv8`/ODBC marshalling (khả năng do codepage hệ thống
Windows, không phải type inference của thư viện `mssql`). **Chỉ xảy ra ở
nhánh LocalDB** (`isLocalDbHost`) — production dùng driver `tedious` (TCP
thuần, không qua ODBC) nên KHÔNG bị ảnh hưởng. Ghi nhận để các phase sau khi
cần dữ liệu test tiếng Việt có dấu thật trên LocalDB: ghi trực tiếp bằng
`sqlcmd -f 65001` (chỉ định codepage UTF-8 cho file .sql) thay vì gọi qua
API viết field text/JSON, cho tới khi driver/native addon được thay hoặc vá.

Verify: `dotnet build` sạch, tạo lịch trình 2N1D thật cho Đà Lạt (ghi trực
tiếp SQL Server, `sqlcmd -f 65001` do phát hiện lỗi trên) + 1 bài cẩm nang
test gắn `topic=food` (đã xoá sau verify — placeholder thuần, không phải
nội dung thật) — Playwright xác nhận: khối Lịch trình hiện đúng 2 ngày/5
mục, link POI hoạt động, link "Xem thêm" bài cẩm nang hiện đúng text; xoá
bài test xong link biến mất đúng như thiết kế; Nha Trang (Standard, không
có lịch trình/bài nightlife) xác nhận 2 khối mới KHÔNG hiện; Biệt thự Hằng
Nga (POI) không ảnh hưởng — cả 3 trang 0 lỗi console. Giữ lại lịch trình
2N1D thật cho Đà Lạt (không phải placeholder — theo quyết định giữ dữ liệu
thật của Phase 28.2).

### 28.5 — Website: banner "Về node cha" + đánh giá biên tập + external review (ĐÃ XONG 07/2026)

- Banner "Về {tên cha}" trên trang POI: cha trực tiếp = phần tử CUỐI trong
  `AncestorsJson` (đã có từ Phase 14, đúng thứ tự gốc→cha trực tiếp). Website
  live-query 1 dòng `v2.Destination.ContentTier` theo slug cha đó (KHÔNG
  thêm field mới vào `AncestorsJson` — đúng như plan gốc), chỉ set
  `ParentFlagshipName/Slug` khi cha `ContentTier=="flagship"`. Banner dùng
  template cố định (không phải nội dung AI riêng từng bài), đặt ngay đầu
  trang (trước chip Loại điểm đến).
- `EditorialReview` + `ExternalReviewUrls` (đã ghi dữ liệu từ Phase 28.0
  nhưng CHƯA từng hiển thị) — hiện trên **MỌI** trang (POI lẫn Flagship),
  đặt trong khối "Tổng quan": đánh giá biên tập dạng callout viền trái màu
  primary, external link `rel="nofollow noopener"`.

**Phát hiện thêm liên quan lỗi encoding LocalDB (xem ghi chú Phase 28.4)**:
`AncestorsJson`/`ChildrenJson` precompute TỪ TRƯỚC (ghi qua Node driver lúc
publish/recompute) cũng bị hỏng dấu tiếng Việt trên `dichoithoi_dev` vì
cùng lỗi driver — phát hiện khi banner hiện tên cha bị mất dấu dù logic
đúng. Đã sửa lại `AncestorsJson` của Biệt thự Hằng Nga bằng `sqlcmd -f
65001` để verify — dữ liệu SQL Server thật (site thật, driver `tedious`)
không bị ảnh hưởng, chỉ LocalDB dev sandbox.

Verify: `dotnet build` sạch. Playwright xác nhận: Biệt thự Hằng Nga (POI,
cha Đà Lạt=flagship) hiện đúng banner "Xem đầy đủ điểm tham quan... ở Đà
Lạt →"; Đà Lạt (cha là tỉnh Lâm Đồng, không phải flagship) KHÔNG hiện
banner; Bãi biển Đại Lãnh (POI, cha Nha Trang=standard) KHÔNG hiện banner —
xác nhận link "Nha Trang" duy nhất trên trang là breadcrumb thường, không
phải banner (khác class/style). Đánh giá biên tập + link Google
Maps/TripAdvisor hiện đúng trên cả Đà Lạt và Biệt thự Hằng Nga, 0 lỗi
console cả 3 trang. Giữ lại dữ liệu EditorialReview/ExternalReviewUrls thật
đã tạo (không phải placeholder).

### 28.6 — Coverage Score: checklist theo tier thật (ĐÃ XONG 07/2026)

`computeCoverageScore` (domain) bỏ proxy `kind` — `tier` nay tính tu
`ContentTier` THAT (Phase 25): `kind=poi` → tier "poi"; `kind IN
(province,cluster)` + `ContentTier="flagship"` → tier "flagship"; con lai
(standard/null, kể cả chưa gán) → tier "standard" MOI (checklist rut gon
giong POI, khong co 5 muc rieng). 4 muc Flagship-only truoc day ghi "chua
tinh duoc do thieu ha tang" (xem `packages/contracts/src/dichoithoi/coverage-score.ts`)
nay tinh duoc du ca:

- `itinerary` — `mirror.itinerary.length > 0` (Phase 28.0).
- `article-topic-coverage` — co bai cam nang published gan qua
  `ArticleDestinationMap` (Phase 26) — port `DichoithoiSiteDb` them
  `fetchArticleTopicCoverage()` (1 query JOIN `ArticleDestinationMap` ×
  `Article`, tra ve danh sach slug).
- `editorial-review` — `mirror.editorialReview` khong rong (Phase 28.0).
- `external-review-url` — `mirror.externalReviewUrls.length > 0` (Phase 28.0).

Contract `destinationCoverageScoreSchema.tier` doi tu 2 gia tri
(`poi|flagship`) sang 3 (`poi|standard|flagship`) — UI `do-phu/page.tsx`
them nhan "Standard".

**Phát hiện thêm (cùng gốc lỗi encoding LocalDB đã ghi ở Phase 28.4/28.5)**:
`v2.Destination.Name` của chính Đà Lạt cũng bị hỏng dấu (`?? L?t`) do 1 lần
ghi qua Node driver trước đây trong phiên làm việc — đã sửa lại bằng
`sqlcmd -f 65001` + chạy lại `/api/destinations/sync` để mirror nhận tên
đúng. Quét toàn bộ 271 điểm xác nhận CHỈ Đà Lạt bị ảnh hưởng, không có điểm
nào khác.

Verify: `tsc --noEmit` (api+web) + `npx jest` (10 test coverage-score/
get-coverage-scores, có 4 test flagship/standard/4-mục-mới) sạch, gọi API
thật xác nhận Đà Lạt tier=flagship 15 mục (đủ 5 mục riêng, đúng trạng thái
done/chưa done theo dữ liệu mirror thật), Biệt thự Hằng Nga tier=poi 10 mục,
Nha Trang (ContentTier chưa gán) tier=standard 10 mục — Playwright xác nhận
trang "Độ phủ nội dung" hiện đúng badge + danh sách 15 mục cho Đà Lạt, 0 lỗi
console.

**Phase 28 (Nội dung đầy đủ trang Flagship/POI) hoàn tất toàn bộ 28.0-28.6.**

---

## Còn treo — CHƯA đủ điều kiện đưa vào phase code (cần bạn quyết định trước)

~~Rà soát lại `DestinationType`/`DestinationTypeMap`~~ → **✅ ĐÃ XONG (07/2026,
vòng 2)** — xem `dichoithoi-backlog.md` mục A#8, dòng này đã lỗi thời.

~~Chuẩn hoá danh sách `category` cho Product (product-spec §3)~~ →
**✅ ĐÃ XONG (07/2026)** — Phase 16 trước đây build "tự do nhập + autocomplete"
(drift so với spec gốc "1 giá trị, dropdown quản lý sẵn"). Đổi thành enum cố
định `PRODUCT_CATEGORIES` trong `packages/contracts/src/dichoithoi/product.ts`
(15 giá trị, gồm 4 giá trị BẮT BUỘC giữ nguyên chuỗi vì
`article-block-compiler.service.ts` `FOOD_SPOT_CATEGORIES` khớp chính xác:
"Quán ăn"/"Nhà hàng"/"Ẩm thực"/"Đặc sản") — validate ngay ở Zod schema
(`productSchema`/`upsertProductRequestSchema`, áp dụng luôn cho Sheet import
vì dùng chung schema). Xoá hẳn `GET /products/categories` +
`ListProductCategoriesUseCase` + `listDistinctCategories()` (không cần
autocomplete nữa vì danh sách đã cố định) — UI `san-pham/page.tsx` đổi từ
`<Input list=... /><datalist>` sang `<Select>` thật; màn nhập Sheet
(`san-pham/nhap/page.tsx`) thêm validate category client-side trước khi gọi
API. Verify: `tsc --noEmit` (api+web) sạch, `npx jest` 339 test sạch (sửa vài
fixture dùng category cũ "balo"/"đặc sản" thường → giá trị enum chính xác),
test thật qua API: tạo sản phẩm category hợp lệ → OK, category không hợp lệ →
Zod chặn đúng thông báo liệt kê đủ 15 giá trị, `/products/categories` xác
nhận trả 404 (đã xoá), dọn sạch sản phẩm test.
~~[Bug tiềm ẩn, phát hiện lúc làm Phase 19] Điểm đến hoàn toàn mới qua
zinoflow bị 404 trên `/diem-den/{slug}`~~ → **✅ ĐÃ XONG (07/2026)** — người
dùng xác nhận sửa ngay, không chờ go-live toàn bộ Phase 10. Khảo sát thực tế
(qua Explore agent) phát hiện `/diem-den` Index + `/search` + autocomplete
**ĐÃ cắt sang v2 từ "Phase B"** (ghi chú cũ trong bug report đã lỗi thời) —
chỉ còn đúng `DestinationRepository.GetDetailAsync` (v1-only) là điểm nghẽn
404 thật. Sửa: `GetDetailAsync` thử v1 trước (không đổi), NULL thì fallback
`GetDetailFromV2Async` mới — đọc thẳng `v2.Destination`+`v2.DestinationContent`
+ `v2.Province`/cha, ánh xạ đúng shape `DestinationDetailModel` (field-by-field
khớp nhánh v1) để toàn bộ phần còn lại của controller/view dùng không đổi.
Verify qua 2 destination test thật tạo trực tiếp trong `v2.Destination`
(1 POI, 1 cluster, KHÔNG có dòng `dbo.Destination` tương ứng): xác nhận cả
2 trang render đủ (title/content/giá vé/breadcrumb đúng tên cha qua
`DestinationGroupName`, ảnh resolve đúng cả 2 convention thumbnail cũ/mới —
đã kiểm chứng toán học phép resolve URL tương đối `../diem-den/` khớp y hệt
cách các thẻ con/related dùng `src="@child.Thumbnail"` không tiền tố), 1
regression fix dọc đường (`detail.Type` phải là chuỗi rỗng chứ không phải
null — code cũ giả định luôn non-null tại `detail.Type.Split(',')`), 1
destination v1 thật (Đà Lạt) xác nhận KHÔNG regression. Đã xoá dữ liệu test.

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
  └─ quyết định "kind=cluster 2 biến thể + vùng/miền" ĐÃ CHỐT (07/2026),
     sẵn sàng code, chưa bắt tay làm
Phase 19 (search trong RAM)         — độc lập, ĐÃ XONG (07/2026)
Phase 20 (sidebar-first nav CMS)    — độc lập, ĐÃ XONG (07/2026)
```
