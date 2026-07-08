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
```
