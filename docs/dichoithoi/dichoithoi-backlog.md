# Dichoithoi — Backlog tổng hợp (cập nhật 07/2026)

Gộp mọi "việc cần chốt"/"để giai đoạn sau" đang rải rác trong các spec riêng lẻ
(destination/hotel/tour/article/affiliate/content-seo-ux/database) thành 1 chỗ
duy nhất — đọc trước khi bắt tay build phần tiếp theo. Danh sách nguồn: xem
`dichoithoi-system-overview.md` để biết thứ tự đọc toàn bộ tài liệu.

## 0) Đang phân tích — CHƯA vào lộ trình build chính thức

- **Sim du lịch — gợi ý/gắn link sản phẩm liên quan** (repo `dichoithoi`, ghi
  nhận 07/2026, CHƯA phân tích): mục đích gợi ý và gắn link sản phẩm liên quan
  tới sim du lịch — dự kiến có thể tái dùng chính module Article/Product mới
  đang plan ở đây (`dichoithoi-product-spec.md`, `dichoithoi-article-spec.md`)
  thay vì xây riêng. Trạng thái hiện tại: code Controller/Service/View (Sim,
  FixedProduct) đã có sẵn trong repo `dichoithoi` (nhánh `develop`), nhưng menu
  "SIM DU LỊCH" đã ẩn khỏi header công khai (`_Header.cshtml`, commit
  `43444aa`) — KHÔNG hiển thị cho người dùng cho tới khi phân tích xong hướng
  đi. Khi có thời gian: phân tích lại có nên gộp vào Product/Article hay giữ
  module Sim riêng.

- **Vé máy bay + vé xe** (`dichoithoi-flight-spec.md`, `dichoithoi-bus-spec.md`,
  phân tích 07/2026): 2 kênh mới trả lời "tới điểm đến bằng cách nào", song song
  Hotel/Tour nhưng gắn theo TUYẾN ở cấp tỉnh/thành (không theo POI, không có
  bảng `*_destination_map`) — POI con kế thừa qua `ProvinceId` sẵn có. Giá là
  tham khảo tĩnh, cập nhật định kỳ (không phải meta-search real-time). Cách
  hiển thị cụ thể trên trang detail (vị trí khối, gộp/tách Flight với Bus) —
  vẫn đang phân tích, chưa chốt. Khi quyết định build: thêm vào §B dưới đây +
  `dichoithoi-system-overview.md` + `dichoithoi-implementation-plan.md`. Cách
  nhập: 2 màn quản lý riêng trong zinoflow (giống Hotel/Tour) — nhập tay hoàn
  toàn hoặc cào định kỳ, KHÔNG có panel gán vào từng điểm đến (chỉ chọn tỉnh
  đích), trang chi tiết điểm đến chỉ đọc theo `ProvinceId` (flight-spec §5,
  bus-spec §5).

- **4 khối nội dung mới cho trang điểm đến** (`dichoithoi-content-seo-ux-plan.md`
  §5.4-§5.7, phân tích 07/2026 — vai khách du lịch): chi phí ước tính (§5.4,
  không cần cột mới); giá vé theo đối tượng (§5.5, **2 NGUỒN khác nhau**: (a)
  giá cố định chính thức do điểm đến quy định → cột `PriceBreakdownJson` mới,
  (b) giá riêng từng nhà cung cấp booking → thêm field `price` tuỳ chọn vào
  `ticketLinks[]`, xem `dichoithoi-affiliate-link-conversion-spec.md` §2); câu
  chuyện văn hoá - lịch sử (§5.6, không cần cột mới, chỉ sửa prompt pack); khối
  "Lưu ý thực tế" gộp bãi xe/nhà vệ sinh/an toàn/quy định (§5.7, cột
  `PracticalNotesJson` mới). Đã thêm vào khung "ai cũng cần" (destination-spec
  §2.2) và ghi chú kế hoạch cột ở database-redesign §4.3 — **CHƯA đưa vào
  prompt pack/structure gate/migration thật**.
  Cách nhập từng khối (bổ sung 07/2026, hỏi "có cần nhập ở zinoflow không"):
  giá cố định (a) + giá theo nhà cung cấp (b) → **nhập tay** trong màn sửa
  điểm đến (AI không được bịa số); câu chuyện văn hoá - lịch sử → **AI viết,
  người duyệt** (như mọi section văn xuôi khác, không form riêng); chi phí
  ước tính → **không nhập gì**, tự tính lúc render; lưu ý thực tế → **AI gợi ý
  draft, bắt buộc người dùng duyệt/sửa** trước khi lưu (ảnh hưởng an toàn).
  Xem chi tiết content-seo-ux-plan §5.4-§5.7.

- **Layout mobile-first — đập đi làm lại toàn bộ** (`dichoithoi-content-seo-
  ux-plan.md` §10, phân tích 07/2026): thiết kế mới hoàn toàn cho menu (drawer +
  mega-menu), trang chủ, trang danh mục (Loại/Tỉnh), trang chi tiết điểm đến —
  mobile-first (CSS base cho mobile, desktop thêm bằng `min-width`), có wireframe
  ASCII chi tiết từng loại trang, thanh CTA dính đáy trên mobile ở trang chi
  tiết, `<details>` gốc HTML cho khối dài (không JS ẩn/hiện, giữ SEO). **CHƯA
  vào implementation-plan**, cần chốt duyệt lần cuối trước khi build.

  ⚠️ **Cần bạn xác nhận 1 điểm**: mục "thời điểm đẹp" (mùa/giờ nên đi) trước đó
  đã CHỐT giữ dạng văn xuôi trong `ContentHtml`, không tạo field cấu trúc riêng
  (database-redesign §4.2, "chưa có nhu cầu landing theo mùa cụ thể") — phân
  tích lần này KHÔNG đổi quyết định đó (không đề xuất field mới cho "mùa nên
  đi"), chỉ thêm mục MỚI "câu chuyện văn hoá" (khác nội dung, không phải mở
  rộng field mùa). Nếu bạn thực ra muốn có field mùa cấu trúc (vd để lọc/landing
  theo mùa sau này), cần chốt lại riêng — không nằm trong phạm vi phân tích lần
  này.

- **Nhập toạ độ qua link Google Maps** (`dichoithoi-destination-spec.md`
  §2.1.1, **ĐÃ CHỐT SCOPE 07/2026 — sẵn sàng đưa vào code**): thêm ô "Dán link
  Google Maps" cạnh 2 ô lat/lng, tự parse bằng regex (ưu tiên `!3d!4d`, fallback
  `@lat,lng`, xử lý link rút gọn qua theo-redirect) — không gọi API, không tốn
  phí. Các thông tin khác của điểm đến vẫn nhập tay như cũ, KHÔNG tự điền từ
  Google Maps ở scope này.

  ⚠️ **Ý tưởng nâng cao — Google Places API** (destination-spec §2.1.2,
  **ƯU TIÊN THẤP, chỉ ghi lại mục đích, chưa làm**): tự điền field trống (giờ mở
  cửa, địa chỉ...), lấy thêm rating/số review của Google (khác nguồn review nội
  bộ), gợi ý điểm đến con trong cùng khu qua Nearby Search (vd Suối Tiên có
  nhiều khu nhỏ), lưu `place_id` để tái sử dụng. Ảnh Google Maps: KHÔNG tải/lưu
  về server (rủi ro bản quyền) — chỉ link-out "Xem trên Google Maps". Cần tài
  khoản Google Cloud + billing, chỉ gọi khi người dùng chủ động bấm nút (không
  job nền tự động) — xem lại khi có nhu cầu/ngân sách thật.

- **`AncestorsJson`/`ChildrenJson` cho cây phân cấp tỉnh → khu vực → điểm con**
  (`dichoithoi-database-redesign.md` §3.4/§4.3, phân tích 07/2026, vd Lâm Đồng →
  Đà Lạt/Di Linh/Đức Trọng → điểm cụ thể): cây `kind`(`province`/`cluster`/`poi`)
  + `ParentId`/`ProvinceId` hiện có đã đủ mô hình hoá đúng, KHÔNG cần đổi cấu
  trúc — chỉ thêm 2 cột precompute mới tính trong `RecomputeRelatedService`:
  `AncestorsJson` (breadcrumb, không query đệ quy) và `ChildrenJson` (danh sách
  đầy đủ con trực tiếp, khác `RelatedJson` chỉ cắt 8 mục gợi ý). 1 điểm đến chỉ
  thuộc 1 cha duy nhất ở trục địa lý (đúng bản chất vật lý); trục phân loại
  (`DestinationTypeMap`) đã hỗ trợ nhiều-nhiều sẵn. Tag tự do: chưa cần, vì
  `DestinationType` đã đóng vai trò tag có cấu trúc + trang SEO riêng — chỉ nên
  thêm `tags: string[]` đơn giản khi có nhu cầu lọc mịn hơn thực sự phát sinh.
  **CHƯA thêm vào DDL/migration thật**, chỉ ghi nhận phân tích.

- **URL điểm đến giữ PHẲNG, không theo cấp bậc** (`content-seo-ux-plan.md`
  §10.7, **CHỐT 07/2026**): `/diem-den/{slug}` giữ nguyên như hiện tại, KHÔNG
  đổi sang nested theo tỉnh/cụm — lý do: Google không tính độ sâu URL là yếu
  tố xếp hạng, breadcrumb+`AncestorsJson` đã truyền tải cấp bậc, URL phẳng ổn
  định hơn khi tổ chức lại cây. Không cần code gì thêm (đã đúng hiện trạng).

  ⚠️ **Trang chi tiết theo `kind` (poi/cluster/province) + trục vùng/miền**
  (`content-seo-ux-plan.md` §10.6, **PHÂN TÍCH, CHƯA XÁC NHẬN CUỐI** — khác
  mục slug ở trên đã chốt): cluster có 2 biến thể render khác nhau (có/không
  vé riêng); đề xuất `kind=province` KHÔNG có trang riêng, redirect sang
  `/tinh/{slug}` đã build (tránh duplicate content); vùng/miền đề xuất là trục
  phân loại mới (bảng `Region`, trang `/vung/{slug}`) chứ không phải tầng thứ 4
  trong cây `kind`. Cần bạn xác nhận lại khi quay lại chủ đề này.

- **Website chỉ đọc, KHÔNG xử lý logic — rà soát tốc độ phát hiện vi phạm**
  (`dichoithoi-database-redesign.md` §3.4/§4.3, `dichoithoi-system-design.md`
  §5 mục 1, phân tích 07/2026): nguyên tắc "ghi đắt đọc rẻ" phát biểu lại rõ
  ràng hơn — zinoflow xử lý TOÀN BỘ (join/sort/aggregate), website chỉ SELECT +
  render. Rà soát code thật phát hiện 2 chỗ ĐANG VI PHẠM cần sửa: (1) trang
  detail JOIN+ORDER BY+TAKE bảng Hotel/Tour SỐNG lúc render
  (`DestinationExtrasRepository.GetExtrasBySlugAsync`) → thêm `HotelCardsJson`/
  `TourCardsJson` precompute (2 trigger: lúc publish destination, và lúc
  Hotel/Tour đổi giá/rating/mapping); (2) tính `AvgRating` bằng `.Average()`
  toàn bộ list review MỖI LẦN RENDER → sửa thành UPDATE 2 cột cache
  `AvgRating`/`ReviewCount` (đã có sẵn trên `V2Destination`) ngay lúc website
  ghi review mới, trang detail đọc thẳng cột cache. Mục tiêu: từ 7 query rời
  rạc hiện tại/trang detail → còn 1 query chính + tối đa 1 query phụ. **Đây là
  việc SỬA hiện trạng, chưa code — CHƯA vào migration/refactor thật.**

- **Tối ưu hạ tầng cho hosting SmarterASP .NET Advance** (`content-seo-ux-
  plan.md` §10.5.1, `system-design.md` §5 mục 9, phân tích 07/2026 — rà soát
  toàn diện thêm sau khi đã có thiết kế precompute/mobile-first/stack nhẹ):
  (1) cache 2 tầng — `OutputCache` in-memory + Cloudflare free làm CDN/edge
  cache (bắt buộc vì IIS App Pool recycle làm mất cache tầng 1 trên shared
  hosting), invalidate cả 2 khi publish (mở rộng endpoint invalidate cache có
  sẵn, thêm gọi Cloudflare Purge API); (2) resize ảnh ở zinoflow — ĐÃ có kế
  hoạch từ trước (`destination-spec.md` §14), không phải việc mới, chỉ xác
  nhận lại; (3) đo Lighthouse thực tế qua GitHub Actions/PageSpeed API từ bên
  ngoài, không phụ thuộc hosting; (4) `noindex`/canonical cho tổ hợp filter;
  (5) sitemap chia nhỏ theo ngưỡng 40.000 URL/file; (6) CẦN BẠN KIỂM TRA: gói
  Advance có tính năng Task Scheduler/Cron trong control panel không (để
  warm-up app pool sau recycle) — chưa xác nhận được từ xa.

- **Module Sản phẩm (affiliate, chèn qua tag trong bài viết)**
  (`dichoithoi-product-spec.md`, **PHẦN LỚN ĐÃ CHỐT SCOPE 07/2026**): kiếm tiền
  affiliate dụng cụ/đồ dùng qua khối động thứ 5+6 (`products`/`product`, số
  nhiều/số ít giống `destinations`/`destination`) chèn vào bài cẩm nang theo
  `tag` (KHÔNG theo tỉnh/điểm đến như Hotel/Tour). Đã chốt: (1) match tag kiểu
  OR — khớp bất kỳ tag nào; (2) KHÔNG có trang catalog sản phẩm công khai, chỉ
  nhúng card trong bài; (3) AI tự gợi ý chèn khối lúc generate, người dùng
  duyệt/quyết định trước khi publish — áp dụng chung MỌI kind khối động, không
  riêng Product (giải quyết luôn câu hỏi mở cũ ở article-spec §10 #4); (4) sẽ
  dùng nhiều sàn TMĐT (Shopee/Lazada/Tiki...), cấu hình rule affiliate để sau,
  không chặn build. Còn 1 điểm chưa chốt: chuẩn hoá danh sách `category` (xem
  product-spec §8 #5). **Data model mới, chưa vào migration thật.**

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
| 8 | **Rà soát lại `DestinationType`/`DestinationTypeMap` đã gắn cho từng điểm đến — hiện tại có thực sự hợp lý không** (ghi nhận 07/2026, người dùng tự nêu nghi ngờ, chưa xác nhận đúng/sai): cần 1 đợt đánh giá lại toàn bộ — do AI chấm/gợi ý sửa (dựa nội dung bài + loại đang gắn) hay tự tay chuẩn hoá thủ công từng điểm — CHƯA chọn cách nào, CHƯA có job/tool cho việc này | Chất lượng taxonomy ảnh hưởng trực tiếp trang `/loai` (SEO) + khối động `[[block:destinations type=...]]` trong bài viết | destination-spec §2.2 (khung phân loại), article-spec §3 (block theo `type`) |

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
