# Dichoithoi Destination Content — Technical Spec (tạo 12/06/2026)

Tính năng mới trong AI Content Tool: tạo và cập nhật bài viết **điểm đến du lịch**
cho https://dichoithoi.com/ bằng AI, thay thế hoàn toàn luồng Google Sheet → CMS import.

Trạng thái: **ĐÃ PHÂN TÍCH, CHỜ BUILD** — ƯU TIÊN LÀM TRƯỚC WordPress publish,
xếp ở milestone **M4** (quyết định 12/06/2026, xem `ai-content-delivery-plan.md`).

Tài liệu vào cửa cho dichoithoi: `dichoithoi-system-overview.md` (kiến trúc
AI tool ↔ CMS cũ ↔ website + lộ trình); schema DB đích: `dichoithoi-database-redesign.md`.

## 1) Bối cảnh và hệ thống hiện tại (phân tích từ source code 12/06/2026)

Source đã đọc:
- Website: `D:\Gits\mmo\dichoithoi\DiChoiThoi.Web` (.NET, SQL Server hosted tại site4now.net)
- CMS: `D:\Gits\mmo\dichoithoi\CmsDiChoiThoi.Web`

### 1.1 Luồng hiện tại (thủ công)
```
Google Sheet (viết tay từng điểm đến)
  → CMS bấm import (GET /webapi/import_destination)
    → XÓA TOÀN BỘ bảng Destination + DestinationDetail rồi insert lại từ sheet
    → trong lúc import: auto-replace tên điểm đến trong Content thành link nội bộ
  → Website đọc DB hiển thị tại /diem-den/{id}
```

### 1.2 Data model SQL Server (giữ nguyên — website đang đọc trực tiếp)

Bảng `Destination` (metadata, **Id chính là slug** dùng trong URL `/diem-den/{id}`):

| Cột | Kiểu | Ghi chú |
|---|---|---|
| Id | nvarchar(64) PK | slug, vd `vinh-ha-long` |
| Name | nvarchar(128) | tên hiển thị |
| Description | nvarchar(1000) | mô tả ngắn, dùng làm meta description |
| DestinationGroupId / DestinationGroupName | nvarchar(128) | nhóm điểm đến |
| AreaId, ProvinceId, ProvinceName, DisctrictId | nvarchar(32) | taxonomy địa lý (cột DisctrictId viết sai chính tả sẵn trong DB — giữ nguyên) |
| HotelGroupId | nvarchar(50) | liên kết nhóm khách sạn |
| Type | nvarchar(128) | loại điểm đến, CSV nhiều giá trị |
| Address, Lat, Lng | required | **AI không được tự chế** — người dùng nhập/giữ nguyên |
| Order, DistanceFromCenter | | sắp xếp + khoảng cách |
| IsGroup, IsArea, IsProvince | bit | điểm đến cấp nhóm/vùng/tỉnh |
| SearchKeyword | nvarchar(256) | từ khóa tìm kiếm nội bộ |

Bảng `DestinationDetail` (nội dung, 1-1 theo DestinationId):

| Cột | Ghi chú |
|---|---|
| Content | **HTML** thuần — phần thân bài chính |
| OpeningTime, TicketPrice | nvarchar(512) — hiển thị thành mục riêng trên web |
| Food, Transport, Tip, Hotel | text — các mục ăn uống / di chuyển / mẹo / lưu trú |
| Phone | nvarchar(128) |

Bảng taxonomy: `DestinationGroup`, `DestinationType`, `Province`, `Area`, `District`.

### 1.3 Logic auto-link hiện tại (port sang AI tool — bắt buộc giữ hành vi)
Trong `CmsDiChoiThoi.Service/Services/Destination/DestinationService.cs::ImportAsync`:
1. Sắp xếp danh sách điểm đến theo **tên dài nhất trước** (tránh "Hồ Gươm" ăn mất "Phố đi bộ Hồ Gươm").
2. Với mỗi bài, quét Content tìm tên điểm đến khác (IgnoreCase), **bỏ qua chính nó**.
3. Mỗi tên chỉ replace **lần xuất hiện đầu tiên** thành
   `<a title="{Name}" href="/diem-den/{Id}">{Name}</a>`.
4. Tên đã nằm trong tên dài hơn đã replace thì bỏ qua (chống link lồng nhau).

### 1.4 Ràng buộc phát hiện được (quan trọng khi thiết kế)
1. **CMS import là wipe-all**: xóa sạch 2 bảng rồi insert lại từ sheet. Khi AI tool
   ghi trực tiếp vào DB, nếu ai đó bấm import CMS từ sheet cũ thì **mất hết bài AI**.
   → Sau go-live phải NGỪNG dùng CMS import; AI tool trở thành source of truth.
2. Auto-link chỉ chạy lúc import toàn bộ. Khi thêm điểm đến MỚI từng cái một,
   bài CŨ nhắc tới điểm mới sẽ không có link → cần job "re-link" chạy lại được.
3. Content là HTML (không phải markdown như bài WordPress) → cần bước render
   markdown → HTML sạch trước khi publish (tái dùng export HTML của M3).
4. DB SQL Server nằm trên hosting bên ngoài (site4now.net) → mọi thao tác phải có
   timeout + retry, và connection string là secret (env var).

## 2) Yêu cầu nghiệp vụ (từ docs/idea.md — định hướng 12/06/2026)
1. Tạo bài điểm đến mới bằng AI theo format chuẩn SEO, giọng văn tự nhiên như người viết.
2. Cập nhật bài đã có bằng nút bấm (thủ công trước, tự động để giai đoạn sau).
3. Giữ cơ chế quan hệ điểm đến: bài A nhắc tới điểm B → tự thành link nội bộ.
4. Toàn bộ bài viết quản lý trong AI tool; duyệt xong thì ghi **trực tiếp** vào
   SQL Server của dichoithoi (không qua CMS, không qua Google Sheet nữa).
5. Menu riêng trong UI vì luồng data khác hẳn bài affiliate.

### 2.1 Input cho 1 bài điểm đến (người dùng cung cấp)
AI dựa trên input + kiến thức nền để viết, KHÔNG bịa dữ liệu cứng:

| Trường | Nguồn |
|---|---|
| Tên | nhập tay |
| Địa chỉ — **cả cũ VÀ mới sau sáp nhập tỉnh/thành** | nhập tay |
| Vị trí (lat/lng) + khoảng cách tới trung tâm | nhập tay / lấy từ mirror / **dán link Google Maps → tự parse** (đề xuất 07/2026, xem §2.1.1) |
| Liên hệ (điện thoại, website chính thức) | nhập tay |
| Giờ mở cửa | nhập tay HOẶC đưa URL tham khảo để tool tự lấy |
| Giá vé | nhập tay HOẶC đưa URL tham khảo để tool tự lấy |
| Thông tin tổng quát / ghi chú | nhập tay (tùy chọn) |
| URL tham khảo chung | 0-n link, mỗi trường có thể có nguồn riêng |
| Link mua vé online (`ticketLinks[]` — nhiều nhà cung cấp: Klook, TripVision...) | nhập tay (tùy chọn, 0-n dòng — xem §2.3, thay cho `bookingUrl` 1 link cũ) |
| Khách sạn gợi ý | quản lý ở module Hotel riêng, gán qua `HotelDestinationMap` — không nhập ở form này (kiếm tiền khách sạn — §2.3, xem `dichoithoi-hotel-spec.md`) |

Lưu ý "địa chỉ cũ và mới": sau đợt sáp nhập tỉnh/thành, bài viết phải ghi rõ cả 2
để người đọc tra cứu — đưa vào prompt và structure gate (§6.1).

### 2.1.1 Nhập toạ độ qua link Google Maps (chốt scope 07/2026)

Vấn đề: nhập tay lat/lng từng điểm đến bất tiện (phải tự tra rồi copy 2 số).
Giải pháp đã chốt — **CHỈ làm phần parse link, KHÔNG dùng Google Places API**:

- Thêm 1 ô "Dán link Google Maps" trong form sửa điểm đến, cạnh 2 ô lat/lng
  hiện có (vẫn giữ 2 ô này để sửa tay/fallback).
- Parse thuần bằng regex trên chuỗi URL công khai (không gọi API, không tốn
  phí, không vi phạm ToS Google — chỉ đọc cấu trúc URL):
  - Ưu tiên đọc cặp `!3d{lat}!4d{lng}` trong tham số `data=` nếu có (toạ độ
    chính xác của ghim/marker).
  - Fallback về `@{lat},{lng},{zoom}z` nếu không có `!3d!4d`.
  - Link rút gọn (`maps.app.goo.gl/...`) không chứa toạ độ trong chuỗi — cần
    1 request HTTP theo redirect để lấy URL đầy đủ trước khi parse (vẫn hợp
    lệ: chỉ theo redirect công khai, không scrape nội dung trang).
- Kết quả tự điền vào 2 ô lat/lng có sẵn — người dùng vẫn xem/sửa được trước
  khi lưu, không tự động ghi thẳng không qua kiểm tra.
- Các thông tin khác của điểm đến (tên, địa chỉ, giờ mở cửa...) vẫn **nhập tay
  hoàn toàn** như hiện tại — không tự động điền từ Google Maps ở scope này.

### 2.1.2 Ý tưởng nâng cao — Google Places API (ưu tiên THẤP, ghi lại để làm sau)

⚠️ **CHƯA làm, chỉ ghi lại mục đích để tham khảo khi có nhu cầu/ngân sách API.**
Khác §2.1.1 (parse URL miễn phí), nhóm này cần gọi **Google Places API chính
thức** (trả phí theo lượt, cần tài khoản Google Cloud + billing) — KHÔNG được
scrape trực tiếp trang Google Maps (vi phạm ToS, rủi ro bị chặn/pháp lý).

Các mục đích dự kiến dùng API này khi triển khai:
1. **Tự điền field còn trống** (Place Details): giờ mở cửa, địa chỉ chuẩn,
   loại hình — chỉ điền field TRỐNG, không ghi đè field đã có, hiển thị rõ
   "gợi ý từ Google Maps — cần xác nhận" để người dùng duyệt trước khi lưu
   (không tự động publish thẳng).
2. **Lấy thêm thông tin tham khảo**: rating/số lượt đánh giá của Google (khác
   nguồn với `DestinationReview` nội bộ site — không được trộn 2 số này làm 1
   khi hiển thị).
3. **Gợi ý điểm đến con trong cùng khu** (Nearby Search): với điểm đến kiểu
   khu phức hợp (vd Suối Tiên có nhiều khu nhỏ), gợi ý danh sách địa điểm
   Google tìm thấy gần đó cho người biên tập cân nhắc tạo thành điểm đến con
   (dùng quan hệ `parent`/`children` đã có) — chỉ là công cụ gợi ý nội bộ,
   KHÔNG tự động tạo/publish điểm đến mới.
4. **Lưu `place_id`** cạnh lat/lng khi có gọi API lần đầu — Google cho phép
   cache `place_id` vô thời hạn (khác các field khác có giới hạn cache), giúp
   lần sau không cần tìm kiếm lại bằng tên/toạ độ.

Ảnh từ Google Maps: **KHÔNG tải/lưu ảnh của Google về server** (rủi ro bản
quyền/ToS) — chỉ hiển thị 1 link/nút "Xem ảnh & đánh giá trên Google Maps" dẫn
thẳng ra trang địa điểm đó. Nếu cần ảnh xem trước trên site, dùng ảnh tự upload
(`GalleryJson`), không lấy từ Google.

**Cập nhật vị trí 07/2026** (chỗ đặt cũ "cạnh khối bản đồ nhúng" đã lỗi thời —
map nhúng đã bỏ hẳn, xem `content-seo-ux-plan.md` phần map removal): nút này
dời sang **cạnh khối "Đánh giá biên tập"** (§2.2 nhóm F) — ghép logic tự nhiên
"đây là góc nhìn của chúng tôi" + "xem thêm ý kiến người khác ở nơi khác". Mở
rộng thành mục **"Xem thêm trên"** gồm tối đa 2 link tham khảo độc lập (không
phải affiliate, không bán vé): Google Maps (đã có kế hoạch) + **TripAdvisor**
(mới, nếu điểm đến có trang TripAdvisor) — nhập tay URL, không gọi API. Cả 2
gắn `rel="nofollow"` (không cho đi PageRank) nhưng vẫn hữu ích cho người đọc —
lấp khoảng trống review thật sau khi đã gỡ review tự nhập (§1). Dùng style
"trung tính" trong hệ card đã chốt (content-seo-ux-plan §10.6.5), KHÔNG dùng
màu Accent — đây không phải CTA mua hàng, tránh nhầm với nút vé/đặt phòng.

**Phân biệt với nền tảng CÓ BÁN VÉ** (Traveloka, Klook...): nếu điểm đến có
bán vé qua các nền tảng này VÀ có chương trình affiliate, KHÔNG thêm như link
tham khảo ở đây — đi qua đúng cơ chế `ticketLinks[]` đã có (§2.3), giống
Klook/TripVision. Việc cần làm là kiểm tra Traveloka có affiliate program hay
không (việc kinh doanh, không phải thiết kế lại).

Thiết kế khi triển khai (để tránh tốn phí không kiểm soát): nút bấm thủ công
"Lấy thông tin từ Google Maps" trong form, gọi 1 lượt duy nhất khi người dùng
chủ động bấm — KHÔNG chạy job nền tự động/định kỳ gọi lại API.

### 2.2 Khung thông tin theo từng khối — phân loại nguồn gốc A-F (CHỐT 07/2026,
thay bảng cũ, đủ mọi khối đã chốt ở `content-seo-ux-plan.md` §10.6.2/§10.6.3)

**6 nhóm nguồn gốc nội dung** — quyết định AI có sinh nội dung hay không, và
sinh theo hình thức nào:

| Nhóm | Ý nghĩa | Cơ chế sửa/lưu |
|---|---|---|
| **A. AI viết (văn xuôi)** | Nằm trong outline → expand theo prompt pack | Draft → editor sửa văn bản thường → Approve → Publish (cơ chế đã có, không cần xây thêm) |
| **B. AI viết CÓ CẤU TRÚC** | Output JSON schema riêng, không phải đoạn văn | Editor phải có **form riêng** theo từng field (không hiện JSON thô) — xem ví dụ Lịch trình dưới |
| **C. Nhập tay 100%, AI KHÔNG đụng** | Dữ liệu cứng/quyết định kinh doanh | Form nhập liệu thường trong màn sửa điểm đến |
| **D. Tự tính, KHÔNG AI KHÔNG nhập tay** | Máy tính từ dữ liệu đã có (bake `DynamicBlocksJson`, `RelatedJson`...) | Không có UI sửa nội dung — chỉ sửa DỮ LIỆU NGUỒN (vd sửa giá Hotel) rồi hệ thống tự tính lại |
| **E. AI gợi ý draft, BẮT BUỘC duyệt/sửa** | Ảnh hưởng an toàn thực tế, không tự publish | Giống nhóm A nhưng gate chặn Approve nếu chưa có thao tác xem/sửa từng dòng |
| **F. Nhập tay, mang tính quan điểm** | Tiếng nói biên tập thật, KHÔNG phải AI generate thay | AI chỉ được **gợi ý draft**, bắt buộc biên tập viết lại bằng giọng riêng trước Approve (mạnh hơn nhóm E — không chỉ duyệt, phải viết lại) |

**Nguyên tắc chung mọi nhóm A/B/E/F**: dùng đúng cơ chế draft→review→approve→
publish + lưu version đã có (spec chính §7) — AI tạo draft, người dùng luôn
sửa được và lưu lại trước khi publish, không có đường tắt.

#### Bảng khối — `kind=poi` (vd Biệt Thự Hằng Nga)

| # | Khối | Nhóm | Map dữ liệu |
|---|---|---|---|
| 1 | Tổng quan/giới thiệu | A | `Content` (intro) |
| 2 | Vị trí + khoảng cách + chỉ đường | C (nhập) + D (hiện) | `Address`/`Lat`/`Lng`/`DistanceFromCenter` |
| 3 | Giờ mở cửa & giá vé | C | `OpeningTime`/`TicketPrice`/`ticketLinks[]` |
| 4 | Trải nghiệm/chơi gì ✅ ĐÃ XONG (07/2026 — blockKey `trai-nghiem`, danh sách hành động cụ thể KHÁC "điểm tham quan"/vị trí, đối chiếu TripAdvisor: mô tả dài không thay được danh sách hành động ngắn) | A | `Content` (sections, dạng list `items[]`) |
| 4b | Lịch trình gợi ý ✅ MỚI (07/2026 — blockKey `lich-trinh`; với POI là 1 điểm lẻ nên viết "nên dành bao lâu + kết hợp điểm nào gần đó", KHÁC bản Flagship là lịch trình nhiều ngày) | A | `Content` (section, prose) |
| 5 | Ăn uống gần đó | A | `Food` |
| 6 | Thời điểm đẹp (giờ/mùa) | A | `Content` (section) |
| 7 | Di chuyển (chặng cuối từ trung tâm cụm) | A | `Transport` |
| 8 | Câu chuyện văn hoá - lịch sử ✅ ĐÃ XONG (Phase 12) | A | `Content` (section mới — content-seo-ux-plan §5.6) |
| 9 | Chi phí ước tính ✅ ĐÃ XONG (Phase 12) | D | Tính từ `TicketPriceFrom`/Hotel/Tour `PriceFrom` (§5.4) |
| 10 | Giá vé theo đối tượng ✅ ĐÃ XONG (Phase 12) | C | `PriceBreakdownJson` + `price` trong `ticketLinks[]` (§5.5) |
| 11 | Mẹo & lưu ý thực tế | E | `PracticalNotesJson` (§5.7) |
| 12 | Banner khách sạn / Card tour | D | `DynamicBlocksJson["hotels"/"tours"]` |
| 13 | Banner "Về {node cha}" | D | Template cố định + `AncestorsJson` (§10.6.3) |
| 14 | FAQ | A | `FaqJson` |
| 15 | Đánh giá biên tập + "Xem thêm trên" (Google Maps/TripAdvisor) | F + C | Field riêng (chưa đặt tên cột) + `ExternalReviewUrls` (Google Maps/TripAdvisor, nhập tay, `rel=nofollow` — §2.1) |
| 16 | Điểm đến liên quan | D | `RelatedJson` |
| 17 | Disclosure affiliate | — (template tĩnh, không A-F) | Cố định trong layout |

#### Bảng khối — node `ContentTier=Flagship` (vd Đà Lạt)

| # | Khối | Nhóm | Map dữ liệu |
|---|---|---|---|
| 1 | Tổng quan/giới thiệu | A | `Content` (intro, viết theo §10.6.2 khối 1) |
| 1b | Trải nghiệm gì ✅ ĐÃ XONG (07/2026 — blockKey `trai-nghiem`, hoạt động tiêu biểu CẢ VÙNG, danh sách hành động chứ không phải tên điểm con) | A | `Content` (section, dạng list `items[]`) |
| 2 | Nên đi mùa nào | A | `Content` (section) |
| 3 | Lịch trình gợi ý (2N1D/3N2D/4N3D) | A (ĐỔI 07/2026, xem ghi chú dưới bảng) | `Content` (section, blockKey `lich-trinh`, prose — KHÔNG còn JSON riêng) |
| 3b | Link bài cẩm nang lịch trình | D | `ArticleDestinationMap` (topic=itinerary) |
| 4 | Di chuyển — cách tới nơi + trong khu vực | A | `Content` (section) |
| 4b | Card vé máy bay/xe khách | D | `DynamicBlocksJson["transports"]` |
| 5 | Điểm tham quan (2 lớp: nổi bật + theo khu vực) | **D hoàn toàn** — không AI viết gì | `ChildrenJson`+`IsFeatured`+`Order`+`DistanceFromCenter` |
| 5b | Link bài cẩm nang điểm tham quan | D | `ArticleDestinationMap` (topic=poi-guide) |
| 6 | Ăn gì đặc trưng | A | `Food` (viết sâu hơn POI — món, không tên quán) |
| 6b | Link bài cẩm nang ẩm thực | D | `ArticleDestinationMap` (topic=food) |
| 6c | Buổi tối làm gì — link bài cẩm nang *(khối mới 07/2026, chỉ hiện khi có bài)* | D | `ArticleDestinationMap` (topic=nightlife) |
| 7 | Mẹo & lưu ý thực tế | E | `PracticalNotesJson` |
| 8 | Quà mang về (mô tả đặc sản) | A | `Content` (section mới) |
| 8b | Card sản phẩm mua sắm + link bài cẩm nang | D | `DynamicBlocksJson["souvenirProducts"]` + `ArticleDestinationMap` (topic=souvenir) |
| 9 | FAQ (tầm thành phố) | A | `FaqJson` |
| 10 | Đánh giá biên tập + "Xem thêm trên" (Google Maps/TripAdvisor) | F + C | Field riêng, chung cơ chế với POI (§2.1) |
| 11 | Điểm đến liên quan (loại trừ con, ưu tiên anh em/vùng) | D | `RelatedJson` (công thức riêng Flagship) |
| — | `ContentTier` | C | Gán tay, không AI (§7.3) |
| — | Disclosure affiliate | — | Cố định trong layout |

**Cơ chế chọn đúng bộ khối khi tạo outline**: bước "Tạo outline" (spec chính
§7) đọc `kind`+`ContentTier` của điểm đến TRƯỚC khi chọn đúng bảng khối A/B ở
trên — Flagship và POI có bộ khối nhóm A/B khác nhau hoàn toàn (Flagship có
Lịch trình/Mùa/Di chuyển 2 chiều; POI có Giờ mở cửa/Giá vé). Nhóm C/D/E/F
không nằm trong outline AI sinh — ghép vào cùng trang lúc publish từ field/cơ
chế riêng của từng nhóm.

Prompt pack ép đủ các khối nhóm A/B theo đúng bảng khối tương ứng; khối nào
không áp dụng (vd điểm miễn phí không có giá vé) phải ghi rõ thay vì bỏ trống
— structure gate kiểm tra (§6). Khối #8 (câu chuyện văn hoá - lịch sử) đã vào
prompt pack + structure gate thật (Phase 12, `CULTURAL_STORY_HEADING_KEYWORDS`
ở `destination-gates.ts`).

**"Lịch trình gợi ý" đổi từ nhóm B sang nhóm A (07/2026)**: trước đây là JSON
có cấu trúc riêng (`ItineraryJson` — form nhập tay theo ngày/buổi, `poiSlug`
tự động gắn link nội bộ, CTA "tour N ngày phù hợp" tự khớp theo `duration_days`
đếm từ số ngày). Theo quyết định của chủ site, đổi thành prose thường trong
`sections[]` (blockKey `lich-trinh`) như mọi khối khác — đổi lấy 1 UX soạn bài
duy nhất (AI viết + editor tự do sửa), chấp nhận **mất 2 tính năng tự động**:
link POI không còn đảm bảo đúng (chỉ còn auto-link theo tên khớp chữ), và CTA
tour không còn tự khớp theo số ngày. Cột `ItineraryJson` trên SQL Server
(schema do dichoithoi sở hữu) không bị xoá — chỉ ngừng đọc/ghi từ 07/2026, dữ
liệu cũ trên đó coi là rác. Xem `apps/api/src/migrations/1782070000000-DestinationDropItinerary.ts`
(xoá cột mirror Postgres — khác SQL Server) và `DiChoiThoi.Web/Views/Destination/Detail.cshtml`
(gỡ khối render cũ, giữ lại riêng link "Xem lịch trình chi tiết" tới bài cẩm
nang `topic=itinerary` — đây là cơ chế khác, không phụ thuộc `ItineraryJson`).

**"Mẹo & lưu ý thực tế" BỎ khỏi `sections[]` (07/2026, còn 7 khối)**: từng có
blockKey `meo-luu-y` (prose, do AI viết trong outline) — phát hiện khi rà lại
kiến trúc rằng chủ đề này ĐÃ có 2 nguồn khác chạy song song và **đã hiện trùng
thật trên live site** (`Detail.cshtml` §`#meo` render 2 khối `<details>` cạnh
nhau: `Tip` (quickFacts, AI viết) và `PracticalNotesJson` (nhóm E, AI gợi ý +
duyệt tay)). Thêm blockKey thứ 3 chỉ làm nặng hơn, không giải quyết gốc rễ.
Bỏ khối này, giữ nguyên `Tip`/`PracticalNotesJson` như cũ. Khối `meo-luu-y`
VẪN còn trong enum `DestinationBlockKey` + `DESTINATION_BLOCK_LABELS` (nhãn
đổi thành "Mẹo & lưu ý thực tế (cũ)") để bài cũ đã gán blockKey này vẫn hiển
thị đúng — chỉ không còn nằm trong `DESTINATION_SECTION_ORDER` nên AI/editor
không tạo mới nữa.

**Còn tồn đọng (CHƯA xử lý, ghi nhận để làm sau)**: "Di chuyển" và "Ăn gì đặc
trưng" có cùng kiểu trùng y hệt — `quickFacts.transport`/`quickFacts.food`
(cột `Transport`/`Food`) render thành khối riêng trên web (`#di-chuyen`,
`#an-uong`), ĐỘC LẬP với section cùng tên trong `sections[]` (`di-chuyen`,
`an-gi`) — 2 lần AI viết cho cùng 1 câu hỏi, không đối chiếu nhau. Mức độ nhẹ
hơn "mẹo & lưu ý" (chỉ 2 nguồn, không phải 3) nên tạm giữ nguyên, ưu tiên xử
lý sau nếu cần.

### 2.2.1 Ghi chú/tư liệu tham khảo — bổ sung chi tiết đặc trưng cho từng khối
(CHỐT 07/2026, giải quyết vấn đề "nội dung AI viết đạt gate nhưng chung chung")

1 ô nhập tự do, KHÔNG bắt buộc, trong form điểm đến (tab Thông tin/Nội dung) —
khuyến khích ghi theo tên khối để dễ đối chiếu (không ép cấu trúc cứng):
```
Tổng quan: kiến trúc sư Đặng Việt Nga, cảm hứng từ Gaudí, xây từ 1990, vẫn
đang mở rộng
Trải nghiệm: có các phòng đặt tên theo con vật (Kiến, Đại Bàng, Hổ), cầu thang
xoắn hẹp
Mẹo: buổi tối khá rùng rợn vì ánh sáng yếu, nên đi ban ngày nếu sợ
Ăn uống: gần đó có quán bánh tráng nướng khá nổi ở đầu đường
```

**Cách AI dùng**: mỗi lần generate 1 khối (nhóm A/B, §2.2), prompt kèm theo
TOÀN BỘ nội dung ô này (không tách nhỏ theo khối, đỡ rối form) cùng chỉ dẫn:
*"Nếu có ghi chú liên quan tới khối đang viết, PHẢI dùng đúng chi tiết đó,
không viết chung chung thay thế; KHÔNG được tự bịa thêm sự kiện ngoài ghi chú
và dữ liệu đã có"* — đúng nguyên tắc "AI không bịa dữ liệu cứng" áp dụng xuyên
suốt dự án, mở rộng sang cả tình tiết/chi tiết đặc trưng, không chỉ số liệu.

Không bắt buộc điền — bỏ trống thì AI vẫn viết dựa trên field sẵn có
(`Content`/`Food`/`Tip`...) như bình thường; ô này chỉ "tăng lực" cho nội dung
cần đặc biệt hơn (ưu tiên điền cho node Flagship/POI nổi tiếng — cùng tinh
thần ưu tiên theo `ContentTier` áp dụng xuyên suốt §10.6.1-§10.6.5
content-seo-ux-plan), không phải điều kiện publish.

**Nguồn tự động cho ô này — "Đọc nội dung từ website chính thức" (CHỐT
07/2026)**: mở rộng đúng pattern đã áp dụng cho Google Maps ở §2.1 ("tự điền
field còn trống, gợi ý — cần xác nhận") sang website chính thức
(`ContactWebsite`, §2.2/§7.3):
1. Khi điểm đến đã có `ContactWebsite`, hiện 1 nút bấm TAY (không tự
   động/định kỳ — tránh tốn phí/vi phạm ToS, cùng nguyên tắc Google Maps) —
   "Đọc nội dung từ website".
2. AI đọc trang web đó, trích thông tin thực tế: **hoạt động/trải nghiệm có
   thể làm** (chèo thuyền, tham quan xưởng, chụp ảnh...), **dịch vụ tại chỗ**
   (cho thuê đồ, hướng dẫn viên, ăn uống, giữ xe...), giờ mở cửa/giá vé nếu có
   — đúng nhu cầu "cho người đọc biết tới đó có thể làm gì/dùng dịch vụ gì".
3. Kết quả đổ THẲNG vào ô "Ghi chú/tư liệu tham khảo" trên, gắn nhãn rõ "Trích
   từ website chính thức — cần xác nhận" — KHÔNG tự ghi vào bài đã publish.
   Người dùng xem/sửa/xoá trước khi generate — không có đường tắt tự publish
   thẳng, đúng nguyên tắc "AI không bịa, luôn qua duyệt".
4. **Không copy nguyên văn** — khi AI dùng chi tiết này để viết khối chính
   thức (§2.2), phải diễn đạt lại bằng lời riêng, tránh trùng lặp nội dung với
   chính website nguồn (hại SEO cho cả 2 bên).

Lợi ích chính: mở rộng quy mô nội dung đặc trưng (không chỉ node có admin tự
gõ tay chi tiết) — hầu hết điểm đến đã có sẵn thông tin chuẩn trên website
riêng, tận dụng được thay vì AI phải viết chung chung vì thiếu nguồn.

### 2.2.2 Điểm độ phủ nội dung — Content Coverage Score (CHỐT 07/2026)

Mỗi điểm đến có 1 **thang đánh giá độ đầy đủ nội dung** — nhóm **D** (tự tính
từ dữ liệu sẵn có, không AI, không nhập tay), CHỈ hiện NỘI BỘ trong CMS
zinoflow, KHÔNG phơi ra website.

**Mục đích**: người vận hành nhìn vào biết ngay điểm nào đang "mỏng" và thiếu
đúng mục gì để bổ sung — đây là công cụ chủ động chống "scaled content abuse"
(seo-principles §3): làm dày từng điểm theo checklist thay vì xả hàng loạt
trang mỏng giống nhau.

**Checklist tính điểm — theo đúng bảng khối §2.2, KHÁC NHAU giữa 2 tier**:
- POI: đủ field thực dụng (Address/giờ/giá vé), toạ độ, ảnh (≥N ảnh gallery),
  Content các section nhóm A, FAQ, mẹo thực tế (E đã duyệt), đánh giá biên tập
  (F), external review link, ≥1 chủ đề (tag) đã gắn (§2.4).
- Flagship: như trên + lịch trình (B), điểm tham quan con có `IsFeatured`,
  và **độ phủ bài cẩm nang theo topic** (`ArticleDestinationMap` —
  article-spec §8.1): mỗi topic áp dụng (`itinerary`/`food`/`souvenir`/
  `nightlife`/`poi-guide`) chưa có bài nào gắn vào = 1 mục ⚠️ thiếu.

**Hiển thị**:
1. Màn chi tiết điểm đến (§7.3): panel checklist ✅/⚠️ từng mục; mục "chưa có
   bài viết topic X" có nút đi thẳng sang màn tạo Article với destination +
   topic điền sẵn.
2. Màn danh sách (§7.2): cột/badge % tổng để quét nhanh, sort/filter được
   theo % — ưu tiên bổ sung node Flagship/nổi tiếng trước (đúng tinh thần ưu
   tiên theo `ContentTier`).

Trọng số/ngưỡng % cụ thể từng mục: chốt lúc build, không chốt cứng ở spec —
nhưng nguyên tắc cố định là **điểm chỉ phản ánh dữ liệu THẬT đã có** (bài đã
publish, field đã điền), không tính draft chưa duyệt.

### 2.3 Kiếm tiền trên bài điểm đến (khách sạn + vé online + tour)
Mô hình: bài điểm đến kéo organic traffic → chuyển đổi qua 3 kênh affiliate:
1. **Khách sạn**: module Hotel riêng (`dichoithoi-hotel-spec.md`) — zinoflow là
   CMS (cào/nhập tay), render theo `HotelDestinationMap` gán cho điểm đến (§4
   của spec đó — thay cho `HotelGroupId` cũ). Việc gán khách sạn nằm ở màn
   quản lý Hotel, không phải form điểm đến; mục "Lưu trú" trong bài chỉ dẫn
   người đọc xuống khu khách sạn hiển thị.
2. **Vé online**: thêm input `ticketLinks[]` — DANH SÁCH 0-n link affiliate
   (quyết định 07/2026, thay cho `bookingUrl` 1 link cũ), mỗi dòng gồm
   `{provider, label, sourceUrl, affiliateUrl, linkStatus}` (`provider` gợi ý
   sẵn: `klook` | `tripvision` | `bestprice` | `other`; `label` hiển thị trên
   nút, vd "Đặt vé qua Klook") — người dùng chỉ nhập `sourceUrl` (link gốc),
   `affiliateUrl` TỰ SINH theo rule cấu hình sẵn, KHÔNG nhập tay link affiliate
   (xem cơ chế chung `dichoithoi-affiliate-link-conversion-spec.md`). Có ≥1
   dòng `linkStatus != 'no-rule'` (hoặc chấp nhận dùng `sourceUrl` khi chưa có
   rule) → bài chèn khối CTA "Mua vé online" (1 nút cho mỗi link, xem thứ tự
   hiển thị ở `dichoithoi-content-seo-ux-plan.md` §2) ngay cạnh mục giá vé.
   Data gate: mỗi `sourceUrl` phải hợp lệ (http/https); KHÔNG có dòng nào hợp
   lệ thì không chèn khối CTA.
3. **Tour**: module Tour riêng (`dichoithoi-tour-spec.md`, quyết định 07/2026)
   — tour gắn vào 1 HOẶC NHIỀU điểm đến (kể cả điểm liên quan, không chỉ điểm
   đang xem), hiển thị dạng card gợi ý "Tour {tên}" tương tự khối khách sạn,
   dùng chung cơ chế `sourceUrl → affiliateUrl` ở trên. AI tool KHÔNG generate
   nội dung tour, chỉ hiển thị data đã nhập/cào.
Nguyên tắc policy: CTA trung thực, không cam kết "giá rẻ nhất"; giá hiển thị luôn
kèm lưu ý thay đổi (§6.3); nhiều nhà cung cấp không sắp xếp theo "rẻ nhất trước"
trừ khi có dữ liệu giá thật kèm theo — mặc định giữ thứ tự người dùng nhập.

### 2.4 Chủ đề (tag) điểm đến — quy trình AI gán + soạn mô tả (CHỐT 07/2026)

Nền tảng DB + luật SEO (bộ từ vựng đóng, không trùng nghĩa Type, ngưỡng ≥5
điểm mới index): `dichoithoi-database-redesign.md` §3.2.1. Trang public:
`/chu-de/{slug}` (`content-seo-ux-plan.md` §10.3). Phần này chốt quy trình
làm việc trong CMS zinoflow — cả 3 bước đều **gợi-ý-rồi-duyệt**, không bao
giờ tự gán/tự publish im lặng:

0. **Bước 0 — thiết kế bộ từ vựng ban đầu (YÊU CẦU 07/2026, làm 1 lần trước
   khi build UI/seed)**: KHÔNG tự nghĩ bộ tag trên giấy — AI (phiên làm việc
   Claude, không phải tính năng CMS) phải **đọc danh sách TOÀN BỘ điểm đến
   thật từ DB** (~271 điểm hiện tại: tên, loại, content), rà lại luôn hệ
   thống `DestinationType`/`DestinationTypeGroup` hiện có (loại nào thừa/
   thiếu/trùng nghĩa, điểm nào đang phân loại sai), rồi đề xuất TRỌN BỘ:
   danh sách tag ~10-20 chủ đề (mỗi tag kèm tiêu chí gán + đếm sơ bộ bao
   nhiêu điểm hiện tại đạt — tag nào < 5 điểm thì loại khỏi đợt đầu) + đề
   xuất chỉnh sửa taxonomy Type nếu có. Người dùng xem toàn bộ và duyệt
   TRƯỚC khi seed bảng `DestinationTag` hay gán bất kỳ điểm nào.

   **KẾT QUẢ Bước 0 (đã chạy 07/2026 trên `dichoithoi_dev`, 271 điểm — chờ
   bạn duyệt trước khi seed):**

   **✅ ĐÃ DUYỆT 07/2026** — áp dụng khi seed migration v2 (Phase B), không
   cần hỏi lại.

   *A. Đánh giá taxonomy Type hiện có (`v2.DestinationTypeGroup`/`DestinationType`)*
   — cấu trúc 3 nhóm/18 loại hiện tại (Thiên nhiên: Biển-Đảo, Núi-Cao nguyên,
   Sông-Suối-Hồ-Thác, Hang động, Rừng-Vườn quốc gia, Đồng quê miền Tây; Văn
   hóa-Lịch sử: Di tích lịch sử, Chùa-Đền-Miếu, Nhà thờ, Làng nghề truyền
   thống, Bảo tàng, Công trình kiến trúc; Vui chơi-Trải nghiệm: Khu vui
   chơi-Giải trí, Check-in sống ảo, Chợ-Phố đêm, Khu-Phố ẩm thực, Phố cổ-Phố
   đi bộ, Nghỉ dưỡng) — **KHÔNG có loại nào thừa/trùng nghĩa rõ**, không cần
   gộp/tách nhóm. Phát hiện 2 vấn đề cụ thể, cả 2 xử lý được ngay không cần
   đổi cấu trúc:

   **CẬP NHẬT 17/07/2026 (relations-plan §6.0b/§B1)**: "Check-in sống ảo" và
   "Nghỉ dưỡng" đã bị RÚT khỏi `v2.DestinationType` — 2 tag này mô tả trải
   nghiệm/mục đích cắt ngang, không phải loại nơi chốn cố định, nên chuyển
   sang hệ thống `v2.DestinationTag`/trang `/chu-de` đã có sẵn. Taxonomy Type
   hiện tại còn ĐÚNG 16 loại (Vui chơi-Trải nghiệm còn 4: Khu vui chơi-Giải
   trí, Chợ-Phố đêm, Khu-Phố ẩm thực, Phố cổ-Phố đi bộ). Danh sách bên dưới
   giữ nguyên để lưu lại bối cảnh audit gốc 07/2026, không sửa lại theo hiện
   trạng mới.
   - **10 điểm (`kind=poi`) đang KHÔNG có Type nào** (chặn hiển thị đúng ở
     `/loai`): Cơ sở sản xuất rượu Sim, Đồi chè Tân Cương, Làng hoa Thái
     Phiên, Nhà thùng sản xuất nước mắm → gán `Làng nghề truyền thống`; Dalat
     Fairytale Land, Đồi cỏ hồng Đà Lạt, Đồi Cù, Vườn Ánh Sáng Lumiere → gán
     `Check-in sống ảo` (+ `Khu vui chơi - Giải trí` nếu có dịch vụ); Hà
     Tiên, Mũi Cà Mau → 2 điểm mang tính địa danh/mũi đất, đề xuất tạm không
     ép Type (giữ như điểm địa lý phụ, không phải lỗi).
   - **Loại `Di tích lịch sử` đang bị gán RỘNG quá mức** (35/271 điểm, gấp
     đôi loại đông thứ 2) — lẫn cả điểm KHÔNG phải di tích lịch sử: **Vịnh Hạ
     Long** (di sản thiên nhiên, không phải di tích lịch sử), **Biệt thự
     Hằng Nga/Crazy House** (công trình kiến trúc hiện đại thập niên 1990,
     không phải di tích), **Bãi đá cổ Sa Pa** (cảnh quan tự nhiên gắn truyền
     thuyết, không phải di tích). Đề xuất: khi chạy bước 2 (AI rà chiều
     ngược) ưu tiên rà lại đúng 35 điểm này trước, gỡ Type cho ít nhất 3 điểm
     kể trên. *(Lưu ý: Biệt thự Hằng Nga là 1 trong 2 điểm pilot Phase E —
     nên sửa ngay khi duyệt, không đợi tới đợt rà toàn bộ).*

   *B. Đề xuất bộ tag ~10-20 chủ đề cắt ngang* — chỉ giữ tag nào (a) không
   trùng nghĩa 1-1 với 1 Type sẵn có (loại "Tâm linh", "Ẩm thực", "Nghỉ dưỡng
   cao cấp" khỏi danh sách vì đã trùng gần hết với Type "Chùa-Đền-Miếu"/"Khu-
   Phố ẩm thực"/"Nghỉ dưỡng"), (b) có ≥5 điểm đạt dựa trên dữ liệu content
   thật (tên + mô tả 271 điểm, không suy đoán):

   | # | Tag đề xuất | Tiêu chí gán | Đếm sơ bộ (thật) |
   |---|---|---|---|
   | 1 | Hoang sơ — Ít người biết | Mô tả nhấn "hoang sơ/hoang dã/chưa nhiều người biết", cắt ngang biển/đảo/bản làng/thác | ~27 |
   | 2 | Lãng mạn — Check-in cặp đôi | Mô tả nhấn "lãng mạn/thơ mộng/mộng mơ", cắt ngang đồi/hồ/kiến trúc Pháp/khu vui chơi | ~22-25 |
   | 3 | Mạo hiểm — Trekking — Phượt | Địa hình khó (đèo, núi cao, hang, rừng nguyên sinh) đòi hỏi thể lực, khác "hoang sơ" (offbeat) ở việc nhấn thử thách thể chất | ~20-25 |
   | 4 | Di sản — Kỷ lục thế giới | Được công nhận chính thức (UNESCO/khu dự trữ sinh quyển/kỷ lục) — Vịnh Hạ Long, Cù Lao Chàm, Phố cổ Hội An, Tràng An... | ~15 |
   | 5 | Biểu tượng địa phương — Phải ghé | Điểm "must-see" gắn liền hình ảnh 1 thành phố (cầu Rồng, cầu Trường Tiền, chợ Bến Thành, Nhà thờ Đức Bà, Tháp Bà Ponagar) | ~15-20 |
   | 6 | Văn hóa dân tộc thiểu số | Bản làng/chợ phiên gắn đời sống đồng bào dân tộc (Sa Pa, Hà Giang, Yên Bái, Sơn La) | ~12-15 |
   | 7 | Lịch sử chiến tranh — Cách mạng | Di tích gắn giai đoạn kháng chiến cụ thể (Địa đạo Củ Chi, Nhà tù Hỏa Lò, Pác Bó...) — hẹp hơn Type "Di tích lịch sử" chung | ~8-10 |

   **Theo dõi thêm (chưa đủ dữ liệu để chốt ngay, AI sẽ đọc kỹ hơn ở Bước 1
   khi gán tay từng tag)**: "Đặc sản — Quà lưu niệm" (~7 điểm, sát ngưỡng 5,
   liên quan topic `souvenir` của Article) và "Săn mây — Ngắm bình minh/hoàng
   hôn" (chưa đo được số chính xác bằng từ khóa, cần AI đọc mô tả kỹ hơn) —
   để lại xét ở Bước 1, không đưa vào seed đợt đầu. Loại khỏi danh sách vì
   tín hiệu quá yếu trong content hiện tại: "Gia đình — Trẻ em" (chỉ 1 điểm
   nhắc tới), "Phim trường/nổi tiếng qua MXH" (dưới ngưỡng 5).

   → Nếu duyệt: seed 7 tag trên vào `DestinationTag`, sửa 10 điểm thiếu Type
   + gỡ Type sai cho ≥3 điểm nêu trên NGAY trong migration v2 (Phase B),
   trước khi chạy Bước 1 (gán tay hàng loạt).

1. **Gán chủ đề hàng loạt** (màn Công cụ §7.6): chọn 1 tag (vd "Kiến trúc")
   → AI đọc toàn bộ điểm đến (tên + content + ghi chú tham khảo §2.2.1) →
   trả danh sách đề xuất **kèm lý do 1 dòng** (vd "Biệt Thự Hằng Nga — công
   trình của KTS Đặng Việt Nga, phong cách biểu hiện") → người dùng tick
   duyệt/bỏ từng dòng rồi mới ghi `DestinationTagMap`.
2. **AI rà chiều ngược**: cùng màn đó, AI chỉ ra (a) điểm đang gắn tag mà có
   vẻ SAI (đề xuất gỡ, kèm lý do), (b) tag đang dưới ngưỡng 5 điểm — chưa
   đáng mở trang public, nên gom thêm điểm hoặc gộp/xoá tag.
3. **Soạn mô tả chủ đề** (nhóm **E**): chạy qua đúng pipeline ai-content sẵn
   có (job → draft → review → approve — §3.1), prompt pack riêng cho tag
   description (300-500 từ: chủ đề có gì đặc sắc, phong cách/vùng nổi bật,
   dẫn vài điểm tiêu biểu ĐÃ gắn tag — không bịa điểm ngoài danh sách).
   Không xây luồng generate mới.

Trên trang điểm đến: dãy chip chủ đề (link `/chu-de/...`) — thêm 1 lớp
internal link đúng ngữ nghĩa. Điểm đến chưa gắn chủ đề nào = 1 mục ⚠️ trong
Điểm độ phủ nội dung (§2.2.2).

## 3) Quyết định thiết kế

### 3.1 Tái dùng pipeline ai-content, KHÔNG tạo module sinh bài mới
Điểm đến là một **content type mới** chạy trên pipeline sẵn có:
- ContentJob + state machine + pg-boss worker: giữ nguyên.
- Generate 3 bước (outline → expand từng section → assemble): giữ nguyên,
  chỉ thay prompt pack + output schema.
- Review workflow + version + editor UI: giữ nguyên.
- Quality gates: engine giữ nguyên, thay bộ rule theo niche travel (spec chính §19.5).

Cái MỚI nằm ở 3 chỗ:
1. Schema bài điểm đến trong `packages/contracts` (§4).
2. Module publish đích SQL Server + mirror danh sách điểm đến (§5).
3. UI menu "Điểm đến" riêng (§7).

### 3.2 Mirror danh sách điểm đến trong Postgres
AI tool giữ bảng `destinations` (Postgres) mirror metadata từ SQL Server:
- Lý do: form tạo bài cần chọn taxonomy có sẵn; engine auto-link cần danh sách
  toàn bộ tên + slug; cần biết điểm nào đã có bài AI / bài tay / chưa có bài.
- Đồng bộ: **import 1 lần** lúc setup (đọc từ SQL Server) + cập nhật khi publish.
  Có nút "Đồng bộ lại từ website" phòng khi DB bị sửa ngoài luồng.
- Nội dung bài (draft) vẫn nằm trong `content_drafts` như mọi job khác —
  mirror chỉ chứa metadata + con trỏ draft đã publish.

### 3.3 Ghi DB đích bằng UPSERT từng điểm, không bao giờ wipe
Adapter publish dùng TypeORM DataSource thứ 2 (driver `mssql`), chỉ trong
infrastructure, sau interface `IDestinationPublisher` (application layer không
biết SQL Server):
- Upsert `Destination` theo Id; upsert `DestinationDetail` theo DestinationId.
- Chạy trong transaction; timeout + retry/backoff như mọi external call.
- KHÔNG quản lý migration cho DB này — schema do dichoithoi sở hữu, AI tool chỉ đọc/ghi.

### 3.4 Auto-link chạy ở 2 thời điểm
1. **Lúc publish 1 bài**: quét content bài đó, link tới mọi điểm đến đã tồn tại
   (thuật toán §1.3, viết lại bằng TS + unit tests, so khớp không phân biệt hoa thường).
2. **Nút "Cập nhật link toàn bộ"**: chạy lại auto-link cho mọi bài trên DB đích
   (giải quyết ràng buộc §1.4.2 — bài cũ nhắc tới điểm mới). Chạy qua pg-boss job,
   có log số bài đã sửa. Đây là job batch đầu tiên, nền tảng cho "tự động" sau này.

Lưu ý kỹ thuật khi port: bản C# dùng `new Regex(replaceStr)` với tên chưa escape —
bản TS phải **escape regex** tên điểm đến (tên có thể chứa ký tự đặc biệt) và chỉ
replace text node, không replace bên trong tag `<a>` đã có.

### 3.5 AI không được bịa dữ liệu cứng
- Lat/Lng/Address/taxonomy: người dùng nhập hoặc lấy từ mirror — không đưa vào output AI.
- Giá vé / giờ mở cửa: ưu tiên giá trị người dùng nhập hoặc lấy từ nguồn tham khảo (§3.6);
  nếu AI điền từ kiến thức nền thì bài luôn kèm "thông tin cập nhật {tháng/năm},
  có thể thay đổi" (gate bắt buộc), và 2 trường này hiển thị nổi bật trong màn review
  để người duyệt kiểm tra tay.

### 3.6 Nguồn tham khảo theo trường (giá vé, giờ mở cửa từ URL)
Người dùng có thể gắn URL nguồn cho từng trường dữ liệu (vd giá vé lấy từ trang vé
chính thức, giờ mở cửa từ website điểm đến):
1. Adapter `IReferenceFetcher` (infrastructure): HTTP fetch + bóc text chính của trang
   (timeout + retry như mọi external call, chặn SSRF: chỉ http/https, không IP nội bộ).
2. Bước extract: dùng model nhẹ (`claude-haiku-4-5`) trích giá vé / giờ mở cửa từ text
   → điền vào form dưới dạng **gợi ý kèm nguồn**, người dùng xác nhận trước khi generate.
3. URL nguồn được lưu vào job input để: (a) prompt ghi chú nguồn, (b) sau này tính năng
   "tự động cập nhật" re-fetch đúng nguồn đó so sánh thay đổi.
4. MVP: fetch tĩnh (không headless browser); trang chặn bot → người dùng nhập tay.

### 3.7 Quan hệ điểm đến — lưu ở đâu

> Cập nhật 07/2026: mục này viết lúc 12/06/2026 (trước quyết định đại tu schema)
> mô tả model CŨ (`relationType` dạng chuỗi, đồng bộ qua phụ lục §11.3 đã bị
> thay thế). Model THẬT SỰ áp dụng là bản 2 chữ số nguyên (`nearby(1)/related(2)/
> mentioned(3)`) theo `dichoithoi-database-redesign.md` §3.3/§4.5 — xem §12.2-12.3
> dưới đây để biết chi tiết đúng, đoạn dưới giữ lại nguyên tắc chung, đã sửa cho
> khớp model thật.

DB website (schema v2) có bảng quan hệ tường minh `DestinationRelation` — chỉ
lưu 3 loại KHÔNG suy ra được từ cây/loại (database-redesign §3.3): `nearby`(1),
`related`(2), `mentioned`(3). "Cùng nhóm" (ParentId) và "cùng loại"
(DestinationTypeMap) KHÔNG nằm trong bảng này vì suy ra được bằng index, không
cần lưu thêm.

1. Nguồn sự thật quan hệ nằm ở AI tool (Postgres): bảng `destination_relations`
   (sourceId, targetId, relationType: `nearby` | `related` | `mentioned`,
   source: `auto` | `manual`) — phản chiếu đúng enum của `DestinationRelation`
   bên SQL Server.
2. Quan hệ `mentioned` sinh tự động từ engine auto-link mỗi lần publish/re-link
   (§12.2) — vừa là log link đã chèn, vừa là data cho gợi ý sau này.
3. Khi generate, danh sách điểm liên quan (con/nearby/related/cùng loại-tỉnh từ
   mirror, xem §12.3 quy tắc trộn) đưa vào prompt để AI chủ động nhắc tới →
   tăng mật độ internal link tự nhiên.
4. Đồng bộ xuống website: bảng `DestinationRelation` bên SQL Server
   (database-redesign §4.5) là nguồn để TÍNH LẠI; trang detail KHÔNG query bảng
   này lúc render — đọc thẳng `RelatedJson` đã precompute (§12.3, database-redesign
   §3.4). Publish/recompute lúc nào ghi lại `RelatedJson` lúc đó.

## 4) Contracts — schema `destinationArticle` (Zod, packages/contracts)

Output AI map thẳng sang cột `DestinationDetail`:

```
destinationArticleSchema = {
  intro:        // đoạn mở bài — nằm đầu Content
  sections[]:   // H2/H3: giới thiệu, chơi gì, mùa đẹp, kinh nghiệm... — thân Content
  openingTime:  // ngắn gọn, ≤ 500 ký tự (cột nvarchar 512)
  ticketPrice:  // ≤ 500 ký tự, kèm thời điểm cập nhật
  transport:    // cách di chuyển
  food:         // ăn gì gần đó
  hotel:        // gợi ý khu lưu trú (text, không booking link ở MVP)
  tip:          // mẹo/lưu ý
  faq[]:        // 3-6 câu — render vào cuối Content
  metadata: {
    name,                  // tên chuẩn hóa có dấu
    slugSuggestion,        // gợi ý Id — người dùng xác nhận, vì Id là URL vĩnh viễn
    description,           // ≤ 950 ký tự (chừa lề cho cột nvarchar 1000)
    searchKeyword,         // ≤ 250 ký tự
  }
}
```

Quy tắc render khi publish: `Content` = intro + sections + faq (markdown → HTML
sạch qua sanitize pipeline M3); các trường còn lại đổ thẳng vào cột tương ứng.

Prompt bắt buộc (theo quy tắc chung): "viết tiếng Việt có dấu đầy đủ",
"chuẩn hóa chủ đề không dấu thành có dấu", giọng tự nhiên như người đi thực tế,
không liệt kê khô khan.

## 5) Module mới `apps/api/src/modules/destination` (4 lớp chuẩn)

- `domain/` — entity Destination (mirror), engine auto-link + unit tests,
  bộ quality gates travel.
- `application/` — use cases: SyncDestinationsFromSite, CreateDestinationJob (mode
  create/update), PublishDestination, RelinkAllDestinations;
  ports: `IDestinationPublisher`, `IDestinationMirrorRepository`.
- `infrastructure/` — TypeORM mssql DataSource (lazy connect), publisher adapter,
  mirror repository (Postgres), pg-boss worker cho relink.
- `presentation/` — controller `/api/destinations` + DTO.

Generate vẫn đi qua module ai-content (job có `siteCode='dichoithoi'`,
`contentType='guide-diem-den'`) — module destination KHÔNG gọi AI provider trực tiếp.

### 5.1 API
```
GET    /api/destinations                    — list mirror + trạng thái bài (lọc tỉnh/nhóm/chưa có bài)
POST   /api/destinations/sync               — đồng bộ mirror từ SQL Server
POST   /api/destinations/:id/jobs           — tạo job AI (mode: create | update)
POST   /api/destinations/:id/publish        — publish draft đã Approved vào DB đích
POST   /api/destinations/relink             — chạy lại auto-link toàn bộ (pg-boss job)
GET    /api/destinations/taxonomy           — groups/provinces/types cho form
```
Publish chỉ chấp nhận draft trạng thái **Approved** (tái dùng rule M3 — không có
đường tắt bỏ qua review).

## 6) Quality gates travel (thay bộ affiliate)
1. **Structure**: có intro, ≥3 section, có đủ openingTime/ticketPrice/transport
   (hoặc đánh dấu rõ "không áp dụng" — vd điểm đến miễn phí), FAQ ≥3; thân bài
   (không tính quick-facts/FAQ) ≥800 từ — tránh thin content (bổ sung 07/2026,
   xem `dichoithoi-content-seo-ux-plan.md` §8.3); nếu input có địa chỉ cũ + mới
   (sau sáp nhập) thì bài phải nêu cả 2.
2. **SEO**: keyword chính ("du lịch {tên}" hoặc "{tên}") trong H1 + mở bài;
   description ≤950 ký tự và chứa keyword; slug hợp lệ (a-z0-9-).
3. **Travel policy** (spec chính §19.5): có dòng thời điểm cập nhật thông tin;
   giá vé/chi phí kèm lưu ý có thể thay đổi; không claim tuyệt đối ("rẻ nhất",
   "duy nhất") khi không có nguồn.
4. **Data**: không có section rỗng; độ dài field khớp giới hạn cột SQL;
   slug không trùng với điểm đến khác (check qua mirror) khi mode=create.

KHÔNG áp gate affiliate disclosure / product URL cho loại bài này.

## 7) UI — khu "Dichoithoi" trong AI tool (apps/web)

### 7.1 Menu (sidebar)
Dichoithoi là MỘT KHU riêng trong sidebar (group có sub-menu), không phải 1 mục lẻ —
vì AI tool đóng vai CMS đầy đủ cho site này (system overview §1):

```
ZinoFlow
├─ Dashboard
├─ AI Content                ← bài affiliate laruki/dochoi3s (flow hiện tại)
├─ Dichoithoi                ← khu mới (cây HỢP NHẤT 07/2026 — gom mọi module spec sau)
│   ├─ Điểm đến              /dichoithoi              (màn trung tâm — hub)
│   ├─ Bài viết              /dichoithoi/articles     (cẩm nang — article-spec; tạo AI/viết tay §1.1)
│   ├─ Khách sạn             /dichoithoi/hotels       (hotel-spec §6)
│   ├─ Tour                  /dichoithoi/tours        (tour-spec §6)
│   ├─ Sản phẩm              /dichoithoi/products     (product-spec §6)
│   ├─ Chủ đề                /dichoithoi/chu-de       (tag — CRUD + gán AI + mô tả, §2.4 + database-redesign §3.2.1)
│   ├─ Taxonomy              /dichoithoi/taxonomy     (Loại + Tỉnh — giai đoạn 2, ẩn ở MVP)
│   ├─ Review khách          /dichoithoi/reviews      (duyệt review — giai đoạn 2, ẩn ở MVP)
│   └─ Công cụ               /dichoithoi/tools        (re-link, recompute, đồng bộ, gán chủ đề hàng loạt, log job)
└─ Settings
```

Cây trên là **nguồn sự thật duy nhất** cho menu khu Dichoithoi — các spec module
(hotel/tour/product/article) chỉ mô tả NỘI DUNG màn của mình, vị trí menu theo
đây; thêm module mới thì cập nhật cây này trước.

Nguyên tắc: **mọi việc theo TỪNG điểm đến đi từ màn "Điểm đến"** (hub); các job
chạy toàn cục (re-link, recompute related, đồng bộ mirror) nằm ở "Công cụ".
Draft dichoithoi vẫn chạy chung pipeline ai-content → màn review draft TÁI DÙNG
route `/content/[id]` hiện có (thêm panel quick-facts), không xây editor thứ 2;
list ở `/content` thêm filter theo site để tách bài dichoithoi khỏi bài affiliate.

### 7.2 Màn "Điểm đến" `/dichoithoi` (hub)

**Khối "Việc cần làm" (dashboard vận hành — CHỐT 07/2026)**, nằm TRÊN bảng
danh sách. KHÔNG làm route Dashboard riêng, KHÔNG biểu đồ thống kê (không dẫn
tới hành động thì không build). Trả lời đúng 1 câu: "hôm nay mở CMS nên làm
gì trước?" — đây là nơi mọi cảnh báo từ các cơ chế đã chốt đổ về 1 chỗ, phục
vụ chiến lược "làm dày từng điểm theo checklist" (chống scaled-content).

Nguyên tắc: chỉ hiện mục có số > 0; MỖI mục là 1 link nhảy thẳng tới danh
sách đã lọc sẵn — không có mục "chỉ để biết". Dashboard chỉ TỔNG HỢP dữ liệu
sẵn có (mỗi dòng 1 query đếm, cache 5-10 phút), không tính toán/bảng/job mới:

| Cảnh báo | Nguồn |
|---|---|
| X điểm độ phủ nội dung < ngưỡng (Flagship trước) | Coverage Score §2.2.2 |
| X điểm Chủ lực chưa có bài cẩm nang topic nào | `ArticleDestinationMap` (article-spec §8.1) |
| X chủ đề (tag) dưới ngưỡng 5 điểm — chưa mở được trang | database-redesign §3.2.1 |
| X draft chờ duyệt (điểm đến + bài viết) | pipeline ai-content |
| X job lỗi / khối động trả 0 kết quả | job log + compile report (article-spec §4) |
| X link affiliate `no-rule`/chết | affiliate-link-conversion spec |
| X điểm chưa migrate địa chỉ mới | plan migration địa chỉ (khi làm xong) |
| X điểm không có ảnh gallery | `GalleryJson` (§14) |

Kèm đúng 1 dòng sức khoẻ tổng: **% điểm đến đạt độ phủ ≥ ngưỡng** — 1 con số
theo dõi tiến bộ, không biểu đồ. KHÔNG đưa vào: traffic/thứ hạng (Search
Console làm tốt hơn), biểu đồ theo thời gian, doanh thu affiliate (số thật
nằm ở dashboard đối tác — kéo về vừa khó vừa lệch).

**Bảng danh sách:**
- Bảng từ mirror: Tên (kèm badge Kind: tỉnh/cụm/điểm) · Tỉnh · Loại · Trạng thái
  nội dung · Cập nhật lúc · Nguồn (tay/AI).
- Trạng thái nội dung là cột quan trọng nhất, 4 giá trị có màu:
  `Chưa có bài` / `Bài tay (chưa AI)` / `Đang soạn/duyệt` (kèm trạng thái job) /
  `Đã publish`.
- Filter: tỉnh, loại, kind, trạng thái nội dung; search theo tên (không dấu được).
- Hành động mỗi dòng (theo trạng thái): **Tạo bài AI** / **Cập nhật bài** /
  **Xem draft** (nhảy sang `/content/[id]`) / **Publish** (draft đã Approved) /
  **Mở trên web** (link `/diem-den/{slug}`).
- Nút đầu trang: **+ Thêm điểm đến** · **Đồng bộ mirror**.

### 7.3 Màn chi tiết điểm đến `/dichoithoi/[id]` — 4 tab
1. **Thông tin**: form metadata — tên, slug (cảnh báo đổi slug → tạo redirect),
   kind + cha (chọn trong cây), tỉnh, loại (multi), lat/lng, địa chỉ mới/cũ,
   liên hệ (điện thoại, website chính thức, **Fanpage Facebook** — thêm lại
   07/2026, xem `database-redesign.md` §4.2: nguồn tham khảo cho người đọc,
   không phải kênh kinh doanh nên không xung đột affiliate), **danh sách ticketLinks** (thêm/xóa/sắp xếp từng dòng, dán `sourceUrl`
   → preview `affiliateUrl` ngay theo cơ chế chung
   `dichoithoi-affiliate-link-conversion-spec.md`), thumbnail, featured/order —
   KHÔNG có trường chọn khách sạn ở đây (`HotelGroupId` legacy, đã thay bằng
   `HotelDestinationMap`). Khách sạn/tour gợi ý cho điểm đến này quản lý ở module
   riêng (`dichoithoi-hotel-spec.md` §6, `dichoithoi-tour-spec.md` §6), không nằm
   trong form này.
   - **`ContentTier`** (chỉ hiện khi `kind IN (province, cluster)` — ẩn hẳn với
     `kind=poi` vì luôn mặc định "sâu", không cần chọn): dropdown `Chủ lực` /
     `Thường`, mặc định `Thường`. **Ghi chú hiển thị ngay cạnh field (bắt buộc
     khi build UI, để admin chọn đúng)**:
     > "Chủ lực" = nơi người dùng chủ động tìm kiếm và cần được TRUYỀN CẢM HỨNG
     > (câu chuyện, trải nghiệm, lịch trình) trước khi quan tâm chi tiết —
     > không phải cứ tỉnh/cụm lớn là chọn Chủ lực. Ví dụ: Đà Lạt, TP.HCM, Hội
     > An, Phú Quốc, Đà Nẵng, Huế, Sa Pa. Chọn "Thường" cho tỉnh/cụm chỉ đóng
     > vai trò gom nhóm điểm con (vd Bảo Lộc, Di Linh) — trang của chúng sẽ ở
     > dạng danh mục gọn, không cần đầu tư nội dung sâu.
     > Ảnh hưởng khi chọn "Chủ lực": trang được viết nội dung điểm đến đầy đủ
     > (không chỉ danh sách con), có thêm JSON-LD `TouristAttraction`, và được
     > phép xuất hiện ở khối "Điểm nổi bật"/gợi ý liên quan trên toàn site —
     > xem `dichoithoi-content-seo-ux-plan.md` §10.6.1.
2. **Nội dung**: draft hiện tại + lịch sử version, nút "Tạo bài AI"/"Cập nhật bài"
   (mở form job §7.4), preview HTML sẽ publish.
3. **Quan hệ**: con trực thuộc (từ cây) · nearby (tự tính, kèm khoảng cách) ·
   related curated (thêm/xóa tay) · "được nhắc trong bài nào" (mentioned) ·
   preview khối RelatedJson sẽ render trên web.
4. **Publish**: lịch sử publish, trạng thái đồng bộ với SQL Server, nút Publish
   (chỉ enable khi draft Approved), kết quả invalidate cache.

### 7.4 Form tạo job (modal, dùng cho cả create/update)
- Mode create: nhập input §2.1 (slug do AI gợi ý, người dùng xác nhận).
- Mode update: input có sẵn từ mirror; content hiện tại đưa vào ngữ cảnh.
- Khu "Nguồn tham khảo": mỗi trường giá vé/giờ mở cửa gắn được URL → nút
  "Lấy dữ liệu" (haiku extract §3.6) điền gợi ý, người dùng sửa/xác nhận.
- Chọn provider/model như form job hiện tại.

### 7.5 Màn review draft (tái dùng `/content/[id]`)
Thêm cho job dichoithoi: panel phải hiển thị nổi bật quick-facts (giờ mở cửa,
giá vé, di chuyển, danh sách ticketLinks) — phần dữ liệu dễ sai cần duyệt tay; checklist
gates travel thay gates affiliate. Sau Approve: nút **"Publish lên dichoithoi"**
+ preview các link nội bộ sẽ chèn; publish xong hiện link mở web kiểm tra.

### 7.6 Màn "Công cụ" `/dichoithoi/tools`
Nút chạy + bảng lịch sử pg-boss job (thời gian, kết quả, số bài ảnh hưởng):
**Re-link toàn bộ** · **Recompute related toàn bộ** · **Đồng bộ mirror** ·
(giai đoạn 2) lịch tự động cập nhật content.

## 8) Config & bảo mật
- `DICHOITHOI_DB_CONNECTION` trong env (`.env.example` cập nhật, không commit secret).
- Connection chỉ mở khi cần (lazy), timeout mặc định 15s, retry 2 lần có backoff.
- Trước lần publish thật đầu tiên: **backup 2 bảng** (script SQL trong runbook).
- Sanitize HTML trước khi ghi (XSS) — tái dùng pipeline M3.

## 9) Rủi ro & việc cần chốt trước khi build

✅ Module destination đã build xong (Phase 2) — mục này giữ tham khảo lịch
sử. Rủi ro vận hành còn thật sự cần nhớ (khóa nút import CMS cũ trước
go-live, test encoding tiếng Việt) đã gộp vào `dichoithoi-backlog.md` mục C —
xem đó để biết trạng thái mới nhất, không lặp lại ở đây.

## 10) Ngoài phạm vi MVP (để giai đoạn sau)

Trùng với `dichoithoi-implementation-plan.md` Phase 11 "Giai đoạn 2" — xem
phase đó để biết đầy đủ + trạng thái mới nhất (tự động refresh theo lịch,
tab Ảnh/upload, quản lý taxonomy, viết bài Post/Phượt/Tour cũ).

## 12) Chi tiết 3 job vận hành (re-link, recompute related, đồng bộ mirror)

Cả 3 đều: chạy qua pg-boss (không chạy trong request handler), **idempotent**
(chạy 2 lần liên tiếp → lần 2 không đổi gì), có report ghi lại ở màn Công cụ
(thời gian, số dòng ảnh hưởng, lỗi từng dòng), batch theo lô + transaction theo lô.

### 12.1 Đồng bộ mirror (SQL Server → Postgres, một chiều ĐỌC)

Mục đích: mirror Postgres là bản chiếu metadata để UI list/filter, form chọn
taxonomy, engine auto-link có danh sách tên+slug — và để PHÁT HIỆN sửa ngoài luồng.

Khi chạy: 1 lần lúc setup (import toàn bộ); nút bấm khi nghi ngờ DB bị sửa tay;
bắt buộc chạy lại sau migration schema.

Thuật toán:
1. Đọc toàn bộ `Destination` (+ `ContentHtml` chỉ để tính **contentHash** SHA-256,
   không lưu HTML vào mirror) + `DestinationTypeMap` + `Province` từ SQL Server.
2. Upsert mirror theo Id. So contentHash với hash lưu lần trước:
   khác mà AI tool không publish trong khoảng đó → gắn cờ `editedOutside`
   (bài bị sửa tay trực tiếp trên DB) — hiện badge cảnh báo ở UI, vì lần publish
   đè tiếp theo sẽ XÓA phần sửa tay đó.
3. Dòng mirror có local change chưa publish (đang soạn metadata mới) → KHÔNG đè,
   gắn cờ `conflict` cho người dùng chọn giữ bên nào.
4. Dòng có ở mirror nhưng biến mất bên SQL Server → gắn cờ `orphan`, KHÔNG tự xóa
   (có thể còn draft/job gắn vào).
5. Report: thêm X / cập nhật Y / editedOutside Z / conflict / orphan.

### 12.2 Re-link toàn bộ (ghi vào SQL Server)

Mục đích: bài CŨ nhắc tới điểm đến MỚI thêm sau này thì chưa có link (auto-link
lúc publish chỉ sửa được chính bài đang publish); kèm chuẩn hóa link đã đổi slug.

Khi chạy: nút bấm; UI gợi ý chạy sau khi publish điểm đến mới. Có chế độ
**xem trước (dry-run)**: báo cáo "bài A sẽ thêm link tới B, C" trước, xác nhận
rồi mới ghi.

Thuật toán (mỗi bài, thao tác trên `ContentHtml` — nguồn duy nhất phủ cả bài tay
lẫn bài AI):
1. Load danh sách mọi điểm published từ mirror (name, slug), sort **tên dài → ngắn**
   (giữ logic CMS cũ: tránh "Hồ Gươm" ăn mất "Phố đi bộ Hồ Gươm").
2. Parse HTML → chỉ xử lý **text node**; bỏ qua text nằm trong `<a>`, `<h1>`,
   `code/pre` (khác bản C# cũ: chạy regex thẳng trên chuỗi HTML — dễ phá tag).
3. Với mỗi điểm đích: bỏ qua chính nó; nếu bài ĐÃ có `href="/diem-den/{slug}"`
   đó rồi → bỏ qua (chống double-link, đây là chỗ làm job idempotent);
   match tên không phân biệt hoa thường (tên phải **escape regex**), chỉ replace
   **lần xuất hiện đầu tiên** thành `<a title="{Name}" href="/diem-den/{slug}">
   {text gốc giữ nguyên hoa thường}</a>`; tên đã nằm trong tên dài hơn vừa replace
   → bỏ qua (chống link lồng).
4. Pass chuẩn hóa: quét mọi `<a href="/diem-den/X">`, nếu X nằm trong `SlugRedirect`
   → thay bằng slug mới (link cũ vẫn chạy nhờ redirect, nhưng link thẳng tốt hơn
   cho SEO + đỡ 1 hop 301).
5. Chỉ UPDATE những bài có thay đổi; mỗi link mới chèn → ghi thêm dòng
   `DestinationRelation (mentioned)`; invalidate cache các slug đã sửa.
6. Report: số bài quét / số bài sửa / số link thêm / link chuẩn hóa, chi tiết per bài.

### 12.3 Recompute related (tính lại RelatedJson — ghi vào SQL Server)

Mục đích: khối "liên quan" trên trang detail là JSON precompute (redesign doc §3.4);
thêm/ẩn điểm, đổi quan hệ, đổi tên/thumbnail → JSON của các bài xung quanh outdated.

Khi chạy: tự động hẹp sau mỗi publish (chỉ tính lại các bài BỊ ẢNH HƯỞNG: cha,
anh em cùng cha, các điểm có quan hệ tới điểm vừa publish); nút chạy TOÀN BỘ ở
màn Công cụ (sau re-link, sau sửa quan hệ tay hàng loạt).

**CẬP NHẬT 17/07/2026** — thay toàn bộ mô tả waterfall cứng cũ (5 bước theo
NGUỒN: con → curated → nearby → anh em → cùng tỉnh) bằng thuật toán **chấm
điểm (scoring)** theo MỨC ĐỘ LIÊN QUAN thật, xem chi tiết đầy đủ
`docs/dichoithoi/dichoithoi-destination-relations-plan.md` §1.3 (nguồn thiết
kế gốc) — bản dưới đây là bản rút gọn, giữ nguyên khi hai tài liệu lệch nhau
tài liệu này (spec) là nguồn sự thật lâu dài.

**CẬP NHẬT 25/07/2026** (3 thay đổi, xuất phát từ audit trang
`/dalat-fairytale-land?tab=relations` chỉ hiện đúng 8 mục và phát hiện lỗi
Bà Nà Hill cách 452km vẫn lọt vào gợi ý):

1. **Số lượng mục KHÔNG còn cố định 8** — trần trên đổi thành
   `RELATED_MAX_COUNT = 12` (KHÔNG phải mục tiêu, chỉ là trần), số lượng thực
   tế hiển thị bằng số ứng viên đạt `hasGenuineRelevance()` (mục 3d dưới),
   có thể ít hơn 12 nếu điểm đến hẻo lánh không đủ ứng viên liên quan thật —
   không còn độn thêm ứng viên vô can chỉ để "đủ số".
2. **Thêm `tagOverlapScore`** — tín hiệu THỨ 2 độc lập với `typeOverlapScore`.
   Tag = "phù hợp trải nghiệm gì" (đối tượng/trải nghiệm/bối cảnh/giá trị, xem
   `docs/dichoithoi/phan-tich/dichoithoi-taxonomy-chuan-hoa.md` §0) — cắt ngang
   Type. Mirror từ `v2.DestinationTagMap` sang Postgres `dichoithoi_destinations.tags`.
   ⚠️ Trọng số ban đầu (trần 500, dưới Type) đã bị **thay thế** bởi bản
   "CẬP NHẬT 25/07/2026 (lần 2)" ngay dưới đây — xem đó, không dùng số liệu ở
   mục này nữa.
3. **Rào cứng 100km cho ứng viên KHÁC cụm/tỉnh** — Type/Tag trùng khớp NHIỀU
   ĐẾN ĐÂU cũng không được dùng để vượt qua rào này. Cụ thể: 1 ứng viên khác
   cụm VÀ khác tỉnh với self chỉ được vào danh sách nếu có dữ liệu khoảng
   cách xếp hạng thật (mô hình 2 tầng mục 3 dưới) VÀ khoảng cách đó
   **≤ 100.000 mét** — nếu không có dữ liệu khoảng cách, hoặc khoảng cách
   vượt 100km, ứng viên bị loại NGAY CẢ KHI trùng cả Type lẫn toàn bộ Tag
   với self (case thật đã sửa: Bà Nà Hill trùng Type `khu-vui-choi-cong-vien`
   + cả 3 Tag với Dalat Fairytale Land nhưng cách 452km — vô dụng cho người
   lên lịch trình 1 chuyến đi, dù đúng chủ đề nội dung). Cùng cụm/cùng tỉnh
   thì không bị rào này (luôn hợp lệ, Type/Tag chỉ quyết định THỨ TỰ).

**CẬP NHẬT 25/07/2026 (lần 2)** — đảo NGƯỢC vai trò chi phối, theo yêu cầu
người dùng sau khi audit thực tế Dalat Fairytale Land: cả 12/12 gợi ý đều lên
nhãn "Cùng loại hình" vì `sinh-thai-dong-que`/`khu-vui-choi-cong-vien` được
gán tràn lan cho hầu hết điểm quanh Đà Lạt (Type quá rộng ở khu vực này), át
hết tín hiệu Tag đi kèm. Quyết định: **Tag mới là yếu tố CHI PHỐI chính,
Type giáng xuống thành tiebreaker phụ** (ngược hoàn toàn bản #2 ở trên):

- `tagOverlapScore` — **TIERED theo SỐ LƯỢNG tag khớp tuyệt đối** (không còn
  tỉ lệ liên tục): khớp **TOÀN BỘ** tag của self → **3000**; khớp **≥ 2** tag
  (chưa toàn bộ) → **2000**; khớp **1** tag → **1000**; không khớp → 0.
  Khoảng cách GIỮA các bậc (1000) LỚN HƠN TỔNG mọi thành phần phụ khác cộng
  lại (xem dưới, tối đa 380) — đảm bảo thứ tự theo SỐ TAG KHỚP không bao giờ
  bị Type/khoảng cách/ưu tiên tay đảo ngược. Đúng ý người dùng: "1 điểm có
  nhiều tag, khớp tất cả ưu tiên nhất, khớp 2 tag, khoảng cách ngắn, cùng
  cụm" — kể cả khớp chỉ 1 tag (1000) vẫn thắng 1 ứng viên khớp 0 tag dù
  trùng cả Type lẫn cùng cụm (tối đa ~262, xem dưới) — "Type đứng sau Tag".
- `typeOverlapScore` — **demote xuống tiebreaker phụ**, trần **50** (từ 1000
  trước đó), vẫn tỉ lệ giao nhau như cũ. Tổng mọi thành phần phụ (type 50 +
  cùng cụm/tỉnh 200/100 + khoảng cách 100 + ưu tiên tay 20 + flagship 10) tối
  đa 380, luôn nhỏ hơn 1 bậc tag (1000) — không bao giờ đủ để vượt qua chênh
  lệch số tag khớp.
- Nhãn `criterion` đảo thứ tự tương ứng: kiểm tra khớp Tag TRƯỚC khớp Type
  (`same-tag`/`same-type-tag` ưu tiên hơn `same-type-cluster`/`same-type`) —
  nếu không sẽ tiếp tục hiện "Cùng loại hình" dù Tag mới là lý do thật khiến
  ứng viên được xếp hạng cao.

Thuật toán hiện hành (mỗi điểm), thực thi tại `apps/api/.../domain/related-builder.ts`
hàm `buildRelatedItems()`:

1. **2 bậc cứng đứng TRƯỚC scoring** (quyết định cây/biên tập, không qua chấm
   điểm, KHÔNG bị rào 100km): con trực tiếp (nếu là tỉnh/cụm, tối đa 4) →
   `related` curated (type 2, theo Weight — bao gồm cả quan hệ tạo tay qua
   trang bản đồ `/dichoithoi/ban-do`, xem §5.7 relations-plan).
2. **Lọc `excluded`** (type 4, mới thêm Giai đoạn C3) — loại bỏ mọi ứng viên
   admin đã đánh dấu "gợi ý sai" cho điểm này, TRƯỚC khi chấm điểm, bất kể
   điểm đó lẽ ra được điểm cao thế nào.
3. **Lọc `hasGenuineRelevance()`** trước khi chấm điểm — ứng viên cùng cụm/cùng
   tỉnh với self luôn hợp lệ; ứng viên KHÁC cụm VÀ khác tỉnh chỉ hợp lệ nếu có
   khoảng cách xếp hạng thật ≤ 100km (mục "CẬP NHẬT 25/07/2026" #3 ở trên).
4. **Chấm điểm** toàn bộ ứng viên còn lại (đã qua bước 3), cộng:
   - `tagOverlapScore` — **yếu tố CHI PHỐI chính** (từ "CẬP NHẬT 25/07/2026
     lần 2"): khớp toàn bộ tag của self → 3000; khớp ≥2 tag → 2000; khớp 1
     tag → 1000; không khớp → 0 (tag mirror từ `v2.DestinationTagMap` sang
     Postgres `dichoithoi_destinations.tags`).
   - `typeOverlapScore` = `50 * |giao tập loại hình| / |tập loại hình của
     self|` — tiebreaker phụ (demote từ chi phối chính, xem "CẬP NHẬT
     25/07/2026 lần 2"), loại hình mirror từ `v2.DestinationTypeMap` sang
     Postgres `dichoithoi_destinations.types`, Giai đoạn C1.
   - `+200` cùng cụm/cha, hoặc `+100` cùng tỉnh (loại trừ nhau).
   - Điểm gần: `100 / (1 + khoảngCáchMét/1000)` — cùng cụm/tỉnh dùng
     haversine trực tiếp từ toạ độ riêng; khác cụm dùng mô hình khoảng cách
     2 tầng (`DistanceFromCenter` + bảng `dichoithoi_cluster_distances`,
     Giai đoạn A2) CHỈ để xếp hạng (luôn ≥ thật do bất đẳng thức tam giác) —
     badge hiển thị công khai luôn tính lại bằng haversine thật cho các mục
     đã chọn, không dùng số ước lượng.
   - `(6 - Priority) * 4` — Priority 1 (cao nhất) +20, Priority 5 +4, không
     bao giờ 0/âm (không loại điểm ít được đánh giá).
   - `+10` nếu `ContentTier = flagship`.
   Xếp hạng giảm dần, điền cho tới khi đủ `RELATED_MAX_COUNT` (12) mục HOẶC
   hết ứng viên qua được bước 3 — số lượng hiển thị vì vậy BIẾN THIÊN theo
   từng điểm đến, không còn cố định.
5. Dedupe, loại chính nó, chỉ lấy Status=published.
   Mỗi mục: `{slug, name, thumbnail, badge, criterion}` (badge = "cách 2,5 km"
   nếu biết toạ độ thật cả 2 bên, null nếu không; `criterion` — lý do gợi ý,
   xem §2 relations-plan, nay có thêm `"same-tag"` khi Tag là thành phần điểm
   cao nhất mà không trùng Type, và `"same-type-tag"` khi trùng CẢ Type LẪN
   Tag nhưng không cùng cụm — thêm 25/07/2026 vì phát hiện thực tế nhãn
   `"same-type"` cũ luôn thắng tuyệt đối kể cả khi Tag cũng trùng, làm nhãn
   "Cùng loại hình" áp đảo mọi gợi ý ở khu vực có Type quá rộng/phổ biến
   (vd Đà Lạt: `sinh-thai-dong-que`/`khu-vui-choi-cong-vien` được gán cho gần
   như mọi điểm quanh đó — 12/12 gợi ý của Dalat Fairytale Land đều trùng
   Type), che mất tín hiệu Tag đi kèm. Sau "CẬP NHẬT 25/07/2026 lần 2" thứ tự
   kiểm tra nhãn cũng đảo theo: khớp Tag được kiểm tra TRƯỚC khớp Type —
   `same-tag`/`same-type-tag` ưu tiên hơn `same-type-cluster`/`same-type`,
   `same-type-cluster` giờ chỉ còn là fallback khi KHÔNG có tag nào khớp).
- So sánh JSON mới với cũ — **khác mới UPDATE** (tránh write + invalidate cache vô ích).
- `mentioned` (type 3) KHÔNG vào RelatedJson — nó phục vụ thống kê + re-link,
  link đã nằm trong thân bài rồi, lặp lại ở khối liên quan là thừa.
- `nearby` (type 1, tính bằng `computeNearby()`) KHÔNG còn dùng để BUILD
  RelatedJson (đã gộp vào bước chấm điểm ở trên) — chỉ còn phục vụ panel
  "gợi ý nearby" khi biên tập viên tự thêm quan hệ curated tay trên trang
  sửa điểm đến.
- Trang `/dichoithoi/ban-do` (CMS nội bộ) có lớp trực quan hoá TOÀN BỘ quan
  hệ này — nền khoảng cách cụm/tỉnh (xám), quan hệ curated (tím), "spotlight"
  đỏ hiện đúng `RelatedJson` thật của 1 điểm khi bấm chọn — dùng để QA thuật
  toán + curate tay có ngữ cảnh (relations-plan §5).

### 12.4 Thứ tự khi chạy cả 3 (ví dụ sau migration)
`Đồng bộ mirror` → `Re-link toàn bộ` → `Recompute related toàn bộ` —
mirror cấp danh sách tên/slug cho re-link; re-link sinh quan hệ mentioned + sửa
content xong rồi mới build RelatedJson và invalidate cache 1 lượt cuối.

## 13) Bảng hành chính + mapping địa chỉ cũ ↔ mới (thêm 12/06/2026)

Yêu cầu: website hiển thị CẢ địa chỉ mới VÀ cũ; AI tool (vai CMS) giữ bảng mapping
để map dữ liệu. Nguồn seed: https://github.com/thanhtrungit97/dvhcvn
(provinces.sql + wards.sql định dạng pgsql — import thẳng;
ward_mappings.sql định dạng MySQL — cần convert backtick/engine clause).

### 13.1 Ba bảng seed trong POSTGRES (zinoflow)
Nằm bên AI tool chứ không phải SQL Server — đây là dữ liệu công cụ soạn thảo,
website không cần (website chỉ render 2 cột text đã build sẵn):

```
admin_provinces      (34 tỉnh mới: province_code, name, short_name, code, place_type)
admin_wards          (phường/xã mới: ward_code UNIQUE, name, province_code FK)
admin_ward_mappings  (~10k dòng: old_ward_code/name, old_district_name,
                      old_province_name → new_ward_code/name, new_province_name)
```

Seed bằng migration TypeORM (data từ file SQL đã convert, idempotent — chạy lại
không nhân đôi). Khi nhà nước điều chỉnh tiếp → cập nhật từ repo dvhcvn, re-seed.

### 13.2 Bốn chỗ dùng

1. **Form nhập địa chỉ điểm đến** (§7.3 tab Thông tin, §7.4 form job):
   - Chọn tỉnh mới → autocomplete phường/xã mới (`admin_wards`) + số nhà/đường
     (text) → build `AddressNew` chuẩn cú pháp "{đường}, {phường mới}, {tỉnh mới}".
   - Từ `new_ward_code` tra NGƯỢC `admin_ward_mappings` → ra danh sách phường cũ
     (kèm quận/huyện cũ + tỉnh cũ). Nhiều phường cũ gộp về 1 phường mới →
     hiện danh sách ứng viên, người dùng chọn đúng phường cũ nơi điểm đến nằm →
     build `AddressOld` "{đường}, {phường cũ}, {quận cũ}, {tỉnh cũ}".
   - Không bịa: nếu người dùng không chắc phường cũ → để trống AddressOld.

2. **Migration data hiện có** (redesign doc §7): địa chỉ trong DB là địa chỉ CŨ →
   parse tên phường/quận/tỉnh → match `admin_ward_mappings`
   (old_ward_name + old_district_name + old_province_name) → sinh `AddressNew`
   tự động; dòng match mờ (không ra hoặc ra nhiều) → gắn cờ rà tay.
   Cột Address cũ giữ nguyên giá trị → đổ vào `AddressOld`.

3. **Map tỉnh cũ → 34 tỉnh mới** (việc cần chốt #1 ở redesign doc §9): derive
   `SELECT DISTINCT old_province_name, new_province_name FROM admin_ward_mappings`
   → bảng map tỉnh tự sinh, chỉ còn rà các tỉnh không xuất hiện trong mapping.

4. **Prompt AI**: đưa cả 2 địa chỉ vào input; structure gate kiểm tra bài có nêu
   cả 2 khi input có đủ (§6.1).

### 13.3 Website hiển thị cả 2 địa chỉ
- Khối quick-facts trang detail render: dòng "Địa chỉ" = `AddressNew`,
  ngay dưới là "Địa chỉ cũ (trước sáp nhập)" = `AddressOld` (ẩn dòng nếu NULL).
- JSON-LD (schema.org address) dùng `AddressNew`; AddressOld chỉ là text hiển thị.
- Trong thân bài AI cũng nhắc cả 2 (gate §6.1) — phục vụ người đọc tra cứu
  theo tên cũ vốn còn phổ biến vài năm tới.

## 14) Hình ảnh điểm đến (thêm 12/06/2026)

Hiện trạng: 278 ảnh `{slug}.webp` + thumbnail cùng tên, nằm TRONG source
(`DiChoiThoi.Web\contents\diem-den`), deploy = upload cả thư mục lên smarterasp.net.
Người dùng TỰ tạo ảnh (AI chỉ gợi ý, không sinh ảnh — Image Tool là chuyện sau).

### 14.1 Ba thay đổi (giữ hosting hiện tại, không thêm dịch vụ trả phí)

1. **Tách ảnh khỏi deploy source**: ảnh upload qua FTP của smarterasp vào thư mục
   `contents/diem-den/` trên hosting — thêm/sửa ảnh KHÔNG cần deploy website.
   Ảnh gốc (chưa nén) giữ ở máy local làm source of truth + backup
   (thư mục data riêng, không nằm trong repo nào).
2. **DB lưu đường dẫn, không suy từ slug**: cột `Thumbnail` (+ ảnh hero/trong bài
   lưu path trong content) — đường dẫn TƯƠNG ĐỐI (`diem-den/{slug}/{slug}-hero.webp`),
   base URL để trong config website → sau này dời sang CDN/storage khác chỉ đổi
   1 dòng config. Hết hardcode `Id + ".webp"` trong repository.
3. **Convention mới — folder theo slug, tên file giữ slug** (SEO ảnh dựa vào cả
   filename lẫn folder, không chỉ folder; chuẩn bị cho bài có nhiều ảnh):
   ```
   contents/diem-den/{slug}/
     {slug}-hero.webp    1200-1600w — ảnh đầu bài + og:image
     {slug}-medium.webp  800w       — card danh sách responsive (srcset)
     {slug}-thumb.webp   400w       — card danh sách / related / search
     01-{mo-ta}.webp     800w       — ảnh trong thân bài (mô tả không dấu, SEO filename)
   ```
   Migration 278 ảnh cũ: script copy `x.webp` → `x/x-hero.webp`, `thumbnail/x.webp`
   → `x/x-thumb.webp` + điền cột Thumbnail — chạy 1 lần lúc migration DB.

### 14.2 Tốc độ (website ưu tiên tốc độ nhất)
- 3 cỡ cố định như trên; render `<img>` có `width/height` (chống CLS),
  `srcset` thumb/medium, `loading="lazy"` cho mọi ảnh TRỪ hero
  (hero dùng `fetchpriority="high"`).
- Bật Cloudflare free trước domain: cache ảnh ở edge + `Cache-Control: immutable`.
  Vì immutable → khi THAY ảnh phải đổi tên file (`hero-v2.webp`), không ghi đè —
  đường dẫn nằm trong DB nên đổi tên không đau.

### 14.3 Tích hợp AI tool
- **M4 (MVP)**: giữ luồng tay như cũ (tự tạo ảnh, tự FTP) — chỉ thêm: form điểm đến
  có ô `Thumbnail path` + nút "Kiểm tra ảnh tồn tại" (HEAD request); quality gate
  data bổ sung check thumbnail có path.
- **Giai đoạn 2 — tab "Ảnh" trong màn chi tiết điểm đến**: kéo thả ảnh gốc →
  tool tự convert WebP + resize 3 cỡ (sharp) + đặt tên chuẩn → đẩy FTP lên hosting
  (`ftp` adapter, credentials qua env `DICHOITHOI_FTP_*`) → cập nhật cột DB
  + invalidate cache. Xóa hẳn bước FTP tay.
- **AI gợi ý ảnh** (giai đoạn 2, khi generate bài): output thêm khối `imageSuggestions`
  — danh sách ảnh NÊN có (hero chụp gì, section nào cần ảnh gì), kèm **alt text**
  + **tên file chuẩn SEO** cho từng ảnh; người dùng nhìn danh sách tự đi tạo/chụp
  rồi kéo thả vào đúng ô. AI không sinh ảnh.

### 14.4 Remark trên ảnh (yêu cầu 12/06/2026 — LÀM SAU, giai đoạn 2+)
Mọi ảnh có thể gắn remark. Hai dạng, làm trong pipeline xử lý ảnh (sharp) lúc upload:
1. **Watermark/branding**: đóng logo + domain dichoithoi.com góc ảnh (composite,
   bật/tắt theo setting, mặc định bật cho ảnh tự tạo) — chống re-up, nhận diện thương hiệu.
2. **Caption/credit**: bảng `destination_images` (Postgres) quản lý metadata từng ảnh:
   path, altText, caption, credit/nguồn, sortOrder — website render caption dưới ảnh
   (`<figure>/<figcaption>`), alt từ DB thay vì hardcode trong HTML.
Khi làm tab "Ảnh" (giai đoạn 2) thì build bảng metadata này luôn; watermark là
option trong pipeline resize. Ảnh gốc local KHÔNG đóng watermark (giữ bản sạch).

### 14.5 Ingest ảnh từ URL ngoài — cơ chế dùng chung (CHỐT 07/2026)

Áp dụng cho MỌI record có ảnh nguồn ngoài (Product/Hotel/Tour từ Shopee/
Klook/OTA — import sheet `product-spec.md` §5.1, hoặc cào). **Quyết định:
KHÔNG hotlink ảnh nguồn, luôn tải về server mình.** Lý do:
- Link CDN Shopee/OTA xoay/hết hạn + chống hotlink (403 theo referer) —
  sản phẩm gỡ bán là ảnh chết hàng loạt, không ai biết.
- Ảnh domain người khác = Google Images index cho HỌ; không kiểm soát
  kích thước/định dạng → hại LCP (§14.2 — site ưu tiên tốc độ nhất).
- Mỗi lượt xem trang lộ traffic cho bên thứ 3.

**Pipeline** (tái dùng đúng hạ tầng ảnh §14.3 giai đoạn 2 — sharp + FTP,
không xây mới):
1. Lưu record có `imageUrl` ngoài → job pg-boss: tải ảnh → validate (đúng
   MIME ảnh, kích thước tối thiểu) → nén + resize bộ cỡ chuẩn (WebP +
   thumbnail) → đẩy lên hosting hiện tại → ghi path nội bộ vào DB.
2. **Giữ `imageSourceUrl` gốc trong DB** — tải lại được khi cần + biết nguồn.
3. Tải lỗi → placeholder + đếm vào cảnh báo "X ảnh lỗi" ở khối "Việc cần
   làm" (§7.2) — không âm thầm.
4. Chạy async — import 100 dòng không đợi 100 ảnh, ảnh về dần.

Lưu ý bản quyền: ảnh sản phẩm Shopee thuộc shop/nhãn hàng — dùng để dẫn
traffic affiliate về đúng shop là thực tế phổ biến, nhưng shop yêu cầu gỡ
thì gỡ. Ảnh ingest từ nguồn ngoài KHÔNG đóng watermark (không phải ảnh của
mình — khác ảnh tự tạo §14.4).

## Phụ lục — §11 cũ: Nâng cấp schema DB website — ⚠️ ĐÃ BỊ THAY THẾ (12/06/2026)

> Quyết định mới cùng ngày: ĐẠI TU toàn bộ website + database (người dùng sẽ viết lại
> website hiển thị theo schema mới, ưu tiên tốc độ). Phương án B (additive) dưới đây
> KHÔNG còn áp dụng — thiết kế chính thức xem `dichoithoi-database-redesign.md`.
> Publisher/mirror của AI tool build theo schema MỚI ngay từ đầu (Id int + Slug,
> ContentHtml render sẵn, RelatedJson precompute). Giữ phần dưới để tham khảo
> quá trình phân tích.

### (Tham khảo — không áp dụng) Phân tích phương án B additive

### 11.1 Vì sao phải đổi schema
Idea mới có 4 yêu cầu schema hiện tại KHÔNG chứa được:
1. Địa chỉ cũ + mới sau sáp nhập — cột `Address` chỉ nvarchar(128), 1 giá trị.
2. Liên hệ website chính thức — chỉ có `Phone`, không có cột website.
3. CTA mua vé online — không có chỗ lưu `bookingUrl` (nhét vào Content HTML thì
   không quản lý/cập nhật link affiliate tập trung được).
4. Quan hệ điểm đến tường minh — đang suy diễn từ DestinationGroupId.
Ngoài ra thiếu vết vận hành: không biết bài nào do AI viết, cập nhật lúc nào
(SEO cần hiển thị "cập nhật tháng X/2026").

### 11.2 Ba phương án đã cân nhắc
| | A. Giữ nguyên | B. Mở rộng additive ✅ | C. Thiết kế lại toàn bộ |
|---|---|---|---|
| Sửa website .NET | không | thêm render, không sửa query cũ | viết lại query/EF/Views |
| URL `/diem-den/{slug}` | giữ | giữ (bảo toàn SEO) | rủi ro đổi/redirect |
| Chứa yêu cầu mới | không (nhét vào HTML) | đủ | đủ |
| Sửa nợ cũ (typo DisctrictId, cột Name denormalize, flags IsGroup/IsArea) | không | không (chấp nhận giữ) | có |
| Rủi ro / công sức | 0 | thấp (cột nullable + bảng mới) | cao, không xứng giá trị |

**Chốt B**: thêm cột nullable + bảng mới, KHÔNG đổi/xóa cột cũ. Nợ cũ (typo, denormalize)
giữ nguyên — sửa chỉ đẹp code, không thêm giá trị người dùng, lại đụng toàn bộ website.

### 11.3 Thay đổi cụ thể (SQL chạy tay bên dichoithoi, script lưu repo dichoithoi)

Bảng `Destination` — thêm cột (toàn bộ NULL, không phá data cũ):
```sql
ALTER TABLE Destination ADD
  AddressOld      nvarchar(256) NULL,  -- dia chi truoc sap nhap (Address = dia chi MOI)
  ContactWebsite  nvarchar(256) NULL,
  BookingUrl      nvarchar(512) NULL,  -- link affiliate mua ve online
  ContentSource   tinyint NULL,        -- 0=viet tay, 1=AI tool
  ContentUpdatedAt datetime NULL;      -- hien thi "cap nhat thang X/nam" tren bai
```
Quy ước: `Address` mang địa chỉ MỚI (sau sáp nhập) vì là cái người đọc cần trước;
địa chỉ cũ vào `AddressOld`, bài viết nêu cả 2.

Bảng mới `DestinationRelation`:
```sql
CREATE TABLE DestinationRelation (
  Id           int IDENTITY PRIMARY KEY,
  SourceId     nvarchar(64) NOT NULL,   -- FK Destination.Id
  TargetId     nvarchar(64) NOT NULL,
  RelationType varchar(32)  NOT NULL,   -- same-group | nearby | mentioned-in-content
  CreatedAt    datetime NOT NULL DEFAULT GETDATE(),
  CONSTRAINT UQ_DesRelation UNIQUE (SourceId, TargetId, RelationType)
);
```

`DestinationDetail` — GIỮ NGUYÊN cột (website đang render từng mục); FAQ nằm cuối
Content như thiết kế §4.

### 11.4 Phân công và thứ tự
1. Script ALTER/CREATE: viết và chạy bên repo dichoithoi (AI tool KHÔNG migrate DB này
   — rule giữ nguyên §3.3), chạy TRƯỚC Phase A, sau khi backup.
2. AI tool: mirror + publisher đọc/ghi đủ cột mới ngay từ đầu (entity infrastructure
   khai báo cột mới, nullable).
3. Website .NET: thêm render AddressOld / ContactWebsite / nút "Mua vé online" /
   "Cập nhật tháng X" / điểm liên quan từ bảng DestinationRelation (fallback group
   khi chưa có dòng nào) — làm song song Phase A-B, KHÔNG chặn pipeline AI.
4. Đồng bộ taxonomy Province sau sáp nhập (data cleanup bảng Province/Area) —
   việc data bên dichoithoi, AI tool đọc as-is.
