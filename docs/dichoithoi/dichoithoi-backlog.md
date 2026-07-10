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
1. Migration schema v2 (`database-redesign.md` §7) — **chạy trên bản clone
   LocalDB trước** (`pnpm clone:dichoithoi`), KHÔNG chạy thẳng production.
   Gộp output Phase A: seed `DestinationTag`/`TagMap`, sửa `TypeMap`, cột +
   dữ liệu `AddressNew`/`AddressOld`.
2. Website .NET đọc schema mới (repo dichoithoi, song song).

**Phase C — CMS zinoflow (các module, theo thứ tự phụ thuộc):**
1. M4 destination: mirror + generate + review + publisher.
2. Cơ chế affiliate link conversion — TRƯỚC hoặc CÙNG Hotel/Tour (cả 2 phụ
   thuộc `provider/sourceUrl/affiliateUrl/linkStatus`).
3. Hotel + Tour + Product, **KÈM CÙNG ĐỢT**: pipeline ảnh (tab Ảnh §14.3 +
   ingest ảnh URL ngoài §14.5 — sharp/FTP) và import Google Sheet
   (product-spec §5.1) — sheet import PHỤ THUỘC pipeline ảnh, không tách rời.
4. Năng lực "Viết tay thủ công" ở lõi `ai-content` (`sourceType=Manual` —
   article-spec §1.1) — TRƯỚC hoặc CÙNG Article.
5. Module Article: khối động + publisher + **1 engine auto-link DÙNG CHUNG**
   (re-link nội dung destination §12.2 VÀ auto-link compile bài §8.2 — build
   1 lần, 2 nơi gọi, không 2 bản sao) + bổ sung prompt mặc định `cam-nang.*`
   (gap Phase 8 đã ghi nhận — điều kiện chặn của generate Article).
6. UI Chủ đề (tag) §2.4 (màn quản lý + gán hàng loạt AI gợi ý) + Coverage
   Score §2.2.2 + Flight/Bus (2 màn quản lý theo flight/bus-spec §5).
7. Khối "Việc cần làm" trên hub §7.2 — CUỐI Phase C (tổng hợp cảnh báo từ
   mọi nguồn ở trên, nguồn phải tồn tại trước).

**Phase D — Website .NET (routes/views mới):**
1. Route/view: Article `/blog/`, `/chu-de/{slug}`, khối Flight/Bus trên
   detail — ưu tiên theo SEO ROI (landing loại/tỉnh đã build Phase 18).
2. Faceted search — hợp nhất `/diem-den` + `/search` (§9.3): đợt 1 facet
   Tỉnh/Khu vực/Loại; facet Chủ đề bật khi tag đã seed.
3. Tắt module Destination + Hotel + Tour trên CMS cũ.

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
