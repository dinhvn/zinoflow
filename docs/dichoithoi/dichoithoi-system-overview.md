# Dichoithoi — Tài liệu tổng (kiến trúc hệ thống, cập nhật 12/06/2026)

ĐÂY LÀ TÀI LIỆU VÀO CỬA cho mọi thứ liên quan dichoithoi.com. Toàn bộ tài liệu
riêng cho dichoithoi nằm trong thư mục `docs/dichoithoi/` (tách khỏi `docs/specs/`
chung của zinoflow vì đây là 1 sản phẩm/nội dung riêng).

**Quy ước nhãn trạng thái** dùng xuyên suốt mọi tài liệu dichoithoi (áp dụng
cho mọi chỉnh sửa từ 07/2026 trở đi, không hồi tố toàn bộ file cũ): ✅ ĐÃ XONG
· 🔄 ĐANG LÀM · ❌ CHỦ Ý CHƯA LÀM (đã quyết, không phải quên) · ⚠️ CẦN QUYẾT
ĐỊNH (chờ bạn chốt) · ~~gạch ngang~~ = đã lỗi thời/bị thay thế bởi quyết định
mới hơn. **"Cái gì đã xong / còn thiếu" chỉ theo dõi ở đúng 1 chỗ**:
`dichoithoi-backlog.md` (việc mở + quyết định cần chốt) và
`dichoithoi-implementation-plan.md` (nhật ký build theo Phase, có DoD) — các
tài liệu spec khác dưới đây là THIẾT KẾ (data model/thuật toán/UI), không lặp
lại tracking trạng thái.

**Bắt đầu từ đâu tuỳ mục đích:**
- Quay lại code / hỏi "còn gì phải làm" → `dichoithoi-backlog.md` rồi
  `dichoithoi-implementation-plan.md`.
- Thêm/sửa tính năng hiển thị công khai → đọc `dichoithoi-seo-principles.md`
  TRƯỚC TIÊN (ưu tiên cao nhất, checklist SEO-owner bắt buộc).
- Cần bức tranh kỹ thuật tổng thể nhanh → `dichoithoi-system-design.md`.
- Cần chi tiết 1 module → đúng file spec module đó (danh sách dưới).

Đọc theo thứ tự (lần đầu tiếp cận dự án):
1. Tài liệu này — vai trò + quan hệ giữa 3 thành phần, lộ trình.
2. `dichoithoi-seo-principles.md` — nguyên tắc SEO tối thượng, ĐỌC TRƯỚC KHI
   CODE bất kỳ tính năng/field hiển thị nào (ưu tiên cao nhất, ghi trong CLAUDE.md).
3. `dichoithoi-database-redesign.md` — schema database mới (ưu tiên tốc độ).
4. `dichoithoi-destination-spec.md` — tính năng tạo/cập nhật bài điểm đến trong AI tool.
5. `dichoithoi-content-seo-ux-plan.md` — mục tiêu sản phẩm, khung nội dung đầy đủ,
   chiến lược SEO + kiếm tiền (booking khách sạn/vé), thiết kế UI/UX trang detail.
   Lưu ý: phần lớn nội dung §10 (mobile-first) đã build xong (Phase 18) — đọc
   như tài liệu as-built/tham khảo, không phải việc còn mở.
6. `dichoithoi-hotel-spec.md` — module Hotel (cào/nhập tay, chỉ hiển thị dạng
   khối gợi ý, KHÔNG có trang riêng — quyết định 07/2026).
7. `dichoithoi-tour-spec.md` — module Tour (cào/nhập tay, gắn vào 1-n điểm đến,
   cùng KHÔNG có trang riêng — quyết định 07/2026).
8. `dichoithoi-product-spec.md` — module Sản phẩm (affiliate, chèn qua tag
   trong bài viết — đã build Phase 16).
9. `dichoithoi-affiliate-link-conversion-spec.md` — cơ chế chung: lưu link gốc,
   tự sinh link affiliate theo rule cấu hình, dùng cho cả Hotel/Tour/vé điểm đến.
10. `dichoithoi-article-spec.md` — bài viết tổng hợp/cẩm nang (khác Destination,
    có cơ chế "khối động" tự nhúng danh sách điểm đến/hotel/tour).
11. `dichoithoi-flight-spec.md`, `dichoithoi-bus-spec.md` — vé máy bay/xe khách,
    ❌ CHỦ Ý CHƯA vào lộ trình build (tự ghi "phân tích, chưa chốt" — chờ bạn
    xem lại spec trước khi có đợt code tiếp theo).
12. `dichoithoi-backlog.md` — **nguồn sự thật duy nhất** cho quyết định cần
    chốt + việc còn mở + rủi ro vận hành từ tất cả tài liệu trên.
13. `dichoithoi-system-design.md` — **đọc file này nếu chỉ có thời gian đọc 1
    file**: tổng hợp toàn bộ spec thành 1 bức tranh kỹ thuật đầy đủ (bảng dữ
    liệu 2 database, sơ đồ luồng, API surface, nguyên tắc xuyên suốt).
14. `dichoithoi-implementation-plan.md` — **BẮT ĐẦU TỪ ĐÂY khi quay lại code**:
    kế hoạch build theo phase, có thứ tự phụ thuộc + Definition of Done từng
    phase.
15. `archive/` — tài liệu audit/note một-lần đã lỗi thời (mô tả code TRƯỚC
    Phase 18 rebuild UI / Phase B migrate schema v2), giữ lại chỉ để tham khảo
    lịch sử, KHÔNG phản ánh trạng thái hiện tại.

## 1) Ba thành phần và vai trò (đã chốt)

| Thành phần | Công nghệ | Vai trò MỚI | Thay đổi so với hiện tại |
|---|---|---|---|
| **Website dichoithoi** | .NET (GIỮ NGUYÊN stack) | Renderer thuần đọc — đọc DB schema mới, render nhanh nhất có thể | Sửa lại tầng đọc theo schema mới (`dichoithoi-database-redesign.md` §5-6); KHÔNG quản lý nội dung |
| **AI Content Tool (zinoflow)** | NestJS + Next.js + Postgres | **TRỞ THÀNH CMS** cho nội dung điểm đến, khách sạn, tour VÀ bài cẩm nang tổng hợp: soạn (AI generate/cào/nhập tay), duyệt, publish, quan hệ, re-link, đồng bộ | Thêm module destination (M4) + module hotel + module tour + module article (`dichoithoi-hotel-spec.md`, `dichoithoi-tour-spec.md`, `dichoithoi-article-spec.md`, quyết định 07/2026) |
| **CMS dichoithoi (cũ)** | .NET trên Azure | Chỉ còn giữ các module CHƯA migrate: Sim, Phượt, Post (bài blog kiểu cũ, khác Article mới) | Module Destination TẮT vĩnh viễn; module Hotel + Tour migrate về zinoflow (nút import/crawl cũ vô hiệu hóa) |

Nguyên tắc nền: **single-writer cho từng bảng** — mỗi bảng chỉ có đúng 1 hệ thống
được ghi, không bao giờ 2 hệ cùng ghi 1 bảng:

| Bảng (schema mới) | Ai ghi | Ai đọc |
|---|---|---|
| Destination, DestinationContent, DestinationRelation, DestinationType(+Map), DestinationTypeGroup, Province, SlugRedirect | **AI tool** (duy nhất) | Website |
| Hotel, HotelGroup | **AI tool** (duy nhất — cào/nhập tay, xem `dichoithoi-hotel-spec.md`) | Website |
| Tour, TourDestinationMap | **AI tool** (duy nhất — cào/nhập tay, xem `dichoithoi-tour-spec.md`) | Website |
| Article (mới) | **AI tool** (duy nhất — bài cẩm nang có khối động, xem `dichoithoi-article-spec.md`) | Website |
| DestinationReview | **Website** (khách viết review) | Website, AI tool (đếm/duyệt) |
| Sim, Phượt, Post... | **CMS cũ** (như hiện tại) | Website |

## 2) Sơ đồ quan hệ và luồng dữ liệu

```
                    ┌─────────────────────────────┐
                    │   AI Content Tool (zinoflow)│
                    │ = CMS điểm đến+hotel+tour   │
                    │  Postgres: draft, review,   │
                    │  prompt, relations, mirror, │
                    │  hotels, tours (cào/nhập tay)│
                    │  affiliate_link_rules       │
                    └────────┬──────────┬─────────┘
              (1) publish/upsert        │ (2) invalidate cache
              schema mới, transaction   │     (HTTP, secret key)
                         ▼              ▼
        ┌────────────────────┐   ┌──────────────────┐
        │ SQL Server          │◄──│ Website dichoithoi│
        │ (site4now)          │(3)│ .NET — chỉ ĐỌC    │
        │ nguồn render        │   │ + ghi review (4)  │
        └─────────▲───────────┘   └──────────────────┘
                  │ (5) ghi bảng Sim/Phượt/Post (như cũ)
        ┌─────────┴───────────┐
        │ CMS dichoithoi (cũ) │  ← module Destination + Hotel + Tour ĐÃ TẮT
        └─────────────────────┘
```

Các luồng:
1. **AI tool → SQL Server**: publish bài đã Approved (upsert Destination +
   DestinationContent + Relation + SlugRedirect, transaction, không bao giờ wipe);
   cùng cơ chế cho Hotel/HotelGroup (`dichoithoi-hotel-spec.md`) và
   Tour/TourDestinationMap (`dichoithoi-tour-spec.md`). Mọi link affiliate (vé,
   hotel, tour) đã tính sẵn `affiliateUrl` trước khi ghi
   (`dichoithoi-affiliate-link-conversion-spec.md`). Đây cũng là chiều sync
   ngược: AI tool đọc DB để dựng mirror lần đầu.
2. **AI tool → Website**: gọi endpoint `POST /admin/cache/refresh` (bảo vệ bằng
   secret key trong header) sau mỗi lần publish — website xóa memory cache của
   slug đó + taxonomy. Website KHÔNG cần biết AI tool tồn tại ngoài endpoint này;
   nếu endpoint lỗi, cache tự hết hạn theo sliding expiration (degrade mềm).
3. **Website ← SQL Server**: đọc thuần theo covering index (redesign doc §5).
4. **Website → DestinationReview**: bảng DUY NHẤT website được ghi
   (khách gửi review, IsApproved=0).
5. **CMS cũ → SQL Server**: tiếp tục ghi các bảng Sim/Phượt/Post —
   không đụng bảng điểm đến/hotel/tour nên không xung đột.

KHÔNG có luồng nào: AI tool ↔ CMS cũ (không tích hợp, không gọi API lẫn nhau);
Website → bảng điểm đến/hotel/tour (không ghi).

## 2.1) Vòng đời nội dung qua 2 database (cơ chế lưu + publish)

Phân vai 2 database — dữ liệu KHÔNG bao giờ tồn tại "nửa này nửa kia":

| | Postgres (zinoflow, local) | SQL Server (site4now, production) |
|---|---|---|
| Vai trò | **Xưởng soạn thảo** — nguồn sự thật của nội dung | **Read-model production** — chỉ chứa bản ĐÃ duyệt |
| Chứa gì | job, draft (mọi version), review history, quality results, prompt, ai_usage_logs, mirror metadata, quan hệ đang soạn | Destination + Content (bản cuối đã render HTML), Relation, redirect — đúng những gì website cần để render |
| Bài chưa duyệt | có (draft) | **KHÔNG BAO GIỜ** — không có khái niệm draft trên production |

Luồng từ lúc AI tạo xong → production (5 trạng thái, 2 chốt chặn TAY):

```
[1] Generate (pg-boss worker, 3 bước)
      └─ draft lưu POSTGRES (DraftReady) ──────────── SQL Server chưa bị đụng tới
[2] Quality gates (code thuần, tự động)
      └─ fail → sửa/generate lại, vẫn chỉ ở Postgres
[3] ✋ CHỐT 1 — Manual review (M3 đã có):
      đọc + sửa tay trên editor (mỗi lần sửa = version mới),
      panel quick-facts (giá vé/giờ mở cửa) để soát dữ liệu dễ sai,
      Approve (chạy lại gates lần cuối) / RequestChange / Reject
      └─ Approved — VẪN chỉ nằm ở Postgres
[4] ✋ CHỐT 2 — Manual publish:
      nút "Publish lên dichoithoi" (chỉ enable khi Approved),
      preview lần cuối: HTML sẽ ghi + danh sách link nội bộ sẽ chèn
      └─ bấm → render HTML + auto-link + RelatedJson
              → UPSERT SQL Server (transaction) → invalidate cache web
[5] Live trên dichoithoi.com — AI tool lưu PublishRecord (ai, lúc nào, version nào)
```

Hệ quả của thiết kế này:
1. **Approve ≠ Publish** — 2 nút riêng, đều là người bấm. Duyệt xong 10 bài rồi
   publish dần từng bài cũng được.
2. **Update bài cũ an toàn**: draft mới nằm ở Postgres, bài cũ trên web giữ nguyên
   cho tới khi bấm publish đè.
3. **Rollback được**: Postgres giữ mọi version → chọn version cũ re-publish.
4. Tùy chọn soát kỹ hơn nữa (khi cần): publish với `Status=hidden` — bài đã nằm
   trên SQL Server, xem được qua URL trực tiếp nhưng không vào danh sách/sitemap;
   ưng rồi bật `Status=published`. Dùng cho bài nhạy cảm/đợt đầu chưa tin pipeline.

## 2.2) Ba cửa vào: tạo điểm mới, viết lại bài cũ, sửa metadata

§2.1 mô tả vòng đời TỪ lúc Generate. Phần này bổ sung **bước 0 (tạo metadata)**
và phân nhánh điểm MỚI vs điểm CŨ ở hai đầu (tạo job + publish) — soi theo code:
`upsert-destination.usecase.ts`, `create-destination-job.usecase.ts`,
`publish-destination.usecase.ts`.

Mọi điểm đến đều có cột `siteId` trong mirror Postgres: `null` = chỉ sống trong
AI tool (production chưa biết tới); có giá trị = đã tồn tại bên SQL Server. `siteId`
là cờ quyết định nhánh ở mọi bước.

### Cửa A — Viết bài cho điểm đến MỚI hoàn toàn

```
[0] Thêm điểm đến  POST /api/destinations  (UpsertDestination.create)
      └─ tạo dòng mirror siteId=null — sống ở Postgres, CHƯA chạm SQL Server.
         Người dùng nhập tay thứ AI không được bịa: tên, slug, lat/lng,
         địa chỉ cũ/mới, liên hệ, bookingUrl (code hiện tại — kế hoạch đổi
         sang `ticketLinks[]` nhiều link, xem destination-spec §2.3, CHƯA
         implement), hotelGroup (code hiện tại — kế hoạch đổi sang
         `HotelDestinationMap`, xem hotel-spec §4, CHƯA implement), thumbnail.
[1] Tạo job AI  POST /:slug/jobs  mode=create  (CreateDestinationJob)
      └─ gom sourceContext (facts mirror + điểm cùng tỉnh để auto-link + URL nguồn)
         → CreateContentJob siteCode=dichoithoi, articleType=guide-diem-den
         → set activeContentJobId vào mirror.
[2..4] Generate → CHỐT 1 Review/Approve → CHỐT 2 Publish (y hệt §2.1)
[5] Publish (PublishDestination): vì siteId=null →
      INSERT "shell" Destination xuống SQL Server lấy siteId mới → lưu lại mirror →
      rồi mới UPSERT nội dung. Đây là LẦN ĐẦU điểm đến chạm production.
```

### Cửa B — Viết lại NỘI DUNG bài đã có (mode=update)

Giống Cửa A nhưng bỏ bước [0] (điểm đã có trong mirror, `siteId != null`):
```
[1] POST /:slug/jobs  mode=update
      └─ nạp THÊM nội dung hiện tại trên web (fetchDestinationContent) vào prompt
         → AI viết lại tốt hơn, giữ thông tin đúng.
[2..4] Generate → Review/Approve → Publish (§2.1)
[5] Publish: vì siteId đã có → KHÔNG insert shell, chỉ UPSERT ĐÈ nội dung.
      Taxonomy/lat/lng/địa chỉ giữ nguyên (publish chỉ ghi cột nội dung +
      thumbnail + description). Bài cũ trên web giữ nguyên tới đúng lúc bấm publish.
```

### Cửa C — Chỉ sửa METADATA (đường tắt, KHÔNG qua review/publish)

Đổi địa chỉ / lat-lng / bookingUrl (→ `ticketLinks[]` khi implement) / thumbnail /
hotelGroup (→ `HotelDestinationMap` khi implement)... của điểm đã có:
```
PATCH /api/destinations/:slug  (UpsertDestination.update)
      └─ cập nhật mirror; vì siteId != null → ghi metadata THẲNG SQL Server ngay
         (updateMetadata) → website phản ánh tức thì.
```
Lý do bỏ qua 2 chốt: đây là **dữ liệu cứng người dùng nhập tay**, không phải nội
dung AI sinh — không có gì để duyệt. Nội dung bài (Content HTML) thì luôn phải đi
qua Cửa A/B. Sửa metadata của điểm `siteId=null` chỉ cập nhật mirror, chờ publish.

| Cửa | siteId trước | Qua review/publish? | Tác động production |
|---|---|---|---|
| A — bài điểm mới | null | có (2 chốt) | INSERT shell + UPSERT nội dung |
| B — viết lại bài cũ | != null | có (2 chốt) | UPSERT đè nội dung, giữ metadata |
| C — sửa metadata | != null | KHÔNG | ghi thẳng metadata (updateMetadata) |

## 3) Vì sao sắp xếp như vậy (phân tích)

1. **AI tool = CMS** thay vì "AI tool đẩy về CMS cũ rồi CMS publish":
   - CMS cũ thiết kế quanh Google Sheet + wipe-import, không có draft/review/version —
     đắp thêm sẽ tốn hơn xây mới, mà zinoflow ĐÃ có sẵn pipeline draft → quality
     gates → review → publish (M1-M3 xong).
   - Giảm 1 chặng dữ liệu = giảm 1 chỗ lệch nhau. Nội dung chỉ có 2 trạng thái:
     đang soạn/duyệt (Postgres) và đang hiển thị (SQL Server).
2. **Website chỉ đọc** (trừ review): tách hoàn toàn đường ghi khỏi đường render →
   website tối ưu tốc độ tự do (cache mạnh tay, không lo invalidate phức tạp vì
   chỉ 1 nguồn ghi và nguồn đó chủ động báo).
3. **Postgres (soạn) tách khỏi SQL Server (render)**: draft/version/review history/
   prompt là dữ liệu vận hành của AI tool, website không cần — để bên zinoflow giúp
   SQL Server chỉ chứa read-model gọn, đúng tinh thần "ghi đắt, đọc rẻ".
4. **CMS cũ không tắt ngay toàn bộ**: các module Sim/Phượt/Post còn chạy tự
   động (crawl, update) và không liên quan nội dung điểm đến/hotel/tour —
   migrate dần sau, tránh đại tu quá nhiều thứ cùng lúc. Hotel + Tour migrate
   SỚM HƠN dự kiến ban đầu (cùng đợt với Destination, quyết định 07/2026) vì
   cùng là nội dung "biên tập + duyệt" hợp lý để chung 1 CMS, không phải vì kỹ
   thuật bắt buộc.

## 4) Trách nhiệm vận hành cụ thể của AI tool (vai CMS)

Lúc publish 1 điểm đến (mọi việc nặng dồn về đây — render chỉ SELECT):
1. Render ContentHtml hoàn chỉnh (markdown → HTML sạch + auto-link).
2. Tính RelatedJson (trộn con/nearby/related/cùng loại), NameUnaccented.
3. Upsert các bảng + SlugRedirect nếu đổi slug + cập nhật ChildCount.
4. Ghi quan hệ mentioned vào DestinationRelation.
5. Gọi invalidate cache website.

Ngoài publish:
- Nút "Re-link toàn bộ" + "Recompute related toàn bộ" (pg-boss job).
- Nút "Đồng bộ mirror" (đọc lại từ SQL Server phòng sửa ngoài luồng).
- Nút "Áp dụng lại affiliate rule" (`dichoithoi-affiliate-link-conversion-spec.md`
  §4) — dùng chung cho vé điểm đến, hotel, tour.
- (Giai đoạn sau) duyệt DestinationReview + cập nhật ReviewCount/AvgRating —
  tạm thời việc duyệt review vẫn ở CMS cũ cho tới khi chuyển.

## 5) Lộ trình 3 giai đoạn

**Giai đoạn 1 — Đại tu nền (hiện tại):**
1. Chạy migration schema mới (redesign doc §7) — bên repo dichoithoi, sau backup.
2. Sửa website .NET đọc schema mới (repo dichoithoi, song song) — ✅ cập nhật
   07/2026: ghi chú "người dùng tự làm" trước đó chỉ là note cũ chưa cập
   nhật, không phải quyết định có chủ ý — Claude làm luôn, test trên
   `dichoithoi_dev` trước khi động tới production.
3. Build M4 zinoflow: mirror + generate + review + publisher (destination-spec).
4. Build module Hotel zinoflow: cào/nhập tay + publisher (`dichoithoi-hotel-spec.md`).
5. Build module Tour zinoflow: cào/nhập tay + publisher (`dichoithoi-tour-spec.md`).
6. Build cơ chế affiliate link conversion dùng chung
   (`dichoithoi-affiliate-link-conversion-spec.md`) — làm TRƯỚC hoặc CÙNG lúc
   với Hotel/Tour vì cả 2 module đều phụ thuộc field `provider/sourceUrl/
   affiliateUrl/linkStatus`.
7. Tắt module Destination + Hotel + Tour trên CMS cũ.
Kết thúc khi: gate M4 pass (bài AI lên web thật, update đè bài cũ, re-link chạy ổn)
VÀ khối gợi ý khách sạn/tour trên trang điểm đến đọc đúng data + link affiliate
do zinoflow ghi.

**Giai đoạn 2 — AI tool thành CMS đầy đủ cho điểm đến:**
1. Duyệt review chuyển về AI tool.
2. Tự động cập nhật content theo lịch (re-fetch nguồn tham khảo, so sánh, đề xuất).
3. Quản lý taxonomy (Type, Province) có UI.
4. Quản lý ảnh: tab "Ảnh" upload kéo thả → convert/resize → FTP lên hosting
   (destination-spec §14) + AI gợi ý danh sách ảnh/alt text khi generate bài
   + remark trên ảnh (watermark/caption — §14.4).

**Giai đoạn 3 — Thu gọn CMS cũ:**
Migrate dần Sim/Phượt/Post về zinoflow (hoặc quyết định giữ vĩnh viễn phần
crawl bên CMS cũ nếu không bõ công) → CMS cũ chỉ còn crawler hoặc tắt hẳn. (Hotel
+ Tour đã migrate ở Giai đoạn 1, không nằm trong phần "sau" này nữa.)

## 6) Quy ước & ràng buộc chung
1. Schema SQL Server thuộc sở hữu repo dichoithoi (migration script nằm đó);
   zinoflow không bao giờ tự migrate DB này — chỉ đọc/ghi data.
2. Secret: `DICHOITHOI_DB_CONNECTION`, `DICHOITHOI_CACHE_REFRESH_KEY` — env vars
   bên zinoflow; không hardcode, không log.
3. Mọi ghi từ AI tool: transaction + timeout + retry/backoff; mọi nội dung HTML
   đã sanitize trước khi ghi.
4. Backup: trước migration (toàn DB) và định kỳ trước đợt publish lớn (runbook).
5. Tiếng Việt có dấu cho TOÀN BỘ nội dung + UI (quy tắc chung của repo).
6. **Dev KHÔNG trỏ thẳng production** (bổ sung 07/2026): script
   `pnpm clone:dichoithoi` (`apps/api/scripts/clone-dichoithoi-to-localdb.ts`)
   đã có sẵn — đọc production CHỈ ĐỌC, ghi sang LocalDB `dichoithoi_dev`
   (idempotent, an toàn chạy lại). Dev/test hằng ngày (kể cả build/test module
   Hotel/Tour/Article mới) trỏ `DICHOITHOI_DB_HOST=(localdb)\MSSQLLocalDB`,
   `DICHOITHOI_DB_NAME=dichoithoi_dev` trong `.env`; chỉ điền connection
   production khi thật sự go-live/publish thật (`.env.example` dòng 42-51 đã
   ghi chú đúng ý này, chỉ cần ai đó thực sự đổi `.env` sang LocalDB).
