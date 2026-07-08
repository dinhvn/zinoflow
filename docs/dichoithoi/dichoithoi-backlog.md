# Dichoithoi — Backlog tổng hợp (cập nhật 07/2026)

Gộp mọi "việc cần chốt"/"để giai đoạn sau" đang rải rác trong các spec riêng lẻ
(destination/hotel/tour/article/affiliate/content-seo-ux/database) thành 1 chỗ
duy nhất — đọc trước khi bắt tay build phần tiếp theo. Danh sách nguồn: xem
`dichoithoi-system-overview.md` để biết thứ tự đọc toàn bộ tài liệu.

## A) Quyết định CẦN BẠN CHỐT trước khi code (không phải việc kỹ thuật thuần)

| # | Việc | Ảnh hưởng | Nguồn |
|---|---|---|---|
| 1 | URL bài cẩm nang — đề xuất `/cam-nang/{slug}`, có đổi `/blog/`/`/tin-tuc/` không? | Route website + SEO | article-spec §10.1 |
| 2 | Bộ khối động MVP chỉ 4 loại (`destinations`/`hotels`/`tours`/`destination`) — cần thêm khối "món ăn/quán ăn" riêng không? | Độ phức tạp compile engine | article-spec §10.3 |
| 3 | AI có tự đề xuất chèn khối động lúc generate hay chỉ người dùng tự chèn tay (MVP)? | Độ phức tạp prompt pack | article-spec §10.4 |
| 4 | Chọn OTA nào cào khách sạn trước (Booking.com/Agoda/Traveloka) | Parser đầu tiên cần build | hotel-spec §7.1 |
| 5 | Chọn nguồn cào tour trước (Klook/TripVision/khác) | Parser đầu tiên cần build | tour-spec §7.1 |
| 6 | Mạng affiliate đang/sẽ tham gia đã cấp rule/deep-link dạng nào (theo từng khách sạn/tour hay chỉ link chung)? | Thiết kế `affiliate_link_rules`, ảnh hưởng CTA | hotel-spec §7.2, tour-spec §7.2, affiliate-conversion-spec §2 |
| 7 | Ngưỡng khối lượng khách sạn/tour cần có trước khi đáng xây job cào tự động | MVP nhập tay hay xây crawler ngay | hotel-spec §7.3, tour-spec §7.3 |

## B) Thứ tự build đề xuất (phụ thuộc lẫn nhau — không phải "chưa quyết")

**Giai đoạn 1 — Đại tu nền** (`system-overview.md` §5, đã cập nhật 07/2026):
1. Migration schema v2 (`database-redesign.md` §7) — **chạy trên bản clone
   LocalDB trước** (`pnpm clone:dichoithoi`, xem `system-overview.md` §6.6),
   KHÔNG chạy thẳng production.
2. Website .NET đọc schema mới (repo dichoithoi, song song).
3. Build M4 destination: mirror + generate + review + publisher.
4. Build cơ chế affiliate link conversion (`affiliate-link-conversion-spec.md`)
   — làm TRƯỚC hoặc CÙNG Hotel/Tour vì cả 2 phụ thuộc field
   `provider/sourceUrl/affiliateUrl/linkStatus`.
5. Build module Hotel (`hotel-spec.md`) + Tour (`tour-spec.md`).
6. Build năng lực "Viết tay thủ công" ở lõi module `ai-content`
   (`sourceType=Manual`, transition `Created→DraftReady` mới —
   `article-spec.md` §1.1, đồng bộ với `ai-content-technical-spec.md` §4.1/§5)
   — cần TRƯỚC hoặc CÙNG lúc build Article vì Article là nơi đầu tiên cần.
7. Build module Article (`article-spec.md`) — cơ chế khối động + publisher.
8. Website .NET: route/view mới cho `/loai/{group}[/{type}]`, `/tinh/{slug}`,
   Article — ưu tiên landing loại/tỉnh trước (SEO ROI cao nhất, data sẵn sàng).
9. Tắt module Destination + Hotel + Tour trên CMS cũ.

**SEO/UX đi kèm** (`content-seo-ux-plan.md` §7, đã sắp ưu tiên):
- Cao: bật lại Review/Rating + JSON-LD AggregateRating; render FAQ + JSON-LD
  FAQPage; trang landing Loại+Tỉnh; SSR khối khách sạn/tour giữa bài (không AJAX).
- Trung bình: gallery ảnh (`GalleryJson` + bảng `destination_images`); bản đồ
  nhúng; `rel=sponsored` + disclosure; render `ticketLinks[]` thành nhiều nút.
- Sau: mini lịch trình; so sánh giá tại quầy vs online; sitemap.xml + Search
  Console; critical CSS cho LCP; phân trang `/diem-den` có URL riêng từng trang.

## C) Rủi ro/lưu ý vận hành (không phải task, nhưng đừng quên)

1. ⚠️ **Sau go-live phải khoá nút import Destination + Hotel + Tour trên CMS
   cũ** — tránh wipe dữ liệu AI tool vừa ghi (destination-spec §9.2,
   system-overview §1).
2. Encoding tiếng Việt khi ghi `nvarchar` qua driver `mssql` — test sớm 1
   record thật trước khi ghi hàng loạt (destination-spec §9.3).
3. Backup 2 bảng gốc trước lần publish thật đầu tiên (destination-spec §8,
   system-overview §6.4).
4. Dev/test hằng ngày dùng LocalDB clone (`dichoithoi_dev`), KHÔNG trỏ thẳng
   production — script `pnpm clone:dichoithoi` đã có sẵn (system-overview §6.6).
5. Cào dữ liệu khách sạn/tour: ưu tiên API/affiliate feed chính thức nếu nhà
   cung cấp có, tần suất thấp nếu phải cào HTML — rủi ro ToS là quyết định
   kinh doanh của bạn, không phải giới hạn kỹ thuật (hotel-spec §1, tour-spec §1).

## D) Đã làm rõ / không còn là việc mở (tránh làm lại)

- ~~Bộ `DestinationType` chuẩn~~ → đã thành 2 tầng thật trong DB
  (`DestinationTypeGroup` + `DestinationType`, database-redesign §3.2/§4.4/§9.2).
- ~~Quy tắc trộn khối "liên quan"~~ → đã duyệt, xem destination-spec §12.3 pha 2.
- ~~Website mới giữ .NET hay đổi stack~~ → giữ .NET, chỉ đổi tầng đọc.
- ~~Module Hotel/Tour làm ở giai đoạn nào~~ → Giai đoạn 1 (cùng Destination),
  không phải giai đoạn 3 như dự kiến ban đầu (database-redesign §9 mục 5).
- ~~Cách 1 vs Cách 2 cho khối động (precompute vs render-time)~~ → chọn Cách 1
  (precompute lúc publish), xem article-spec §2.
- ~~Hotel/Tour có cần trang chi tiết riêng không~~ → KHÔNG, chỉ card gợi ý.
- ~~Vé điểm đến 1 link hay nhiều link~~ → nhiều link (`ticketLinks[]`), mỗi
  link tự sinh affiliate URL theo rule chung.
- ~~Contact mở rộng (Zalo/Facebook) / BestMonths có cấu trúc~~ → không cần,
  giữ schema Destination gọn (database-redesign.md §4.2, quyết định 07/2026).
- ~~Hotel render theo HotelGroupId hay bảng map riêng~~ → `HotelDestinationMap`
  (thay `HotelGroupId`, nhất quán với `TourDestinationMap` của Tour) —
  hotel-spec.md §4, sửa 07/2026 (mâu thuẫn với bản đầu đã phát hiện + sửa khi rà lại).

## Việc CŨ hơn — đã lỗi thời, cần rà lại khi đụng tới

- destination-spec §10 nhắc "Viết bài Post/Phượt/Tour của dichoithoi (chỉ làm
  Destination trước)" — **lưu ý**: chữ "Tour" ở đây (12/06/2026) nói về bài
  viết dạng CMS cũ, KHÁC với module Tour mới (07/2026, dữ liệu đặt tour affiliate,
  không phải bài viết). Post/Phượt (CMS cũ) vẫn ngoài phạm vi, chưa có kế hoạch
  migrate cụ thể (system-overview §5 Giai đoạn 3 — chưa chốt thời điểm).
