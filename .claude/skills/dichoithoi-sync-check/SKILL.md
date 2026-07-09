---
name: dichoithoi-sync-check
description: Xác định trước khi code 1 phase/tính năng dichoithoi có cần đổi CẢ zinoflow (Postgres mirror, apps/api, admin UI apps/web) LẪN dichoithoi (SQL Server schema, DiChoiThoi.Web) hay chỉ 1 bên. Dùng khi bắt đầu 1 phase mới trong dichoithoi-implementation-plan.md, hoặc trước khi báo 1 phase là "xong" để không bỏ sót đồng bộ 2 phía.
---

# Dichoithoi — Kiểm tra đồng bộ zinoflow ⇄ dichoithoi

**Chuẩn đã đặt ra từ đầu dự án**: mọi phase liên quan dichoithoi phải đồng bộ
cả admin/API zinoflow LẪN website dichoithoi trong cùng 1 khối công việc, ở
những phần thực sự cần cả 2 phía — nhưng KHÔNG phải phase nào cũng cần cả 2
(vd Phase 18 hầu hết là thuần website, chỉ 18.1 trục vùng/miền cần cả 2 bên).
Đừng giả định — luôn kiểm tra thực tế theo từng phase cụ thể.

## Quy trình

1. Đọc phase liên quan trong
   `docs/dichoithoi/dichoithoi-implementation-plan.md` — xem phần "Phụ thuộc"
   và mô tả việc cụ thể đã ghi có nhắc tới bảng/API/UI zinoflow không.
2. Tự hỏi 2 câu:
   - **Dữ liệu mới có cần một nơi lưu/quản lý ở zinoflow không?** — nếu có
     field/bảng mới mà admin cần nhập liệu (không phải chỉ đọc live từ SQL
     Server), cần: migration Postgres (nếu mirror) HOẶC field trực tiếp trên
     SQL Server qua `DichoithoiSiteDb`/`MssqlSiteDbAdapter` (xem pattern
     `fetchTaxonomyContent`/`updateTaxonomyDescription` — Phase 18.2), Zod
     schema mới trong `packages/contracts`, use-case + controller endpoint
     trong `apps/api`, và trang/form admin trong `apps/web`.
   - **Website dichoithoi có cần đọc/hiển thị dữ liệu này không?** — nếu có,
     cần đổi Controller/Repository/View trong `DiChoiThoi.Web`.
   Nếu câu trả lời của CẢ HAI là "không" (ví dụ thuần đổi UI/CSS/JS không
   động tới dữ liệu) → chỉ cần sửa bên dichoithoi, không đụng zinoflow.
3. Ghi rõ trong tóm tắt/kế hoạch: phase này chạm zinoflow hay không, và vì
   sao — tránh người review phải tự suy luận lại.
4. Nếu KHÔNG chắc — dùng SQL trực tiếp kiểm tra dữ liệu thật trên
   `dichoithoi_dev` (LocalDB) trước khi giả định schema, thay vì đoán từ tên
   cột/bảng (đã có tiền lệ giả định sai: `IsGroup`/`IsProvince` ở v1 tưởng
   suy ra được `Kind` ở v2 nhưng thực tế không — phải verify bằng query thật).

## Nguồn tham chiếu

- `docs/dichoithoi/dichoithoi-implementation-plan.md` — theo dõi phase, DoD.
- `docs/dichoithoi/dichoithoi-system-design.md` — bản đồ hệ thống, ranh giới
  Postgres mirror vs SQL Server trực tiếp.
- `docs/dichoithoi/dichoithoi-backlog.md` — quyết định/rủi ro đang mở.
- `docs/dichoithoi/dichoithoi-destination-spec.md` §13 — schema field-level.

## Lưu ý ranh giới quan trọng

`DestinationTypeGroup`/`DestinationType`/`Province` KHÔNG có mirror Postgres
— zinoflow đọc/ghi trực tiếp qua `siteDb.fetchTypes()`/`DichoithoiSiteDb`
adapter. Không phải mọi field mới đều cần migration Postgres — kiểm tra bảng
đó đã có mirror chưa trước khi viết migration thừa.
