# Dichoithoi — Chiến lược nội dung, SEO & UI/UX trang điểm đến (viết mới 07/2026)

Tài liệu này trả lời câu hỏi: **trang điểm đến cần có gì để đầy đủ nhất cho người
đọc, tốt nhất cho SEO, và kiếm tiền hiệu quả nhất** — dựa trên hiện trạng đã audit
([dichoithoi-web-page-audit.md](dichoithoi-web-page-audit.md)) và data model đã
thiết kế ([dichoithoi-destination-spec.md](dichoithoi-destination-spec.md),
[dichoithoi-database-redesign.md](dichoithoi-database-redesign.md)). Khác với 2 tài
liệu đó (mô tả hiện trạng / thiết kế backend), đây là tài liệu **định hướng sản
phẩm + UI/UX**, dùng khi viết lại website — được phép đập đi xây lại phần hiển thị,
KHÔNG bắt buộc giữ layout cũ.

## 0) Mục tiêu sản phẩm (chốt theo yêu cầu 07/2026)

**Vai trò trang điểm đến**: cung cấp đủ thông tin để người đọc quyết định và thực
hiện 1 chuyến đi — không chỉ "có bài viết hay", mà phải trả lời hết các câu hỏi
thực tế: địa chỉ (cũ + mới), giá vé, giờ mở cửa, tổng quan, điểm liên quan, ăn
uống, kinh nghiệm, chỗ ở.

**3 kênh kiếm tiền** (đã có trong data model, cần khai thác đủ ở UI):
1. Đặt phòng khách sạn — module Hotel ([dichoithoi-hotel-spec.md](dichoithoi-hotel-spec.md)).
2. Đặt vé vào cổng — qua `ticketLinks[]` (nhiều nhà cung cấp cùng lúc:
   Klook, TripVision, BestPrice... — quyết định 07/2026, xem
   [dichoithoi-destination-spec.md](dichoithoi-destination-spec.md) §2.3).
3. Đặt tour — module Tour, gắn vào điểm đến này hoặc điểm liên quan
   ([dichoithoi-tour-spec.md](dichoithoi-tour-spec.md)).

Cả 3 kênh dùng chung cơ chế "chỉ nhập link gốc, tự sinh link affiliate theo rule"
([dichoithoi-affiliate-link-conversion-spec.md](dichoithoi-affiliate-link-conversion-spec.md)).

**Thứ tự ưu tiên khi có xung đột thiết kế**: SEO > tốc độ tải > thẩm mỹ. Trong
thực tế 3 cái này thường CÙNG CHIỀU chứ không đối lập — ảnh nhẹ + ít JS + cấu trúc
rõ ràng vừa nhanh vừa dễ Google hiểu vừa dễ đọc. Chỉ khi phải đánh đổi thật (vd
hiệu ứng động, font đẹp nhưng nặng) thì bỏ thẩm mỹ trước.

## 1) Khung nội dung đầy đủ cho 1 trang điểm đến

Cột "Trạng thái" đối chiếu với data model đã có (destination-spec §2.2, §4;
database-redesign §4.3) và audit (mục 3 — "Thiếu hoàn toàn").

| Khối nội dung | Trạng thái | Ghi chú |
|---|---|---|
| Tổng quan / giới thiệu | Đã có (ContentHtml intro) | |
| Địa chỉ mới + cũ | Đã có (AddressNew/AddressOld, spec §13) | |
| Giờ mở cửa & giá vé | Đã có (OpeningTime/TicketPrice) | phải hiện NỔI BẬT, không chôn giữa bài — xem §2 |
| Vị trí & di chuyển | Đã có (Transport + Lat/Lng) | **thiếu bản đồ nhúng** — xem dưới |
| Trải nghiệm / chơi gì | Đã có (sections trong Content) | |
| Ăn uống | Đã có (Food) | |
| Thời điểm đẹp | Đã có (1 section trong Content) | |
| Lưu trú / khách sạn | Đã có (HotelText + `HotelDestinationMap` → module Hotel) | Module Hotel chuyển về zinoflow làm CMS (cào/nhập tay), chỉ hiển thị dạng card gợi ý, KHÔNG có trang riêng — xem [dichoithoi-hotel-spec.md](dichoithoi-hotel-spec.md). Audit: hiện SSR sau (AJAX), nên fix (xem §3) |
| **Tour gợi ý** | MỚI (module Tour, quyết định 07/2026) | Card gợi ý tour đi qua điểm đến này HOẶC điểm liên quan, KHÔNG có trang riêng — xem [dichoithoi-tour-spec.md](dichoithoi-tour-spec.md) |
| Mẹo & lưu ý | Đã có (Tip) | |
| FAQ | Đã có (FaqJson, render JSON-LD FAQPage) | website hiện CHƯA render — cần làm khi viết lại |
| Điểm đến liên quan | Đã có (RelatedJson precompute) | |
| CTA mua vé online | Đã có (`ticketLinks[]`, nhiều nhà cung cấp) | render 1 nút/dòng, xem §2 |
| **Review & rating khách** | Có schema (`DestinationReview`, `AvgRating`/`ReviewCount`) NHƯNG code fetch đang bị comment out trên website hiện tại (audit) | **Phải bật lại** — social proof quan trọng nhất cho quyết định đặt khách sạn/vé, và cho JSON-LD `AggregateRating` (rich snippet sao vàng trên Google) |
| **Gallery ảnh** | THIẾU — hiện chỉ 1 ảnh hero | Đề xuất mới, xem §5.1 |
| **Bản đồ nhúng** | THIẾU — có Lat/Lng nhưng không render trực quan | Đề xuất: embed tĩnh + nút "Chỉ đường" mở Google Maps app, xem §2 |
| Mini lịch trình ("nên ở lại bao lâu", "kết hợp đi với") | Chưa có ý tưởng này trong spec | Đề xuất mới §5.2 — tăng dwell time + internal link |
| So sánh giá tại quầy vs mua online | Chưa có | Đề xuất nhỏ §5.3 — tăng động lực bấm CTA |

Nguyên tắc: khối nào không áp dụng cho điểm đến cụ thể (vd điểm miễn phí không có
giá vé, điểm nhỏ không cần bản đồ riêng vì đã ở trong 1 cluster có bản đồ) thì ẩn
rõ ràng, không để trống giữa trang — giữ nguyên nguyên tắc structure gate đã có ở
destination-spec §6.1.

## 2) Bố cục trang chi tiết — thứ tự & vị trí CTA kiếm tiền

Trang hiện tại chỉ có 1 cột dọc, "khách sạn giá rẻ" luôn hiện ở gần cuối và load
rỗng chờ AJAX (audit mục 3). Đề xuất bố cục lại theo hành vi đọc thật (F-pattern —
phần lớn người đọc bỏ dở giữa bài), CTA phải xuất hiện SỚM và LẶP LẠI, không chỉ
ở cuối:

```
┌─ Hero: gallery ảnh (không chỉ 1 ảnh) + H1 + badge loại + ⭐ rating (nếu có)
├─ [Mobile: thanh CTA dính đáy màn hình]  [Desktop: sidebar dính bên phải]
│    → Giờ mở cửa · Giá vé · [Nút(s): Mua vé qua Klook/TripVision/... →ticketLinks] · Địa chỉ (mới/cũ)
│      + [Nút: Chỉ đường] · Điện thoại (click-to-call)
├─ Tổng quan / giới thiệu
├─ Bản đồ nhúng + khoảng cách trung tâm (ngay sau tổng quan — quyết định "có đi được không")
├─ Trải nghiệm / chơi gì
├─ ► Banner "Khách sạn gần {Tên}" (giữa bài, SSR — không AJAX) — điểm CTA thứ 2
├─ Ăn uống gần đó
├─ Thời điểm đẹp
├─ Di chuyển
├─ ► Card "Tour gợi ý" (nếu có tour gán tới điểm này/điểm liên quan) — điểm CTA thứ 3
├─ Mẹo & lưu ý
├─ FAQ (accordion, JSON-LD FAQPage)
├─ Review & rating khách (hiện avg + list + form gửi review)
├─ Điểm đến liên quan (8 thẻ, RelatedJson)
└─ Dòng disclosure affiliate (1 dòng, cuối trang)
```

Lý do đặt banner khách sạn/tour GIỮA bài thay vì chỉ cuối: đây là hành động kiếm
tiền quan trọng nhất của trang, không nên phụ thuộc việc người đọc cuộn hết bài
mới thấy. Sidebar/CTA dính cũng phục vụ mục đích này cho vé — luôn trong tầm mắt.

## 3) Kiếm tiền — nguyên tắc & việc kỹ thuật cần làm

1. Mọi link affiliate (`affiliateUrl` của từng dòng `ticketLinks[]`, mỗi khách
   sạn, mỗi tour — tính sẵn qua
   [dichoithoi-affiliate-link-conversion-spec.md](dichoithoi-affiliate-link-conversion-spec.md))
   gắn `rel="sponsored noopener"` (Google yêu cầu để không truyền PageRank cho
   link trả tiền, tránh bị coi là link scheme thao túng SEO).
2. 1 dòng disclosure ngắn ở footer/cuối bài: "Dichoithoi có thể nhận hoa hồng khi
   bạn đặt vé/phòng/tour qua liên kết trên trang, không phát sinh thêm phí cho
   bạn." — minh bạch với người đọc, tuân thủ chính sách các mạng affiliate.
3. CTA giữa bài (khách sạn, tour) phải **SSR cùng lúc với query trang detail**
   (audit đã ghi nhận đây là vấn đề Nhóm B cho khối khách sạn: hiện tại AJAX
   sau load → rỗng với crawler và người đọc thấy layout shift; áp dụng nguyên
   tắc này luôn cho khối tour mới để không lặp lại lỗi cũ). Đây là việc ưu tiên
   cao khi viết lại.
4. Text CTA trung thực, không cam kết tuyệt đối ("rẻ nhất", "duy nhất") — đã là
   quy tắc quality gate của AI tool (destination-spec §2.3, §6.3); áp dụng luôn cho
   copy tĩnh trong template UI (nút, banner) chứ không chỉ nội dung AI sinh.
5. Giá vé hiện là text tự do (`TicketPrice nvarchar(512)`) — đủ cho hiển thị nhưng
   không đủ cho JSON-LD `offers`/`priceRange` (rich snippet giá trên Google). Đề
   xuất thêm 1 field số riêng, tuỳ chọn: `TicketPriceFrom` (decimal, NULL nếu giá
   không quy về 1 con số được, vd giá theo gói) — giữ `TicketPrice` text cho hiển
   thị linh hoạt, chỉ dùng field số cho structured data khi có.

## 4) SEO — checklist tổng hợp

### 4.1 Đã làm (theo audit, Nhóm A hoàn thành 07/2026)
canonical self-reference, `robots noindex` cho `/search`, ảnh `loading="lazy"` +
khoá tỉ lệ khung hình, JSON-LD `Organization`/`WebSite`/`TouristAttraction` (bật
lại + sửa bug off-by-one), `ItemList` cho `/diem-den` và `/search`, breadcrumb có
gốc "Trang chủ", title/description template phong phú hơn, gộp cache TTL, sửa link
chết, bỏ `async` sai trên CSS + thêm `defer` cho JS.

### 4.2 Cần làm khi viết lại (mới, ngoài audit hoặc thuộc Nhóm B đã ghi nhận)
1. **JSON-LD `AggregateRating` + `Review`** — cần bật lại review trước (mục §1).
2. **JSON-LD `FAQPage`** từ `FaqJson` — data đã có, website chưa render.
3. **Trang landing theo loại (2 tầng) và theo tỉnh** — đây là gap SEO long-tail
   lớn nhất: schema mới đã có `DestinationTypeGroup`/`DestinationType`/`ProvinceId`
   (database-redesign §3.2, §4.1, §4.4 — cập nhật 07/2026 thành 2 tầng nhóm/loại)
   nhưng audit không thấy trang loại/tỉnh nào tồn tại trên website hiện tại.
   Cấu trúc silo: `/loai/{groupSlug}` (trang nhóm, vd "Thiên nhiên" — pillar,
   gộp mọi loại con) → `/loai/{groupSlug}/{typeSlug}` (trang loại cụ thể, vd
   "Sông - suối - hồ - thác" — cluster) → bài điểm đến. Không có trang landing
   = mất toàn bộ traffic tìm kiếm dạng "địa điểm thiên nhiên ở Quảng Ninh", "sông
   suối đẹp miền Bắc", "kiến trúc cổ Việt Nam"... Đây là việc SEO có ROI cao
   nhất khi viết lại UI, vì data đã sẵn sàng, chỉ thiếu route + view. Nav chính
   của website cũng nên có menu 3 nhóm (Thiên nhiên / Văn hóa - Lịch sử / Vui
   chơi - Trải nghiệm) trỏ tới 3 trang pillar này, giúp người dùng vào thẳng
   theo cách họ nghĩ ("muốn đi chỗ tự nhiên") thay vì chỉ tìm theo tên/tỉnh.
4. **Sitemap.xml động** (theo `UpdatedAt`) + kiểm tra đã submit Google Search
   Console chưa — audit chưa xác nhận trạng thái hiện tại, cần rà khi viết lại.
5. **Core Web Vitals ngoài ảnh**: SSR khối khách sạn (§3.3), giảm JS không module
   hoá (`common.js`), `font-display: swap` nếu dùng web font, preconnect tới CDN
   ảnh nếu bật Cloudflare (đã đề cập ở destination-spec §14.2).
6. **Internal linking từ trang landing mới**: breadcrumb thêm cấp Tỉnh/Loại khi
   các trang này ra đời; card trên landing dùng anchor text = tên điểm (đã tốt ở
   related/child hiện tại, giữ nguyên pattern).
7. **Bài cẩm nang tổng hợp** (`dichoithoi-article-spec.md`, mới 07/2026) — loại
   bài "Các con thác đẹp tại Việt Nam", "Khách sạn đẹp tại Đà Lạt", "1 ngày ở
   TP.HCM đi đâu ăn gì" bổ sung tầng silo còn thiếu: landing `/loai/...` liệt kê
   THUẦN TUÝ theo taxonomy, còn bài cẩm nang là nội dung biên tập tự nhiên
   (search intent informational) NHÚNG SẴN card điểm đến/hotel/tour qua "khối
   động" — vừa phủ thêm từ khóa dài, vừa tăng internal link tới bài điểm đến mà
   không cần viết tay danh sách.

## 5) Đề xuất bổ sung mới (chưa có trong spec/schema hiện tại)

### 5.1 Gallery ảnh (mở rộng ý §14.4 của destination-spec)
Spec ảnh hiện tại (destination-spec §14) đã thiết kế bảng `destination_images`
cho watermark/caption ở giai đoạn 2 — đề xuất dùng LUÔN bảng đó làm nguồn cho
gallery hiển thị trên trang (không chỉ metadata phụ): 4-8 ảnh dưới hero, dạng
lưới hoặc carousel nhẹ (CSS-only, không kéo thêm thư viện JS nặng), mỗi ảnh có
alt text riêng từ DB. Đây là khối nội dung thiếu rõ nhất theo audit (100% điểm
đến hiện chỉ có 1 ảnh).

### 5.2 Mini lịch trình / gợi ý kết hợp
Thêm 1 khối ngắn cuối phần "Trải nghiệm": "Nên dành bao lâu ở đây" (nửa buổi/1
ngày...) + "Kết hợp đi với" (link tới 2-3 điểm trong RelatedJson/nearby, có sẵn
data). Mục tiêu: tăng thời gian đọc + số trang/phiên (tín hiệu dwell time tốt cho
SEO) và tăng cơ hội chuyển đổi ở các bài liên quan. AI tool có thể sinh khối này
cùng lúc generate bài (thêm 1 field ngắn vào output schema §4 destination-spec nếu
duyệt) hoặc để giai đoạn sau.

### 5.3 So sánh giá tại quầy vs mua online
Khi có ≥1 `ticketLinks[]` VÀ `TicketPrice`, hiển thị gợi ý ngắn kiểu "Giá tại quầy: X —
đặt online có thể rẻ hơn/tránh xếp hàng" cạnh nút CTA. Chỉ hiện khi có cả 2 nguồn
dữ liệu, không suy diễn nếu thiếu (đúng nguyên tắc "AI không bịa dữ liệu cứng").

### 5.4 Chi phí ước tính cho 1 chuyến (đề xuất 07/2026, phân tích vai khách du lịch)
Gộp dữ liệu ĐÃ CÓ (`TicketPriceFrom`, `Hotel.PriceFrom` thấp nhất trong card gợi ý,
`Tour.PriceFrom` thấp nhất) thành 1 dòng tổng "Chi phí tham khảo: từ ~X đ/người"
hiển thị gần đầu trang (cạnh giá vé) — trả lời câu hỏi đầu tiên của khách: "đi
chuyến này tốn khoảng bao nhiêu". **Không cần cột DB mới** — tính lúc render ở
website (cộng các `PriceFrom` đang đọc sẵn), giống cách tính bên `dichoithoi-flight-
spec.md`/`dichoithoi-bus-spec.md` không cần trang riêng. Chỉ hiện khi có ≥1 nguồn
giá thật (không suy diễn nếu thiếu, đúng nguyên tắc §3.5 destination-spec).
**Nhập ở zinoflow**: không nhập gì cả — không có field/form nào trong màn sửa
điểm đến cho mục này, chỉ là công thức tính lúc render ở website từ các
`PriceFrom` đã có sẵn.

### 5.5 Giá vé — 2 NGUỒN khác nhau, không gộp làm 1 (đề xuất 07/2026, sửa sau khi
trao đổi với chủ dự án)

Giá vé tham quan thực ra có 2 nguồn dữ liệu khác bản chất, cần tách rõ:

**(a) Giá cố định chính thức** — do chính điểm đến quy định (giá vé người lớn/
trẻ em/sinh viên/người cao tuổi niêm yết tại cổng), admin/AI tool tự nhập/cập
nhật khi biết thông tin mới, KHÔNG qua affiliate. `TicketPrice` hiện là 1 chuỗi
text tự do ("50.000đ/người") — không đủ khi khách hỏi giá theo từng đối tượng.
Đề xuất thêm field cấu trúc `PriceBreakdownJson` dạng `[{audience, price, note}]`
(vd `{audience:"Người lớn", price:50000}`, `{audience:"Trẻ em 6-12 tuổi",
price:25000}`) — hiển thị dạng bảng nhỏ ngay dưới `TicketPrice` khi có dữ liệu,
ẩn hoàn toàn khi không có (không suy diễn giá theo tỷ lệ). CẦN cột DB mới
(`DestinationContent.PriceBreakdownJson`, database-redesign §4.3) — chưa build.
**Nhập ở zinoflow**: nhập tay hoàn toàn trong màn sửa điểm đến (thêm 1 khối
"Giá vé theo đối tượng" — bảng {đối tượng, giá, ghi chú}, thêm/xoá dòng tự do).
AI KHÔNG được tự sinh/đoán số này — đây là số liệu chính thức của điểm đến,
sai là sai tiền thật của khách.

**(b) Giá theo từng nhà cung cấp booking** — đã có sẵn cơ chế `ticketLinks[]`
(§2.3 destination-spec, mỗi dòng 1 nhà cung cấp như Klook/TripVision) nhưng
HIỆN CHƯA có field giá riêng cho từng link — chỉ có
`{provider, label, sourceUrl, affiliateUrl, linkStatus}`. Đề xuất thêm field
`price` TUỲ CHỌN vào item schema đó (nullable — nhiều nhà cung cấp không hiện
giá trước khi bấm vào link ngoài), để mỗi nút "Đặt vé qua {provider}" có thể
hiện kèm giá tham khảo của riêng nhà đó. CẦN sửa `affiliateLinkItemSchema`
(`packages/contracts/src/dichoithoi/affiliate.ts`) + cột `TicketLinksJson`
(cùng cấu trúc, database-redesign §4.3) — chưa build. Xem thêm ghi chú ở
`dichoithoi-affiliate-link-conversion-spec.md`.
**Nhập ở zinoflow**: nhập tay, thêm 1 ô "Giá tham khảo" vào form "Link vé tham
quan" đã có sẵn (cùng chỗ nhập `sourceUrl`) — tuỳ chọn, để trống nếu nhà cung
cấp không hiện giá trước khi bấm link ngoài.

**Hệ quả cho §5.3 (so sánh giá tại quầy vs online)**: khi có (a) và (b) cùng
lúc, so sánh nên đổi từ "TicketPrice text vs có ticketLinks hay không" sang so
sánh CỤ THỂ giữa `PriceBreakdownJson` (giá tại quầy) và `ticketLinks[].price`
theo từng nhà cung cấp (giá online) — chính xác hơn bản đang chạy (chỉ so
sánh định tính, không có 2 con số thật để đối chiếu).

### 5.6 Câu chuyện văn hoá - lịch sử (đề xuất 07/2026)
Khối "ai cũng cần" đã có sẵn trong khung nội dung (destination-spec §2.2, dòng
"Thời điểm đẹp") nhưng KHÔNG có mục kể chuyện/truyền thuyết — đây là phần tạo cảm
xúc, khác hẳn dữ liệu khô khan (giờ mở cửa, giá vé), và là đòn bẩy E-E-A-T thật sự
(§8.5) chứ không chỉ nhồi từ khoá. Đề xuất: thêm 1 section bắt buộc trong prompt
pack AI ("Câu chuyện/ý nghĩa văn hoá - lịch sử của {tên điểm đến}"), render như 1
phần của `ContentHtml` (KHÔNG cần field/cột riêng — giống cách "thời điểm đẹp"
đã quyết định giữ dạng văn xuôi, database-redesign §4.2). Chỉ cần cập nhật prompt
pack + structure gate (bắt buộc có mục này), không đổi schema.
**Nhập ở zinoflow**: KHÔNG có form/field riêng — AI tự viết đoạn này như 1
phần `ContentHtml` trong lúc generate bài (giống mọi section văn xuôi khác),
người dùng duyệt/sửa qua 2-gate review có sẵn, không phải nhập tay từ đầu.

### 5.7 Khối "Lưu ý thực tế" gộp (đề xuất 07/2026, phân tích vai khách du lịch)
Các câu hỏi thực tế khách hay hỏi nhưng không đáng tách field riêng từng cái: bãi
đậu xe (có phí không), nhà vệ sinh công cộng, phù hợp trẻ em/người già/xe lăn hay
không, quy định tại chỗ (cấm flycam/mang đồ ăn riêng/hút thuốc...), lưu ý an toàn
(đường trơn, sóng lớn, có cứu hộ không). Đề xuất GỘP thành 1 field JSON duy nhất
`PracticalNotesJson` dạng `[{icon, label, note}]` (tự do, không ép cấu trúc chi
tiết từng loại) — render thành 1 khối danh sách ngắn, giống cách `FaqJson` đang
hoạt động. CẦN cột DB mới (`DestinationContent.PracticalNotesJson`, database-
redesign §4.3) — chưa build.
**Nhập ở zinoflow**: AI gợi ý draft trước (dựa trên loại điểm đến — vd biển thì
gợi ý mục "sóng lớn/cứu hộ", núi thì gợi ý "đường trơn/độ cao") trong 1 khối
riêng ở màn sửa điểm đến, nhưng KHÔNG tự publish thẳng — bắt buộc người dùng
xem/sửa/xoá từng dòng trước khi lưu, vì đây là thông tin ảnh hưởng an toàn
thực tế, không phải văn phong thuần tuý.

## 6) Việc phát sinh cần chốt trước khi build UI mới

| # | Việc | Thuộc về |
|---|---|---|
| 1 | Bật lại `DestinationReview` fetch trên website (đang comment out) | Repo dichoithoi (.NET) |
| 2 | Route + view mới `/loai/{groupSlug}` (2 tầng: nhóm + loại con), `/tinh/{slug}` | Repo dichoithoi (.NET) — ưu tiên cao nhất theo §4.2.3 |
| 3 | ✅ Cột `GalleryJson`/`TicketPriceFrom` đã thêm vào DDL (database-redesign §4.3, 07/2026) — còn lại: bảng `destination_images` build sớm hơn kế hoạch (giai đoạn 2 → gộp vào M4) để có nguồn điền `GalleryJson` ngay khi viết lại UI | zinoflow (spec §14.4) |
| 4 | ✅ Đã thêm `TicketPriceFrom` (decimal, optional) vào DDL cho JSON-LD `offers` (database-redesign §4.3, 07/2026) | zinoflow (schema) + repo dichoithoi (cột DB) |
| 5 | SSR khối khách sạn thay AJAX | Repo dichoithoi (.NET) |
| 6 | Sitemap.xml + xác nhận Search Console | Repo dichoithoi (vận hành) |
| 7 | `rel="sponsored"` + dòng disclosure trên mọi CTA affiliate | Repo dichoithoi (template) |
| 8 | Render danh sách `ticketLinks[]` thành nhiều nút CTA (thay 1 nút `BookingUrl` cũ) | zinoflow (schema, đã cập nhật destination-spec §2.3) + Repo dichoithoi (template render mảng thay 1 link) |

## 7) Ưu tiên triển khai (gợi ý thứ tự, chưa quyết)

**Cao (ROI cao, không chặn bởi việc khác):**
1. Bật lại Review/Rating + JSON-LD AggregateRating.
2. Render FAQ (FaqJson) + JSON-LD FAQPage — data đã có sẵn.
3. Trang landing theo Loại + Tỉnh — SEO long-tail lớn nhất, data đã sẵn sàng.
4. SSR khối khách sạn giữa bài (bỏ AJAX).

**Trung bình (cần thêm việc nhỏ ở data trước):**
5. Gallery ảnh (bảng `destination_images`).
6. Bản đồ nhúng + nút chỉ đường.
7. `rel=sponsored` + disclosure.

**Sau (đủ nền tảng rồi mới đáng làm):**
8. Mini lịch trình / gợi ý kết hợp.
9. So sánh giá tại quầy vs online.
10. `TicketPriceFrom` cho JSON-LD offers.

**Mới đề xuất — phân tích vai khách du lịch, 07/2026 (CHƯA build, chưa vào
implementation-plan chính thức):**
11. Chi phí ước tính cho 1 chuyến (§5.4) — không cần cột DB mới, ROI cao nhất
    trong nhóm này vì chỉ là logic tổng hợp dữ liệu đã có.
12. Giá vé theo đối tượng (§5.5) — cần cột `PriceBreakdownJson` mới.
13. Câu chuyện văn hoá - lịch sử (§5.6) — không cần cột mới, chỉ sửa prompt pack.
14. Khối "Lưu ý thực tế" gộp (§5.7) — cần cột `PracticalNotesJson` mới.

1-10 ở trên (trừ #1 Review/Rating, #2 FAQ, #3 landing Loại/Tỉnh, #4 SSR khách
sạn, #6 bản đồ, #7 rel=sponsored, #9 so sánh giá, #10 TicketPriceFrom — đã build
Phase 9, xem `dichoithoi-backlog.md`) vẫn giữ nguyên để tra cứu lịch sử quyết
định; trạng thái build mới nhất luôn tra ở `dichoithoi-backlog.md`.

Tài liệu này không thay thế phần thiết kế backend/schema đã chốt ở
`dichoithoi-database-redesign.md` và `dichoithoi-destination-spec.md` — mọi thay
đổi schema đề xuất ở §6 cần chốt riêng trước khi đưa vào migration.

⚠️ **Toàn bộ tài liệu này phải tuân theo** `dichoithoi-seo-principles.md` (ưu
tiên cao nhất) — mọi đề xuất SEO/UX ở đây là ÁP DỤNG của nguyên tắc đó, nếu
phát hiện mâu thuẫn thì `dichoithoi-seo-principles.md` thắng.

---

## 8) Phân tích SEO chuyên sâu (mục tiêu top 1 Google — thêm 07/2026)

Phần này đào sâu góc nhìn "chuyên gia SEO" trên nền đã thiết kế ở §1-7 — không
lặp lại, chỉ bổ sung quy tắc cụ thể + yếu tố còn thiếu.

### 8.1 Title & Meta Description — quy tắc chi tiết

**Title** (đã thoát khỏi lỗi "2 template duy nhất" — audit mục 3 — nhưng cần quy
tắc rõ hơn khi viết lại):
- Độ dài 50-60 ký tự (~575px trên SERP) — dài hơn bị Google cắt giữa từ khoá,
  xấu và giảm CTR.
- **Từ khoá chính đứng ĐẦU** câu (trọng số cao hơn khi ở cuối) — vd
  "{Tên} — Giá vé, giờ mở cửa, kinh nghiệm 2026 | Dichoithoi", không phải
  "Dichoithoi | Thông tin về {Tên}...".
- Yếu tố phân biệt (tỉnh/loại/năm) để giải quyết trùng tên thật (2 điểm tên
  "Chợ đêm" khác tỉnh phải ra 2 title khác nhau — đã có hướng này, nhấn mạnh lại
  vì đây là lỗi hay tái phát khi thêm điểm mới).
- Brand ở **CUỐI** câu, không đầu — đầu câu dành cho search intent.
- 2 template không đủ cho catalog lớn — nên có ≥4-5 biến thể theo tình huống
  (có vé/miễn phí, có/không giờ mở cửa, là cluster/poi) để tránh lặp cấu trúc
  câu y hệt hàng trăm lần (Google vẫn coi là kém đa dạng dù nội dung khác nhau).

**Meta description**: 150-160 ký tự, chứa từ khoá chính + 1 lý do click cụ thể
(số liệu: "8 điểm nổi bật", "cập nhật T7/2026", "giá từ 50.000đ") — KHÔNG nhồi
từ khoá lặp lại. Cột `MetaDescription` đã tách khỏi `ShortDescription` hiển thị
trên trang (database-redesign §4.3) — đảm bảo AI thực sự viết 2 bản KHÁC NHAU,
không copy nguyên văn (rủi ro hiện tại nếu prompt không ép rõ).

### 8.2 JSON-LD — danh mục đầy đủ theo loại trang

| Trang | Schema cần có | Trạng thái |
|---|---|---|
| Trang chủ | `Organization`, `WebSite` (+ `SearchAction` cho sitelinks searchbox) | Đã có Organization/WebSite (audit); SearchAction — MỚI, đề xuất thêm |
| Điểm đến | `TouristAttraction`/`Place` (geo, address), `BreadcrumbList`, `FAQPage`, `AggregateRating`+`Review`, `Offer`/`AggregateOffer` (từ `TicketPriceFrom`), `ImageObject[]` (từ `GalleryJson`) | TouristAttraction/Breadcrumb đã có; FAQPage/AggregateRating/Offer/ImageObject — cần làm khi viết lại (§4.2) |
| Danh sách/Loại/Tỉnh | `ItemList`, `BreadcrumbList` | ItemList đã có cho `/diem-den`/`/search`; cần thêm cho `/loai/...`, `/tinh/...` mới |
| Cẩm nang (Article) | `Article`/`BlogPosting`, `ItemList` LỒNG bên trong nếu bài dạng liệt kê (Google hỗ trợ rich result cho listicle), `BreadcrumbList` | MỚI — chưa có trang, làm cùng lúc build `dichoithoi-article-spec.md` |

Nguyên tắc chung: **KHÔNG markup dữ liệu không hiển thị trên trang** — Google
phạt "structured data spam"/thao túng nếu JSON-LD không khớp nội dung visible
(vd đừng khai `AggregateRating` nếu trang chưa thật sự hiện sao + số review).

### 8.3 Cấu trúc bài viết — bổ sung ngưỡng chất lượng

- **Bài điểm đến**: cấu trúc đã đủ (§1-2: H1 duy nhất, quick-facts sớm, FAQ
  cuối). Bổ sung MỚI: cần **ngưỡng độ dài tối thiểu** cho phần thân bài (đề xuất
  ≥800 từ, không tính quick-facts/FAQ) để tránh thin content — hiện
  destination-spec §6 (quality gates) CHƯA có ngưỡng từ, nên thêm 1 gate mới.
- **Bài cẩm nang (Article — listicle)**: mỗi mục trong danh sách nên có
  H2/H3 RIÊNG do AI viết ngay TRƯỚC token khối động
  (`dichoithoi-article-spec.md` §3), không để khối động đứng trơ trọi không có
  tiêu đề bao quanh — Google index listicle tốt hơn hẳn khi mỗi mục có heading
  semantic rõ ràng (và đây cũng là chỗ tự nhiên để nhồi biến thể từ khoá phụ).
  Đề xuất thêm gate cho Article: "mỗi khối động phải có ≥1 dòng H2/H3 giới
  thiệu ngay phía trên".

### 8.4 Technical SEO / Core Web Vitals — mở rộng checklist §4.2.5

- **LCP**: hero `fetchpriority="high"` (đã có); cân nhắc **critical CSS inline**
  cho phần above-the-fold + defer phần còn lại — hiện `common.css` vẫn
  render-blocking THẬT SỰ (audit chỉ phát hiện `async` sai bị bỏ qua, nhưng bản
  thân `<link rel="stylesheet">` luôn blocking bất kể có sửa `async` hay không;
  muốn hết blocking phải tách critical CSS, không chỉ bỏ thuộc tính sai).
- **CLS**: width/height ảnh (đã có); SSR khối khách sạn/tour (đã có kế hoạch);
  nếu sau này thêm banner quảng cáo — RESERVE sẵn không gian, không để banner
  load sau đẩy layout.
- **INP**: hạn chế JS nặng cho FAQ accordion/gallery carousel — ưu tiên
  CSS-only (đã khuyến nghị gallery CSS-only ở §5.1, áp dụng luôn cho accordion).
- **Crawlability**: sitemap.xml động (đã ghi nhận §4.2.4); rà `robots.txt`
  không chặn nhầm CSS/JS/ảnh (lỗi phổ biến làm Google không render đúng trang);
  **phân trang `/diem-den` cần URL riêng mỗi trang** (`?page=2` hoặc `/trang-2`)
  với title/canonical RIÊNG từng trang — khác `/search` (đang noindex đúng vì
  là kết quả tìm kiếm động, còn phân trang danh mục là nội dung thật, KHÔNG nên
  noindex).
- **Mobile-first**: Google index bản mobile là chính — test mọi thay đổi trên
  mobile TRƯỚC desktop.

### 8.5 E-E-A-T (Experience-Expertise-Authoritativeness-Trust)

Yếu tố hay bị bỏ qua khi nội dung do AI sinh:
- Google KHÔNG cấm nội dung AI, nhưng đánh giá cao tín hiệu "có con người chịu
  trách nhiệm nội dung". Pipeline ĐÃ CÓ sẵn cơ chế này (review/approve bắt buộc
  trước publish — system-overview §2.1) nhưng KHÔNG hiển thị ra ngoài. Đề xuất:
  thêm 1 dòng trust signal trên trang — "Nội dung được biên tập và xác minh bởi
  đội ngũ Dichoithoi, cập nhật tháng X/2026" — biến quy trình nội bộ đã có thành
  tín hiệu trust NGƯỜI ĐỌC và Google đều thấy được, không chỉ nằm trong DB.
- Review/rating thật từ khách (đã có kế hoạch bật lại — §1) — social proof
  mạnh nhất cho trust.
- Ảnh tự chụp/tự tạo, không dùng stock (đã quyết định — destination-spec §14)
  — tăng tín hiệu "Experience" thật + tránh trùng ảnh với site khác (Google
  Images ưu tiên ảnh gốc).
- Thông tin có ngày cập nhật, không cam kết tuyệt đối (đã có nguyên tắc policy
  §2.3, §6.3) — đúng hướng Trustworthiness, giữ nguyên khi viết lại UI.

### 8.6 Silo / Topical authority — sơ đồ internal link hoàn chỉnh

```
Trang chủ
 ├─ /loai/{group}              (pillar — 3 nhóm loại)
 │    └─ /loai/{group}/{type}  (cluster — loại cụ thể)
 │         └─ bài điểm đến      (leaf)
 ├─ /tinh/{slug}                (pillar — theo tỉnh)
 │    └─ bài điểm đến (cùng tỉnh)
 └─ /cam-nang/{slug}            (HUB NGANG — cắt qua nhiều silo dọc,
                                  link chéo tới bài điểm đến qua khối động)
```
Bài cẩm nang là lý do chính đáng để đầu tư cơ chế "khối động"
(`dichoithoi-article-spec.md`): nó tạo internal link tự nhiên CẮT NGANG qua các
silo loại/tỉnh mà không cần đi link tay từng bài. Giữ nguyên tắc anchor text =
tên điểm (đã tốt, không đổi). Kiểm tra độ sâu: mọi bài điểm đến nên cách trang
chủ **≤ 3 click** (qua nhóm→loại→bài, hoặc thẳng từ trang chủ nếu `IsFeatured`).

### 8.7 Ngoài tầm kiểm soát của schema/code (vẫn là yếu tố quyết định top 1)

- **Backlink** (tín hiệu ngoài site) — không giải quyết được bằng thiết kế kỹ
  thuật, cần chiến lược riêng (ngoài phạm vi tài liệu này).
- **Tốc độ index**: submit sitemap qua Google Search Console, theo dõi
  Coverage report để phát hiện lỗi crawl sớm.
- **Thời gian**: nội dung tốt + kỹ thuật đúng là điều kiện CẦN, không phải ĐỦ
  để "top 1" ngay lập tức — SEO là cuộc chơi dài hạn, đặc biệt với domain mới/
  ít backlink.

## 9) Phân tích UI/UX chuyên sâu (thêm 07/2026)

Đào sâu thêm góc UI/UX ngoài phần bố cục đã có ở §2.

### 9.1 Visual hierarchy & trust signals
- Thứ tự nổi bật trên trang detail: H1 > giá vé/CTA > rating sao > ảnh > phần
  còn lại — dùng size/màu/khoảng trắng để mắt người đọc đi đúng thứ tự này,
  không để mọi thứ đều "gào to" ngang nhau.
- Badge trạng thái nên nhất quán màu xuyên site: loại điểm (màu theo nhóm —
  thiên nhiên/văn hoá/vui chơi mỗi nhóm 1 tông màu để nhận diện nhanh), tỉnh,
  "Cập nhật gần đây" — giúp người dùng quét trang nhanh hơn đọc chữ.
- Rating sao + số review hiển thị NGAY cạnh H1 (không chôn xuống dưới) — đây là
  tín hiệu trust đầu tiên người đọc thấy, ảnh hưởng quyết định đọc tiếp hay
  không (giống Google/TripAdvisor).

### 9.2 Mobile UX (ưu tiên vì tra cứu du lịch chủ yếu trên điện thoại)
- Vùng chạm (tap target) CTA tối thiểu 44×44px, khoảng cách đủ giữa các nút để
  tránh bấm nhầm — đặc biệt quan trọng cho thanh CTA dính đáy màn hình (§2).
- Thanh CTA dính đáy PHẢI có thể thu gọn/không che nội dung khi cuộn xuống đọc
  kỹ — tránh gây khó chịu (Google cũng phạt gián tiếp qua tín hiệu hành vi nếu
  người dùng thoát nhanh vì bực).
- Font tối thiểu 16px cho nội dung chính (dưới ngưỡng này mobile browser tự
  zoom, phá layout); dòng ngắn (45-75 ký tự/dòng) dễ đọc trên màn hình hẹp.
- Ảnh gallery: vuốt ngang (swipe) thay vì lưới cố định trên mobile — tự nhiên
  với thao tác chạm.

### 9.3 Filter/Search UX (trang danh sách — audit đã ghi nhận thiếu)
- `/diem-den` cần: filter theo tỉnh + loại (dropdown hoặc chip), sort (nổi bật/
  mới nhất/gần tôi nếu có định vị), hiển thị SỐ KẾT QUẢ trước khi cuộn.
- Trạng thái rỗng (0 kết quả sau filter): không để trang trắng — gợi ý "thử bỏ
  bớt filter" hoặc link tới trang landing loại/tỉnh gần nhất.
- Giữ filter trên URL (`?loai=thac-ho-suoi&tinh=lam-dong`) để chia sẻ/back
  button hoạt động đúng, và để mỗi tổ hợp filter phổ biến có thể tự thành 1
  URL landing thật nếu traffic đủ lớn (nâng cấp từ filter tự do → trang cứng).

### 9.4 Accessibility (ảnh hưởng cả UX lẫn gián tiếp SEO)
- Alt text mọi ảnh (đã tốt ở phần lớn, trừ banner Klook chung chung — audit đã
  ghi nhận, cần sửa khi viết lại).
- Tương phản màu đủ (WCAG AA tối thiểu) cho text trên ảnh nền (badge, overlay
  hero) — dễ bị bỏ qua khi thiết kế đẹp mắt nhưng chữ mờ trên ảnh sáng.
- FAQ accordion, gallery carousel: điều hướng được bằng bàn phím + `aria-*`
  đúng vai trò — không chỉ là "đẹp" mà còn giúp Google hiểu cấu trúc nội dung
  tốt hơn khi crawl (crawler cũng đọc DOM/ARIA để hiểu ngữ nghĩa).

### 9.5 Cân bằng CTA kiếm tiền vs UX — tránh phạt thuật toán
Google có thuật toán phạt trực tiếp trang có **quá nhiều quảng cáo/CTA trên màn
hình đầu (above the fold)** che nội dung thật ("intrusive interstitial"). Áp
dụng cho thiết kế đã đề xuất ở §2-3:
- Thanh CTA dính KHÔNG được chiếm >15-20% chiều cao màn hình mobile.
- Banner khách sạn/tour giữa bài (§2) phải có nội dung THẬT xen giữa (không xếp
  2-3 banner affiliate liên tiếp không có văn bản ở giữa) — vừa đúng chính sách
  Google vừa tốt cho UX, người đọc không cảm thấy bị "bán hàng" liên tục.
- Disclosure affiliate rõ ràng (đã có §3) cũng là tín hiệu trust, gián tiếp tốt
  cho UX/uy tín thương hiệu.

### 9.6 Loading / empty / error states — dễ bị bỏ qua khi thiết kế
- Ảnh: khung giữ chỗ (skeleton/blur-up) thay vì khoảng trắng đột ngột khi ảnh
  load xong (giảm cảm giác "giật" dù đã có width/height chống CLS kỹ thuật).
- Chưa có review nào: trạng thái trống PHẢI có (không để mất cả khối review
  khi `ReviewCount=0`) — vd "Chưa có đánh giá — hãy là người đầu tiên", kèm CTA
  viết review, biến trạng thái trống thành cơ hội thu thập UGC.
- Gallery <4 ảnh (dưới ngưỡng thiết kế cho carousel): fallback về lưới đơn giản
  thay vì carousel trống/lỗi hiển thị.
- Lỗi tải dữ liệu (vd khối khách sạn/tour không load) trên production: ẩn hẳn
  khối đó thay vì hiện khung lỗi xấu — nguyên tắc "degrade mềm" đã áp dụng cho
  cache invalidation (system-overview §2) nên áp dụng nhất quán ở UI luôn.

## 10) Layout mobile-first — thiết kế lại toàn bộ (đề xuất 07/2026)

Thiết kế mới hoàn toàn, KHÔNG dựa trên layout hiện có — được phép đập đi làm lại
theo mục tiêu §0 (giá trị người dùng + tốc độ + SEO), ưu tiên **mobile-first**:
viết CSS base cho mobile trước, desktop chỉ thêm bằng `min-width` (không phải
ngược lại) — vì phần lớn traffic tìm kiếm du lịch là mobile, base payload phải
nhẹ nhất cho nhóm đông nhất. Áp dụng cho cả 3 loại trang: trang chủ, trang danh
mục (Loại/Tỉnh), trang chi tiết điểm đến.

### 10.1 Menu/điều hướng

**Mobile (< 768px)** — header sticky cao ~56px:
```
┌─────────────────────────────┐
│ ☰   [Logo dichoithoi]   🔍  │
└─────────────────────────────┘
```
- `☰` mở drawer trượt từ trái: Trang chủ / Điểm đến (accordion: theo Loại, theo
  Tỉnh) / Cẩm nang / Về chúng tôi.
- `🔍` mở ô tìm kiếm full-width đè lên header (không chuyển trang riêng), gợi ý
  ngay khi gõ (điểm đến/tỉnh).
- KHÔNG dùng mega-menu hover (không có hover trên mobile) — mọi thứ tap +
  accordion.

**Desktop (≥ 1024px)** — `☰` biến mất, nav ngang đầy đủ:
```
[Logo]   Trang chủ   Điểm đến ▾   Cẩm nang        [Tìm kiếm...........]
```
"Điểm đến ▾" hover ra mega-menu 2 cột: cột trái = Loại (nhóm + loại con), cột
phải = Tỉnh/Thành (chia theo miền Bắc/Trung/Nam) — đây là internal-link quan
trọng nhất của site nên liệt kê đủ, không chỉ vài mục "nổi bật".

**Thanh hành động dính đáy (chỉ trang chi tiết điểm đến, mobile only)** — pattern
chuyển đổi tốt nhất cho content du lịch, thay thế vai trò 2 nút CTA đã nằm sẵn
trong khối "quyết định nhanh" ở đầu trang trên desktop:
```
┌─────────────────────────────┐
│  [📍 Chỉ đường]  [🎟 Mua vé] │  ← sticky bottom, luôn hiện khi cuộn
└─────────────────────────────┘
```
Giới hạn chiều cao thanh này KHÔNG quá 15-20% chiều cao màn hình mobile (đúng
nguyên tắc chống "intrusive interstitial" ở §9.5).

### 10.2 Trang chủ

**Mobile** — 1 cột dọc theo đúng thứ tự ưu tiên §... (mục §0 mục tiêu sản
phẩm), 2 khối cuối dùng carousel vuốt ngang thay vì kéo dài trang:
```
[Ô tìm kiếm nổi bật]
[Lưới danh mục 2 cột — icon Loại]
[Điểm đến nổi bật — carousel vuốt ngang, 6-8 thẻ biên tập tay]
[Cẩm nang mới — carousel vuốt ngang]
[Gợi ý khách sạn/tour — carousel vuốt ngang]
[Footer: link đủ ~34 tỉnh + ~18 loại, dạng list gọn]
```
**Desktop** — carousel mở rộng thành lưới tĩnh (4-6 cột), danh mục thành lưới
6-8 cột; vẫn giữ 1 cột chính (không chia sidebar) vì trang chủ không cần điều
hướng phụ.

Vai trò trang chủ: KHÔNG phải nơi hứng traffic SEO chính (traffic tìm kiếm rơi
thẳng vào trang danh mục/chi tiết) — vai trò là crawl-hub điều hướng toàn site +
điểm giữ chân traffic trực tiếp/quay lại + tín hiệu freshness (cẩm nang mới).

### 10.3 Trang danh mục (`/loai`, `/loai/{group}`, `/loai/{group}/{type}`, `/tinh/{slug}`)

Trang SEO ưu tiên cao nhất (long-tail: "địa điểm tâm linh miền Bắc", "du lịch Đà
Lạt có gì chơi") — khác biệt lớn nhất so với listing thông thường: **mỗi trang
phải có đoạn văn bản riêng**, không chỉ là 1 lưới card (tránh thin content).

**Mobile:**
```
[Breadcrumb rút gọn: Tỉnh > Đà Lạt]
[H1 + đoạn giới thiệu ngắn riêng cho trang này]
[Nút "Bộ lọc ▾"] → mở bottom-sheet (không sidebar, tốn ngang màn hình nhỏ)
[Lưới card 1 cột, ảnh full-width]
[Phân trang: ‹ Trang 2/8 › — URL riêng từng trang, crawl được]
[FAQ cấp danh mục — accordion]
```
**Desktop:** sidebar lọc bên trái (~25% width) luôn hiện thay vì bottom-sheet,
lưới card 3-4 cột bên phải — màn desktop đủ rộng để lọc song song không che
nội dung. Kết quả mặc định (không filter) PHẢI luôn SSR sẵn ở cả 2 kích thước;
filter chỉ là tăng cường phía client, giữ trạng thái trên URL (§9.3).

### 10.4 Trang chi tiết điểm đến

Trang dài nhất — mobile cần công cụ điều hướng trong-trang để không bắt cuộn mù:

**Mobile:**
```
[Breadcrumb]
[Ảnh hero full-width]
[Thanh chip vuốt ngang: Giá vé | Vị trí | Trải nghiệm | Ăn uống | Lưu trú | FAQ]
   ← bấm nhảy neo tới section
[Card "Quyết định nhanh": địa chỉ, giờ mở cửa, giá vé, chi phí ước tính]
[Tổng quan]
[Câu chuyện văn hoá - lịch sử]
[Trải nghiệm/chơi gì]
[Bản đồ nhúng + Flight/Bus tới tỉnh này]
[Gallery — carousel vuốt ngang]
[Ăn uống]
[Lưu trú — card carousel]
[Tour — card carousel]
[Lưu ý thực tế — <details> gấp mặc định]
[Mẹo & lưu ý — <details>]
[Thời điểm đẹp]
[FAQ — <details> từng câu]
[Review/rating]
[Điểm gần đó — carousel]
[Bài cẩm nang liên quan]
                                    [📍 Chỉ đường][🎟 Mua vé] ← sticky đáy (§10.1)
```
Dùng `<details>` gốc HTML (không phải JS ẩn/hiện) cho khối dài (lưu ý thực tế,
mẹo, FAQ) — gọn trang mobile nhưng vẫn nằm trong DOM để Google đọc được, không
mất nội dung SEO (đúng nguyên tắc §9.4 — crawler đọc DOM/ARIA để hiểu ngữ nghĩa).

**Desktop:** chia 2 cột — cột chính (~70%) chứa toàn bộ nội dung theo đúng thứ
tự trên nhưng KHÔNG cần gấp `<details>` (đủ chỗ hiện hết); cột phụ bên phải
(~30%) sticky theo scroll chứa: card "Quyết định nhanh" + 2 nút hành động + bản
đồ thu nhỏ — thay cho thanh sticky đáy của mobile.

Thứ tự nội dung ở cả 2 kích thước đi theo hành trình quyết định của khách: tiền/
hành động lên trên (giá vé, chi phí, CTA), cảm xúc/khám phá ở giữa (câu chuyện
văn hoá, trải nghiệm, gallery), thực tế/liên quan ở cuối (lưu ý, FAQ, điểm gần
đó) — nhất quán với khung nội dung đã chốt ở §1 và các khối mới §5.4-§5.7.

### 10.5 Technical stack — tối ưu Lighthouse/PageSpeed tối đa (chốt 07/2026)

Hiện trạng (`wwwroot/css/*.css`): Bootstrap + jQuery + icon font (`icon-navigation`,
`btn btn-outline-primary`...) — nặng hơn cần thiết cho 1 site chủ yếu nội dung
tĩnh. Khi đập đi làm lại, **KHÔNG dùng framework UI runtime nào** (không
Bootstrap, không React/Vue/Alpine cho website công khai — Razor vẫn server-render
HTML như hiện tại, đúng cho SEO/LCP, chỉ đổi tầng CSS/JS):

1. **CSS**: viết bằng Tailwind nhưng **compile 1 lần lúc build/deploy** (PostCSS
   purge hết class không dùng) → ra 1 file CSS tĩnh duy nhất, không cần Node.js
   chạy runtime trên server production. Bảng màu khai báo CỐ ĐỊNH trong config
   (chỉ 7 màu, xem bảng dưới) — không dùng bảng màu mặc định khổng lồ của
   Tailwind, giữ file CSS nhỏ nhất.
2. **JS**: bỏ hẳn jQuery. Vanilla JS thuần cho tương tác (drawer menu mobile
   §10.1, carousel vuốt ngang, bottom-sheet filter §10.3, accordion FAQ/lưu ý
   thực tế §10.4) — không cần bundler phức tạp.
3. **Icon**: bỏ icon font hiện tại (tải cả bộ ký tự chỉ để dùng vài icon) →
   SVG inline trực tiếp trong HTML.
4. **Font chữ**: system font stack (`-apple-system, "Segoe UI", Roboto,...`) —
   không tải gì cả, không FOUT/FOIT, không ảnh hưởng CLS/LCP. Nếu sau này cần
   font riêng cho thương hiệu: self-host 1 font variable, subset tiếng Việt có
   dấu, `font-display: swap`.
5. **Ảnh**: WebP/AVIF, `srcset` theo kích thước màn hình, `width`/`height` cố
   định (chống CLS), lazy-load mọi ảnh dưới màn hình đầu (đã áp dụng 1 phần,
   giữ nguyên — xem §9.6 khung giữ chỗ ảnh).
6. **Critical CSS**: inline phần CSS above-the-fold vào `<head>`, phần còn lại
   load không chặn render (`media="print" onload=...` hoặc tương đương).
7. **Nén + cache**: bật Brotli ở tầng IIS/Kestrel; cache header dài hạn cho
   CSS/JS/ảnh kèm fingerprint tên file để cache-bust đúng lúc đổi nội dung.
8. **Bên thứ 3**: Google Maps giữ nguyên iframe embed (`maps?q=...&output=embed`,
   đã dùng — nhẹ nhất), KHÔNG chuyển sang Maps JavaScript SDK. Analytics (nếu
   có) load `async`/`defer`, không chặn render.

### 10.5.1 Tối ưu thêm — hosting SmarterASP .NET Advance (đề xuất 07/2026)

Rà soát sau khi đã có bản thiết kế trên, phát hiện thêm các điểm tối ưu chưa
xử lý — điều chỉnh cho đúng ràng buộc hosting shared/Advance (KHÔNG có quyền
root/cài dịch vụ hệ thống như Redis server):

1. **Output/HTTP cache — 2 tầng**: (a) ASP.NET Core `OutputCache` middleware
   (in-memory, không cần cài gì thêm ở server) làm tầng 1; (b) **Cloudflare
   (free tier)** đặt trước hosting qua DNS làm tầng 2 — cách thực tế nhất để
   có CDN/edge cache thật trên shared hosting không có quyền server. Bật
   "Cache Everything" (Page Rule/Cache Rule) cho `/diem-den/*`, `/tinh/*`,
   `/loai/*`. ⚠️ IIS Application Pool bị recycle định kỳ trên shared hosting →
   cache tầng 1 mất theo, Cloudflare (ngoài server) không bị ảnh hưởng — đây
   là lý do BẮT BUỘC có tầng 2, không chỉ dựa tầng 1.
2. **Invalidate cache khi publish**: mở rộng endpoint "invalidate cache" đã có
   (database-redesign) — thêm bước gọi **Cloudflare Purge Cache API** theo
   đúng URL vừa đổi, cần 1 API token Cloudflare cấu hình trong zinoflow.
3. ✅ **Resize ảnh ở zinoflow, KHÔNG ở hosting** — đã có kế hoạch chi tiết từ
   trước ở `destination-spec.md` §14 (3 cỡ cố định hero/medium/thumb, Cloudflare
   free đã nhắc ở §14.2, tool tự convert WebP + resize bằng `sharp` + FTP ở
   §14.3 giai đoạn 2) — KHÔNG phải đề xuất mới, chỉ xác nhận đúng hướng và
   nhắc lại vì liên quan trực tiếp ràng buộc hosting Advance đang phân tích ở
   đây.
4. **Đo Lighthouse thực tế — chạy từ BÊN NGOÀI hosting**: 1 GitHub Actions
   workflow (miễn phí) chạy định kỳ, gọi PageSpeed Insights API/Lighthouse CI
   nhắm vài URL chính (trang chủ, 1 trang tỉnh, 1 trang điểm đến), lưu kết quả
   theo thời gian để phát hiện regression — không phụ thuộc gói hosting.
5. **`noindex`/canonical cho filter**: `<link rel="canonical">` trỏ về URL
   không filter trong layout Razor khi có query string filter — tránh loãng
   crawl budget khi nhiều tổ hợp tham số.
6. **Sitemap chia nhỏ theo ngưỡng**: hiện ghi thẳng file tĩnh `wwwroot/*.xml`
   — thêm ngưỡng (vd 40.000 URL/file, an toàn dưới giới hạn 50.000 của Google)
   rồi tự tách nhiều file + `sitemap_index.xml`.
7. **Warm-up sau App Pool recycle** (cần bạn kiểm tra control panel): nếu gói
   Advance có tính năng "Task Scheduler"/"Cron Job", cấu hình gọi 1 URL "ping"
   định kỳ (vd mỗi 10-15 phút) giữ app pool sống + cache ấm, tránh khách đầu
   tiên sau mỗi lần recycle bị chậm — CHƯA xác nhận gói Advance có tính năng
   này hay không.

**Phong cách thiết kế — Flat, hiện đại** (chốt 07/2026, áp dụng cho MỌI UI mới
của dichoithoi — website lẫn các khối quản lý liên quan): ưu tiên flat design,
KHÔNG dùng gradient/đổ bóng nặng/hiệu ứng 3D/bo góc quá dày kiểu skeuomorphism
cũ — màu khối đặc (solid), viền mảnh hoặc không viền (dùng khoảng trắng/tương
phản màu nền để phân tách thay vì border nặng), bóng đổ (nếu có) chỉ rất nhẹ
(vd `shadow-sm`) cho card/dropdown, bo góc vừa phải nhất quán (không quá tròn
kiểu "bubbly"). Đúng tinh thần đã chốt ở stack nhẹ (không framework nặng) —
flat design vốn cũng ít CSS hơn (không cần nhiều layer gradient/shadow phức
tạp), khớp mục tiêu file nhỏ nhất/tốc độ đã đặt ra.

**Bảng màu** (giữ tinh thần màu thương hiệu cũ trong `common.css`, chuẩn hoá lại
tối giản — chỉ 7 màu để CSS compile ra nhỏ nhất):

| Vai trò | Mã màu | Ghi chú |
|---|---|---|
| Primary (thương hiệu, header, link) | `#015B93` | Giữ nguyên từ site cũ |
| Primary hover/dark | `#013C60` | Giữ nguyên từ site cũ |
| Accent (CTA affiliate: "Mua vé", "Đặt phòng") | `#F97316` | **Đổi từ đỏ `#D0021B` cũ** — cam tạo cảm giác hành động/ưu đãi, không liên tưởng lỗi/cảnh báo, tách biệt rõ với primary xanh dương (quyết định 07/2026) |
| Success (giá tốt, đã xác nhận) | `#34A853` | Giữ nguyên từ site cũ |
| Text chính | `#03121A` | Giữ nguyên từ site cũ |
| Text phụ/border | `#5F6368` / `#CFD8DC` | Giữ nguyên từ site cũ |
| Nền / nền phụ | `#FFFFFF` / `#F1F1F1` | Giữ nguyên từ site cũ |

**Logo** (chốt 07/2026): **giữ nguyên** logo hiện tại (`wwwroot/images/logo.svg`,
wordmark "DiChoiThoi" + icon máy bay giấy, SVG ~4.8KB) — màu nhấn đã khớp chính
xác `#015B93` (Primary mới), không cần vẽ lại. Việc nhỏ đáng làm khi build: (1)
chạy qua SVGO để nén path data (~giảm thêm 20-30%); (2) cân nhắc thêm 1 bản rút
gọn chỉ icon (không phải logo mới, chỉ cắt từ path có sẵn) dùng riêng cho header
mobile 56px/favicon — logo đầy đủ (wordmark dài) vẫn dùng cho header desktop +
footer. Xem xét vẽ lại chỉ khi phát sinh nhu cầu thật sau này.

### 10.6 Trang chi tiết theo `kind` — poi/cluster/province, và trục vùng/miền (phân tích 07/2026, CHƯA xác nhận cuối)

⚠️ Phần này mới ở mức phân tích, chưa được xác nhận rõ ràng (khác §10.7 dưới —
đã chốt) — ghi lại để không mất, cần bạn duyệt lại khi quay lại chủ đề này.

- **`kind=poi`** (điểm con, lá cây): trang đầy đủ đúng §10.4 (giá vé, giờ mở
  cửa, câu chuyện văn hoá, trải nghiệm, ăn uống, lưu trú, tour, lưu ý thực tế,
  FAQ, review, điểm gần đó).
- **`kind=cluster`** (khu vực/cụm) — 2 biến thể khác nhau, phân biệt bằng có
  hay không `OpeningTime`/`TicketPrice`/`ContentHtml` thật (không cần cột mới):
  1. Cụm CÓ vé/giờ riêng (vd Suối Tiên): render như POI đầy đủ + thêm khối
     "Các khu trong [tên]" (dùng `ChildrenJson` — database-redesign §3.4) ngay
     sau "Trải nghiệm/chơi gì".
  2. Cụm THUẦN địa lý (vd Đà Lạt, Di Linh — huyện/thành phố): ẩn khối "quyết
     định nhanh" (không áp dụng giá vé/giờ mở cửa), cấu trúc gần giống trang
     danh mục (§10.3): breadcrumb, H1 + giới thiệu riêng, khối "Các điểm
     trong [tên]" (toàn bộ `ChildrenJson`), rồi đặc sản/lưu trú/tour/FAQ cấp
     khu vực.
- **`kind=province`** (tỉnh) — ⚠️ đề xuất KHÔNG có trang chi tiết riêng ở
  `/diem-den/{slug}`, vì trùng vai trò với `/tinh/{slug}` đã build Phase 9
  (2 URL cùng nội dung 1 tỉnh → duplicate content, hại SEO). Đề xuất
  `/diem-den/{provinceSlug}` redirect 301 sang `/tinh/{provinceSlug}`; node
  `kind=province` trong cây chỉ giữ vai trò cấu trúc (gốc cho
  `parentSlug`/`AncestorsJson`/`ChildrenJson`).
- **Vùng/miền** (lớn hơn tỉnh, vd Tây Nguyên, Miền Bắc) — đề xuất KHÔNG thêm
  làm `kind` thứ 4 trong cây destination (không phải 1 điểm du lịch vật lý,
  không có giá vé/giờ mở cửa/toạ độ riêng) — thêm 1 trục phân loại độc lập mới
  (giống `DestinationTypeGroup`): bảng `Region` (`Id`, `Slug`, `Name`) +
  `Province.RegionId` FK, trang `/vung/{slug}` dùng đúng pattern trang danh
  mục (§10.3): breadcrumb, H1 + giới thiệu riêng, danh sách tỉnh trong vùng,
  điểm nổi bật toàn vùng, FAQ cấp vùng.

### 10.7 Cấu trúc URL điểm đến — slug PHẲNG, không theo cấp bậc (chốt 07/2026)

Quyết định: **giữ nguyên cách làm hiện tại** — `/diem-den/{slug}` phẳng
(`slug` là khoá tự nhiên, unique toàn cục, KHÔNG nhúng đường dẫn cha/cụm/tỉnh
vào URL, vd KHÔNG làm `/diem-den/lam-dong/da-lat/ho-xuan-huong`). Lý do (áp
dụng chung cho mọi route điểm đến, không riêng trường hợp cụ thể nào):

1. Google không tính độ sâu URL là yếu tố xếp hạng trực tiếp — quan trọng là từ
   khoá trong URL + nội dung khớp intent, không phải số cấp thư mục.
2. Cấp bậc đã truyền tải đủ qua Breadcrumb + JSON-LD `BreadcrumbList` (dùng
   `AncestorsJson` — database-redesign §3.4) — không cần lặp lại trong URL.
3. URL phẳng ổn định hơn nhiều khi tổ chức lại cây (đổi 1 điểm từ cụm này sang
   cụm khác — thực tế hay xảy ra): URL nested bắt buộc đổi theo (mất link
   equity, phải redirect + cập nhật sitemap); URL phẳng không bao giờ cần đổi
   trừ khi chính bạn đổi tên/slug điểm đó.
4. URL ngắn có CTR tốt hơn trên SERP (Google có thể cắt URL quá dài khi hiển
   thị; URL ngắn nhìn "sạch", đáng tin hơn).
5. Slug đã là khoá tự nhiên unique toàn cục (không phụ thuộc cha) — giữ đơn
   giản, không cần đảm bảo unique-trong-phạm-vi-cha.

**Không mâu thuẫn** với `/loai/{group}/{type}` (đang nested 2 tầng) — taxonomy
loại hình ổn định/ít đổi cấu trúc theo thời gian (curated tay), khác cây
destination (dễ tổ chức lại) — nguyên tắc chung: **nested URL chỉ dùng cho cấu
trúc ổn định, ít đổi**; cây địa lý điểm đến giữ phẳng.

**Quy ước đặt slug**: ngắn nhưng đủ từ khoá chính (tên điểm đến, không dấu) —
KHÔNG lặp lại thông tin đã có ở breadcrumb/title (vd dùng `thac-datanla`, không
`thac-nuoc-datanla-da-lat-lam-dong-viet-nam`). Chỉ thêm hậu tố phân biệt (vd
`-da-lat`) khi THẬT SỰ trùng tên với 1 điểm khác, không mặc định thêm mọi lúc.

### 10.8 Trạng thái — chưa build, chờ chốt

⚠️ Đây là bản thiết kế MỚI, thay thế hoàn toàn cách trình bày hiện có trên
website dichoithoi — **chưa vào `dichoithoi-implementation-plan.md`**, cần bạn
duyệt lần cuối trước khi đưa vào lộ trình build (đúng nguyên tắc "phân tích xong
hết mới code sau"). Khi chốt: thêm vào `dichoithoi-backlog.md` §B (thứ tự build)
và implementation-plan.

