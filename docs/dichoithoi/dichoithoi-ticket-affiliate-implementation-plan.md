# Kế hoạch triển khai: Vé điểm đến + Affiliate Partner (13/07/2026)

Gộp toàn bộ quyết định đã chốt ở 2 doc phân tích thành checklist thực thi
theo đúng THỨ TỰ PHỤ THUỘC. **Chưa code gì** — chỉ lên kế hoạch, chờ bạn
yêu cầu "implement" mới bắt đầu (có thể làm từng Phase riêng, không bắt
buộc làm hết 1 lần).

Nguồn quyết định:
- `dichoithoi-affiliate-provider-management-analysis.md` (gọi tắt **[AFF]**)
- `dichoithoi-ticket-analysis.md` (gọi tắt **[VÉ]**)

## Thứ tự Phase (sau PHẢI phụ thuộc trước)

```
Phase 1: Affiliate Partner (networks + partners)         [AFF §3, §4, §4.1]
   ↓ (destination_tickets cần dropdown provider từ đây)
Phase 2: Bảng destination_tickets (thay ticketLinks[] nhúng) [VÉ §11.5]
   ↓ (trang /ve và trang chi tiết điểm đến cần đọc bảng mới)
Phase 3: Cập nhật trang /dichoithoi/ve + trang chi tiết điểm đến [VÉ §10]
   (độc lập, chạy song song được)
Phase 4: ticketPrice mirror + auto-parse + cột/filter giá  [VÉ §11.1, §11.2, §11.3]
   (độc lập hoàn toàn, làm trước/sau/song song đều được)
Phase 5: Đổi 3 form Hotel/Tour (Select bắt buộc)            [AFF §5]
   (chỉ phụ thuộc Phase 1)
```

---

## Phase 1 — Affiliate Partner [AFF §3, §4, §4.1]

**Backend (apps/api, module `affiliate`):**
1. Migration Postgres: tạo bảng `affiliate_networks` (id, code, name,
   template, placeholder, is_active, notes) + `affiliate_partners` (id,
   code, name, homepage_url, description, network_id FK nullable,
   match_domain, is_active).
2. Cân nhắc: giữ hay bỏ bảng `affiliate_link_rules` cũ — nếu gần như trống
   dữ liệu thật (cần kiểm tra lúc code), có thể xoá thẳng thay vì migrate.
3. Entity + repository cho 2 bảng mới (TypeORM).
4. Sửa `resolveAffiliateLink` (domain) — thuật toán v2: tra `provider` →
   `affiliate_partners` → lấy `network_id` → tra `affiliate_networks` →
   áp `template` của MẠNG (không phải của partner) — xem thuật toán đầy đủ
   ở [AFF] §3.
5. API CRUD `affiliate_networks` (thêm/sửa/tắt — màn quản lý mạng, đơn
   giản, phục vụ Phase 1 UI).
6. API CRUD `affiliate_partners` (thêm/sửa/tắt/gán `network_id`).
7. API import: `POST /affiliate/partners/import-google-sheet` nhận
   `{ sheetUrl }` → convert URL sheet → CSV export URL → fetch (timeout +
   retry) → parse bằng `csv-parse` → map cột theo header (chuẩn hoá tên,
   không hardcode vị trí) → upsert theo `code` → trả
   `{ inserted, updated, skipped }`. **Lưu thẳng, không preview** (đã chốt).
8. `packages/contracts`: schema mới `affiliateNetworkSchema`,
   `affiliatePartnerSchema`, request import — rebuild contracts sau khi sửa.

**Frontend (apps/web):**
9. Màn `/dichoithoi/affiliate` — thêm tab/khu vực mới "Đối tác" (danh sách
   `affiliate_partners`, badge "Chưa gán mạng" nếu `network_id` null, dropdown
   inline gán mạng ngay tại dòng — xem [AFF] §4.1) + tab "Mạng affiliate"
   (CRUD `affiliate_networks`, tương tự UI rule cũ nhưng field ít hơn).
   Nút "Đồng bộ từ Google Sheet" (nhập `sheetUrl`, bấm chạy, hiện kết quả
   `inserted/updated/skipped`).

**Cần bạn cung cấp lúc code**: link Google Sheet **public** (chia sẻ "Bất
kỳ ai có link — Người xem"), đúng cột `code | name | link | desc | loại
affiliate | status`.

---

## Phase 2 — Bảng `destination_tickets` [VÉ §11.5]

**Backend:**
1. Migration Postgres: tạo bảng `destination_tickets` (id, destination_slug,
   label, provider, source_url, affiliate_url, link_status, price,
   thumbnail_url, order, created_at, updated_at) — schema đầy đủ ở [VÉ]
   §11.5. Không cần migrate dữ liệu cũ (0/272 điểm có `ticketLinks` thật).
   `thumbnail_url`: cùng field Hotel/Tour đã có — chỉ lưu trữ + cho nhập ở
   form, việc HIỂN THỊ trên website (`_QuickDecisionCard.cshtml`) quyết
   định sau tuỳ thiết kế, KHÔNG làm trong Phase này.
2. Entity + repository (`DestinationTicketRepository`): CRUD từng dòng
   (`create`, `update(id)`, `delete(id)`, `listByDestinationSlug(slug)`,
   `listAll()` cho trang `/ve`).
3. Use case: mỗi lần create/update/delete 1 dòng vé → gom lại toàn bộ dòng
   cùng `destination_slug` → tính `TicketLinksJson` → ghi vào
   `DestinationContent` bên SQL Server (nếu điểm đã publish, `siteId` khác
   null) — TÁI DÙNG đúng cơ chế publish hiện có (`siteDb.updatePriceBreakdown`
   pattern tương tự), không tạo bảng SQL Server mới.
4. API: `GET /destinations/:slug/tickets`, `POST /destinations/:slug/tickets`,
   `PATCH /tickets/:id`, `DELETE /tickets/:id`, `GET /tickets` (toàn bộ,
   cho trang `/ve`).
5. `provider` field: validate bắt buộc phải khớp 1 `affiliate_partners.code`
   đang `is_active=true` (phụ thuộc Phase 1 đã xong).
6. Xoá dần code cũ: `UpdateTicketLinksUseCase`, cột `ticketLinks` jsonb
   trong mirror entity (sau khi xác nhận không còn chỗ nào đọc) — dọn ở
   cuối Phase 2, không xoá vội giữa chừng.

**Frontend:**
7. Viết lại `destination-ticket-links-editor.tsx` (hoặc file mới) — mỗi
   dòng có nút Sửa/Xoá riêng (gọi `PATCH`/`DELETE` theo `id`), form thêm
   dòng mới dùng `Select` provider từ `affiliate_partners` (Phase 1) thay
   Input tự do.

---

## Phase 3 — Trang `/dichoithoi/ve` + trang chi tiết điểm đến [VÉ §10]

1. `/dichoithoi/ve/page.tsx` — đổi nguồn dữ liệu: `GET /tickets` (Phase 2)
   thay vì đọc `ticketLinks` nhúng qua `GET /destinations`. Giữ layout hiện
   tại (nhóm theo điểm đến, tìm kiếm, sửa inline).
2. Trang chi tiết điểm đến (`[slug]/page.tsx`) — khối "Link mua vé":
   - Có ≥1 dòng vé (`GET /destinations/:slug/tickets`) → hiện danh sách
     CHỈ ĐỌC (provider/label/giá).
   - Chưa có → mô tả hướng dẫn + nút "Thêm link vé cho {Tên} →" dẫn sang
     `/dichoithoi/ve?q={tên}` (giữ cơ chế auto-mở dòng đã có).

---

## Phase 4 — Giá vé tại quầy (độc lập, không phụ thuộc Phase 1-3) [VÉ §11.1-§11.3]

1. Migration Postgres: thêm cột `ticketPrice` vào mirror destination (đọc
   1 chiều từ SQL Server `TicketPrice`, không ảnh hưởng `contentHash`) —
   chi tiết đủ 7 bước ở [VÉ] §11.1.
2. `sync-destinations.usecase.ts`/adapter — kéo thêm cột này lúc đồng bộ.
3. `destination-price-breakdown-editor.tsx` — nút "Tách giá vé từ text",
   thuật toán nhận nhãn linh hoạt (số đầu không nhãn = "Người lớn", số sau
   không nhãn = "Giá vé {thứ tự}", có nhãn thật thì lấy đúng nhãn) — thuần
   client-side, không cần API mới ([VÉ] §11.2).
4. `/dichoithoi/ve` — thêm cột "Giá tại quầy" + filter mặc định ẩn điểm
   miễn phí/chưa có giá, ưu tiên nổi bật nhóm "có giá nhưng chưa có link"
   ([VÉ] §11.3).

---

## Phase 5 — Đổi form Hotel/Tour sang Select bắt buộc [AFF §5]

1. `apps/web/src/app/dichoithoi/khach-san/page.tsx` — provider Input →
   Select (nguồn `affiliate_partners`, group theo `network`).
2. `apps/web/src/app/dichoithoi/tour/page.tsx` — tương tự.
3. `affiliate-url-preview.tsx` — kiểm tra vẫn hoạt động đúng với thuật
   toán resolve v2 (Phase 1 mục 4), không cần đổi logic hiển thị.

---

## Việc phụ (không thuộc code, làm khi tiện — không chặn Phase nào)

- Cập nhật `dichoithoi-bus-spec.md`/`dichoithoi-flight-spec.md`: thêm yêu
  cầu "provider phải chọn từ `affiliate_partners`" vào spec TRƯỚC khi build
  2 module đó (đã nêu ở [AFF] §7) — chỉ sửa doc, không code (Bus/Flight
  chưa build).

## Việc cần bạn quyết nốt trước khi bắt đầu (câu hỏi còn treo)

- [VÉ] §12 câu 5: `destination_tickets` có cần thêm `status` (ẩn tạm không
  xoá hẳn) hay giữ đơn giản như đề xuất (không có status, xoá là xoá thật)?
- Link Google Sheet public cho Phase 1 (khi bắt đầu Phase 1).
