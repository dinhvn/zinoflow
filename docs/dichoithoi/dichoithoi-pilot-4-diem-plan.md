# Dichoithoi — Pilot chuẩn hoá 4 điểm test toàn bộ pipeline AI content (31/07/2026)

Ghi lại từ yêu cầu: trước khi generate bài AI hàng loạt, chuẩn hoá dữ liệu +
verify chất lượng trên 1 tập nhỏ đại diện đủ các module (Điểm đến/Article/
Hotel/Tour/Vé/Vé xe khách). 4 điểm chọn: **Đà Lạt** (cụm lớn), **Dalat
Fairytale Land** (điểm con, đủ giá vé/vé online), **Đạ Tẻh** (cụm nhỏ),
**Thác Triệu Hải** (điểm con, hoang sơ).

## 0) Hiện trạng đã audit (dữ liệu thật, 31/07/2026)

- `v2.Destination` (`dichoithoi_dev`, LocalDB) chỉ có **đúng 1 dòng**: Id=277
  `thac-trieu-hai`, Kind=3 (POI), `ParentId=NULL`, `ProvinceId=26` (Lâm Đồng,
  đã sáp nhập Bình Thuận + Đắk Nông cũ). Chưa gán cụm cha (Đạ Tẻh chưa tồn
  tại).
- Đà Lạt, Đạ Tẻh, Dalat Fairytale Land **chưa tồn tại** trong `v2.Destination`
  (đã query bằng cả `Slug LIKE` và `NameUnaccented LIKE`, 0 kết quả).
- `dbo.Destination` (legacy) có 271 dòng — đây là dữ liệu v1, theo
  [[dichoithoi-release-strategy-wipe-and-replace]] sẽ bị xoá khi release,
  **không dùng làm nguồn cho pilot này**.
- `v2.Hotel`, `v2.Tour`, `v2.Transport` đang **trống hoàn toàn** (0 dòng).
- Thác Triệu Hải đã có 1 lượt test AI content thật trước đó (29/07/2026):
  log outline/content/usage trong `tmp/job-abaa-*` (repo zinoflow, chưa
  commit — file làm việc), 3 screenshot `thac-trieu-hai-*.png` /
  `diem-den-listing-fixed.png` ở root zinoflow. Đây là 1/4 điểm coi như đã
  đi qua Giai đoạn 4-7 một phần, cần verify lại theo checklist đầy đủ ở §2
  (chưa chắc đã đạt hết).
- Prompt thật chạy nằm trong bảng `prompt_templates` (DB thắng
  `default-prompts.ts`) — xem [[dichoithoi-destination-prompts-db]].

## 1) Bảng tiến độ tổng quan (cập nhật tay mỗi lần quay lại)

Đây là nơi DUY NHẤT cần nhìn để biết "đang ở đâu" — tick `[x]` khi xong,
ghi ngày. Chi tiết từng bước ở §2.

| Giai đoạn | Đà Lạt (cụm) | Dalat Fairytale Land | Đạ Tẻh (cụm) | Thác Triệu Hải |
|---|---|---|---|---|
| GĐ0 — Tạo Destination | [ ] | [ ] | [ ] | [x] đã có (277) |
| GĐ1 — Taxonomy (Type/Tag) | [ ] | [ ] | [ ] | [ ] |
| GĐ2 — Quan hệ cha-con + khoảng cách | [ ] (là cha) | [ ] | [ ] (là cha) | [ ] |
| GĐ3 — Overlay thương mại | [ ] Hotel | [ ] Vé online | [ ] (xem tuyến vé xe) | — không cần |
| GĐ4 — Trích xuất nguồn bài viết | [ ] | [ ] | [ ] | [x] (job-abaa) |
| GĐ5 — Chạy AI generate | [ ] | [ ] | [ ] | [x] (job-abaa, cần re-run nếu prompt đổi) |
| GĐ6 — Verify checklist bài viết | [ ] | [ ] | [ ] | [ ] (chưa chạy checklist đầy đủ) |
| GĐ7 — Test UI thật (qa-audit) | [ ] | [ ] | [ ] | [ ] (có screenshot cũ, chưa audit skill) |

Overlay dùng chung 1 lần (không lặp theo từng điểm):
- [ ] Tour đa điểm chứa Đà Lạt (test affiliate overflow Top-N)
- [ ] Tuyến vé xe khách đi qua Đà Lạt + Đạ Tẻh (HCM/Sài Gòn ⇄ Đà Lạt qua Bảo Lộc/Đạ Tẻh)

GĐ8 (ghi nhận lỗi + lặp) không có ô tick cố định — mở 1 mục log lỗi mới mỗi
vòng verify, xem §2.8.

## 2) Chi tiết từng giai đoạn

### GĐ0 — Tạo dữ liệu Destination còn thiếu
**Phụ thuộc**: độc lập, làm trước tiên.
**Việc cụ thể**: dùng skill `dichoithoi-extract-destination-info` (Google
Maps link + web tham khảo) cho Đà Lạt, Đạ Tẻh, Dalat Fairytale Land — duyệt
bảng so sánh trước khi lưu, không tự động ghi thẳng.
**DoD**: `SELECT * FROM v2.Destination WHERE Slug IN (...)` trả đủ 3 dòng
mới, có `Name`/`ShortDescription`/toạ độ hợp lệ (không NULL).

### GĐ1 — Taxonomy (Type/Tag)
**Phụ thuộc**: cần GĐ0 xong (phải có Id để gán).
**Việc cụ thể**: gán Type/Tag **tay** qua `/dichoithoi/phan-loai`, không tin
kết quả AI xếp hạng di tích (xem [[dichoithoi-taxonomy-redesign-chot-chua-build]]
— luật cứng đã thử vẫn không đáng tin, AI thiếu dữ liệu tra cứu thật). Chạy
skill `dichoithoi-seo-check` trước khi chốt field hiển thị liên quan.
**DoD**: cả 4 điểm có `PrimaryTypeId` khác NULL + ít nhất 1 Tag, kiểm tra
qua Kanban `/dichoithoi/phan-loai` bằng mắt (không chỉ query count).

### GĐ2 — Quan hệ cha-con + khoảng cách thật
**Phụ thuộc**: GĐ0.
**Việc cụ thể**: set `Dalat Fairytale Land.ParentId = Đà Lạt.Id`, `Thác
Triệu Hải.ParentId = Đạ Tẻh.Id` (hiện đang NULL). Chạy tính khoảng cách thật
(OpenRouteService, xem [[dichoithoi-poi-distance-plan-open]]) cho từng cặp
cụm-điểm.
**DoD**: trang cụm Đà Lạt/Đạ Tẻh hiện đúng "Các khu trong..." với con vừa
gán; bảng `poi_distances` có dòng cho cả 2 cặp, khoảng cách khác 0/NULL.

### GĐ3 — Overlay thương mại
**Phụ thuộc**: GĐ0 (cần Id điểm đến để map).
**Việc cụ thể**:
- Hotel: ≥1 khách sạn thật tại Đà Lạt, publish qua `/dichoithoi/khach-san`.
- Vé: giá vé + link vé online cho Dalat Fairytale Land qua `/dichoithoi/ve`.
- Tour: **1 tour đa điểm** có Đà Lạt (nên chứa Fairytale Land + ≥1 điểm khác
  trong Đà Lạt) — bắt buộc đa điểm vì cơ chế "Xem thêm"/overflow Top-N
  ([[dichoithoi-camnang-affiliate-overflow-plan-open]]) chỉ có ý nghĩa khi
  >1 tour/điểm để test.
- Vé xe khách: 1 tuyến qua `/dichoithoi/van-chuyen`, chọn điểm đầu/cuối/
  trung gian sao cho đi qua **cả Đà Lạt và Đạ Tẻh** (tuyến thực tế HCM ⇄ Đà
  Lạt qua Bảo Lộc/Đạ Tẻh) — dùng đúng pattern
  [[dichoithoi-transport-vexekhach-plan-open]] (`TransportCardsJson`, card
  chỉ hiện ở điểm đầu/cuối, không hiện ở điểm trung gian).
**DoD**: mở trang web thật (`/diem-den/da-lat`,
`/diem-den/dalat-fairytale-land`, `/diem-den/da-teh`) thấy đúng card
Hotel/Vé/Tour/Vé xe khách xuất hiện/không xuất hiện đúng vai trò (đầu-cuối
vs trung gian).

### GĐ4 — Trích xuất nguồn cho bài viết
**Phụ thuộc**: GĐ0-2 (cần dữ liệu điểm đến đã chuẩn để AI viết đúng ngữ
cảnh).
**Việc cụ thể**: skill `dichoithoi-extract-article-info` cho mỗi job trước
khi bấm sinh nội dung — bắt buộc theo quy trình cẩm nang mới
([[dichoithoi-article-ai-extraction-plan-open]], `articleType=cam-nang`
không tự queue).
**DoD**: bảng `article_ai_extractions` có `extracted_summary` cho mỗi job,
đã đọc/sửa tay trước khi "Lưu vào ngữ cảnh nguồn".

### GĐ5 — Chạy AI generate
**Phụ thuộc**: GĐ4.
**Việc cụ thể**: bấm sinh nội dung, theo dõi `ai_usage_logs`
(cost/latency/token) — cùng pattern log đã lưu ở `tmp/job-abaa-*`.
**DoD**: job chuyển trạng thái xong (không lỗi), có bản outline + content
lưu lại để so sánh ở GĐ6.

### GĐ6 — Verify checklist bài viết
**Phụ thuộc**: GĐ5.
**Checklist mỗi bài** (tick tay, không chỉ đọc lướt):
- [ ] Cấu trúc 8-block đúng spec (`ai-content-technical-spec.md`)
- [ ] SEO: structured data, meta, internal link cụm↔điểm, freshness badge
      đúng logic ([[dichoithoi-content-freshness-plan-open]])
- [ ] Giọng văn tự nhiên theo checklist Who/How/Why
      ([[dichoithoi-ai-content-vs-google]]) — so sánh rõ giữa Đà Lạt (dữ
      liệu dày) và Thác Triệu Hải/Đạ Tẻh (hoang sơ, ít dữ liệu) xem AI có bịa
      khi thiếu thông tin không
- [ ] Overlay card Hotel/Tour/Vé/Vé xe khách bake đúng, không thiếu/thừa
- [ ] Ảnh đủ — chạy `dichoithoi-find-content-images` nếu thiếu, ưu tiên
      điểm hoang sơ (khả năng cao thiếu ảnh nguồn)
**DoD**: 4/4 bài qua hết checklist trên, mọi lỗi đã ghi vào §2.8 (không sửa
ngầm không ghi lại).

### GĐ7 — Test UI thật
**Phụ thuộc**: GĐ6 (bài đã publish).
**Việc cụ thể**: skill `qa-audit` (Playwright + PageSpeed/Lighthouse + SEO
on-page) trên cả 4 trang + 2 trang cụm.
**DoD**: report qa-audit không có lỗi console/UI vỡ, điểm tốc độ ghi lại để
so sánh về sau.

### GĐ8 — Ghi nhận lỗi & lặp
**Phụ thuộc**: chạy song song GĐ6-7, không phải giai đoạn cuối cố định.
**Việc cụ thể**: mỗi lỗi phát hiện, phân loại rõ 1 trong 3 loại trước khi
sửa (không sửa mò):
1. Prompt DB (`prompt_templates`) — sửa nội dung/rule, không phải bug code.
2. Logic bake overlay (`*CardsJson`, `related-builder`, taxonomy) — bug code
   thật, cần fix + test.
3. Taxonomy/dữ liệu gán sai — sửa tay qua Kanban, không phải bug code.
Sau khi sửa, quay lại GĐ5-7 **chỉ cho bài bị lỗi** (không re-run toàn bộ 4
điểm mỗi lần).
**Log lỗi** (thêm dòng mới mỗi lần phát hiện, ghi ngày):
- _(chưa có mục nào — điền khi bắt đầu GĐ6)_

## 3) Ngoài phạm vi pilot này

- Generate hàng loạt (batch) cho các điểm khác — chỉ làm sau khi pilot 4
  điểm này đạt DoD toàn bộ GĐ6-7, không làm song song.
- Rà tay taxonomy toàn bộ 247 POI đã gán AI — việc vận hành riêng
  ([[dichoithoi-taxonomy-redesign-chot-chua-build]]), không phải điều kiện
  chặn pilot này (chỉ 4 điểm trong pilot cần Type/Tag đúng).
