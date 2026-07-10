# Dichoithoi — Backlog tổng hợp (cập nhật 07/2026)

Gộp mọi "việc cần chốt"/"để giai đoạn sau" đang rải rác trong các spec riêng lẻ
(destination/hotel/tour/article/affiliate/content-seo-ux/database) thành 1 chỗ
duy nhất — đọc trước khi bắt tay build phần tiếp theo. Danh sách nguồn: xem
`dichoithoi-system-overview.md` để biết thứ tự đọc toàn bộ tài liệu.

## 0) Đang phân tích — CHƯA vào lộ trình build chính thức

- **Gate "originality" (thứ 5) cho quality gates AI content** (`dichoithoi-
  seo-principles.md` §3.3/§3.4, phân tích 07/2026 — xác minh trực tiếp tài
  liệu Google `using-gen-ai-content`/`spam-policies`/`creating-helpful-
  content`): 4 gate hiện có (structure/SEO/policy/data,
  `destination-gates.ts`) đã đúng hướng chống "scaled content abuse" nhưng
  CHƯA có gate kiểm tra trùng lặp NỘI BỘ (nhiều bài cùng khung dễ lặp công
  thức, nhất là đoạn "câu chuyện văn hoá", "lưu ý thực tế", giới thiệu trang
  cluster/tỉnh). Đề xuất: so sánh similarity với bài đã publish cùng loại/
  tỉnh, chặn publish nếu vượt ngưỡng — CHƯA code, cần chọn phương pháp đo
  similarity (full-text search đơn giản hay embedding) trước khi build.
  Đồng thời chốt: KHÔNG dùng AI-detector (GPTZero/Originality.ai) làm tiêu
  chuẩn pass/fail — không phải cơ chế Google dùng, chỉ tham khảo phụ.

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
  tham khảo tĩnh, cập nhật định kỳ (không phải meta-search real-time). ✅ **Cách
  hiển thị trên trang detail ĐÃ CHỐT** (`content-seo-ux-plan.md` §5.8, Phase A
  bước 3 07/2026 — chỉ là `flight-spec`/`bus-spec §6` trước đó ghi sót "chưa
  chốt", đã đồng bộ lại): 2 card "✈️ Vé máy bay"/"🚌 Vé xe khách" cạnh nhau
  trong mục "Cách tới đây" (sau lịch trình gợi ý, trước Điểm tham quan gần
  đây), ẩn card rỗng, gộp 1 bảng `transports` (cột `mode`) không tách bảng
  riêng, bake HTML vào `DynamicBlocksJson`. Khi quyết định BUILD (đổi tên
  bảng, đồng bộ SQL Server): thêm vào §B dưới đây + `system-overview.md` +
  `implementation-plan.md`. Cách nhập: 2 màn quản lý riêng trong zinoflow
  (giống Hotel/Tour) — nhập tay hoàn toàn hoặc cào định kỳ, KHÔNG có panel gán
  vào từng điểm đến (chỉ chọn tỉnh đích), trang chi tiết điểm đến chỉ đọc theo
  `ProvinceId` (flight-spec §5, bus-spec §5).

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
  (`DestinationTypeMap`) đã hỗ trợ nhiều-nhiều sẵn. ~~Tag tự do: chưa cần~~ →
  **ĐÃ MỞ LẠI 07/2026** — nhu cầu chủ đề cắt ngang (vd "Kiến trúc") đã phát
  sinh thật: chốt bảng `DestinationTag`/`DestinationTagMap` + trang
  `/chu-de/{slug}` (bộ từ vựng ĐÓNG quản lý trong CMS, không phải tag nhập tự
  do — database-redesign §3.2.1, destination-spec §2.4).
  **CHƯA thêm vào DDL/migration thật**, chỉ ghi nhận phân tích.

- **URL điểm đến giữ PHẲNG, không theo cấp bậc** (`content-seo-ux-plan.md`
  §10.7, **CHỐT 07/2026**): `/diem-den/{slug}` giữ nguyên như hiện tại, KHÔNG
  đổi sang nested theo tỉnh/cụm — lý do: Google không tính độ sâu URL là yếu
  tố xếp hạng, breadcrumb+`AncestorsJson` đã truyền tải cấp bậc, URL phẳng ổn
  định hơn khi tổ chức lại cây. Không cần code gì thêm (đã đúng hiện trạng).

  **Trang chi tiết theo `kind` (poi/cluster/province) + trục vùng/miền**
  (`content-seo-ux-plan.md` §10.6, **CHỐT 07/2026**, đưa vào Phase 18 của
  implementation-plan): cluster có 2 biến thể render khác nhau (có/không vé
  riêng); `kind=province` KHÔNG có trang riêng, redirect sang `/tinh/{slug}`
  đã build (tránh duplicate content); vùng/miền là trục phân loại mới (bảng
  `Region`, trang `/vung/{slug}`) chứ không phải tầng thứ 4 trong cây `kind`.

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

- **Module Sản phẩm (affiliate, chèn qua tag trong bài viết)** —
  **ĐÃ BUILD XONG (Phase 16, 07/2026)**, xem implementation-plan.md Phase 16 để
  biết chi tiết đầy đủ. Quyết định `category`: tự do nhập + gợi ý autocomplete
  từ giá trị đã dùng, không bảng quản lý riêng (đã hỏi người dùng khi build).
  Phát hiện lúc build: prompt mặc định cho `cam-nang.*` (bài cẩm nang, nơi
  chèn khối Product) chưa tồn tại trong `DEFAULT_PROMPTS` — thuộc khoảng trống
  Phase 8, chưa xử lý.

## A) Quyết định CẦN BẠN CHỐT trước khi code (không phải việc kỹ thuật thuần)

| # | Việc | Ảnh hưởng | Nguồn |
|---|---|---|---|
| 1 | ✅ **CHỐT 07/2026** — URL bài cẩm nang = `/blog/{slug}` (đổi từ đề xuất `/cam-nang/`) | Route website + SEO | article-spec §10.1 |
| 2 | ✅ **CHỐT 07/2026** — thêm ngay khối `foodSpots` (món ăn/quán ăn, tái dùng bảng `products` lọc category) | Độ phức tạp compile engine | article-spec §3.1/§10.3 |
| 3 | ✅ AI tự đề xuất chèn khối động lúc generate, người dùng duyệt/sửa trước khi publish (chốt 07/2026, áp dụng mọi kind) | Độ phức tạp prompt pack | article-spec §10.4, product-spec §7 |
| 4 | Chọn OTA nào cào khách sạn trước (Booking.com/Agoda/Traveloka) | Parser đầu tiên cần build | hotel-spec §7.1 |
| 5 | Chọn nguồn cào tour trước (Klook/TripVision/khác) | Parser đầu tiên cần build | tour-spec §7.1 |
| 6 | Mạng affiliate đang/sẽ tham gia đã cấp rule/deep-link dạng nào (theo từng khách sạn/tour hay chỉ link chung)? | Thiết kế `affiliate_link_rules`, ảnh hưởng CTA | hotel-spec §7.2, tour-spec §7.2, affiliate-conversion-spec §2 |
| 7 | Ngưỡng khối lượng khách sạn/tour cần có trước khi đáng xây job cào tự động | MVP nhập tay hay xây crawler ngay | hotel-spec §7.3, tour-spec §7.3 |
| 8 | ✅ **ĐÃ CHỐT CÁCH LÀM 07/2026** — rà `DestinationType`/`TypeMap` GỘP CHUNG vào đợt "thiết kế bộ chủ đề (tag)": Claude đọc toàn bộ điểm đến thật, đánh giá cả taxonomy lẫn đề xuất tag, người dùng duyệt (§B Phase A bước 1, destination-spec §2.4 bước 0) | Chất lượng taxonomy ảnh hưởng trang `/loai` (SEO) + khối động theo `type` | destination-spec §2.4 |
| 9 | ✅ **CHỐT 07/2026** — Ô "Tư liệu tham khảo" trong form tạo bài Article bằng AI: giống mẫu Destination §2.2.1, lưu cùng `ContentJob` | Chất lượng bài Article + tín hiệu Who/How/Why | article-spec §1.2 |
| 10 | ✅ **CHỐT 07/2026** — Khoá phụ UPSERT = slug + tên chuẩn hoá (bỏ dấu, lowercase) + tỉnh/tuyến; nghi trùng → để nháp chờ người dùng xác nhận gộp, KHÔNG tự động ghi đè | Import sheet không tạo trùng với data nhập tay | product-spec §5.1 |

## B) Lộ trình thực hiện theo PHASE (viết lại 07/2026 sau đợt rà toàn bộ — thứ tự theo PHỤ THUỘC, không theo thứ tự nghĩ ra)

**Phase A — Làm được NGAY, không chờ code gì** (toàn bộ là việc phân tích/
dữ liệu, output đổ vào migration Phase B — làm sau là phải migrate 2 lần):
1. ✅ **ĐÃ DUYỆT 07/2026 — Thiết kế bộ chủ đề (tag) + rà taxonomy Type**: đọc
   thật 271 điểm đến từ `dichoithoi_dev`, phát hiện 10 điểm chưa có Type +
   loại "Di tích lịch sử" bị gán quá rộng (35 điểm, lẫn cả Vịnh Hạ Long/Biệt
   thự Hằng Nga không phải di tích) + đề xuất 7 tag chủ đề (kèm tiêu chí +
   đếm thật) — chi tiết đầy đủ + 2 tag theo dõi thêm ở destination-spec §2.4
   bước 0. Áp dụng khi seed migration v2 (Phase B), không cần hỏi lại.
2. ✅ **XONG (07/2026, theo phạm vi đã chốt) — migration địa chỉ cũ→mới**
   (plan riêng `~/.claude/plans/nifty-purring-waterfall.md`): sửa lỗi thuật
   toán so khớp (bỏ tiền tố Xã/Phường) + sửa `ProvinceName` sai (Phan Thiết→
   Bình Thuận, Hội An→Quảng Nam) — kết quả cuối: 114 match tự tin cấp
   phường/xã, 121 chấp nhận cấp tỉnh (quyết định người dùng, không chặn tiến
   độ), 36 cần xem tay khi rảnh (không chặn Phase B). Chuẩn hoá format địa
   chỉ (mục cũ) để lại làm lúc chạy migration v2 thật.
3. ✅ **XONG (07/2026) — Cách hiển thị Flight/Bus trên trang detail**: hoá ra
   đã chốt sẵn từ trước ở `content-seo-ux-plan.md` §5.8, chỉ do `flight-spec`/
   `bus-spec §6` chưa cập nhật nên tưởng còn mở — đã đồng bộ lại 3 file. Không
   còn là điều kiện chặn Pilot (Phase E) nữa, chỉ còn chờ BUILD module.
4. ✅ **PHẦN LÀM ĐƯỢC XONG (07/2026)** — 4/8 mục A quyết được ngay: URL Article
   = `/blog/` (A#1), thêm khối `foodSpots` (A#2), ô tư liệu Article (A#9), khoá
   UPSERT sheet (A#10). **Còn 4 mục A#4-7 (chọn OTA khách sạn/tour cào trước,
   dạng rule mạng affiliate, ngưỡng khối lượng xây crawler) — CHƯA quyết được**
   vì cần thông tin kinh doanh thật (bạn đã/đang đàm phán mạng affiliate nào,
   OTA nào có API) mà Claude không có — để mở, hỏi bạn khi bắt tay build đúng
   module đó (Phase C bước 3), không phải việc phân tích giấy giải quyết được.

**Phase B — Đại tu nền** (`system-overview.md` §5):
1. ✅ **XONG (07/2026) — Gộp output Phase A vào schema v2 trên `dichoithoi_dev`**
   (LocalDB, KHÔNG đụng production). Phát hiện lúc bắt tay: core migration
   §7 bước 1-5 (bảng `v2.Destination`/`DestinationContent`/`Province`/
   `DestinationType*` + 271 dòng dữ liệu) **đã được dựng và chạy sẵn từ
   trước** (không rõ lúc nào) — không phải làm lại từ đầu, chỉ còn thiếu
   đúng phần Phase A tạo ra:
   - Tạo bảng `v2.DestinationTag`/`DestinationTagMap` (database-redesign.md
     §3.2.1) + seed 7 tag đã duyệt (chỉ định nghĩa tag, CHƯA gán vào điểm đến
     nào — việc đó là Bước 1 quy trình AI-gán-duyệt ở destination-spec §2.4,
     cần UI, chưa build).
   - Sửa `v2.DestinationTypeMap`: gán Type cho 8/10 POI trước đó thiếu hẳn
     Type (Hà Tiên/Mũi Cà Mau giữ nguyên không ép Type theo đúng ghi chú
     Phase A); gỡ Type "Di tích lịch sử" gán sai cho Biệt thự Hằng Nga/Vịnh
     Hạ Long/Bãi đá cổ Sa Pa (Bãi đá cổ được gán thay bằng "Núi - Cao
     nguyên" vì nếu gỡ suông sẽ về 0 type). Kết quả: 239→247/271 điểm có
     `PrimaryTypeId`.
   - `UPDATE AddressNew/AddressOld` từ `dry-run-report-v2.csv` (Phase A bước
     2) cho 235/271 dòng (114 match tự tin + 121 chấp nhận cấp tỉnh) — 36
     dòng "nhiều phường/xã trùng" CHỦ Ý để `AddressNew=NULL`, chờ người dùng
     xem tay từng dòng trước khi ghi (đúng quyết định đã chốt, không tự
     đoán ward có rủi ro sai).
   - Script SQL: `dichoithoi/scripts/address-migration/phase-b-0{1,2,3}-*.sql`
     (idempotent, có thể chạy lại an toàn — dùng `IF NOT EXISTS`/kiểm tra
     trước khi INSERT).
2. 🔄 **ĐANG LÀM (07/2026) — Website .NET đọc schema mới** (repo dichoithoi,
   song song). Khảo sát thực tế cho thấy đã v2-hoá SẴN 1 phần trước đây:
   `/loai/...` + `/tinh/{slug}` (100% v2), trang chi tiết `/diem-den/{slug}`
   (dữ liệu bổ sung — review/FAQ/gallery/hotel-tour/breadcrumb — đã đọc v2 qua
   `DestinationExtrasRepository`, nhưng field CHÍNH — Address/Type — vẫn đọc
   bảng v1 cũ). ✅ Đã làm xong đợt này: field `AddressNew`/`AddressOld` (output
   Phase A/B bước 1) nối vào `DestinationExtrasModel`/`DestinationExtrasRepository`,
   hiển thị đúng theo destination-spec §13.3 (địa chỉ mới làm chính, địa chỉ cũ
   chỉ hiện khi khác địa chỉ mới) trên `_QuickDecisionCard.cshtml` + JSON-LD
   (`SchemaUtil.cs`) — build sạch, test bằng dev server thật trên
   `dichoithoi_dev`, spot-check 2 điểm (Biệt thự Hằng Nga — không đổi, Hoàng Su
   Phì — Hà Giang→Tuyên Quang, hiện đúng cả 2 dòng).

   ✅ **Đợt 2 cùng ngày** — nối luôn `Types` (v2 `DestinationTypeMap` join
   `DestinationType`/`DestinationTypeGroup`) vào `DestinationExtrasModel`,
   thay CSV `Type` v1 ở 3 chỗ hiển thị trên trang chi tiết: chip loại (link
   thẳng `/loai/{groupSlug}/{typeSlug}` đã build sẵn, thay vì `/search?q=`
   không còn đúng nghĩa), JSON-LD `touristType`, và `firstType` dùng trong
   title/meta — đều fallback về CSV v1 khi điểm chưa có Type nào trong v2.
   **Kết quả trực tiếp nhìn thấy được**: kết quả rà taxonomy ở Phase A bước 1
   (gỡ "Di tích lịch sử" sai cho Biệt thự Hằng Nga) giờ mới thật sự hiện đúng
   trên web — trước đợt sửa này, dù đã sửa `DestinationTypeMap` trong DB, trang
   chi tiết vẫn hiện "Di tích lịch sử" vì đọc CSV `Type` v1 chưa đụng tới, hoàn
   toàn tách biệt với cột đã sửa. Test dev server thật: title đổi từ "...Di
   tích lịch sử" → "...Công trình kiến trúc", JSON-LD `touristType` đúng, chip
   link đúng `/loai/van-hoa-lich-su/cong-trinh-kien-truc`.

   ~~⚠️ Cố ý CHƯA đụng: logic sắp xếp "điểm liên quan" theo loại trùng nhau~~
   → ✅ **ĐÃ SỬA (đợt 4 cùng ngày)**. Sau đợt 3 migrate `DestinationRepository.cs`,
   vế ứng viên (`GetRelationDestinationAsync` → `ToShortModel`) đã tự động đổi
   sang đọc `TypeNames` từ v2 — khiến vế còn lại (`detail.Type`, CSV v1 từ
   `GetDetailAsync` chưa migrate) bị LỆCH "từ điển" so khớp thật sự (không
   còn là "để nguyên an toàn" như ghi chú cũ, mà đã thành bug sống). Sửa
   `DestinationController.cs`: dời fetch `extras` lên TRƯỚC khối tính
   "điểm liên quan", dùng `extras.Types` (v2, cùng vocabulary với candidate)
   thay `detail.Type` CSV khi so khớp `type1`/`type2`, fallback CSV nếu điểm
   chưa có Type nào ở v2. Build sạch, test dev server thật: `/diem-den/biet-
   thu-hang-nga-dalat` (cụm Đà Lạt, 45 con → rơi đúng nhánh >9 ứng viên cần
   sắp xếp) trả về đúng 8 điểm liên quan hợp lệ, không lỗi.

   ✅ **Đợt 3 cùng ngày — migrate nốt phần "còn lại" nêu trên sang v2**:
   viết lại toàn bộ `DestinationRepository.cs` (`GetListAsync`,
   `GetChildDestinationAsync`, `GetRelationDestinationAsync`, `GetTopListAsync`,
   `GetDesForHotelAsync`) đọc từ `v2.Destination` + join `DestinationTypeMap`/
   `DestinationType` (thay CSV Type) — dùng lại đúng pattern cache-RAM đã có
   (`SEARCH_INDEX_CACHE_KEY`), tận dụng cột `NameUnaccented` đã precompute sẵn
   ở v2 thay vì tính lại. Quan hệ cha-con dùng `ParentId` (self-join) thay
   `DestinationGroupId` CSV cũ. `/diem-den` (list), `/search`, trang chủ (top
   list), `destination-sitemap.xml` (dùng chung `GetListAsync` nên tự động ăn
   theo, không cần sửa riêng), `/map`, cross-ref `/khach-san/{id}` — TẤT CẢ
   giờ đọc v2. Test dev server thật, tất cả trả 200 đúng dữ liệu (VD `/diem-den`
   hiện đúng 25 nhóm = 17 tỉnh + 8 cụm; sitemap ghi đúng 272 URL).

   Phát hiện + sửa 1 bug thật khi test (không phải do đợt sửa này gây ra —
   đã có sẵn từ trước): `MapController.Index` gọi `GetListAsync(null)` nhưng
   hàm không null-guard `param` trước khi truy cập `param.q` → NRE. Đã thêm
   `param = param ?? new DestinationListParameter();` (cùng pattern
   `DestinationController.Search` đã dùng).

   ⚠️ **Cố ý CHƯA đụng** (ngoài phạm vi hợp lý của đợt này):
   - `GetDetailAsync` — nội dung chính (Content/OpeningTime/TicketPrice/Food/
     Transport/Tip/Hotel/Phone) vẫn đọc `dbo.DestinationDetail` — CÓ THỂ
     migrate sang `v2.DestinationContent` (đã có field tương ứng đầy đủ,
     `ContentHtml`/`HotelText`...) nhưng là 1 đợt riêng, rủi ro cao hơn (nội
     dung hiển thị chính, không chỉ field phụ) — để dành khi cần.
     **Xác nhận rủi ro cụ thể (07/2026)**: so `LEN()` của `Content` (v1) vs
     `ContentHtml` (v2) trên mẫu 5 dòng + đếm coverage 271/271 cả 2 bên —
     giống hệt nhau (v2 là bản mirror copy của v1 từ lần migrate trước, chưa
     rõ thời điểm). NHƯNG `CmsDiChoiThoi.Service/Repositories/Destination/
     DestinationRepository.cs` (CMS cũ) vẫn còn nguyên luồng import Google
     Sheet kiểu xoá-trắng-rồi-nạp-lại (`DeleteAllAsync`+`AddListAsync`+
     `AddDetailListAsync`) nhắm thẳng vào `dbo.Destination`/`DestinationDetail`
     (v1) — module Destination CMS cũ CHƯA tắt (kế hoạch tắt nằm ở Phase D
     mục 3, chưa tới). Nếu migrate `GetDetailAsync` sang v2 NGAY BÂY GIỜ:
     lần tới admin re-import từ Google Sheet qua CMS cũ sẽ ghi đè v1, v2
     đứng yên — website sẽ âm thầm hiện nội dung CŨ vĩnh viễn, không có lỗi
     nào báo hiệu. Kết luận: **giữ nguyên quyết định trì hoãn**, chỉ migrate
     khi module Destination CMS cũ đã tắt HOẶC M4 destination (Phase C) đã
     build xong và ghi thẳng vào v2 thay Google Sheet import.
   - Thiếu entity `V2DestinationRelation`/`V2SlugRedirect` — không cần tới vì
     dùng `ParentId` self-join thay thế được, nhưng nếu sau này muốn dùng
     đúng bảng quan hệ curated (`nearby`/`related`/`mentioned` — database-
     redesign §3.3) thì vẫn cần tạo 2 entity này.
   - ~~`/map` vẫn lỗi 500... bảng `Ad` KHÔNG tồn tại...~~ / ~~`/update-sitemap`
     lỗi 500 vì bảng `Phuot`...~~ → ✅ **ĐÃ XOÁ HẲN (đợt 5, theo yêu cầu người
     dùng "xóa Ad với phượt đi")**. Xác nhận phạm vi trước khi làm (AskUser-
     Question): người dùng chọn xoá hẳn khỏi code (không chỉ tắt 2 route lỗi),
     vì khảo sát cho thấy Ad/Phuot đang chạy thật trên nhiều trang khác
     (`/blog`, `/phuot`) — không phải code chết, tắt 2 chỗ lẻ tẻ sẽ để sót
     `/blog`+`/phuot` vẫn 500 cùng lỗi. Đã gỡ toàn bộ 2 tính năng khỏi
     `DiChoiThoi.Web`/`DiChoiThoi.Service`/`DiChoiThoi.Common` (entity,
     repository, service, model, parameter, enum, `AdUtils`, `_Ad.cshtml`,
     `PhuotController` + view, DI ở `Program.cs`, `DbSet`/modelBuilder ở
     `DiChoiThoiDbContext`/`TestDbContext`, nav link Footer, breadcrumb util,
     cache key) — build gặp lỗi vì `CmsDiChoiThoi.*` (CMS admin, project khác
     trong cùng solution) cũng tham chiếu entity `Phuot`/`PhuotDetail` (module
     quản lý Phượt qua Google Sheet import) nên phải gỡ tiếp bên đó để cả
     solution build sạch (không có Ad trong CMS, chỉ Phuot). Tiện thể sửa 1
     bug copy-paste có sẵn từ trước lộ ra khi gỡ: `CmsDiChoiThoi.Web/Views/
     Tour/Index.cshtml` có form search trỏ nhầm `asp-controller="Phuot"` (đáng
     lẽ "Tour") và include nhầm bundle JS `phuotList.js` — sửa cả hai vì nếu
     không sẽ vỡ khi Phuot bị xoá. Build cả `dichoithoi.sln` sạch (0 lỗi), test
     dev server thật: `/map`, `/map/{slug}`, `/update-sitemap`, `/diem-den`,
     trang chủ đều 200. Phát hiện thêm khi test `/blog`: lỗi 500 `Invalid
     object name 'Post'` — bảng `Post`/`PostDetail` (nội dung blog cũ) CŨNG
     không tồn tại trong `dichoithoi_dev`, CÙNG loại gap script clone như
     Ad/Phuot trước đây, không liên quan tới đợt xoá này — để ngoài phạm vi,
     ghi nhận thêm vào danh sách gap của `pnpm clone:dichoithoi`.

**Phase C — CMS zinoflow (các module, theo thứ tự phụ thuộc):**

⚠️ **SỬA LẠI TOÀN BỘ (07/2026)** — mục này TỪNG ghi "chưa xây", nhưng đó là
SAI: audit code thật (`apps/api/src/modules/*`, `apps/web/src/app/dichoithoi/*`,
git log) cho thấy phần lớn đã build xong từ trước (M4 Phase A/B/C, Phase
12-20 trong `dichoithoi-implementation-plan.md`) — tài liệu Phase C này chỉ
đơn giản KHÔNG được cập nhật sau khi việc đã xong (giống 2 lần phát hiện
tương tự trước đó trong phiên này: schema v2 "đã migrate từ trước", note
"người dùng tự làm" sai). **Từ nay coi `dichoithoi-implementation-plan.md`
(Phase 0-20, có gắn nhãn "ĐÃ XONG 07/2026") là nguồn sự thật cho "cái gì đã
xong", KHÔNG dùng mục Phase C này nữa.** Giữ lại bảng dưới chỉ để tra cứu
lịch sử + 2 gap thật còn sót:

| # | Việc | Trạng thái thật (audit 07/2026) |
|---|---|---|
| 1 | M4 destination: mirror + generate + review + publisher | ✅ XONG — `publish-destination.usecase.ts` UPSERT thẳng vào `v2.Destination`/`DestinationContent` qua `mssql-site-db.adapter.ts`, có auto-link + cache purge + RelatedJson. |
| 2 | Affiliate link conversion trước/cùng Hotel/Tour | ✅ XONG — module `affiliate/` đầy đủ, Hotel/Tour upsert gọi `ResolveAffiliateLinkUseCase` khi lưu. |
| 3 | Hotel+Tour+Product kèm pipeline ảnh (sharp/FTP) + import Google Sheet | 🔄 **BACKEND XONG (07/2026, đợt tự động)** — pipeline ảnh + Sheet import (dry-run/upsert/fallback) đều xong; chỉ còn thiếu trang web UI preview. Xem chi tiết ngay dưới bảng. |
| 4 | "Viết tay thủ công" (`sourceType=Manual`) trong `ai-content` | ✅ XONG — `create-manual-draft.usecase.ts`, đi qua đủ gate review/publish như bài AI. |
| 5 | Article: khối động + publisher + auto-link engine DÙNG CHUNG với destination | ✅ **XONG (07/2026, đợt tự động)** — xem chi tiết ngay dưới bảng. |
| 6 | UI Chủ đề (tag) + Coverage Score | ✅ **XONG (07/2026, đợt tự động)** — xem chi tiết ngay dưới bảng. Flight/Bus vẫn CHƯA XÂY (lý do dưới, spec tự ghi chưa chốt). |
| 7 | Khối "Việc cần làm" trên hub | ✅ XONG — `dashboard-home.tsx` có block `Card title="Việc cần làm"` + `get-dashboard-summary.usecase.ts`. |

**✅ Mục 5 — Auto-link Article (07/2026, tự động, không cần hỏi lại):**
`shared/text/auto-link.ts` (dọn từ `destination/domain/auto-link.ts`, dùng
chung 100% — không 2 bản sao) nối vào `PublishArticleUseCase` và
`RefreshDynamicBlocksUseCase` qua `ArticleAutoLinkService`
(`article/application/services/article-auto-link.service.ts`, inject
`DESTINATION_MIRROR_REPOSITORY` lấy danh sách điểm đến đã publish làm target).
Bài cẩm nang giờ tự chèn link nội bộ tới điểm đến được nhắc trong thân bài,
cùng engine/quy tắc với `publish-destination.usecase.ts`/`relink-all.usecase.ts`.
Build + test sạch (`article-auto-link.service.spec.ts` — 2 case: có link, bỏ
qua điểm chưa publish).

**🔄 Mục 3 — Pipeline ảnh Hotel/Tour/Product (07/2026, tự động — nửa đầu xong):**
- ✅ Đã xây: pipeline ảnh dùng chung (`shared/media/` — dọn từ `destination/`:
  `image-processor.port.ts`/`SharpImageProcessor`, `image-uploader.port.ts`/
  `FtpsImageUploader` nay nhận thêm `baseDirEnvVar` để mỗi module dùng 1 thư
  mục FTP gốc riêng — biến mới `DICHOITHOI_FTP_{HOTEL,TOUR,PRODUCT}_BASE_DIR`,
  không đổi hành vi cũ của destination). Thêm
  `IngestExternalImageUseCase` (`shared/media/application/`) — tải ảnh URL
  ngoài (Booking/Agoda/Shopee...) → validate content-type/kích thước → resize
  3 cỡ WebP → FTP, đúng destination-spec §14.5. Nối vào `UpsertHotelUseCase`/
  `UpsertTourUseCase`/`UpsertProductUseCase`: `thumbnailUrl`/`images` là URL
  http(s) thì tự ingest và thay bằng path nội bộ, giữ URL gốc ở cột mới
  `thumbnailSourceUrl`/`imageSourceUrls` (migration
  `1782000000000-HotelTourProductImageSourceUrls.ts`). Ingest lỗi → log cảnh
  báo + giữ tạm URL ngoài, KHÔNG chặn lưu bản ghi (never-block, đúng tinh
  thần "MVP trước" của hotel-spec/tour-spec §7). Test: `upsert-hotel.usecase.
  spec.ts` (3 case: ingest thành công/bỏ qua path nội bộ/ingest lỗi vẫn lưu
  được) + `ingest-external-image.usecase.spec.ts` (4 case biên: HTTP lỗi,
  sai content-type, ảnh quá nhỏ, thành công). Toàn bộ 266 test + typecheck
  API/web sạch.
  - Tour/Product áp y hệt logic Hotel (cùng pattern).
- ✅ **Đã xây tiếp (07/2026, cùng đợt tự động) — backend Sheet import cho cả
  3 module, theo đúng product-spec §5.1**:
  - `SHEET_CSV_FETCHER`/`GoogleSheetCsvFetcher` dọn từ `destination/` sang
    `shared/sheet-import/` (generic, không đổi hành vi — chỉ đổi vị trí file
    để Hotel/Tour/Product dùng chung mà không phải import cả `DestinationModule`
    nặng nề, riêng Product vốn không phụ thuộc Destination).
  - `shared/sheet-import/import-matcher.ts` (`matchImportRow` + test) — hàm
    thuần so khớp: `sourceUrl` trùng → `update`; không trùng nhưng
    tên-chuẩn-hoá + tỉnh trùng → `needsConfirm` (không tự ghi đè); không
    trùng gì → `create`. **Chỉ áp dụng khoá phụ cho Hotel/Tour** — Product
    CHỦ Ý bỏ qua khoá phụ (chỉ so `sourceUrl`) vì spec §5.1 chỉ ghi
    "áp dụng chung cho Hotel/Tour", sản phẩm không có địa lý để phân biệt,
    trùng tên hoàn toàn không đủ chắc chắn để tự gợi ý gộp — tránh gộp nhầm
    2 sản phẩm khác nhau cùng tên.
  - `ImportHotelsUseCase`/`ImportToursUseCase`/`ImportProductsUseCase` +
    contracts (`import{Hotels,Tours,Products}RequestSchema`/`...ResultSchema`
    trong `packages/contracts`) + endpoint `POST /hotels|tours|products/
    {fetch-sheet,import}` — cùng hình dạng response với destination (dry-run
    trả báo cáo create/update/needsConfirm/lỗi từng dòng, `dryRun=false` mới
    ghi thật; dòng `needsConfirm` CHỈ ghi khi client gửi kèm
    `confirmMergeIds[sourceUrl] = matchedId` đúng — không bao giờ âm thầm ghi
    đè bản ghi nhập tay trước đó). Test: `import-hotels.usecase.spec.ts` (4
    case) + `import-tours.usecase.spec.ts` (2 case) + `import-products.
    usecase.spec.ts` (2 case) + `import-matcher.spec.ts` (4 case). Toàn bộ
    278 test + typecheck API/web sạch.
- ✅ **XONG (07/2026, cùng đợt tự động) — trang web UI paste-link-Sheet cho cả
  3 module**: `apps/web/src/app/dichoithoi/{khach-san,tour,san-pham}/nhap/
  page.tsx` — dán link Google Sheet (hoặc CSV/JSON), gọi `POST .../fetch-sheet`
  rồi `POST .../import` với `dryRun:true` để xem trước từng dòng (badge Tạo
  mới/Cập nhật/Cần xác nhận + lý do), tick xác nhận riêng cho dòng
  `needsConfirm` (Hotel/Tour) rồi mới `dryRun:false` ghi thật — không bao giờ
  tự động gộp khi chưa tick. Product bỏ nhánh `needsConfirm` (đúng thiết kế
  backend). Phần parse CSV/JSON dùng chung qua
  `features/dichoithoi/sheet-import-csv.ts` (tách từ trang import destination
  có sẵn, tránh copy 3 lần), phần field/preview riêng từng module do khác
  field. Thêm link "Nhập từ Sheet →" trên 3 trang danh sách + route mới. Web
  typecheck + lint sạch.

**✅ Mục 6 — UI Chủ đề (tag) (07/2026, tự động, không cần hỏi lại):**
Xây đủ 3 bước destination-spec §2.4, đọc/ghi thẳng SQL Server (bảng
`v2.DestinationTag`/`DestinationTagMap` đã tạo + seed 7 tag từ trước qua
`phase-b-01-seed-tags.sql` — không cần mirror Postgres riêng, giống pattern
taxonomy group/type/province).
- Contracts: `packages/contracts/src/dichoithoi/destination-tag.ts` (tag,
  suggestion, apply, reverse-check, generate/update description).
- `dichoithoi-site-db.port.ts` + `mssql-site-db.adapter.ts` thêm
  `fetchTags`/`fetchTagAssignments`/`replaceTagAssignments`/
  `updateTagDescription`.
- Buoc 1 — `SuggestTagAssignmentsUseCase`: AI (Haiku, đi qua
  `IContentAIProvider` như mọi call AI khác) gợi ý tag cho các điểm CHƯA có
  tag nào (hoặc danh sách chỉ định), kèm `reasoning` 1 câu; lọc bỏ mọi
  slug tag/điểm đến AI bịa ra không có thật trước khi trả về — CHỈ gợi ý,
  không ghi DB.
- `ApplyTagAssignmentsUseCase`: ghi đè toàn bộ tag của từng điểm sau khi
  người dùng tick duyệt/bỏ trên UI.
- Buoc 2 — `ReverseCheckTagAssignmentsUseCase`: 2 loại phát hiện — "dưới
  ngưỡng" tính thuần (tag có <3 điểm gán, không cần AI) + "có thể gán sai"
  do AI đọc lại toàn bộ gán-tag hiện tại và chỉ ra cặp nghi ngờ (lọc bỏ cặp
  AI bịa không tồn tại thật).
- Buoc 3 — `GenerateTagDescriptionUseCase`: tái dùng `IContentAIProvider`
  soạn đoạn giới thiệu cho `/chu-de/{slug}`, CHỈ trả gợi ý; `UpdateTagDescriptionUseCase`
  lưu sau khi người dùng duyệt/sửa tay (cùng pattern `ManageTaxonomyContentUseCase`).
- Trang web `apps/web/src/app/dichoithoi/chu-de/page.tsx` (thêm mục sidebar
  "Chủ đề"): 4 khối — danh sách 7 tag (sửa/AI soạn mô tả), gợi ý AI hàng loạt
  kèm tick duyệt từng tag/điểm trước khi áp dụng, chạy rà soát ngược hiển thị
  badge theo mức độ, bảng tag đang gán (tham khảo).
- Test: 5 file usecase mới (10 test case) — toàn bộ 42 suite/288 test +
  typecheck API/web sạch.

**✅ Coverage Score (07/2026, tự động, không cần hỏi lại):** destination-spec
§2.2.2 tự ghi "trọng số/ngưỡng chốt lúc build, không chốt cứng ở spec" — nên
xây thẳng thay vì hỏi lại. Phạm vi ĐÃ làm (dùng đúng dữ liệu có thật trong
code, không bịa schema mới):
- Domain thuần `destination/domain/coverage-score.ts` (`computeCoverageScore`)
  — 10 mục checklist chung (địa chỉ/toạ độ/ảnh/nội dung chính/giờ mở cửa/giá
  vé/FAQ/mẹo thực tế/link vé/chủ đề) + 1 mục riêng tier "flagship" (có điểm
  con `IsFeatured`). Test 5 case.
- `mssql-site-db.adapter.ts` thêm `fetchContentCoverageRows()` — 1 câu SQL
  tính sẵn cờ cho TẤT CẢ điểm đã published (tránh N+1 query trên ~271 điểm).
- `GetCoverageScoresUseCase` gộp mirror Postgres (địa chỉ/toạ độ/ảnh/tag qua
  `fetchTagAssignments` đã có từ Tag UI/con `IsFeatured`) + cờ content SQL
  Server, tính điểm % cho từng điểm, sắp xếp điểm thấp trước (ưu tiên bổ
  sung). Endpoint `GET /destinations/coverage-scores`. Test 2 case.
- Trang web `apps/web/.../dichoithoi/do-phu` (thêm mục sidebar "Độ phủ nội
  dung") — danh sách badge % (đỏ/vàng/xanh theo mức), bấm mở rộng xem
  checklist ✅/⚠️ từng mục.
- **Phạm vi CHỦ Ý CẮT BỚT** (ghi rõ trong code/contracts, không giả vờ đã
  đủ): tier Flagship/POI chưa có cột `ContentTier` thật (spec ghi "gán tay"
  nhưng form chưa build) — tạm dùng `kind` làm proxy (poi↔poi,
  province/cluster↔flagship). 2 mục checklist Flagship-only trong spec CHƯA
  tính được vì thiếu hạ tầng: "lịch trình (khối B)" (không có field đánh dấu
  riêng) và "độ phủ bài cẩm nang theo topic" (`ArticleDestinationMap` —
  article-spec §8.1 — bảng quan hệ này chưa được xây, xây thêm sẽ là 1 tính
  năng lớn riêng, không lẫn vào Coverage Score).
- Test: 44 suite/295 test + typecheck/lint API+web sạch.

**❌ Flight/Bus — CHƯA làm (07/2026, quyết định có chủ ý, không phải quên):**
`dichoithoi-flight-spec.md`/`dichoithoi-bus-spec.md` tự ghi banner "⚠️ đây là
tài liệu PHÂN TÍCH — chưa chốt để build". Xây mù 1 thiết kế DB/UI cho thứ
chính spec của nó nói "chưa chốt" thì rủi ro làm sai hướng người dùng thật sự
muốn — để nguyên, chờ người dùng xem lại và chốt spec trước khi có đợt code
tiếp theo.

**Phase D — Website .NET (routes/views mới):**
1. Route/view: ~~Article `/blog/`~~, `/chu-de/{slug}`, khối Flight/Bus trên
   detail — ưu tiên theo SEO ROI (landing loại/tỉnh đã build Phase 18).
   **Sửa lại (07/2026)**: mục "`/blog/`" trong dòng này bị SAI — website đã có
   sẵn hệ bài cẩm nang v2 tại `/cam-nang/{slug}` (`ArticleController.cs`,
   entity `V2Article`), không phải `/blog` (đó là route legacy v1
   `BlogController` vẫn còn sống, không liên quan). Không tạo route `/blog`
   mới đè lên route legacy đang chạy.
   - ✅ **`/chu-de/{slug}` XONG (07/2026, đợt tự động)** — mirror đúng pattern
     `/tinh/{slug}` đã có (`ProvinceController`/`IDestinationTaxonomyService`/
     `IDestinationTaxonomyRepository`): thêm entity `V2DestinationTag`/
     `V2DestinationTagMap` (EF, đọc SQL Server, KHÔNG ghi — zinoflow ghi qua
     `mssql-site-db.adapter.ts`), `TopicDetailPageModel`, `GetTopicPageAsync`
     trong repo/service có sẵn (không tạo interface mới), `TopicController`
     (`Controllers/TopicController.cs`) + view `Views/Topic/Detail.cshtml`
     (dùng lại `_DestinationCardList`/`_Pagination` partial). Gate SEO đúng
     database-redesign §3.2.1: `Status != 1` → 404 (tag chưa duyệt/chưa mở);
     `Status == 1` nhưng thiếu `Description` HOẶC < 5 điểm gán → vẫn hiện
     trang bình thường nhưng thêm `noindex` (dùng `PageInfo.NoIndex` có sẵn,
     không phải cơ chế mới). `dotnet build` sạch (0 lỗi CS — chỉ có lỗi copy
     file do 1 tiến trình `DiChoiThoi.Web` cũ đang chạy giữ khoá DLL, không
     liên quan code, tắt tiến trình đó rồi build lại là hết).
   - **CHỦ Ý CHƯA làm**: (a) link "Chủ đề" trong mega-menu/footer — hoãn vì
     tag hiện chưa có điểm nào được gán qua Tag UI, đưa link vào menu chính
     lúc trang còn rỗng/`noindex` không có lợi, nên bật SAU khi đã gán tag
     thật; (b) chip tag trên trang chi tiết điểm đến (destination-spec §2.4
     có nhắc) — cần sửa `DestinationDetailModel`/`DestinationController`/
     repository liên quan, phạm vi lớn hơn 1 trang mới nên tách việc riêng;
     (c) khối Flight/Bus trên trang chi tiết — vẫn chờ chốt spec như đã ghi.
2. Faceted search — hợp nhất `/diem-den` + `/search` (§9.3): đợt 1 facet
   Tỉnh/Khu vực/Loại; facet Chủ đề bật khi tag đã seed.
   **✅ Phần lõi XONG (07/2026, đợt tự động)** — `DestinationController.Index`
   (`/diem-den`) nay là trang Khám phá duy nhất: `q` + 3 facet Tỉnh/thành,
   Khu vực (cụm — node `Kind=Cluster`), Loại (OR trong nhóm, VÀ giữa nhóm),
   đếm số cạnh từng lựa chọn (tính theo điều kiện các nhóm KHÁC đang chọn,
   đúng ngữ nghĩa faceted search chuẩn), chip đã-chọn + "Xoá hết", banner
   "Xem trang đầy đủ" khi chọn đúng 1 facet Tỉnh hoặc Khu vực, phân trang
   (`_Pagination.cshtml` sửa để nối `&trang=` khi base path đã có query
   string — sửa chung, không hỏng các trang cũ vốn không có query string).
   `/search` → 301 sang `/diem-den` giữ nguyên querystring (dọn luôn bug `q`
   rỗng bỏ dở cũ). SEO: không tham số = index bình thường; có
   `q`/facet = `noindex, follow`. Mở rộng search-index thêm tỉnh + địa chỉ
   không dấu (sửa lỗi "gõ Lâm Đồng bị trượt"). Đã test qua HTTP thật (dry-run
   dev server, không phải chỉ đọc code): lọc 1 facet, lọc 2 facet cùng lúc
   (AND đúng), banner single-facet, noindex, `/search` redirect, phân trang
   giữ facet, `/map`/`/tinh/{slug}` (dùng chung search-index) không bị ảnh
   hưởng — đều đúng. `dotnet build` toàn solution sạch.
   **CHỦ Ý CHƯA làm (đợt 2, ghi rõ tránh hiểu nhầm đã xong 100% §9.3)**:
   (a) live-count-instant-client-filter (đổi kết quả ngay khi tick, không
   cần load lại trang) — hiện MỖI facet click là 1 lần điều hướng URL mới
   (vẫn đúng UX cơ bản, hoạt động không cần JS, nhưng chưa "tức thì" như
   spec §9.3 mục 2 yêu cầu — cần 1 index JSON nhỏ đổ xuống client + JS lọc,
   việc này rủi ro/kích cỡ lớn hơn hẳn phần đã làm nên tách đợt sau);
   (b) autocomplete ô tìm kiếm header (dropdown 8 gợi ý) — form header vẫn
   là submit thường về `/diem-den`, chưa có dropdown/API gợi ý riêng;
   (c) banner "Xem trang đầy đủ" cho facet Loại đơn lẻ — thiếu slug nhóm
   (`GroupSlug`) trong index hiện tại, cần thêm 1 lookup nữa, để lại tránh
   phình thêm phạm vi; (d) bottom-sheet mobile thật — tạm dùng `<details>`
   disclosure (hoạt động tốt, đúng nội dung, nhưng khác animation/UX
   bottom-sheet spec mô tả); (e) facet Chủ đề (tag) — đúng như spec ghi,
   đợi tag được gán qua Tag UI trước.
3. Tắt module Destination + Hotel + Tour trên CMS cũ. ❌ CHƯA làm — đây là
   việc tắt chức năng admin đang chạy thật (`CmsDiChoiThoi.Web`), nên hỏi lại
   trước khi làm thay vì tự ý tắt.

**Phase E — PILOT kiểm thử end-to-end: Đà Lạt (Flagship) + Biệt Thự Hằng Nga
(POI) với FULL dữ liệu** (yêu cầu 07/2026 — chạy SAU khi Phase B-D xong;
người dùng sẽ RA LỆNH khi tới lúc, không tự khởi động). Mục tiêu: 2 trang
mẫu đầy đủ mọi khối đã thiết kế (article gắn topic, vé xe/máy bay,
hotel/tour/product, tag chủ đề, coverage score đạt ngưỡng...) để duyệt chất
lượng trước khi scale. Claude làm giúp, KHÔNG cần người dùng tự tạo/tự viết:
    a. **Rà + tự tạo dữ liệu còn thiếu** cho 2 điểm: chạy checklist Coverage
       Score (destination-spec §2.2.2), field nào thiếu thì Claude tự điền
       bằng suy luận + tra cứu thật — field SỰ THẬT (giá vé, giờ mở cửa,
       địa chỉ, SĐT) phải lấy từ nguồn thật (website chính thức qua cơ chế
       §2.2.1, Google Maps), KHÔNG bịa; field nội dung (mô tả, ghi chú tham
       khảo) dùng kiến thức thật của Claude. Mọi thứ ghi ở trạng thái
       nháp/chờ duyệt.
    b. **Viết sẵn bộ bài cẩm nang mặc định** cho 2 điểm (đủ các topic
       article-spec §8.1: lịch trình, ẩm thực, quà lưu niệm, buổi tối,
       poi-guide...) qua pipeline ai-content → dừng ở trạng thái CHỜ DUYỆT,
       người dùng chỉ việc review/sửa/approve — không tự publish.
    c. **Ảnh còn thiếu: tự tìm → tải → cập nhật**, NHƯNG chỉ từ nguồn giấy
       phép an toàn (Wikimedia Commons, Flickr CC, Unsplash... — ghi rõ
       nguồn + license vào caption/credit `destination_images` §14.4);
       KHÔNG lấy ảnh bản quyền báo chí/blog cá nhân. Ảnh nào không tìm được
       nguồn sạch → liệt kê ra cho người dùng tự chụp/tự tạo. Ảnh vào DB ở
       trạng thái chờ duyệt trước khi lên web.
    d. Kết thúc pilot: báo cáo 2 trang đạt bao nhiêu % coverage, mục nào
       còn chờ người dùng quyết — làm chuẩn mẫu (playbook) để scale các
       điểm còn lại.

**Phase F — Scale sau pilot**: trước khi nhân rộng playbook ra các điểm còn
lại, build **gate "originality"** (mục 0 đầu tài liệu — so trùng lặp nội bộ
giữa các bài cùng loại/tỉnh) — pilot 2 trang chưa cần, scale hàng trăm trang
thì bắt buộc, đúng rủi ro "scaled content abuse" đã phân tích.

**SEO/UX đi kèm** (`content-seo-ux-plan.md` §7, đã sắp ưu tiên):
- Cao: bật lại Review/Rating + JSON-LD AggregateRating; render FAQ + JSON-LD
  FAQPage; trang landing Loại+Tỉnh; SSR khối khách sạn/tour giữa bài (không AJAX).
- Trung bình: gallery ảnh (`GalleryJson` + bảng `destination_images`); bản đồ
  nhúng; `rel=sponsored` + disclosure; render `ticketLinks[]` thành nhiều nút.
- Sau: mini lịch trình; so sánh giá tại quầy vs online; sitemap.xml + Search
  Console; critical CSS cho LCP; phân trang `/diem-den` có URL riêng từng trang.
- **Faceted search — hợp nhất `/diem-den` + `/search` thành trang Khám phá**
  (CHỐT 07/2026, thiết kế đầy đủ `content-seo-ux-plan.md` §9.3): facet
  Tỉnh/Khu vực/Loại (+Chủ đề đợt 2), tick nhiều — OR trong nhóm, AND giữa
  nhóm, đếm số sống, lọc client-side tức thì, autocomplete header,
  `/search` 301 về `/diem-den?q=`; có tham số = noindex. Repo dichoithoi (.NET).
  **Cập nhật 07/2026 (đợt 2, phần 1/2 đã xong)**:
  - ✅ Autocomplete header: `GET /api/search-suggest?q=` (tái dùng search-index
    RAM có sẵn), dropdown JS thuần (`nav.ts`, debounce 250ms, phím mũi tên/
    Enter/Escape, bấm ra ngoài đóng) tối đa 8 gợi ý (tên+tỉnh+loại+thumbnail),
    bấm 1 dòng đi thẳng `/diem-den/{slug}`, dòng cuối "Xem tất cả kết quả →"
    mới đổ về `/diem-den?q=`. Đã smoke-test qua Playwright (dropdown hiện đúng,
    click điều hướng đúng, không còn lỗi 404 ảnh — bug thumbnail thiếu tiền tố
    `/diem-den/thumbnail/` phát hiện + sửa ngay lúc test bằng trình duyệt thật).
  - ✅ Banner landing cho facet Loại đơn lẻ: `DestinationService.GetFacetedSearchAsync`
    tra `GroupSlug` qua `ITaxonomyService.GetAllTypesAsync()` (đã cache sẵn từ
    Phase 18.0, không thêm query) để tính `/loai/{group}/{type}` — trước đây
    chỉ có Tỉnh/Khu vực có banner, thiếu Loại. Verify qua curl thật:
    `?loai=thac-ho-suoi` → banner `/loai/thien-nhien/thac-ho-suoi` (200 OK).
  - ⏳ **Còn lại (đợt 2, phần 2/2 — CHƯA làm, rủi ro cao hơn nên tách riêng)**:
    (a) live client-side instant filter (đổ JSON index xuống client, lọc tức
    thì không reload trang — hiện mỗi lần tick facet vẫn là 1 lần điều hướng
    URL đầy đủ); (b) mobile bottom-sheet thật (đang dùng `<details>` thay thế).
    Cả 2 đòi hỏi viết lại đáng kể phần JS render kết quả — cân nhắc làm riêng
    1 phiên, kiểm thử kỹ trên trình duyệt thật trước khi ship lên production.
  - Facet Chủ đề vẫn chờ tag được gán qua Tag UI (không đổi so với trước).

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
