# Dichoithoi — Thiết kế hệ thống chi tiết (tổng hợp, 07/2026)

Tài liệu TỔNG HỢP toàn bộ 10 spec riêng lẻ thành 1 bức tranh kỹ thuật đầy đủ —
đọc file này để hiểu HỆ THỐNG HOÀN CHỈNH sẽ trông như thế nào, không cần đọc
hết 10 file kia trước. Mỗi mục trỏ lại spec gốc để biết chi tiết/lý do quyết
định; file này KHÔNG lặp lại phần "vì sao" đã có ở spec gốc, chỉ tổng hợp
"trông như thế nào".

Đọc trước: [dichoithoi-system-overview.md](dichoithoi-system-overview.md) (vai
trò 3 thành phần). Kế hoạch triển khai theo file này: xem
[dichoithoi-implementation-plan.md](dichoithoi-implementation-plan.md).

⚠️ **Đọc TRƯỚC TIÊN, ưu tiên cao hơn mọi spec khác**:
[dichoithoi-seo-principles.md](dichoithoi-seo-principles.md) — vai trò/tư duy
bắt buộc + quy trình 3 câu hỏi trước khi thêm bất kỳ tính năng/thông tin nào.

## 1) Bản đồ module

zinoflow (NestJS) có **5 module** phục vụ dichoithoi, cấu trúc 4 lớp chuẩn
(domain/application/infrastructure/presentation — `clean-architecture-playbook.md`):

| Module | Vai trò | Publisher riêng | Có content-pipeline (AI/review)? |
|---|---|---|---|
| `destination` | Bài điểm đến — mirror, generate, quan hệ, auto-link | `IDestinationPublisher` | Có (đầy đủ 2 chốt) |
| `hotel` | Dữ liệu khách sạn — cào/nhập tay, gán điểm đến | `IHotelPublisher` | Không (chỉ data, không qua review) |
| `tour` | Dữ liệu tour — cào/nhập tay, gán điểm đến | `ITourPublisher` | Không (chỉ data, không qua review) |
| `article` | Bài cẩm nang — có "khối động" nhúng data | `IArticlePublisher` | Có (tái dùng pipeline `ai-content`, xem §3.4) |
| `affiliate` (mới, tách riêng — xem §2 lý do) | Rule chuyển link gốc→affiliate, dùng chung 3 module trên | — (không publish gì, chỉ tính toán) | Không |

`ai-content` (module lõi, đã có từ M1-M3) được `destination` và `article` DÙNG
CHUNG qua `siteCode`/`articleType` — không viết pipeline generate/review riêng
(destination-spec §3.1, article-spec §1).

### 1.1 Vì sao tách `affiliate` thành module riêng (quyết định khi viết tài liệu này)
3 spec gốc (destination/hotel/tour) đều tự mô tả cơ chế `sourceUrl→affiliateUrl`
nhưng đều trỏ về CÙNG 1 spec dùng chung
([dichoithoi-affiliate-link-conversion-spec.md](dichoithoi-affiliate-link-conversion-spec.md)).
Về code, đây phải là 1 module/service ĐỘC LẬP (`AffiliateLinkResolver`,
`affiliate_link_rules` table) mà `destination`, `hotel`, `tour` cùng import qua
interface — tránh 3 module tự implement 3 bản logic convert khác nhau (rủi ro
lệch hành vi). Đây là điểm làm rõ MỚI so với các spec gốc (chưa spec nào nói
thẳng "đây là 1 module NestJS riêng").

## 2) Toàn bộ bảng dữ liệu (2 database)

### 2.1 Postgres (zinoflow — xưởng soạn thảo, nguồn sự thật của nội dung)

| Bảng | Thuộc module | Ghi chú |
|---|---|---|
| `content_jobs`, `content_drafts`, `review_records`, `prompt_templates`, `ai_usage_logs` | `ai-content` (lõi, có sẵn) | Dùng chung cho destination + article |
| `destinations` (mirror) | `destination` | Metadata phản chiếu từ SQL Server — destination-spec §3.2 |
| `destination_relations` | `destination` | nearby/related/mentioned — destination-spec §3.7 (đã sửa khớp model thật, xem §12.2-12.3) |
| `admin_provinces`, `admin_wards`, `admin_ward_mappings` | `destination` | Seed dvhcvn, map địa chỉ cũ↔mới — destination-spec §13 |
| `destination_images` (giai đoạn 2) | `destination` | Metadata ảnh (path/altText/caption/credit/sortOrder) — destination-spec §14.4, nguồn điền `GalleryJson` |
| `hotels`, `hotel_destination_map` | `hotel` | hotel-spec §3 |
| `tours`, `tour_destination_map` | `tour` | tour-spec §3 |
| `affiliate_link_rules` | `affiliate` | affiliate-conversion-spec §2 — CHỈ tồn tại ở Postgres, không đồng bộ SQL Server |

### 2.2 SQL Server (site4now — production, read-model của website)

| Bảng | Ghi bởi | Website đọc để render |
|---|---|---|
| `Province` | AI tool | Taxonomy hành chính |
| `Destination` (bảng nóng) | AI tool | List/card/filter — database-redesign §4.2 |
| `DestinationContent` (bảng lạnh) | AI tool | Trang detail — database-redesign §4.3, có `TicketLinksJson`/`GalleryJson`/`TicketPriceFrom` (vá 07/2026) |
| `DestinationTypeGroup`, `DestinationType`, `DestinationTypeMap` | AI tool | Trang `/loai/{group}[/{type}]` — database-redesign §4.4 (2 tầng, sửa 07/2026) |
| `DestinationRelation` | AI tool | Nguồn tính lại `RelatedJson` (không query trực tiếp lúc render) |
| `SlugRedirect` | AI tool | 301 khi đổi slug |
| `DestinationReview` | **Website** (khách viết) | AI tool chỉ đếm/duyệt |
| `Hotel` | AI tool | Card khách sạn |
| `HotelDestinationMap` (mới, thay `HotelGroupId` legacy) | AI tool | JOIN theo `DestinationSlug` — hotel-spec §4 (sửa 07/2026, khớp pattern Tour) |
| `Tour`, `TourDestinationMap` | AI tool | Card tour — tour-spec §4-5 |
| `Article` (mới hoàn toàn) | AI tool | Trang `/cam-nang/{slug}` — article-spec §8 |

Nguyên tắc bao trùm: **mỗi bảng đúng 1 nơi ghi** (system-overview §1) — website
CHỈ ghi `DestinationReview`; mọi bảng còn lại AI tool ghi, website chỉ SELECT.

## 3) Luồng dữ liệu chính (tổng hợp từ nhiều spec)

### 3.1 Publish 1 điểm đến (destination-spec §2.1, §2.2, §12)
```
Generate (AI, 3 bước) → Quality gates → CHỐT 1 Review/Approve
  → CHỐT 2 Publish:
     1. Render ContentHtml (markdown→HTML sạch + auto-link)
     2. Tính RelatedJson (con→related→nearby→anh em→cùng loại, tối đa 8)
     3. Convert ticketLinks[] qua module `affiliate` (sourceUrl→affiliateUrl)
     4. Upsert Destination + DestinationContent (+ SlugRedirect nếu đổi slug)
     5. Ghi DestinationRelation (mentioned, từ auto-link)
     6. Invalidate cache website (POST /admin/cache/refresh)
```

### 3.2 Publish 1 khách sạn/tour (hotel-spec §4, tour-spec §4 — KHÔNG qua review)
```
Cào HOẶC nhập tay → convert sourceUrl→affiliateUrl (module affiliate)
  → publish thẳng (không 2 chốt, vì không phải nội dung AI cần duyệt):
     Upsert Hotel/Tour + HotelDestinationMap/TourDestinationMap
```

### 3.3 Compile 1 bài Article (article-spec §3-§4 — điểm khác biệt lớn nhất so với Destination)
```
RawContent (có token [[block:...]]) → Approve HOẶC bấm "Làm mới khối động":
  1. Parse token, validate tham số (type/province/slug tồn tại?)
  2. Query dữ liệu qua các module tương ứng (destination/hotel/tour)
  3. Render HTML card theo template CHUNG (không để AI tự sinh markup)
  4. Ghép lại → ContentHtml hoàn chỉnh → Upsert Article
Khác Destination: có 2 lối vào riêng — "Cập nhật bài" (gọi AI, đổi văn bản,
qua review lại) vs "Làm mới khối động" (không gọi AI, chỉ re-query, publish
thẳng không cần duyệt lại vì văn bản không đổi).
```

### 3.4 Tạo draft: AI tự động vs viết tay (article-spec §1.1 — thay đổi CORE `ai-content`)
```
"Tạo bằng AI"  → CreateContentJobUseCase (có sẵn) → Created→GeneratingOutline→DraftReady
"Viết tay"     → CreateManualDraftUseCase (MỚI)   → Created→DraftReady (bỏ qua AI, transition mới)
Cả 2 hội tụ về DraftReady → sửa (UpdateDraftUseCase, có sẵn) → review → publish (giống nhau tuyệt đối).
```

### 3.5 Áp dụng lại affiliate rule (affiliate-conversion-spec §4)
```
Sửa/thêm 1 rule → nút "Áp dụng lại" → quét mọi link (ticketLinks/Hotel/Tour)
khớp provider, bỏ qua linkStatus=manual-override, tính lại affiliateUrl
→ publish lại đúng bảng tương ứng (3 nơi khác nhau, 1 job dùng chung).
```

## 4) API surface tổng hợp (dự kiến, gộp từ mọi spec)

```
# destination (destination-spec §5.1)
GET    /api/destinations
POST   /api/destinations/sync
POST   /api/destinations/:id/jobs           {mode: create|update}
POST   /api/destinations/:id/publish
POST   /api/destinations/relink
GET    /api/destinations/taxonomy

# hotel (hotel-spec §6, suy ra cùng pattern)
GET    /api/hotels
POST   /api/hotels                          (nhập tay)
POST   /api/hotels/scrape                   {url}
POST   /api/hotels/:id/publish
POST   /api/hotels/recompute-nearby

# tour (tour-spec §6, cùng pattern)
GET    /api/tours
POST   /api/tours
POST   /api/tours/scrape                    {url}
POST   /api/tours/:id/publish

# article (article-spec §9)
GET    /api/articles
POST   /api/articles/jobs                   {mode: ai|manual}
POST   /api/articles/:id/publish
POST   /api/articles/:id/refresh-blocks      -- "Làm mới khối động", không qua AI
POST   /api/articles/refresh-blocks/batch    -- job hàng loạt

# affiliate (affiliate-conversion-spec §5)
GET    /api/affiliate/rules
POST   /api/affiliate/rules
POST   /api/affiliate/rules/:id/reapply
```

## 5) Nguyên tắc kỹ thuật áp dụng XUYÊN SUỐT (không lặp lại giải thích — chỉ liệt kê)

1. **Ghi đắt, đọc rẻ — website CHỈ đọc và hiển thị, không xử lý logic**
   (nguyên tắc kiến trúc bao trùm, phát biểu lại rõ ràng 07/2026): zinoflow xử
   lý TOÀN BỘ — tính toán, join, sắp xếp, lọc, gộp dữ liệu — ngay lúc ghi/publish;
   website .NET chỉ làm 2 việc: SELECT theo khoá (slug/id) và render template,
   KHÔNG JOIN nhiều bảng lúc render, KHÔNG tính aggregate (`AVG`, `COUNT`) lúc
   render, KHÔNG sort/filter phức tạp lúc render. Mọi danh sách hiển thị
   (related, gallery, FAQ, hotel/tour gợi ý, ticket links, ancestors/children)
   đều là 1 cột JSON đã tính sẵn — trang detail lý tưởng chỉ cần **1 query
   chính** đọc 1 dòng đã chứa mọi thứ, cộng tối đa 1 query phụ cho phần bắt
   buộc phải sống (xem mục 2). Ví dụ cụ thể: `RelatedJson`, `affiliateUrl`,
   `ContentHtml` (kể cả khối động của Article), và mới bổ sung `HotelCardsJson`/
   `TourCardsJson` (thay JOIN+ORDER BY+TAKE lúc render — database-redesign §4.3)
   đều precompute (database-redesign §2.1, affiliate-conversion-spec §6,
   article-spec §2).
2. **Single-writer per table** — website chỉ ghi `DestinationReview`, mọi bảng
   khác chỉ AI tool ghi (system-overview §1).
3. **Không bịa dữ liệu cứng** — AI không tự sinh lat/lng/địa chỉ/link affiliate/
   giá; thiếu thì để trống hoặc chặn publish, không suy đoán (destination-spec
   §3.5, affiliate-conversion-spec §1, article-spec §4).
4. **Idempotent cho mọi job batch** — re-link, recompute related, áp dụng lại
   affiliate rule, làm mới khối động: chạy 2 lần liên tiếp không đổi thêm gì
   (destination-spec §12).
5. **Transaction + timeout/retry** cho mọi ghi external (SQL Server, FTP, HTTP
   fetch nguồn tham khảo) — system-overview §6.3.
6. **Degrade mềm** khi phụ thuộc ngoài lỗi: cache invalidate lỗi → tự hết hạn
   theo TTL; UI ẩn khối lỗi thay vì hiện lỗi xấu (content-seo-ux-plan §9.6).
7. **Dev không đụng production** — LocalDB clone (`pnpm clone:dichoithoi`),
   chỉ bật connection production lúc go-live thật (system-overview §6.6).
8. **Frontend nhẹ nhất có thể (chốt 07/2026, khi đập đi làm lại UI)** — KHÔNG
   framework UI runtime (bỏ Bootstrap/jQuery/icon font hiện tại), Tailwind
   compile-time purge + vanilla JS + SVG inline + system font + ảnh
   WebP/AVIF + Brotli/cache — mục tiêu Lighthouse Performance 90+. Bảng màu cố
   định 7 màu (giữ tinh thần thương hiệu cũ, đổi CTA sang cam). Chi tiết đầy đủ
   + lý do từng lựa chọn: `content-seo-ux-plan.md` §10.5.
9. **Cache 2 tầng phù hợp hosting shared (SmarterASP .NET Advance — không có
   quyền root/cài Redis)**: output cache in-memory (ASP.NET Core
   `OutputCache`) + Cloudflare free tier làm CDN/edge cache ngoài server —
   invalidate cả 2 khi publish (mở rộng endpoint invalidate cache đã có, thêm
   gọi Cloudflare Purge API). Resize ảnh làm ở zinoflow lúc publish (sinh sẵn
   nhiều size, upload qua FTP), KHÔNG resize lúc request trên hosting shared.
   Chi tiết: `content-seo-ux-plan.md` §10.5.1.

## 6) Điểm rủi ro kỹ thuật cần nhớ khi build (tổng hợp, xem chi tiết ở backlog §C)

- Khoá nút import Destination/Hotel/Tour trên CMS cũ NGAY sau go-live (tránh wipe).
- Test encoding tiếng Việt qua driver `mssql` với 1 record thật trước khi ghi hàng loạt.
- `HotelGroupId` là cột LEGACY trong giai đoạn chuyển tiếp — đừng code mới nào
  còn dựa vào nó, chỉ `HotelDestinationMap` là nguồn thật.
- Rủi ro ToS khi cào Hotel/Tour — quyết định kinh doanh, không phải kỹ thuật.
- Card HTML của khối động (Article) phải dùng ĐÚNG 1 bộ template — đổi giao
  diện web sau này nhớ chạy job "biên dịch lại toàn bộ bài có khối động".
