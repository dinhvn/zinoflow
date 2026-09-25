# Dichoithoi — Tự động tìm nguồn tham khảo + gom & chuẩn hoá ảnh hàng loạt (theo cụm)

Ngày ghi: 10/08/2026.

Bối cảnh: sau khi geocode xong phần lớn ~3000+ điểm đến, người dùng đối mặt
2 việc tốn thời gian nhất trước khi viết bài hàng loạt: (1) tìm ảnh đại diện +
thư viện cho từng điểm (làm tay ước tính vài tháng), (2) tìm website tham khảo
cho từng điểm để đưa vào chuỗi trích xuất AI đã có. Người dùng đề xuất tự động
hoá cả 2 theo từng cụm một, chấp nhận rủi ro bản quyền/ToS khi lấy ảnh từ
web/Google Maps (đã được cảnh báo rõ và tự quyết định — xem "Quyết định đã
chốt" bên dưới).

## Hiện trạng đã audit (code thật, không suy đoán)

- Chuỗi 3 bước trích xuất hiện có (Tìm Google Maps → Trích xuất Skill →
  Trích xuất GSG) dùng chung 1 pattern staging table + panel duyệt trong tab
  "AI hỗ trợ" trang chi tiết điểm đến — xem
  `dichoithoi-destination-ai-extraction-plan.md` + skill
  `.claude/skills/dichoithoi-extract-destination-info/SKILL.md`.
- `PlaywrightGoogleMapsProvider.scrapeWebResultUrls()`
  (`apps/api/src/modules/destination/infrastructure/geocoding/playwright-google-maps.provider.ts:285-372`)
  ĐÃ cào tối đa `MAX_WEB_RESULTS=5` link "Kết quả trên web" hiển thị sẵn trên
  trang chi tiết Google Maps của từng điểm — đây là 1 nguồn tham khảo tự động
  ĐÃ CÓ SẴN, trùng phần lớn ý định "bước 1: tự tìm website tham khảo" của
  người dùng.
- `RefreshWebResultsBatchUseCase`
  (`apps/api/src/modules/destination/application/use-cases/refresh-web-results-batch.usecase.ts`)
  ĐÃ chạy hàng loạt cho MỌI điểm đã "Chấp nhận" toạ độ mà chưa có web result,
  merge thẳng (dedupe theo url) vào `aiReferenceUrls` — cột jsonb có sẵn
  (`destination-mirror.entity.ts:153-154`). Nghĩa là phần lớn việc "tự động
  tìm & lưu website tham khảo" mà người dùng muốn đã chạy được — chỉ khác
  nguồn đến từ chính panel Google Maps, không phải 1 lượt Google Search riêng
  ghép query "tên+cụm+tỉnh" như người dùng đề xuất.
- KHÔNG tìm thấy usecase/provider nào gọi Playwright mở `google.com/search`
  (tìm kiếm web thường) trong repo — `PlaywrightGoogleMapsProvider` hiện chỉ
  điều khiển `google.com/maps`.
- Module `content-image` (bảng `content_images`,
  `apps/api/src/modules/content-image/infrastructure/entities/content-image.entity.ts`)
  CHỈ dành cho ảnh minh hoạ bài viết CHUNG — field `relatedJobId` trỏ Content
  Job, KHÔNG có field trỏ destination slug, KHÔNG dùng được thẳng cho ảnh
  riêng của 1 điểm đến.
- Ảnh riêng của destination (hero + gallery) đi qua 2 usecase khác hẳn —
  `UploadDestinationImageUseCase`/`AddDestinationGalleryImageUseCase` — nhận
  thẳng `Buffer` do người dùng tự crop qua extension `gmaps-image-clipper`
  rồi Ctrl+V, ghi THẲNG vào mirror + FTP + SQL Server ngay khi gọi. **Không có
  bước "chờ duyệt" nào cho ảnh destination** — khác hẳn `content_images` (có
  `status=pending`) và geocode-candidates (có bảng staging riêng). Đây là lỗ
  hổng kiến trúc thật cần vá (không phải lệch tài liệu) nếu muốn gom ảnh hàng
  loạt rồi duyệt nhanh như người dùng mô tả.
- `SharpImageProcessor`
  (`apps/api/src/modules/shared/media/infrastructure/sharp-image-processor.ts`)
  hiện chỉ có `toWebpVariants`/`toWebp`/`getDimensions` (resize + encode WebP)
  — KHÔNG có logic brightness/contrast/saturate/sharpen nào.
- Công thức auto-tune 3 mode (Tự động/Rực rỡ/Rõ nét) nằm trong
  `tools/gmaps-image-clipper/crop.js`:
  - `sampleLuminanceRange()` (dòng 213-249): lấy ngưỡng percentile 1%/99% của
    histogram độ sáng (luminance) trong vùng crop hiện tại.
  - `applyAutoMode()` (dòng 255-285): `brightness = clamp(100 + (128-mid)/128*50, 60, 150)`,
    `contrast = clamp(255/(high-low)*100, 100, 180)`; mode `vivid` thêm
    `saturate=130` + `contrast+10`; mode `sharp` thêm `sharpen=60`.
  - Áp dụng qua CSS Canvas filter (`brightness() contrast() saturate()`,
    dòng 90-91) + convolution kernel tự viết cho sharpen (dòng 94-123) — đây
    là API Canvas 2D của trình duyệt, KHÔNG có hàm tương đương 1-1 trong
    `sharp`. "Port sang backend" ở đây nghĩa là giữ ĐÚNG công thức toán
    (percentile histogram → brightness/contrast/saturate/sharpen), nhưng viết
    lại bằng API `sharp` (`.modulate({brightness, saturation})` cho
    sáng/rực màu, `.linear(a, b)` cho tương phản, `.sharpen()` cho làm nét) —
    không phải chép nguyên code JS Canvas sang Node vì nền tảng khác hẳn.
- Chưa có adapter Unsplash nào — module `content-image` chỉ có
  `PexelsStockImageSearchAdapter` implement `StockImageSearchPort`
  (`apps/api/src/modules/content-image/application/ports/stock-image-search.port.ts`).

## Quyết định đã chốt với người dùng (10/08/2026 — không hỏi lại)

1. Chấp nhận rủi ro bản quyền/ToS khi lấy ảnh từ website tham khảo bất kỳ +
   Google Maps — người dùng đã được cảnh báo rõ (khác hẳn rủi ro SEO/duplicate
   content đã bàn trước đây, đây là rủi ro khiếu nại bản quyền/gỡ ảnh thật) và
   tự quyết định chấp nhận. **Đây là thay đổi CÓ CHỦ Ý** so với nguyên tắc
   "Mức A: chỉ xem ảnh Google Maps trực tiếp, không lưu file" đã chốt
   05/08/2026 trong `dichoithoi-destination-geocode-audit-plan.md` — không
   phải lỗ hổng bỏ sót, ghi đè có ý thức cho riêng nhánh ảnh này.
2. Dùng CẢ 4 nguồn ảnh song song, không nguồn nào thay thế nguồn nào: website
   tham khảo, Google Maps, Pexels (đã có), Unsplash (mới).
3. Chạy theo từng CỤM (cluster) một lượt, không chạy toàn site 1 lần.
4. Mọi ảnh gom được phải qua bước chuẩn hoá tự động (crop theo khung + auto-tune
   sáng/tương phản/rực màu/làm nét) trước khi vào hàng "chờ duyệt" — người
   dùng chỉ duyệt nhanh (chọn ảnh ưng ý), không tự crop/chỉnh tay từng ảnh.

## Giai đoạn

### GĐ0 — Bảng staging ảnh destination + chuẩn hoá ảnh tự động (nền tảng)

Việc:
- Tạo bảng mới `dichoithoi_destination_image_candidates` (slug, source:
  `"web" | "gmaps" | "pexels" | "unsplash"`, sourceUrl, ảnh gốc đã tải tạm,
  aspectFrame dự kiến `hero(16:9)` / `gallery(4:3)`, ảnh đã qua chuẩn hoá,
  status `pending/accepted/rejected`).
- Thêm hàm `autoEnhance(buffer, mode, aspectFrame)` áp dụng đúng công thức đã
  audit ở trên, dùng `sharp`.
- Panel duyệt trong CMS (tái dùng pattern lưới ảnh "Chờ duyệt" của
  `content_images` / bảng chọn của `GeocodeCandidatesPanel`) — bấm "Chấp
  nhận" gọi thẳng `UploadDestinationImageUseCase` (ảnh đại diện) hoặc
  `AddDestinationGalleryImageUseCase` (thư viện) đã có sẵn.

Phụ thuộc: không phụ thuộc gì — làm được ngay, độc lập với nguồn ảnh cụ thể.

Definition of Done: tải 1 ảnh test qua bảng staging, xem preview đã
crop+auto-tune đúng khung 16:9 lẫn 4:3; bấm "Chấp nhận" ra đúng ảnh trong
hero/gallery thật của 1 điểm test; so sánh bằng mắt kết quả auto-tune backend
với kết quả crop tay qua extension `gmaps-image-clipper` trên CÙNG 1 ảnh gốc
để xác nhận công thức port đúng (không lệch tông màu/độ nét quá rõ).

### GĐ1 — Mở rộng nguồn ảnh có giấy phép: Unsplash + gom ảnh Google Maps

Việc:
- Thêm `UnsplashStockImageSearchAdapter` implement `StockImageSearchPort`
  hiện có (tái dùng interface, không tạo interface mới).
- Mở rộng lấy danh sách URL ảnh từ dải ảnh trên trang chi tiết Google Maps
  (tái dùng session/throttle Playwright sẵn có trong
  `PlaywrightGoogleMapsProvider`), ghi vào bảng staging GĐ0 với
  `source="gmaps"`.

Phụ thuộc: GĐ0 (cần bảng staging + `autoEnhance` tồn tại để ghi kết quả vào).

Definition of Done: chạy thử 1 cụm nhỏ đã có đủ `googleMapsUrl`, xác nhận ảnh
Google Maps + Unsplash cùng lên hàng chờ duyệt, không có 2 ảnh trùng hệt nhau
từ 2 nguồn khác nhau lọt vào cùng lúc.

### GĐ2 — Tự tìm + gom ảnh từ website tham khảo (rủi ro cao nhất — làm sau khi GĐ0-1 ổn định)

**Cần người dùng chốt hướng trước khi code (không tự chọn hộ):**

- **Lựa chọn A (khuyến nghị)**: tái dùng `aiReferenceUrls` đã có sẵn — phần
  lớn điểm đã "Chấp nhận" toạ độ đã hoặc sẽ có tới 5 link nhờ
  `RefreshWebResultsBatchUseCase` chạy nền, KHÔNG cần Playwright search Google
  riêng. Chỉ cần thêm bước "mở từng link trong `aiReferenceUrls`, gom ảnh
  trong trang đó". Ít rủi ro hơn (không thêm 1 bề mặt bị Google chặn mới),
  không trùng lặp công sức với cơ chế đã chạy.
- **Lựa chọn B**: build Playwright provider mới điều khiển `google.com/search`
  với query tự ghép "tên điểm + tên cụm + tên tỉnh", lấy 5 kết quả đầu —
  không phụ thuộc điểm đã có `googleMapsUrl`, nhưng thêm 1 bề mặt scrape mới
  (Google Search có cơ chế chống bot khác, thường nghiêm hơn Google Maps) và
  nhiều khả năng trùng lặp lớn với Lựa chọn A vì "Kết quả trên web" của
  Google Maps vốn cũng lấy từ chỉ mục tìm kiếm chung của Google.

Việc chung (cả 2 lựa chọn): mở từng URL bằng Playwright, gom `<img>` đủ lớn
(lọc icon/logo nhỏ, dùng lại ngưỡng ≥64px extension cũ áp dụng cho Google
Maps), tải về, đẩy qua `autoEnhance` (GĐ0) rồi vào staging. ĐỒNG THỜI (theo
đúng yêu cầu người dùng — gộp bước, không mở lại trang lần 2): khi trang đã
mở, chạy luôn logic trích xuất tương đương skill
`dichoithoi-extract-destination-info` để ghi thẳng vào bảng staging trích
xuất đã có (`dichoithoi_destination_ai_extractions`) — không tạo bảng trích
xuất mới.

Phụ thuộc: GĐ0 (staging + enhance). Nếu chọn Lựa chọn A, phụ thuộc thêm
`RefreshWebResultsBatchUseCase` đã chạy xong cho cụm đang xử lý (chạy trước
nếu chưa).

Definition of Done: chạy 1 cụm thật, đối chiếu tay 3-5 điểm xem ảnh gom về
đúng chủ đề (không lẫn ảnh quảng cáo/avatar/banner không liên quan), phần
trích xuất ghi đúng bảng staging hiện có và hiển thị đúng trong bảng so sánh
cũ/mới ở CMS.

### GĐ3 — Vận hành theo cụm (quy trình, không phải code)

Việc: chạy tuần tự theo từng cụm — geocode xong (GĐ1 của
`dichoithoi-destination-geocode-audit-plan.md`) → chuẩn hoá lần 1 (audit
trùng lặp/sai cụm bằng Haversine, GĐ2 của plan đó) → GĐ1-2 gom ảnh & tham
khảo ở trên → trích xuất khẳng định lại (skill) → chuẩn hoá lần 2 (rà lại
field sau khi có đủ thông tin) → viết bài.

Phụ thuộc: mọi giai đoạn trên.

Definition of Done: 1 cụm thí điểm đi hết pipeline, người dùng xác nhận tốc
độ/chất lượng ảnh + tham khảo chấp nhận được trước khi lặp lại cho cụm tiếp
theo.

## Rủi ro/lưu ý vận hành

- Ảnh lấy từ website tham khảo/Google Maps chưa có giấy phép rõ ràng — nếu bị
  khiếu nại bản quyền sau này cần gỡ nhanh (nên giữ lại `sourceUrl` gốc trong
  bảng staging/gallery để biết ảnh nào cần gỡ nếu có khiếu nại, không phải để
  xin phép trước).
- Chạy nhiều Playwright liên tiếp (geocode + tìm ảnh + đọc trang tham khảo)
  trên cùng 1 profile Chrome có thể cộng dồn rủi ro bị Google chặn nhanh hơn
  — nên đo lại throttle tổng thể khi cả 3 luồng cùng chạy trong 1 buổi, không
  giả định các throttle riêng lẻ vẫn đủ an toàn khi cộng lại.
