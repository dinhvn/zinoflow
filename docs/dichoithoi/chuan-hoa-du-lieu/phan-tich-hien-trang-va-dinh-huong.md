# Chuẩn hoá dữ liệu Tỉnh / Cụm / Điểm đến — Phân tích hiện trạng và định hướng

Ghi 27/07/2026. Trạng thái: **PHÂN TÍCH — chưa build, chưa phải plan implement.**

Bối cảnh: người dùng đã hoàn tất Atlas Cụm Du lịch Việt Nam (chạy prompt
Gemini bên ngoài theo từng tỉnh + biên tập tay) và chốt: **34 tỉnh thành —
257 cụm**. Nguồn dữ liệu chốt: Google Sheet
(https://docs.google.com/spreadsheets/d/1dj2Zwb496l6rTJykOpMYLyP8syD13Bv4MFrIi9fgIpo/edit?gid=790024445),
snapshot tải về 27/07/2026 lưu cạnh file này:
`atlas-cum-snapshot-2026-07-27.csv` (sheet có thể đổi sau — mọi số liệu
trong doc này tính trên snapshot).

## 1) Đích đến đã chốt (Atlas — số liệu đọc từ sheet thật)

| Chỉ số | Giá trị |
|---|---|
| Tỉnh/thành | 34 (khớp mô hình sáp nhập 2025) |
| Tổng cụm | 257 |
| Cụm lớn (Hub) | 90 |
| Cụm nhỏ (Specialty) | 167 |
| Điểm ví dụ liệt kê kèm | ~2.194 (trung bình 8,5 điểm/cụm, ít nhất 2) |
| Quan hệ "Tiếp giáp" giữa cụm | có, kể cả 11 cạnh xuyên tỉnh |

Cột sheet: `No, Tình(sic), Tên cụm, Loại cụm, Mô tả, Một số điểm trong cụm,
Tiếp giáp`.

Ví dụ độ phân giải mới — Lâm Đồng (sau sáp nhập gồm cả Bình Thuận + Đắk
Nông cũ) có 15 cụm: Đà Lạt, Đức Trọng, Bảo Lộc, Madagui, Cát Tiên, Gia
Nghĩa, Tà Đùng, Krông Nô, Phan Thiết, Bàu Trắng, Cổ Thạch, Kê Gà, La Gi,
Đa Mi, Phú Quý.

## 2) Hiện trạng DB đã audit (query thật trên `dichoithoi_dev` Postgres mirror, 27/07/2026)

| Chỉ số | Hiện có | Đích | Ghi chú |
|---|---|---|---|
| Node tỉnh (`kind=province`) | 17 | 34 | Còn cả tỉnh ĐÃ BỊ SÁP NHẬP: Hà Giang, Phú Yên, Quảng Bình, Kiên Giang |
| Node cụm (`kind=cluster`) | 12 | 257 | 5 cụm không có tỉnh cha (`province` NULL: Đà Lạt, Bảo Lộc, Sapa, Nha Trang, Mù Cang Chải...) |
| POI | 308 (247 đã publish) | mở rộng dần | 141 POI gắn THẲNG vào tỉnh (bỏ qua tầng cụm), 8 POI orphan |
| Hệ mã tỉnh trong cây destination | mã SỐ cũ (`68`, `91`, `01`...) 20 mã | 34 mã mới | Bảng `admin_provinces` đã seed đúng 34 tỉnh mới nhưng dùng mã 3 CHỮ (`LDG`, `AGG`, `HCM`...) — HAI HỆ MÃ KHÔNG KHỚP NHAU |

Đối chiếu 12 cụm hiện có với Atlas:
- **8 khớp** (có trong Atlas): Phú Quốc (nay thuộc An Giang), Phan Thiết,
  Bảo Lộc, Cát Tiên (đều nay thuộc Lâm Đồng), Đà Lạt, Mù Cang Chải (nay
  thuộc Lào Cai), Nha Trang, Sapa (Atlas viết "Sa Pa").
- **4 KHÔNG có trong Atlas**: Phố cổ Hội An (0 con), "An Giang" (đặt tên
  cụm trùng tên tỉnh, 10 con), Đạ Huoai (9 con), Đạ Tẻh (8 con) — cần
  quyết định giải tán/đổi tên/gộp (xem §4.6).
- Đà Lạt hiện ôm 71 con — Atlas chia Lâm Đồng thành 15 cụm, tức phần lớn
  71 con này sẽ phải RE-PARENT về cụm mới đúng hơn (Đức Trọng, Madagui...).

## 3) Trả lời câu hỏi đã hoãn 27/07/2026: cụm liên tỉnh

Câu hỏi cũ (xem backlog mục 0 "Atlas Cụm"): cụm giáp ranh 2 tỉnh (Bảo Lộc ↔
Tà Đùng) xử lý sao khi schema chỉ cho 1 cụm thuộc 1 tỉnh?

**Sheet chốt đã tự giải quyết theo đúng phương án "tách theo tỉnh"**: mỗi
cụm trong 257 cụm thuộc đúng 1 tỉnh (Tà Đùng và Bảo Lộc giờ cùng thuộc Lâm
Đồng sau sáp nhập nên hết là case liên tỉnh; các case thật sự xuyên tỉnh
như Định Quán (Đồng Nai) ↔ Madagui (Lâm Đồng) được thể hiện bằng quan hệ
"Tiếp giáp" giữa 2 cụm độc lập, không phải 1 cụm đa tỉnh). Chỉ có 11 cạnh
tiếp giáp xuyên tỉnh trên tổng số — mức rất nhỏ.

→ **Kết luận: KHÔNG cần mở schema đa-tỉnh.** Schema hiện tại (1 `ParentId`
+ 1 `ProvinceId`/node) chịu được toàn bộ Atlas. Câu hỏi hoãn coi như đóng,
với điều kiện lưu được quan hệ "Tiếp giáp" (xem §4.5).

## 4) Các vấn đề chuẩn hoá phải quyết

### 4.1 Mô hình phân cấp: có cho POI gắn thẳng tỉnh không?

Hiện 141/308 POI gắn thẳng vào tỉnh. Atlas tuyên bố "bao phủ 100% — mọi
điểm thuộc đúng 1 cụm". Hai lựa chọn:
- **(a) Chuẩn cứng tỉnh → cụm → điểm, không POI nào treo thẳng tỉnh
  (khuyến nghị)** — khớp tinh thần Atlas, breadcrumb/URL/internal-link nhất
  quán, trang tỉnh thành trang tổng hợp cụm (hub SEO), trang cụm là trang
  chiến đấu chính. 141 POI hiện tại phải re-parent về cụm đúng.
- (b) Cho phép ngoại lệ POI đặc biệt treo thẳng tỉnh — đỡ công re-parent
  nhưng phá quy tắc "1 điểm 1 cụm", sinh 2 kiểu breadcrumb, về sau mỗi
  tính năng đều phải xử lý 2 nhánh.

### 4.2 Hệ mã tỉnh + 17 node tỉnh cũ

Vấn đề kép: (1) cây destination dùng mã số cũ (63 tỉnh), `admin_provinces`
dùng mã 3 chữ (34 tỉnh) — join/filter giữa 2 bảng hiện không khớp nhau về
mã; (2) 17 node tỉnh gồm cả 4 tỉnh không còn tồn tại.

Đề xuất: khi chuẩn hoá, dựng lại đủ **34 node tỉnh** khớp 1-1 với
`admin_provinces` và thống nhất **một hệ mã duy nhất** cho cột
`province_code`/`ProvinceId` xuyên suốt (chi tiết chọn hệ nào — mã 3 chữ
của `admin_provinces` hay giữ mã số — để phần plan implement quyết sau khi
soi hết chỗ dùng trong code 2 repo; doc này chỉ ghi nhận xung đột).
Node 4 tỉnh cũ (Hà Giang, Phú Yên, Quảng Bình, Kiên Giang) giải tán, con
cháu chuyển về tỉnh mới tương ứng (Tuyên Quang, Đắk Lắk, Quảng Trị, An
Giang), slug cũ vào danh sách redirect release.

### 4.3 Chuẩn tên + slug

Phát hiện từ sheet thật:
- Tên tỉnh trong sheet KHÔNG nhất quán: "TP. Hồ Chí Minh" vs "Thành phố
  Cần Thơ" vs "Khánh Hoà" (DB chuẩn ghi "Khánh Hòa") — khi import phải map
  về đúng tên/mã trong `admin_provinces`, không lấy nguyên văn sheet.
- **2 cặp cụm trùng tên khác tỉnh**: Phong Điền (Cần Thơ | Huế), Hương Sơn
  (Hà Tĩnh | Hà Nội) → slug phải phân biệt, đề xuất quy tắc: slug cụm mặc
  định là tên cụm, khi trùng thì hậu tố tỉnh (`phong-dien-can-tho` /
  `phong-dien-hue`).
- Khác biệt chính tả đã gặp: DB "Sapa" vs Atlas "Sa Pa" → cần bảng map tên
  cũ→mới rõ ràng khi đối chiếu, không tin so-sánh-bằng tuyệt đối (tái dùng
  `isLikelySameDestinationName` — fuzzy-match lỏng đã build 27/07/2026).

### 4.4 Map cột sheet → cột DB

| Cột sheet | Cột DB hiện có | Ghi chú |
|---|---|---|
| Tên cụm | `Name` | + sinh slug theo §4.3 |
| Loại cụm (lớn/nhỏ) | `ContentTier` (`flagship`/`standard`) | Khớp ngữ nghĩa sẵn có — cụm lớn=flagship, cụm nhỏ=standard; KHÔNG cần cột mới |
| Mô tả | `ShortDescription` | Dùng ngay được |
| Một số điểm trong cụm | KHÔNG import thẳng | Là danh sách THAM KHẢO (~8,5 điểm/cụm) — dùng làm `extraNotes` mồi cho tính năng "Tìm điểm con trong cụm bằng AI" (đã build 27/07/2026) + làm dữ liệu đối chiếu khi re-parent POI hiện có |
| Tiếp giáp | xem §4.5 | |

### 4.5 Lưu quan hệ "Tiếp giáp" giữa cụm ở đâu

> **CHỐT 27/07/2026 (xem §7 câu 2): không dùng cả (a) lẫn (b)** — Tiếp
> giáp chỉ nhập vào `ai_notes` của cụm làm ngữ cảnh cho AI, không lưu
> thành quan hệ. Phân tích dưới giữ lại làm bối cảnh.

Hạ tầng sẵn có: bảng `dichoithoi_destination_relations` (Postgres, các
`relationType`: nearby/related/mentioned/excluded) và
`dichoithoi_cluster_distances` (khoảng cách cụm↔cụm đã tính bằng
OpenRouteService). Hai hướng:
- **(a) Dùng relation `related` curated 2 chiều giữa 2 cụm tiếp giáp
  (khuyến nghị)** — tái dùng nguyên hạ tầng + UI bản đồ quan hệ hiện có,
  không schema mới; "tiếp giáp" về bản chất chính là "cụm liên quan nên đi
  cùng hành trình", đúng ngữ nghĩa khối gợi ý hiện hiển thị trên site.
- (b) Thêm `relationType: "adjacent"` riêng — ngữ nghĩa sạch hơn nếu sau
  này muốn hiển thị "cụm kề bên" tách khỏi "cụm liên quan", nhưng phải sửa
  enum contracts + builder RelatedJson + website đọc.

### 4.6 Số phận 4 cụm hiện có ngoài Atlas

- "An Giang" (cụm, 10 con, đang nằm dưới tỉnh Kiên Giang cũ): sai kép —
  vừa trùng tên tỉnh, vừa sai cha. Con cháu cần rà tay về cụm Atlas đúng
  (Châu Đốc? Long Xuyên? — Atlas An Giang có 11 cụm).
- Đạ Huoai (9 con) / Đạ Tẻh (8 con): Atlas Lâm Đồng không có 2 cụm này —
  gần nhất là Madagui (Đạ Huoai cũ chứa Madagui) và Cát Tiên. Cần map tay
  từng con.
- Phố cổ Hội An (0 con, dưới Đà Nẵng): ĐÍNH CHÍNH 27/07/2026 — Atlas CÓ
  cụm "Hội An" (Đà Nẵng), chỉ lệch tên ("Phố cổ Hội An" vs "Hội An") →
  không phải cụm ngoài Atlas, chỉ cần đổi tên/đối chiếu slug. Còn lại
  đúng 3 cụm ngoài Atlas thật sự (An Giang, Đạ Huoai, Đạ Tẻh).

Cả 4 trường hợp đều đụng slug đã publish → mọi đổi tên/giải tán đi qua
`RenameDestinationSlugUseCase`/`SlugRedirect` hoặc ghi vào danh sách
redirect của release checklist (wipe & replace).

### 4.7 Khối lượng và cách nạp 257 cụm

Số phải TẠO MỚI ~245 cụm (257 trừ ~8-12 tái dùng). Nhập tay từng cụm qua
form là không thực tế. Hướng khả thi: luồng import hàng loạt từ sheet đã
có sẵn trong CMS (`POST /destinations/import` — UPSERT theo slug, cột map
được như §4.4) — cần verify luồng này với `kind=cluster` khi viết plan.
Sau khi cụm vào DB, dùng tính năng "Tìm điểm con trong cụm bằng AI" chạy
dần từng cụm để lấp điểm.

## 5) Checklist SEO 3 câu hỏi (bắt buộc theo dichoithoi-seo-principles)

1. **Hữu ích cho người dùng?** Có — cấu trúc cụm theo trải nghiệm du lịch
   thật (thay ranh giới hành chính) khớp cách người ta thực sự đi chơi;
   trang cụm trả lời đúng intent "đi X có gì chơi quanh đó".
2. **Cấu trúc SEO đúng?** Tỉnh (34 trang hub) → cụm (257 trang chủ lực,
   đúng cỡ "topical cluster" theo nghĩa đen) → điểm (long-tail). Cần giữ:
   1 điểm 1 cụm (không duplicate), breadcrumb 3 tầng nhất quán, redirect
   301 đầy đủ cho mọi slug bị đổi/giải tán.
3. **Tín hiệu SEO tăng thêm?** Quan hệ "Tiếp giáp" thành internal link
   ngang giữa các trang cụm (kể cả xuyên tỉnh — 11 cạnh — là link ngang
   tự nhiên mà đối thủ chia theo tỉnh không có); mô tả cụm (sheet có sẵn)
   thành đoạn intro unique cho 257 trang, tránh thin content khi cụm mới
   chưa nhiều điểm.

Rủi ro SEO phải né: tạo 257 trang cụm rỗng cùng lúc (thin content hàng
loạt — đúng mẫu "scaled content abuse"). **CHỐT 27/07/2026 (§7 câu 6)**:
không cần gate publish dần trong CMS — mọi thứ làm chuẩn ở local rồi
release nguyên khối; quy tắc chống thin-content thành mục kiểm lúc release
(đã thêm vào `dichoithoi-release-checklist.md` mục 4).

## 6) Lộ trình đề xuất (thứ tự phụ thuộc — mức phác thảo, plan chi tiết viết sau khi chốt §7)

1. **Nền tỉnh trước**: dựng đủ 34 node tỉnh khớp `admin_provinces`, thống
   nhất hệ mã, giải tán 4 tỉnh cũ + re-parent con cháu. (Chặn mọi bước
   sau — cụm cần tỉnh cha đúng.)
2. **Nạp 257 cụm** từ sheet (import hàng loạt, map cột theo §4.4, slug
   theo §4.3), cụm mới ở trạng thái draft.
3. **Xử lý 12 cụm hiện có**: 8 cụm khớp thì đối chiếu/giữ slug (đỡ mất
   SEO), 4 cụm ngoài Atlas xử lý theo §4.6.
4. **Re-parent 308 POI hiện có** về đúng cụm (141 đang treo tỉnh + 8
   orphan + số con của Đà Lạt/Đạ Huoai/Đạ Tẻh/An Giang phải chia lại) —
   bán tự động: đề xuất bằng fuzzy-match + toạ độ với danh sách "Một số
   điểm trong cụm" của sheet, người dùng duyệt.
5. **Nạp quan hệ Tiếp giáp** giữa cụm (theo phương án chốt ở §4.5).
6. **Lấp điểm mới** cho cụm còn mỏng bằng "Tìm điểm con trong cụm bằng
   AI", chạy dần theo ưu tiên (cụm lớn/flagship trước).
7. Cập nhật danh sách redirect cho release (mọi slug đổi ở bước 1/3/4 ghi
   lại ngay lúc làm, đừng để dồn tới lúc release mới truy).

## 7) Quyết định ĐÃ CHỐT (người dùng trả lời 27/07/2026)

| # | Câu hỏi | CHỐT |
|---|---|---|
| 1 | POI treo thẳng tỉnh? | **Không — chuẩn cứng 3 tầng, không ngoại lệ** |
| 2 | Lưu "Tiếp giáp"? | **KHÔNG lưu thành relation.** Chỉ là thông tin phụ (khoảng cách cụm↔cụm đã có tính năng tính riêng). "Tiếp giáp" + "Một số điểm trong cụm" từ sheet nhập vào trường **"Thông tin bạn cung cấp thêm cho AI"** (`ai_notes`) của node cụm khi import — người dùng sẽ tự check từng điểm và cập nhật lại sau. Lưu ý plan: luồng "Tìm điểm con bằng AI" nên tự đọc/prefill `ai_notes` của cụm làm extraNotes. |
| 3 | Loại cụm map `ContentTier`? | **Map thẳng**: Cụm lớn → `flagship`, Cụm nhỏ → `standard`, không cột mới |
| 4 | Slug trùng tên cụm? | **Hậu tố tỉnh cho CẢ HAI bên trùng** (`phong-dien-can-tho`/`phong-dien-hue`, `huong-son-ha-tinh`/`huong-son-ha-noi`) |
| 5 | Cụm ngoài Atlas? | **Theo đúng sheet.** Tên cụm ĐƯỢC PHÉP trùng tên tỉnh (Atlas tự có: cụm "Đà Nẵng" trong tỉnh Đà Nẵng...) — lưu ý plan: slug cụm sẽ đụng slug node TỈNH cùng tên, cần quy tắc phân biệt (vd tỉnh giữ slug hiện có/tiền tố riêng — chốt lúc viết plan). Đạ Huoai/Đạ Tẻh không tái lập, con về Madagui/Cát Tiên theo sheet; khu vực này người dùng sống nên sẽ TỰ SỬA TAY chi tiết. |
| 6 | Ngưỡng publish cụm mới? | **Không cần gate publish dần**: toàn bộ làm chuẩn ở LOCAL (tìm dữ liệu, kiểm tra), thấy ổn mới release nguyên khối lên production (khớp chiến lược wipe & replace). Quy tắc chống thin-content chuyển thành mục CHECK LÚC RELEASE — đã ghi vào `dichoithoi-release-checklist.md`. |
| 7 | (bổ sung) Mã tỉnh | Node tỉnh hiện chỉ lưu mã SỐ — **đồng ý thêm mã code chữ** (khớp `admin_provinces`: `LDG`, `AGG`...) để 2 hệ join được; chi tiết thêm cột hay thay thế quyết lúc viết plan. |
