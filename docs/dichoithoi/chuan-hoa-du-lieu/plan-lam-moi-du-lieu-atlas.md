# Plan implement: Làm mới dữ liệu Tỉnh/Cụm/Điểm theo Atlas (phương án A — wipe & restore)

Ghi 27/07/2026. Trạng thái: **PLAN — CHƯA BUILD.** Bối cảnh: mọi quyết định
đã chốt trong 2 doc cùng thư mục (`phan-tich-hien-trang-va-dinh-huong.md`
§7 — 7 quyết định; `phuong-an-lam-moi-diem-den.md` §5-6 — phương án A + 7
điều kiện an toàn). Plan này chỉ triển khai, KHÔNG mở lại các quyết định đó.

## Hiện trạng đã audit (file:line đã đọc — nền tảng cho từng giai đoạn)

- Import hàng loạt sẵn có hỗ trợ đủ cột cần cho nạp cụm (`kind`,
  `contentTier`, `aiNotes`, `parentSlug`, `provinceCode`,
  `shortDescription`): `import-destinations.usecase.ts:28-97` (UPSERT theo
  slug, lỗi từng dòng không hỏng cả lô) + endpoint `POST /destinations/import`.
- Xoá cascade Postgres sẵn có, dọn đủ bảng vệ tinh không FK (relations,
  poi/cluster_distances, hotel/tour map, vé, staging extraction, products.tags):
  `typeorm-destination-mirror.repository.ts:310+` (`deleteCascade`, 1
  transaction, nhận danh sách slug bottom-up).
- `DeleteDestinationUseCase` (`delete-destination.usecase.ts`) **KHÔNG tái
  dùng nguyên vẹn cho wipe** vì 2 lý do đã đọc rõ: (1) chặn xoá
  `kind=province` (dòng 92-99); (2) bước 2 (dòng 74-80) XOÁ ẢNH VẬT LÝ
  ngay — wipe phải copy ảnh ra thư mục tạm TRƯỚC. Wipe đi đường riêng
  (giai đoạn 3), chỉ tái dùng `deleteCascade` + `collectDescendantsBottomUp`.
- Ảnh local dev ghi qua `local-image-uploader.ts` với gốc
  `DICHOITHOi_LOCAL_WEB_ROOT` (`apps/api/.env`), layout folder-theo-slug.
- Tìm điểm con trong cụm bằng AI đã build + verify
  (`dichoithoi-cluster-poi-discovery-plan.md`): use case
  `find-cluster-poi-candidates.usecase.ts` (matchType
  new/existing-in-cluster/orphan-match, fuzzy-match lỏng
  `isLikelySameDestinationName`), bảng staging
  `dichoithoi_cluster_poi_candidates`, UI
  `cluster-poi-candidates-panel.tsx` tab "AI hỗ trợ".
- Bảng `admin_provinces` 34 tỉnh mã 3 chữ (`LDG`, `AGG`...);
  `dichoithoi_destinations.province_code` hiện `varchar(2)` mã số cũ.
- Snapshot Atlas: `atlas-cum-snapshot-2026-07-27.csv` (cùng thư mục) — 257
  cụm/34 tỉnh, cột No/Tình/Tên cụm/Loại cụm/Mô tả/Một số điểm trong
  cụm/Tiếp giáp.

## Giai đoạn (thứ tự = phụ thuộc thật)

### GĐ1 — Quy tắc slug tỉnh vs cụm trùng tên — ✅ ĐÃ CHỐT (người dùng xác nhận 27/07/2026)

Bảng quy tắc slug đầy đủ (dùng cho GĐ4/GĐ5):

| Loại node | Quy tắc slug | Ví dụ |
|---|---|---|
| Tỉnh | `tinh-<ten>` | `tinh-lam-dong`, `tinh-khanh-hoa` |
| Thành phố trực thuộc TW (6: Hà Nội, Hồ Chí Minh, Đà Nẵng, Hải Phòng, Cần Thơ, Huế — các dòng `admin_provinces` tên bắt đầu "Thành phố") | `thanh-pho-<ten>` — KHÔNG dùng `tinh-` | `thanh-pho-ha-noi`, `thanh-pho-da-nang` |
| Cụm (kể cả trùng tên tỉnh/thành phố) | slug gọn từ tên cụm | cụm "Đà Nẵng" → `da-nang` |
| Cụm trùng tên cụm khác tỉnh (2 cặp: Phong Điền, Hương Sơn) | hậu tố tỉnh CẢ HAI bên | `phong-dien-can-tho` / `phong-dien-hue` |
| Điểm (POI) | slug gọn từ tên; trùng thì hậu tố số (cơ chế `generateUniqueSlug` sẵn có) | |

- URL tỉnh cũ đã index trên production → danh sách redirect của release
  checklist như mọi slug đổi khác.
- Sheet đã được người dùng cập nhật tên tỉnh khớp `admin_provinces`
  (verify lại 27/07/2026 trên snapshot mới: 34/34 khớp, chỉ còn "Khánh
  Hoà" vs "Khánh Hòa" — lệch vị trí dấu, script import map cứng 1 case
  này, không cần sửa sheet).

### GĐ2 — Backup (bảng tạm + thư mục ảnh tạm + lưới cuối)

Phụ thuộc: không (làm sau GĐ1 cho gọn nhưng không bị chặn).

- Script/endpoint one-time `backup-destinations`:
  1. `CREATE TABLE dichoithoi_destinations_backup AS SELECT * FROM
     dichoithoi_destinations` (nguyên dòng, đủ MỌI cột — điều kiện an toàn
     §6.1) + thêm 2 cột quản trị: `restored_to_slug varchar NULL`,
     `restore_note text NULL`.
  2. Copy toàn bộ thư mục ảnh điểm đến dưới `DICHOITHOI_LOCAL_WEB_ROOT`
     sang thư mục tạm (vd `<web_root>/../backup-images-<date>/` — NGOÀI
     web root để không bị serve nhầm), giữ nguyên cấu trúc folder-theo-slug
     để path trong bản backup khớp lại được (§6.2).
  3. `pg_dump` Postgres + backup SQL Server (`dichoithoi_dev` local) ra
     file, ghi lại đường dẫn (§6.6 — lưới ngoài bảng tạm).
- KHÔNG backup bảng vệ tinh vào bảng tạm (đã chốt 27/07/2026 — pg_dump là
  đủ nếu cần truy lại).

**DoD**: `COUNT(*)` bảng backup = số dòng bảng gốc tại thời điểm chạy
(hiện 337 = 308 poi + 12 cluster + 17 province); spot-check 3 slug có
gallery/thumbnail — file ảnh tồn tại trong thư mục tạm, mở xem được bằng
mắt; file pg_dump + .bak tồn tại, ghi đường dẫn vào doc này.

### GĐ3 — Wipe toàn bộ (2 DB, sạch cả bảng vệ tinh)

Phụ thuộc: GĐ2 xong và DoD đã verify (không wipe khi backup chưa chắc).

- Script/use case one-time `wipe-all-destinations` (KHÔNG phải nút UI
  thường trực — tránh bấm nhầm; chạy qua script CLI có xác nhận):
  1. SQL Server: xoá sạch schema v2 phần destination (`v2.Destination`,
     `DestinationContent`, `DestinationTypeMap`, `DestinationTagMap`,
     `DestinationRelation`, `SlugRedirect`, `DestinationReview`...) — soi
     đủ danh sách bảng lúc code, thứ tự con-trước-cha theo FK.
  2. Postgres: `deleteCascade(TOÀN BỘ slug, bottom-up: poi → cluster →
     province)` — tái dùng logic sẵn có, KHÔNG DELETE tay từng bảng
     (§6.6). Bảng `dichoithoi_cluster_poi_candidates` +
     `dichoithoi_destination_ai_extractions` tự sạch theo FK CASCADE.
  3. KHÔNG xoá ảnh vật lý ở bước này (đã có bản copy, ảnh gốc dọn ở GĐ9
     cùng lúc với backup — tránh 2 nơi phải dọn).
- Taxonomy (Type/Tag/Nhóm) GIỮ NGUYÊN — không thuộc phạm vi wipe (đã
  redesign 24/07/2026, độc lập trục địa lý).

**DoD**: `COUNT(*)`=0 cho dichoithoi_destinations + relations +
poi/cluster_distances + vé + 2 bảng staging (cả 2 DB phần tương ứng);
bảng backup + thư mục ảnh tạm CÒN NGUYÊN (đếm lại lần nữa sau wipe).

### GĐ4 — Dựng nền 34 tỉnh + thống nhất mã

Phụ thuộc: GĐ3 (tạo trên nền sạch).

- Migration: widen `dichoithoi_destinations.province_code`
  `varchar(2)`→`varchar(3)`; từ nay cột này mang mã 3 chữ khớp
  `admin_provinces.code` (quyết định §7 câu 7 — "thêm code"; chọn THAY
  hẳn mã số vì sau wipe không còn dòng cũ nào phải migrate, đây là lúc
  duy nhất đổi hệ mã với chi phí 0). Đồng bộ phía SQL Server: rà cách
  `v2.Province` sinh khi publish (soi `mssql-site-db.adapter.ts` lúc
  code) để mã mới đi xuyên suốt.
- Seed 34 node tỉnh (`kind=province`) từ `admin_provinces`: slug theo quy
  tắc GĐ1, name chuẩn theo `admin_provinces` (KHÔNG lấy tên sheet — sheet
  ghi không nhất quán "TP." vs "Thành phố", "Hoà" vs "Hòa").

**DoD**: 34 node tỉnh trong mirror, mỗi node join được `admin_provinces`
qua mã 3 chữ; không còn dòng nào mang mã số cũ; build + app boot sạch.

### GĐ5 — Nạp 257 cụm từ snapshot Atlas

Phụ thuộc: GĐ4 (cụm cần tỉnh cha + mã tỉnh mới).

- Script build payload import từ `atlas-cum-snapshot-2026-07-27.csv` (parse
  CSV quoted multi-line — tái dùng cách parse đã dùng khi phân tích):
  - `name` = Tên cụm; `slug` theo quy tắc GĐ1 (2 cặp trùng tên: hậu tố
    tỉnh CẢ HAI; trùng tên tỉnh: giữ gọn theo GĐ1).
  - `kind=cluster`, `parentSlug`/`provinceCode` = tỉnh (map tên sheet →
    `admin_provinces` qua bảng đối chiếu tên trong script — sheet ghi tên
    không chuẩn).
  - `shortDescription` = Mô tả; `contentTier`: Cụm lớn→`flagship`, Cụm
    nhỏ→`standard` (§7 câu 3).
  - `aiNotes` = "Một số điểm trong cụm:\n..." + "Tiếp giáp:\n..." (§7 câu
    2 — người dùng sẽ tự cập nhật dần sau).
- Đẩy qua `POST /destinations/import` sẵn có (UPSERT, lỗi từng dòng báo
  riêng) — KHÔNG viết luồng import mới.

**DoD**: đúng 257 cụm trong mirror; đếm theo tỉnh khớp sheet (vd Lâm Đồng
15, An Giang 11); đếm ContentTier = 90 flagship/167 standard; spot-check 3
cụm bằng mắt trên CMS — mô tả + aiNotes hiển thị đúng tiếng Việt có dấu
(cảnh giác bug encoding LocalDB đã biết); 2 cặp slug trùng tên đúng quy
tắc hậu tố.

### GĐ6 — Nâng cấp "Tìm điểm con" thành luồng khôi phục backup

Phụ thuộc: GĐ2 (có bảng backup để match), GĐ5 (có cụm để chạy). Code được
song song từ sớm sau khi GĐ2 chốt schema bảng backup.

- `find-cluster-poi-candidates.usecase.ts` thêm nguồn đối chiếu thứ 3:
  fuzzy-match ứng viên AI với **bảng backup** (`restored_to_slug IS NULL`,
  cùng mã tỉnh; so tên bằng `isLikelySameDestinationName` + so toạ độ
  backup khi nghi ngờ — §6.3) → `matchType: "backup-match"` mới (thêm vào
  enum contracts, kèm `matchedSlug`/`matchedName` trỏ dòng backup). Ưu
  tiên phân loại: existing-in-cluster → orphan-match → backup-match → new.
- Accept flow (`accept-cluster-poi-candidates.usecase.ts`) nhánh
  `backup-match` = **khôi phục MERGE có duyệt** (§6.5): tạo destination
  mới từ NGUYÊN dòng backup (bài viết, gallery, hero, types/tags,
  opening_hours, price_breakdown, practical_notes, editorial_review,
  external_review_urls, ai_*, ticket_links, googleMapsUrl/lat/lng,
  meta_title...) với `parentSlug`=cụm, `siteId=null` (draft — publish lại
  theo quy trình thường); tên/mô tả/priority lấy bản AI mới hay bản backup
  — bảng duyệt hiện CẢ 2 phía cho người dùng chọn (mặc định: giữ bản
  backup vì đã duyệt tay). Copy ảnh của slug đó từ thư mục tạm về đúng
  chỗ web root.
  Ghi `restored_to_slug` vào dòng backup sau khi khôi phục.
- UI panel: badge riêng cho "backup-match" (vd tím "Có trong backup —
  khôi phục") + cột phụ cho thấy backup có gì (✍️ bài viết / 🖼️ ảnh / 📍
  toạ độ) để người dùng biết giá trị trước khi tick.
- Luôn tự động đưa `ai_notes` của cụm vào prompt tìm điểm (ghi chú §7 câu
  2) — nối vào sau extraNotes người dùng gõ thêm.

**DoD**: unit test phân loại ưu tiên 4 nhóm; chạy thật 1 cụm (vd Bảo Lộc
sau khi nạp lại): dòng backup-match hiện đúng điểm cũ, tick khôi phục →
query DB xác nhận đủ bài viết/types/tags/toạ độ như dòng backup, ảnh mở
được trên CMS bằng mắt, dòng backup được đánh dấu `restored_to_slug`.

### GĐ7 — Màn "Backup còn lại" (điều kiện cứng chống chết âm thầm — §6.4)

Phụ thuộc: GĐ6 (có cột `restored_to_slug` vận hành).

- Panel/trang CMS (kèm FeatureIntro giải thích inline theo quy tắc chung):
  liệt kê dòng backup `restored_to_slug IS NULL`, đếm rõ; mỗi dòng: xem
  data cũ (tên/bài viết/ảnh), thao tác **"Khôi phục vào cụm..."** (chọn
  cụm → chạy đúng nhánh khôi phục GĐ6, không cần AI tìm ra nó) hoặc
  **"Bỏ hẳn"** (ghi `restore_note`).
- Đây là một phần Definition of Done của cả đợt: đợt làm mới chỉ được coi
  là XONG khi màn này về 0 dòng chưa xử lý.

**DoD**: số dòng hiển thị khớp query; khôi phục tay 1 dòng + bỏ hẳn 1
dòng hoạt động, đếm giảm tương ứng; Playwright xem bằng mắt.

### GĐ8 — Vận hành lấp dữ liệu (việc NGƯỜI DÙNG, không phải code)

Phụ thuộc: GĐ6+GĐ7 xong.

- Chạy "Tìm điểm con bằng AI" lần lượt 257 cụm (ưu tiên flagship trước),
  duyệt từng bảng: khôi phục backup-match, tạo new, bỏ qua nhiễu.
- Xử lý hết màn "Backup còn lại" (GĐ7) — mục tiêu 0 dòng treo.
- Đặc thù đã chốt: khu Madagui/Cát Tiên (Đạ Huoai/Đạ Tẻh cũ) người dùng
  tự sửa tay chi tiết (§7 câu 5).
- Tính lại khoảng cách bằng nút CMS sẵn có (poi/cluster distances — đã
  chốt không khôi phục); gán Type/Tag cho điểm mới qua luồng suggest sẵn
  có; viết bài/publish theo quy trình thường.
- Trước release: chạy các mục check của `dichoithoi-release-checklist.md`
  (redirect slug cũ→mới, rà cụm mỏng noindex — mục đã thêm 27/07/2026).

**DoD**: 257 cụm đều đã chạy AI ít nhất 1 lần; màn Backup còn lại = 0;
đếm POI mới ≥ mục tiêu người dùng tự đặt (tham khảo ~2.500).

### GĐ9 — Dọn dẹp backup (task người dùng yêu cầu 27/07/2026)

Phụ thuộc: GĐ8 xong TRỌN VẸN + người dùng xác nhận tận mắt (điều kiện
cứng — theo nguyên tắc verify-before-delete của dự án, không tự dọn).

- Điều kiện tiên quyết (kiểm bằng query, ghi kết quả vào doc này trước
  khi dọn): màn "Backup còn lại" = 0 dòng chưa xử lý; dữ liệu mới đã
  spot-check ổn; đã qua ít nhất 1-2 tuần sử dụng thật ở local (khớp tinh
  thần giữ backup của release checklist mục 7).
- Dọn theo thứ tự: (1) `DROP TABLE dichoithoi_destinations_backup`;
  (2) xoá thư mục ảnh tạm `backup-images-<date>`; (3) xoá ảnh MỒ CÔI còn
  sót trong web root của các slug đã "Bỏ hẳn" (ảnh gốc GĐ3 cố ý không
  xoá); (4) file pg_dump/.bak giữ hay xoá theo quyết định người dùng lúc
  đó (đề xuất giữ tới sau release).

**DoD**: bảng tạm không còn tồn tại; thư mục ảnh tạm không còn; web root
không còn thư mục ảnh của slug đã bỏ hẳn; ghi ngày dọn + người xác nhận
vào doc này.

## Lệch tài liệu / lưu ý phát hiện khi audit cho plan này

- `DeleteDestinationUseCase` xoá ảnh vật lý ngay khi xoá điểm — KHÔNG phải
  bug, nhưng là lý do wipe (GĐ3) phải đi đường riêng và ảnh gốc để lại tới
  GĐ9 (ghi rõ ở trên để người code sau không "tiện tay" tái dùng nguyên
  use case).
- `province_code` `varchar(2)` chứa mã số là di sản trước sáp nhập — thay
  hẳn bằng mã 3 chữ ở GĐ4 là "lệch tài liệu được sửa", không phải lỗ hổng.
