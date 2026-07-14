# Checklist test zinoflow — mọi trang tạo data cho Đà Lạt (full luồng)

Test theo thứ tự: **tạo/sửa data ở zinoflow → chạy công cụ đồng bộ nếu cần →
xác nhận hiện đúng trên `/diem-den/da-lat`** (dùng chung với
`website-da-lat.md`). Server zinoflow: `apps/web` (admin UI) + `apps/api`
(localhost:3001).

## A. Trang chính — `/dichoithoi/da-lat` (sửa trực tiếp mọi field của Đà Lạt)

### A.1 Thông tin điểm đến (DestinationMetadataForm)
- [ ] Sửa tên, mô tả ngắn, toạ độ, địa chỉ, liên hệ → Lưu → phản ánh đúng metadata (tên/địa chỉ) trên web
- [ ] Đổi `contentTier` (flagship/standard/null) → xác nhận layout web đổi đúng theo (2-lớp điểm tham quan chỉ hiện khi `flagship`)
- [ ] Tick/bỏ tick `isFeatured` → không ảnh hưởng chính Đà Lạt (field này dùng cho ĐIỂM CON được nổi bật, xem A.9)

### A.2 Ảnh đại diện (DestinationImageUploader)
- [ ] Upload ảnh mới → thumbnail đổi trên trang danh sách + trang chi tiết
- [ ] Ảnh hero trên web dùng đúng ảnh vừa upload

### A.3 Link mua vé (DestinationTicketLinksEditor)
- [ ] Thêm 1 ticketLink (provider/label/sourceUrl) → Lưu → `affiliateUrl` tự tính (xem preview trước khi lưu)
- [ ] Vé máy bay/xe khách hiện ở khối "Di chuyển" — **LƯU Ý**: đây là block `transports` riêng theo `ProvinceId`, KHÔNG phải `ticketLinks` — ticketLinks chỉ dùng cho khối "Quyết định nhanh" của trang POI, Đà Lạt (Flagship) không có card này nên ticketLinks ở đây không hiện trực tiếp trên Đà Lạt — xác nhận đúng hành vi

### A.4 Giá vé theo đối tượng (DestinationPriceBreakdownEditor)
- [ ] Thêm dòng giá (đối tượng/giá/ghi chú) → Lưu → (tương tự A.3, Flagship không có card giá vé riêng — field này chủ yếu phục vụ trang POI con)

### A.5 Lưu ý thực tế (DestinationPracticalNotesEditor)
- [ ] Bấm "AI gợi ý" → xem gợi ý → sửa/duyệt → Lưu
- [ ] Nội dung Lưu ý hiện đúng ở khối 7 "Mẹo & lưu ý thực tế" trên web

### A.6 Lịch trình gợi ý (07/2026 — không còn editor riêng, gộp vào A.11)
- [ ] Đã bỏ `DestinationItineraryEditor`/panel riêng — "Lịch trình gợi ý" giờ là 1 khối trong bài viết AI (blockKey `lich-trinh`), sửa/xem ở khối "✍️ Viết bài bằng AI" (A.11) như mọi khối khác
- [ ] Sau publish (A.11): nội dung lịch trình hiện trong đoạn văn ở khối "Tổng quan" trên web, KHÔNG còn card/anchor riêng, KHÔNG còn link "Xem chi tiết →" đảm bảo đúng POI, KHÔNG còn CTA tour tự khớp

### A.7 Đánh giá biên tập (DestinationEditorialReviewEditor)
- [ ] Bấm "AI gợi ý" → sửa → Lưu
- [ ] Hiện đúng dạng callout trong khối "Tổng quan" trên web

### A.8 Xem thêm trên Google Maps/TripAdvisor (DestinationExternalReviewUrlsEditor)
- [ ] Thêm 1 link (label/url) → Lưu → hiện trên web, `rel="nofollow noopener"` (View Source)

### A.9 Quan hệ / con của Đà Lạt
- [ ] Vào 1 điểm CON (vd Hồ Xuân Hương) → tab Thông tin → gán `parentSlug=da-lat`, tick `isFeatured`, đặt `Order` → Lưu
- [ ] Quay lại Đà Lạt → điểm vừa gán hiện đúng ở Lớp 1 "Điểm nổi bật nhất" (khối 5) theo đúng `Order`
- [ ] Điểm con KHÔNG tick `isFeatured` → chỉ hiện ở Lớp 2, nhóm đúng theo khoảng cách (`DistanceFromCenter`)

### A.10 Đổi slug (nếu cần test lại tính năng vừa xong)
- [ ] Đổi slug 1 điểm con → xác nhận Ancestors/breadcrumb của điểm đó vẫn đúng, Đà Lạt vẫn liệt kê đúng con (xem chi tiết ở phần "Đổi slug" đã làm trước đó, không lặp lại toàn bộ ở đây)

### A.11 Viết bài bằng AI (khối "✍️ Viết bài bằng AI")
- [ ] Nhập "Thông tin bạn cung cấp thêm cho AI" + nguồn tham khảo → "Tạo bài AI" (mode create nếu Đà Lạt chưa có bài, update nếu đã có)
- [ ] Chuyển sang `/content/[jobId]` → duyệt qua các bước → Approve
- [ ] Quay lại `/dichoithoi/da-lat` → bấm **"Đăng lên dichoithoi"** (chỉ hiện khi job đã Approved)
- [ ] Sau publish: `ContentHtml`, FAQ, Food/Transport/Tip... trên web cập nhật đúng theo bài vừa duyệt
- [ ] Vì Đà Lạt là Flagship: xác nhận job dùng đúng nhánh prompt Flagship (outline có heading "mùa/thời điểm", KHÔNG có heading giờ mở cửa/giá vé riêng)

## B. Trang tạo bài cẩm nang (topic gắn với Đà Lạt) — `/dichoithoi/articles/new`

- [ ] Tạo 1 bài cẩm nang mới (viết tay hoặc AI), gán Đà Lạt + chọn đúng `topic` (food/souvenir/itinerary/nightlife)
- [ ] Publish bài → quay lại Đà Lạt xác nhận:
  - `topic=food` → link "Xem thêm: {tên bài} →" hiện ở khối 6 "Ăn gì đặc trưng"
  - `topic=souvenir` → link "Xem thêm →" hiện ở khối 8 "Quà mang về"
  - `topic=itinerary` → link "Xem lịch trình chi tiết →" hiện cuối khối "Tổng quan" (cơ chế này KHÔNG đổi, độc lập với blockKey `lich-trinh`)
  - `topic=nightlife` → khối "Buổi tối" XUẤT HIỆN (trước đó không có bài thì khối này ẩn)
- [ ] Xoá gán topic (hoặc unpublish bài) → link/khối tương ứng biến mất đúng

## C. Trang Sản phẩm — `/dichoithoi/san-pham` (+ `/nhap` import hàng loạt)

- [ ] Tạo 1 sản phẩm mới, category = "Đặc sản" (hoặc Quán ăn/Ẩm thực/Nhà hàng), gắn tag = `da-lat`
- [ ] Đợi bake `SouvenirProductsJson` (kiểm tra qua công cụ đồng bộ nếu cần) → quay lại Đà Lạt, khối 8 "Quà mang về" hiện card sản phẩm vừa tạo, nút **"Mua ngay"** đúng affiliate URL
- [ ] Sản phẩm KHÔNG có ảnh → xác nhận KHÔNG hiện card (đúng thiết kế "bắt buộc có ảnh")
- [ ] Import hàng loạt qua Google Sheet (`/san-pham/nhap`) — 1 dòng gắn tag `da-lat` → xác nhận xuất hiện đúng sau import

## D. Trang Khách sạn — `/dichoithoi/khach-san` (+ `/nhap`)

- [ ] Tạo/import 1 khách sạn, gán `destinationSlug=da-lat` (qua DestinationHotelPanel ở trang Đà Lạt hoặc trang Khách sạn)
- [ ] Xác nhận card khách sạn hiện đúng ở panel "Khách sạn gợi ý" trên trang Đà Lạt (`DynamicBlocksJson["hotels"]`)
- [ ] Preview affiliateUrl trước khi lưu hiện đúng

## E. Trang Tour — `/dichoithoi/tour` (+ `/nhap`)

- [ ] Tạo/import 1 tour, gán Đà Lạt (many-to-many qua `tour_destination_map`)
- [ ] Xác nhận card tour hiện ở panel "Tour gợi ý" trên trang Đà Lạt
- [ ] (07/2026) CTA "tour N ngày phù hợp" tự khớp theo lịch trình đã BỎ — không còn gì để test ở đây

## F. Trang Quy tắc affiliate — `/dichoithoi/affiliate`

- [ ] Thêm/sửa 1 rule (provider/matchDomain/template) → bấm "Áp dụng lại" (rule đó hoặc toàn bộ)
- [ ] Xác nhận `affiliateUrl` của ticketLinks/hotel/tour/product liên quan Đà Lạt đổi đúng theo rule mới (đợi job pg-boss chạy xong — vài giây)

## G. Trang Chủ đề (Tag) — `/dichoithoi/chu-de`

- [ ] Gán 1 tag cho Đà Lạt (nếu UI hỗ trợ gán trực tiếp theo điểm đến) hoặc qua gợi ý tự động
- [ ] Xác nhận tag không phá hành vi hiện tại trên trang Đà Lạt (tính năng tag hiện chưa có UI hiển thị public — chỉ verify dữ liệu ghi đúng, không kỳ vọng thấy gì đổi trên web)

## H. Trang Nội dung danh mục — `/dichoithoi/danh-muc`

- [ ] Sửa mô tả cho 1 `DestinationType`/`Group` mà Đà Lạt đang gắn → xác nhận trang `/loai/{group}/{type}` đổi đúng (KHÔNG ảnh hưởng trực tiếp trang Đà Lạt, chỉ ảnh hưởng trang danh mục)

## I. Công cụ vận hành — cần chạy để dữ liệu phản ánh đúng (trang `/dichoithoi`, khối "Công cụ")

- [ ] **Đồng bộ** (`sync`) — chạy sau khi sửa dữ liệu trực tiếp trên SQL Server (hiếm khi cần thủ công nếu chỉ thao tác qua UI)
- [ ] **Re-link xem trước** (dry-run) rồi **Áp dụng** — chạy sau khi thêm điểm đến mới được nhắc tới trong bài cũ, hoặc sau khi đổi slug
- [ ] **Tính lại liên quan** (`recompute-related`) — chạy sau khi đổi cha/con, thêm/xoá điểm, đổi `isFeatured`/`Order` để `ChildrenJson`/`RelatedJson` cập nhật kịp
- [ ] Sau publish bài Đà Lạt: xác nhận `relatedRecomputed` trong kết quả publish > 0 nếu có điểm liên quan bị ảnh hưởng

## J. Kiểm tra chéo cuối cùng

- [ ] Toàn bộ nội dung sửa ở A-H đều hiện ĐÚNG trên `/diem-den/da-lat` khi dùng `website-da-lat.md` để rà lại lần 2
- [ ] Refresh cache/CDN nếu trang không cập nhật ngay (Phase 17 — cache purge tự động khi ghi qua API, nhưng nếu sửa tay trực tiếp DB thì phải tự gọi purge)
