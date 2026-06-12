# Dichoithoi — Tài liệu tổng (kiến trúc hệ thống, cập nhật 12/06/2026)

ĐÂY LÀ TÀI LIỆU VÀO CỬA cho mọi thứ liên quan dichoithoi.com. Đọc theo thứ tự:
1. Tài liệu này — vai trò + quan hệ giữa 3 thành phần, lộ trình.
2. `dichoithoi-database-redesign.md` — schema database mới (ưu tiên tốc độ).
3. `dichoithoi-destination-spec.md` — tính năng tạo/cập nhật bài điểm đến trong AI tool.

## 1) Ba thành phần và vai trò (đã chốt)

| Thành phần | Công nghệ | Vai trò MỚI | Thay đổi so với hiện tại |
|---|---|---|---|
| **Website dichoithoi** | .NET (GIỮ NGUYÊN stack) | Renderer thuần đọc — đọc DB schema mới, render nhanh nhất có thể | Sửa lại tầng đọc theo schema mới (`dichoithoi-database-redesign.md` §5-6); KHÔNG quản lý nội dung |
| **AI Content Tool (zinoflow)** | NestJS + Next.js + Postgres | **TRỞ THÀNH CMS** cho nội dung điểm đến: soạn (AI generate), duyệt, publish, quan hệ, re-link, đồng bộ | Thêm module destination (M4) |
| **CMS dichoithoi (cũ)** | .NET trên Azure | Chỉ còn giữ các module CHƯA migrate: Hotel (crawl MyTour), Tour, Sim, Phượt, Post | Module Destination TẮT vĩnh viễn (nút import wipe-all phải vô hiệu hóa) |

Nguyên tắc nền: **single-writer cho từng bảng** — mỗi bảng chỉ có đúng 1 hệ thống
được ghi, không bao giờ 2 hệ cùng ghi 1 bảng:

| Bảng (schema mới) | Ai ghi | Ai đọc |
|---|---|---|
| Destination, DestinationContent, DestinationRelation, DestinationType(+Map), Province, SlugRedirect | **AI tool** (duy nhất) | Website |
| DestinationReview | **Website** (khách viết review) | Website, AI tool (đếm/duyệt) |
| Hotel, HotelGroup, Tour, Sim, Phượt, Post... | **CMS cũ** (như hiện tại) | Website |

## 2) Sơ đồ quan hệ và luồng dữ liệu

```
                    ┌─────────────────────────────┐
                    │   AI Content Tool (zinoflow)│
                    │   = CMS mới cho điểm đến    │
                    │  Postgres: draft, review,   │
                    │  prompt, relations, mirror  │
                    └────────┬──────────┬─────────┘
              (1) publish/upsert        │ (2) invalidate cache
              schema mới, transaction   │     (HTTP, secret key)
                         ▼              ▼
        ┌────────────────────┐   ┌──────────────────┐
        │ SQL Server          │◄──│ Website dichoithoi│
        │ (site4now)          │(3)│ .NET — chỉ ĐỌC    │
        │ nguồn render        │   │ + ghi review (4)  │
        └─────────▲───────────┘   └──────────────────┘
                  │ (5) ghi bảng Hotel/Tour/Sim... (như cũ)
        ┌─────────┴───────────┐
        │ CMS dichoithoi (cũ) │  ← module Destination ĐÃ TẮT
        └─────────────────────┘
```

Các luồng:
1. **AI tool → SQL Server**: publish bài đã Approved (upsert Destination +
   DestinationContent + Relation + SlugRedirect, transaction, không bao giờ wipe).
   Đây cũng là chiều sync ngược: AI tool đọc DB để dựng mirror lần đầu.
2. **AI tool → Website**: gọi endpoint `POST /admin/cache/refresh` (bảo vệ bằng
   secret key trong header) sau mỗi lần publish — website xóa memory cache của
   slug đó + taxonomy. Website KHÔNG cần biết AI tool tồn tại ngoài endpoint này;
   nếu endpoint lỗi, cache tự hết hạn theo sliding expiration (degrade mềm).
3. **Website ← SQL Server**: đọc thuần theo covering index (redesign doc §5).
4. **Website → DestinationReview**: bảng DUY NHẤT website được ghi
   (khách gửi review, IsApproved=0).
5. **CMS cũ → SQL Server**: tiếp tục ghi các bảng Hotel/Tour/Sim/Phượt/Post —
   không đụng bảng điểm đến nên không xung đột.

KHÔNG có luồng nào: AI tool ↔ CMS cũ (không tích hợp, không gọi API lẫn nhau);
Website → bảng điểm đến (không ghi).

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
4. **CMS cũ không tắt ngay toàn bộ**: các module Hotel/Tour/Sim còn chạy tự động
   (crawl, update) và không liên quan nội dung điểm đến — migrate dần sau,
   tránh đại tu 2 thứ cùng lúc.

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
- (Giai đoạn sau) duyệt DestinationReview + cập nhật ReviewCount/AvgRating —
  tạm thời việc duyệt review vẫn ở CMS cũ cho tới khi chuyển.

## 5) Lộ trình 3 giai đoạn

**Giai đoạn 1 — Đại tu nền (hiện tại):**
1. Chạy migration schema mới (redesign doc §7) — bên repo dichoithoi, sau backup.
2. Sửa website .NET đọc schema mới (repo dichoithoi, người dùng tự làm, song song).
3. Build M4 zinoflow: mirror + generate + review + publisher (destination-spec).
4. Tắt module Destination trên CMS cũ.
Kết thúc khi: gate M4 pass (bài AI lên web thật, update đè bài cũ, re-link chạy ổn).

**Giai đoạn 2 — AI tool thành CMS đầy đủ cho điểm đến:**
1. Duyệt review chuyển về AI tool.
2. Tự động cập nhật content theo lịch (re-fetch nguồn tham khảo, so sánh, đề xuất).
3. Quản lý taxonomy (Type, Province) có UI.
4. Quản lý ảnh: tab "Ảnh" upload kéo thả → convert/resize → FTP lên hosting
   (destination-spec §14) + AI gợi ý danh sách ảnh/alt text khi generate bài
   + remark trên ảnh (watermark/caption — §14.4).

**Giai đoạn 3 — Thu gọn CMS cũ:**
Migrate dần Hotel/Tour/Sim/Phượt/Post về zinoflow (hoặc quyết định giữ vĩnh viễn
phần crawl bên CMS cũ nếu không bõ công) → CMS cũ chỉ còn crawler hoặc tắt hẳn.

## 6) Quy ước & ràng buộc chung
1. Schema SQL Server thuộc sở hữu repo dichoithoi (migration script nằm đó);
   zinoflow không bao giờ tự migrate DB này — chỉ đọc/ghi data.
2. Secret: `DICHOITHOI_DB_CONNECTION`, `DICHOITHOI_CACHE_REFRESH_KEY` — env vars
   bên zinoflow; không hardcode, không log.
3. Mọi ghi từ AI tool: transaction + timeout + retry/backoff; mọi nội dung HTML
   đã sanitize trước khi ghi.
4. Backup: trước migration (toàn DB) và định kỳ trước đợt publish lớn (runbook).
5. Tiếng Việt có dấu cho TOÀN BỘ nội dung + UI (quy tắc chung của repo).
