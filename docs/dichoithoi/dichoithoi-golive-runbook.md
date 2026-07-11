# Runbook Go-live cutover (Phase 10)

Gộp toàn bộ bước rải rác trong `dichoithoi-implementation-plan.md` Phase 10 +
`dichoithoi-destination-spec.md` §8/§12 thành 1 danh sách thao tác theo ĐÚNG
thứ tự bắt buộc, kèm lệnh cụ thể. Đã **rehearsal toàn bộ chuỗi bước 1-4 và 7
trên `dichoithoi_dev` (07/2026)** — xem log ở cuối file. Bước 5/6/8/9 CHỈ làm
khi chốt thời điểm go-live thật (chưa làm ở phiên rehearsal này).

**Trước khi bắt đầu**: đọc kỹ toàn bộ file này 1 lượt, chuẩn bị cửa sổ theo
dõi log server (.NET + zinoflow api) trong lúc chạy.

## Bước 1 — Backup 2 bảng gốc

```
sqlcmd -S <production-host> -d <production-db> -i scripts/dichoithoi-sqlserver/03-backup-legacy-tables.sql
```

Script tự in bảng đối chiếu `COUNT(*)` bảng gốc vs bảng backup ở cuối —
**dừng lại nếu 2 số không khớp**. Ghi lại hậu tố ngày (`yyyyMMdd`) in ra màn
hình — cần dùng lại nếu phải restore (`04-restore-legacy-tables.sql`, sửa
biến `@suffix` ở đầu file trước khi chạy).

## Bước 2 — Chạy schema v2

```
sqlcmd -S <production-host> -d <production-db> -i scripts/dichoithoi-sqlserver/01-create-new-schema.sql
```

Script idempotent (đã verify chạy 2 lần liên tiếp không đổi gì) — an toàn
nếu lỡ chạy lại. In dòng cuối `"xong - schema v2 da san sang"` là thành công.

## Bước 3 — Migrate data

```
sqlcmd -S <production-host> -d <production-db> -i scripts/dichoithoi-sqlserver/02-migrate-data.sql
```

**CHỈ CHẠY ĐƯỢC ĐÚNG 1 LẦN** — script tự chặn (RAISERROR + ROLLBACK) nếu
`v2.Destination` đã có dữ liệu, đúng dự kiến (đã verify: gọi lần 2 trên
`dichoithoi_dev` bị chặn đúng, không ghi đè/nhân đôi dữ liệu).

## Bước 4 — Checklist an toàn

- So `COUNT(*)` mọi bảng mới với kỳ vọng (đúng checklist Phase 1 đã dùng:
  Province=34, Destination=<khớp số dòng bảng gốc>, DestinationContent=<khớp
  Destination>, DestinationTypeGroup=3, DestinationType=18).
- Spot-check 10 URL `/diem-den/{slug}` ngẫu nhiên — trang load đúng nội dung.
- Sitemap diff = 0 URL mất so với trước migration.

## Bước 5 — Khoá import CMS cũ

Chỉ 2 route thật sự ghi vào `dbo.Destination`/`dbo.DestinationDetail` (đã
grep xác nhận — **Hotel không có route import nào trên CMS cũ**, không cần
khoá): `CmsDiChoiThoi.Web` action `import_destination`
(`Controllers/DestinationController.cs`) và `import_tour`
(`Controllers/TourController.cs`).

Đổi `appsettings.json` (hoặc file môi trường đang deploy thật) của
`CmsDiChoiThoi.Web`:
```json
"AppSetting": { "IsLegacyImportLocked": true }
```
Deploy lại `CmsDiChoiThoi.Web` — 2 route trên sẽ trả
`{"error": "Đã khoá import sau go-live — CMS cũ không còn được dùng."}`
thay vì chạy import. Cơ chế reversible (không xoá code) — muốn mở lại chỉ
cần đổi `false` + deploy lại.

**Lưu ý quan trọng phát hiện lúc chuẩn bị**: `CmsDiChoiThoi.Web` KHÔNG có
profile local an toàn — cả `appsettings.Development.json` lẫn
`appsettings.Release.json` đều trỏ THẲNG vào SQL Server production thật
(`sql5059.site4now.net`). Vì vậy **không được `dotnet run` app này ở máy
local** để test cơ chế khoá — chỉ `dotnet build` (đã verify sạch) rồi tin
code review, test thật sự phải làm lúc deploy thật (xem log cuối file).

## Bước 6 — Đổi `.env` production (zinoflow)

Chỉ lúc này mới đổi `DICHOITHOI_DB_HOST`/`_NAME`/`_USER`/`_PASSWORD` trong
`.env` của `apps/api` sang connection production thật. Restart api.

## Bước 7 — Đồng bộ → re-link → recompute (ĐÚNG thứ tự, destination-spec §12)

```
curl -X POST http://<api-host>/api/destinations/sync
curl -X POST http://<api-host>/api/destinations/relink -H "Content-Type: application/json" -d '{"dryRun":true}'
# Đọc kỹ báo cáo relink dry-run — chỉ tiếp tục nếu hợp lý
curl -X POST http://<api-host>/api/destinations/relink/apply
curl -X POST http://<api-host>/api/destinations/recompute-related
```

Thứ tự bắt buộc: sync (12.1) trước — mirror phải khớp SQL Server trước khi
re-link/recompute đọc mirror làm nguồn. Cả 2 job sau đều idempotent (đã
verify: chạy lần 2 → 0 thay đổi).

## Bước 8 — Website trỏ schema mới

Đổi connection string `DiChoiThoiDb` của `DiChoiThoi.Web` +
`CmsDiChoiThoi.Web` sang production đã có schema v2 (nếu khác connection
cũ). Xác nhận trang chủ + vài `/diem-den/{slug}` load đúng.

## Bước 9 — Theo dõi song song

Chạy song song 1-2 tuần trước khi cân nhắc xoá `dbo.Destination`/
`DestinationDetail` gốc (đã có 2 bản backup từ bước 1 làm lưới an toàn thứ
2). **Việc SAU go-live, không nằm trong runbook cắt lúc này.**

---

## Log rehearsal đã chạy trên `dichoithoi_dev` (07/2026)

Chạy bước 2 (2 lần liên tiếp), bước 3 (xác nhận tự chặn), bước 7 (2 lần
liên tiếp) thật trên `dichoithoi_dev` — KHÔNG chạy bước 1 lại (đã test riêng
lúc viết script `03-backup-legacy-tables.sql`, xem file đó), KHÔNG chạy bước
5/6/8 (hành động thật trên production, ngoài phạm vi rehearsal).

| Bước | Kết quả | Thời gian |
|---|---|---|
| 03-backup (test riêng) | `dbo.Destination` 271=271, `DestinationDetail` 271=271 khớp | — |
| 01-create-new-schema (lần 1, đã vá `DestinationTag`) | thành công, 0 lỗi | — |
| 01-create-new-schema (lần 2) | thành công, 0 lỗi, `DestinationTag`=7 dòng/`DestinationTagMap`=0 dòng KHÔNG đổi | — |
| 02-migrate-data (chạy lại) | tự chặn đúng dự kiến (`v2.Destination đã có dữ liệu — script này chỉ chạy 1 lần. Rollback.`) | — |
| `POST /destinations/sync` | `added:0, updated:0, unchanged:271` | 510ms |
| `POST /destinations/relink` (dryRun) | `scanned:271, changed:0` | 1008ms |
| `POST /destinations/relink/apply` | enqueue OK (`jobId` trả về) | — |
| `POST /destinations/recompute-related` (lần 1) | `scanned:271, updated:90` | 870ms |
| `POST /destinations/recompute-related` (lần 2) | `scanned:271, updated:0` (idempotent xác nhận) | 587ms |
| `POST /destinations/relink` (dryRun, lần 2) | `scanned:271, changed:0` (vẫn idempotent) | — |
| `dotnet build CmsDiChoiThoi.Web` (sau khi thêm `IsLegacyImportLocked`) | Build succeeded, 0 Error | — |

**Giới hạn đã biết của rehearsal này**: không thể rehearsal bước 2+3 từ
trạng thái "sạch, chưa có schema v2" thật sự — vì `dichoithoi_dev` đã có v2
từ Phase 1 (07/2026). Bước 2 chỉ verify được tính idempotent (chạy lại
không lỗi), bước 3 chỉ verify được cơ chế tự chặn hoạt động đúng — LẦN ĐẦU
chạy 2 script này trên production thật vẫn sẽ là lần đầu tiên thực thi trọn
vẹn từ đầu, y hệt cách Phase 1 đã làm 1 lần trên `dichoithoi_dev` trước đây
(đã có checklist row-count khớp kỳ vọng ghi trong implementation-plan Phase
1).
