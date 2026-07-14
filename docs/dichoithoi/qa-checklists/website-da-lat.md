# Checklist test trang `/diem-den/da-lat` (Flagship)

Nguồn: `../dichoithoi-content-seo-ux-plan.md` §10.4 + §10.6.2, đối chiếu thật
với `../dichoithoi-implementation-plan.md` Phase 28.0-28.6 (đã build). Test cả
mobile + desktop. Trang so sánh: Nha Trang (Standard) và Biệt Thự Hằng Nga
(POI, con của Đà Lạt) — mục cuối file.

Dùng chung với `zinoflow-da-lat.md` (checklist phía tạo data ở zinoflow) để
test full luồng tạo data → hiện đúng trên web.

## 0. Đầu trang

- [ ] Breadcrumb hiện đúng: Trang chủ / Lâm Đồng / Đà Lạt
- [ ] Hero: gallery ảnh (KHÔNG chỉ 1 ảnh) — vuốt/chuyển được nhiều ảnh
- [ ] H1 = "Đà Lạt"
- [ ] Badge loại điểm đến hiện đúng
- [ ] ⭐ đánh giá biên tập hiện cạnh hero (KHÔNG phải rating khách — review khách vẫn ẩn)
- [ ] **Chip điều hướng** (mobile, vuốt ngang) đúng 6 mục cho Flagship: Tổng quan | Di chuyển | Điểm tham quan | Ăn uống | Mẹo | FAQ
- [ ] Bấm 1 chip → nhảy đúng anchor tương ứng
- [ ] Cuộn trang thật (không dùng nút) → chip active-highlight đổi đúng theo section đang đọc (test từng nấc `scrollTo`, đặc biệt qua section "Điểm tham quan" rất dài — không được kẹt active ở đó khi đã cuộn qua)
- [ ] Nút **"Mục lục ▾"**: mobile mở bottom-sheet, desktop hiện `<nav>` tĩnh trong sidebar — liệt kê ĐỦ mọi section (không giới hạn 6 như chip)
- [ ] Bấm 1 mục trong Mục lục → nhảy đúng anchor + đóng bottom-sheet (mobile)
- [ ] Đà Lạt **KHÔNG** có card "Quyết định nhanh" (giá vé/giờ mở cửa) — đúng thiết kế, chỉ POI mới có

## 1. Tổng quan/giới thiệu

- [ ] Có hook mở bài (2-3 câu, lý do cụ thể nên đến — không sáo rỗng)
- [ ] Có đoạn "điều làm Đà Lạt khác biệt" (2-3 điểm đặc trưng thật)
- [ ] Đánh giá biên tập (callout viền trái) nằm TRONG khối này
- [ ] Link Google Maps/TripAdvisor (nếu có nhập) — mở tab mới, có `rel="nofollow noopener"` (xem View Source)

## 2. Nên đi mùa nào

- [ ] Hiện dạng lý do → thời điểm (KHÔNG phải 1 câu chung chung)

## 3. Nên ở mấy ngày — Lịch trình gợi ý

- [ ] (07/2026) Không còn là khối/anchor riêng — nội dung lịch trình nằm trong đoạn văn ở khối "Tổng quan" (`#trai-nghiem`), dạng prose bình thường (có thể có `<ul>`/`<ol>` theo ngày/buổi)
- [ ] KHÔNG còn card riêng biệt, KHÔNG còn nút "Xem chi tiết →" đảm bảo đúng POI (chỉ còn auto-link theo tên khớp chữ nếu có)
- [ ] KHÔNG còn CTA "tour N ngày phù hợp" tự động (tính năng đã bỏ theo quyết định 07/2026 — đổi lấy 1 UX soạn bài duy nhất)
- [ ] Cuối khối "Tổng quan": link "Xem lịch trình chi tiết →" NẾU có bài cẩm nang `topic=itinerary` gắn với Đà Lạt (nếu chưa có bài → không hiện link, không lỗi) — cơ chế này KHÔNG đổi

## 4. Di chuyển (`#di-chuyen`)

- [ ] (A) Cách tới Đà Lạt — nêu phương tiện phổ biến + nhược điểm thực tế (sân bay xa trung tâm...)
- [ ] Card affiliate "✈️ Vé máy bay" hiện đúng, link hoạt động
- [ ] Card affiliate "🚌 Vé xe khách" hiện đúng, link hoạt động
- [ ] (B) Đi lại trong khu vực — phương tiện thực tế (xe máy...) + phương án thay thế

## 5. Điểm tham quan — 2 LỚP (khối dài nhất trang)

**Lớp 1 — "Điểm nổi bật nhất"** (đứng đầu, không tab):
- [ ] Hiện 4-6 thẻ LỚN hơn thẻ thường (ảnh to hơn)
- [ ] Hồ Xuân Hương + Thung Lũng Tình Yêu có trong lớp này (đã gán `IsFeatured` thật)
- [ ] Thứ tự thẻ đúng theo `Order` đã gán

**Lớp 2 — "Tất cả điểm tham quan"** (bên dưới):
- [ ] Mobile: hiện dạng tab chip — Trung tâm / Ngoại ô gần / Xa / Tất cả, MỖI tab hiện đúng số lượng điểm
- [ ] Mobile: mặc định mở tab "Trung tâm"
- [ ] Chuyển tab → lọc đúng danh sách theo khoảng cách (không AJAX — F12 Network tab xác nhận không có request mới khi bấm tab)
- [ ] Desktop: hiện đủ 3 cột song song, KHÔNG cần bấm tab
- [ ] Có chip lọc phụ theo `DestinationType` (phẳng, không lồng 2 tầng)
- [ ] Trùng lặp giữa Lớp 1 và Lớp 2 là ĐÚNG THIẾT KẾ (vd Hồ Xuân Hương xuất hiện ở cả 2 lớp) — không phải bug

## 6. Ăn gì đặc trưng

- [ ] Hiện 4-6 món/đồ uống đặc trưng (KHÔNG phải tên quán cụ thể)
- [ ] Mỗi món có: mô tả ngắn + giá tham khảo + khu vực nên ăn (nối với khối 5)
- [ ] Link "Xem thêm: {tên bài} →" NẾU có bài cẩm nang `topic=food` gắn với Đà Lạt

## 7. Mẹo & lưu ý thực tế

- [ ] Hiện đủ nội dung (chuẩn bị đồ + bẫy du lịch cần tránh)
- [ ] Mobile: dùng `<details>` gấp mặc định (kiểm tra View Source — nội dung PHẢI có trong HTML dù đang gấp, không phải ẩn bằng JS thuần)

## 8. Quà mang về (dạng MUA SẮM — khác khối 6/7)

- [ ] Hiện dạng lưới card (không phải danh sách text)
- [ ] Mỗi card BẮT BUỘC có ảnh — đặc sản chưa có ảnh phải ẨN hoàn toàn (không hiện card thiếu ảnh)
- [ ] Card có product affiliate thật → nút **"Mua ngay"**, link tới đúng affiliate URL
- [ ] Card đặc sản chưa có product tương ứng → badge **"Mua tại {khu vực}"** (không phải nút mua)
- [ ] Link "Xem thêm →" NẾU có bài cẩm nang `topic=souvenir`

## 9. Buổi tối (`#buoi-toi`) — CHỈ hiện nếu có bài `topic=nightlife`

- [ ] Nếu Đà Lạt CHƯA có bài `topic=nightlife` → khối này KHÔNG hiện (không phải lỗi thiếu)
- [ ] Nếu có → hiện đúng nội dung bài đó

## 10. Sau khối 8

- [ ] **FAQ**: câu hỏi tầm THÀNH PHỐ (vd "Đà Lạt cách Sài Gòn bao xa", "mấy ngày là đủ để đi Đà Lạt", "Đà Lạt mùa nào đẹp nhất") — KHÔNG phải câu hỏi về 1 địa điểm cụ thể
- [ ] FAQ dùng `<details>` từng câu, có JSON-LD `FAQPage` (View Source hoặc Rich Results Test)
- [ ] **Đà Lạt KHÔNG hiện banner "Về node cha"** (chỉ POI con mới có banner này)
- [ ] **Điểm đến liên quan**: chỉ gợi ý anh em cùng cấp (Bảo Lộc, Di Linh...) hoặc Flagship khác cùng vùng (Nha Trang, Phan Thiết...) — **KHÔNG** lặp lại con của chính Đà Lạt (đã hiện đủ ở khối 5)
- [ ] **Disclosure affiliate**: 1 dòng cố định, giống mọi trang khác

## 11. Kỹ thuật chung (mọi khối)

- [ ] 0 lỗi console (F12) trên cả mobile + desktop
- [ ] Toàn bộ nội dung 2 lớp Điểm tham quan (mục 5) đã có sẵn trong DOM lúc load (View Source, KHÔNG cần chờ AJAX)
- [ ] Card động (vé máy bay/xe khách, quà mang về) là HTML bake sẵn — View Source thấy nội dung ngay, không phải render bằng JS sau khi load

---

## So sánh — Nha Trang (Standard, KHÔNG phải Flagship)

- [ ] KHÔNG có 2 lớp Điểm tham quan — vẫn lưới phẳng "Các khu trong Nha Trang"
- [ ] KHÔNG có khối Lịch trình gợi ý
- [ ] KHÔNG có khối Buổi tối
- [ ] Chip điều hướng KHÁC bộ (không phải 6 mục Flagship)

## So sánh — Biệt Thự Hằng Nga (POI, con của Đà Lạt)

- [ ] Card "Quyết định nhanh" lên đầu (giờ mở cửa/giá vé/mua vé/địa chỉ/chỉ đường/điện thoại) — khác thứ tự Đà Lạt
- [ ] **CÓ** banner "Về Đà Lạt →" (vì cha = Đà Lạt, `ContentTier=flagship`) — ngay trước "Điểm đến liên quan"
- [ ] Điểm đến liên quan CÓ trộn điểm khác trong Đà Lạt (khác Flagship — Flagship không trộn con của chính nó)
- [ ] KHÔNG có: lịch trình nhiều ngày, vé máy bay/xe khách, quà mang về dạng mua sắm (trừ khi đặc sản gắn trực tiếp tại đây)
- [ ] Đánh giá biên tập + link Google Maps/TripAdvisor vẫn hiện (nhất quán mọi trang)
