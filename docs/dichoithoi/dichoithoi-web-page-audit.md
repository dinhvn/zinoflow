# Audit trang chủ / danh sách điểm đến / chi tiết điểm đến — DiChoiThoi.Web (07/2026)

Audit kỹ thuật cho `D:\Gits\mmo\dichoithoi\DiChoiThoi.Web` (ASP.NET Core 9), tập trung
3 trang lưu lượng cao nhất, theo 3 mục tiêu: **nội dung chi tiết, SEO chuẩn, tốc độ**.
Bổ sung/đào sâu cho [dichoithoi-web-image-refactor-notes.md](dichoithoi-web-image-refactor-notes.md)
(đã có sẵn phần ảnh) và tiền đề cho [dichoithoi-database-redesign.md](dichoithoi-database-redesign.md)
(schema v2 — xem §0 để hiểu vì sao nhiều vấn đề dưới đây "phải sửa 2 lần" nếu làm trước migration).

Toàn bộ số dòng tham chiếu theo trạng thái source 07/2026. Đây là tài liệu **phân tích
hiện trạng**, chưa phải kế hoạch triển khai — mục "Đề xuất ưu tiên" ở cuối chỉ gợi ý thứ tự.

## 0. Bối cảnh — vì sao có 2 nhóm vấn đề (độc lập schema vs phụ thuộc schema)

DiChoiThoi.Web hiện đọc từ schema CŨ (`dbo.Destination` + `dbo.DestinationDetail`,
không có cột `Thumbnail`/`ContentSource`/`ContentHash`; ảnh suy từ `Id`). zinoflow đã
code sẵn cho schema MỚI `v2.*` theo kế hoạch "đại tu" (chưa migrate). Vì vậy audit này
tách rõ mỗi vấn đề là **Nhóm A** (sửa được ngay, không đụng DB) hay **Nhóm B** (cần
schema mới hoặc thay đổi lớn ở tầng data) — xem cách gắn nhãn ở mỗi mục.

---

## 1. Trang chủ (`/`)

**Controller**: `HomeController.Index()`, `Controllers/HomeController.cs:46-83`.

### Dữ liệu & cache
- 3 nguồn dữ liệu, mỗi nguồn có `IMemoryCache` riêng (sliding expiration):
  1. Top destinations (line 54, method 85-99) — cache key `TOP_DESTINATION_CACHE_KEY`,
     query **không giới hạn số dòng** (`DestinationRepository.GetTopListAsync`,
     `DestinationRepository.cs:113-121`), cache TOÀN BỘ kết quả rồi mới `.Take(12)`
     (line 98) — tốn cache/băng thông tính toán hơn cần thiết.
  2. Hotel group list (line 55) — cached, 1 query khi miss.
  3. Top sale-off hotel (line 56) — cache đã giới hạn 12 (`NUM_TOP_HOTEL`), controller
     `.Take(8)` (line 62) lần nữa — 2 lớp cắt chồng nhau, thừa 1 lớp.
  - Cold cache: 3 round-trip DB. Warm cache: 0 round-trip, chỉ lookup memory.
- `PageInfo` (lines 65-80): **Title/Description là chuỗi TĨNH, giống hệt mọi lần load**
  (`"Thông tin điểm đến, khách sạn, ăn uống,..."`) — không phản ánh nội dung trang.
  [Nhóm A]
- JSON-LD: chỉ có `Organization` + `WebSite` (lines 49-51) — **không có `ItemList`/
  `CollectionPage`** cho lưới điểm đến nổi bật. [Nhóm A]
- Không gọi `SetBreadcrumbs` — trang chủ không hiện breadcrumb (đúng, vì là gốc).

### Nội dung trang (`Views/Home/Index.cshtml`, top→bottom)
1. Dòng 3-11: search box, **1 `<h1>` duy nhất** = "Thông tin du lịch Việt Nam" (dòng 6) — chung chung, không chứa từ khóa sản phẩm cụ thể. [Nhóm A — có thể tối ưu copy]
2. Dòng 13-20: "Các điểm đến nổi bật tại Việt Nam" (`<h2>`) → `_DestinationGroup.cshtml`,
   ảnh `<img alt="@item.Name">` **không có `width/height/loading`** (`_DestinationGroup.cshtml:13`). [Nhóm A]
3. Dòng 22-35: "Top khách sạn khuyến mãi" (`<h2>`) → `_HotelList.cshtml`, ảnh cũng thiếu
   sizing/lazy (`_HotelList.cshtml:11`). [Nhóm A]
4. Dòng 37-40: "Các khách sạn được quan tâm nhất" (`<h2>`) → chỉ link text, không ảnh.
- **Không có** hero/banner ảnh lớn, không có ad slot, không có teaser blog/phượt nào ở
  trang chủ — toàn bộ trang chỉ 3 khối trên + search box.

### Tốc độ
- `<head>`: `common.css` gắn `async` (`_Layout.cshtml:23`) — thuộc tính này **vô nghĩa**
  với `<link rel="stylesheet">`, browser bỏ qua → CSS vẫn render-blocking như bình
  thường, chỉ là dòng code gây hiểu lầm đã được "tối ưu". [Nhóm A, sửa nhanh]
- `common.js` **không `defer`/`async`** ở cuối `<body>` (`_Layout.cshtml:66`) — parser-blocking
  tại điểm đó. Trang chủ không tự thêm script nào khác. [Nhóm A]

---

## 2. Trang danh sách điểm đến (`/diem-den`)

**Controller**: `DestinationController.Index()`, `Controllers/DestinationController.cs:96-150`,
route `[Route("/diem-den")]` (dòng 96).

### Phát hiện quan trọng: **trang này không có phân trang, không filter, không sort**
- `Index()` **không nhận tham số nào** (dòng 97) — dù đã có sẵn model
  `DestinationListParameter : Paging` (`Paging.cs:7-11` có `Page`/`PageSize`) **nhưng
  không được đọc/dùng ở đây**. [Nhóm A — có thể bổ sung phân trang mà không cần schema mới]
- Luôn gọi đúng 1 query giống hệt trang chủ: `GetTopListAsync(new TopDestinationListParameter())`
  (dòng 108) — không `.Take()`, hiển thị **toàn bộ** danh sách nhóm điểm đến (`model.TopDestinations`
  không bị cắt như ở Home).
- Cache: dùng key `TOP_DESTINATION_CACHE_KEY` **riêng của controller này** (dòng 26,
  hằng số khác với `ContantVariables.TOP_DESTINATION_CACHE_KEY` bên `HomeController`) —
  tức **2 cache entry khác nhau cho cùng 1 câu query không tham số** → lãng phí bộ nhớ,
  2 TTL lệch nhau (6h ở đây vs hằng số khác ở Home) nên có lúc Home và /diem-den hiển
  thị dữ liệu lệch nhau vài phút/giờ dù cùng nguồn. [Nhóm A]

### SEO
- Title/description (dòng 130-148) tính từ `count` + top-5 tên — **quyết định (deterministic)
  hoàn toàn từ dữ liệu cache**, không có biến thể theo trang/filter (vì làm gì có filter/trang
  nào khác) — không có rủi ro duplicate-title kiểu phân trang như audit trước nghi ngờ, NHƯNG
  đây cũng là hệ quả của việc trang này thực chất chỉ có 1 "view" cố định. [Nhóm A]
- `/search` (dòng 44-94) dùng CHUNG view `Index.cshtml` (`ShowTop=false`), title/description
  động theo `param.q` (dòng 74-77) — nhưng **không có canonical**, nên các URL `?q=` khác
  nhau (kể cả biến thể viết hoa/thường, dấu cách thừa) đều có thể bị crawl/index rời rạc.
  [Nhóm A]
- `GetListAsync` (`DestinationRepository.cs:59-82`, dùng cho `/search`) có bug tiềm ẩn:
  dòng 61 `param.q = param.q.Trim()` sẽ **NullReferenceException nếu `q` null** (không có
  guard) — chưa rõ có xảy ra thực tế hay ASP.NET model binding luôn cho chuỗi rỗng.
  [Nhóm A — cần review kỹ trước khi coi là bug thật]
- Không có JSON-LD nào (`ItemList`/`CollectionPage`/`BreadcrumbList`) trên cả `/diem-den`
  và `/search`, không breadcrumb hiển thị. [Nhóm A]
- `SelectMap<Destination, DestinationModel>` (map theo tên property phản chiếu,
  `QueryableExtensions.cs:15-40`) — **`Thumbnail`/`Rating`/`RatingCount` trên `DestinationModel`
  luôn `null`/`0`** vì entity `Destination` không có các cột này. View
  (`_DestinationList.cshtml:11`, `_DestinationGroup.cshtml:8`) **bỏ qua** `item.Thumbnail`,
  tự dựng path `"../diem-den/thumbnail/" + item.Id + ".webp"` — xác nhận lại phát hiện ở
  note ảnh trước đó, nay thấy rõ hơn: field `Thumbnail` trên model là **cột chết** (dead
  property), không ai đọc. [Nhóm B — chỉ hết "chết" khi có cột `Thumbnail` thật ở schema mới]

### View (`Views/Destination/Index.cshtml`, 30 dòng)
- Dòng 4: `<link href="~/css/destination.css">` nằm ngay trong body markup (không qua
  `@section`) → về mặt kỹ thuật `<link>` bị đặt trong `<body>` (browser vẫn chấp nhận
  nhưng sai chuẩn HTML). [Nhóm A, sửa nhanh]
- Không có UI filter theo tỉnh/loại hình — chỉ có ô tìm kiếm tự do (`_SearchCondition.cshtml`).
- Không có control phân trang nào trong view (component `_Paging` chỉ tồn tại bên CMS
  admin project khác, không dùng ở đây).

---

## 3. Trang chi tiết điểm đến (`/diem-den/{slug}`)

**Controller**: `DestinationController.Detail(string id)`, dòng 152-242.

### Title/description — rủi ro trùng lặp cao
```csharp
var title = detail.IsGroup
    ? $"Du lịch {detail.Name} - Thông tin cần biết, Khách sạn, ăn uống"
    : $"{detail.Name} - Thông tin cần biết, Khách Sạn, Giá vé, giờ mở cửa";
```
(dòng 215-217) — **chỉ 2 template cho toàn bộ catalog**, biến duy nhất là `Name`. Hai
điểm đến trùng tên (tên chung: "Chợ đêm", "Bãi biển"...) sẽ ra `<title>` **giống hệt
byte-for-byte**. `Description = detail.Description` (dòng 223/227) — **copy nguyên
văn** cột DB, không xử lý độ dài/không có fallback khi ngắn. [Nhóm A — viết lại theo
template phong phú hơn + dùng field mô tả SEO riêng nếu có ở schema mới]
- Không có `<link rel="canonical">` (xác nhận lại — thiếu toàn site).
- `og:image` trỏ ảnh **full size** (`detail.Image` = `{Id}.webp`), không dùng bản đã
  resize — nặng hơn cần thiết cho preview link. [Nhóm B, gắn liền việc sửa ảnh]

### Breadcrumb
- `BreadcrumbUtils.CreateDestinationDetailBreadcrumb` (`Utilities/BreadcrumbUtils.cs:9-42`):
  luôn bắt đầu tại "Điểm đến" (`/diem-den`) — **không có cấp "Trang chủ" (`/`)** trong
  chuỗi breadcrumb. Cấp Tỉnh/Cluster là tùy chọn (có mới thêm). [Nhóm A — thêm "Trang chủ" làm gốc]
- Breadcrumb hiển thị (UI) và JSON-LD dùng chung 1 list nguồn — đảm bảo khớp nhau tuyệt
  đối, không có rủi ro lệch giữa 2 nơi. ✅ điểm tốt, giữ nguyên khi sửa.

### Nội dung trang — thứ tự chính xác (`Views/Destination/Detail.cshtml`, 126 dòng)
| Dòng | Khối |
|---|---|
| 8-56 | Hero: ảnh full (14), `<h1>` (17, DUY NHẤT trên trang), địa chỉ/khoảng cách (18-22), điện thoại (23-26), giờ mở cửa+giá vé+link Klook (27-41, ẩn nếu `IsGroup`), tag loại hình (42-53) |
| 58-68 | "Thông tin tổng quát" — `@Html.Raw(detail.Content)` **không sanitize thấy được trong file này** + upsell Klook nếu có giá vé |
| 70-83 | "Điểm đến trong khu vực/liên quan" — `_ChildDestination.cshtml`, tối đa hiện theo `.Take(8)` ở controller |
| 85-93 | "Ăn gì ở {Name}" — raw HTML `detail.Food`, ẩn nếu rỗng |
| 95-103 | "Đến {Name} bằng cách nào?" — raw HTML `detail.Transport`, ẩn nếu rỗng |
| 105-111 | "Khách sạn giá rẻ tại {Name}" — **LUÔN hiện** (không guard rỗng như Food/Transport/Tip) + `<div id="hotelListId">` RỖNG, chỉ điền qua AJAX sau khi trang đã load |
| 113-121 | "Lời khuyên khi tới {Name}" — raw HTML `detail.Tip`, ẩn nếu rỗng |

**Thiếu hoàn toàn**: review/rating (bảng `DestinationReview` có sẵn trong DB nhưng code
fetch bị comment out), gallery ảnh (chỉ 1 ảnh hero), bản đồ nhúng (có `Lat/Lng` nhưng
không render trực quan), FAQ. [Nhóm B — các trường này khớp đúng chỗ trống `RelatedJson`/
`FaqJson` đã thiết kế sẵn ở schema v2]

### Alt text
- Tốt: ảnh hero `alt="Hình ảnh về {Name}"` (dòng 14), card liên quan `alt="{Name}"`.
- Chưa tốt: banner Klook `alt="Klook"` — chung chung, không đổi theo điểm đến (dòng 38).
[Nhóm A]

### Internal link — 1 link chết lặp lại nhiều chỗ
- Tag loại hình (dòng 42-53) và "Xem Tất Cả" khi >7 con (dòng 79) đều trỏ
  `/diem-den?keyword=...` — **nhưng cả `Index()` lẫn `Search()` đều không đọc tham số
  `keyword`** (Search chỉ đọc `q`) → đây là **link chết** trên mọi trang chi tiết có tag
  hoặc có >7 điểm con. [Nhóm A — sửa nhanh, ROI cao vì lặp lại toàn site]
- Link hoạt động thật: tối đa 8 card điểm liên quan (anchor = tên điểm, tốt cho SEO) +
  1 link nhóm khách sạn.

### Tốc độ
- Script riêng trang: chỉ `destination-detail.js` có `defer` (dòng 125) — tốt.
- ~~File JS đang deploy production là bundle chế độ development~~ **ĐÃ XÁC NHẬN KHÔNG PHẢI
  BUG (07/2026)**: `wwwroot/` nằm trong `.gitignore` (dòng 263), và `azure-pipelines.yml:22-28`
  chạy `npm run prod` (`webpack --mode=production`) trước khi `dotnet publish`. File `eval`-mode
  thấy trong source cục bộ chỉ là artifact từ lần chạy `npm run dev` thủ công của dev, không
  phải thứ thật sự được deploy lên hosting.
- Phần "Khách sạn giá rẻ" luôn phải đợi 1 AJAX (`POST /api/destinatin_detail`, lưu ý
  route có lỗi chính tả "destinatin") chạy xong mới có nội dung — với crawler không chạy
  JS đầy đủ, phần này coi như **rỗng trong HTML gốc**. [Nhóm B — nên SSR luôn phần khách
  sạn cùng lúc với `GetDetailAsync` để vừa nhanh vừa SEO-friendly hơn]

---

## 4. Vấn đề xuyên suốt cả 3 trang

1. **100% `<img>` trên toàn site thiếu `width/height/loading="lazy"/srcset`** — Home,
   List, Detail, kể cả các partial dùng chung (`_DestinationGroup`, `_HotelList`,
   `_ChildDestination`, `_DestinationList`). Đây là điểm sửa 1 lần ảnh hưởng nhiều nhất
   tới Core Web Vitals. [Nhóm A]
2. **Không trang nào có `<link rel="canonical">`** (site-wide, `_Layout.cshtml`). [Nhóm A]
3. **JSON-LD viết sẵn nhưng phần lớn không được gọi**: `Organization`/`WebSite` chỉ dùng ở
   Home; `TouristAttraction`/`TouristDestination` (`CreateDestinationJsonLD`) hoàn toàn
   chết trên Detail; List/Search không có `ItemList` nào. [Nhóm A]
2 cache key trùng dữ liệu (Home vs `/diem-den` — mục 2) là dấu hiệu cho thấy 2 controller
   được viết độc lập, không share logic — đáng lưu ý khi tái cấu trúc.

---

## 5. Đề xuất ưu tiên (gợi ý thứ tự, chưa triển khai)

**Nhóm A — làm ngay trên schema hiện tại (ROI cao, rủi ro thấp) — ĐÃ TRIỂN KHAI 07/2026**
(chi tiết plan + kiểm thử: xem lịch sử trao đổi/commit liên quan, không lặp lại ở đây):
1. ~~Build mode~~ — xác nhận không phải bug (xem ghi chú đã sửa ở mục 3 phía trên).
2. ✅ Thêm `loading="lazy"` + class CSS khoá tỉ lệ khung hình (`card-img-ratio`,
   aspect-ratio + object-fit:cover) cho ảnh card ở 4 partial dùng chung; hero Detail dùng
   `loading="eager" fetchpriority="high"` (không ép tỉ lệ, tránh crop sai thiết kế).
3. ✅ Thêm `<link rel="canonical">` tự self-reference trong `_Layout.cshtml` +
   `<meta name="robots" content="noindex, follow">` cho `/search`.
4. ✅ Sửa link chết `/diem-den?keyword=...` → `/search?q=...` (tag loại hình + "Xem Tất Cả").
5. ✅ Gộp cache key/TTL trùng giữa Home và `/diem-den` về `ContantVariables` (7 ngày, thay
   vì dao động 6h/7 ngày tuỳ nơi ghi sau).
6. ✅ Bật lại `CreateDestinationJsonLD` (sửa kèm bug off-by-one, `ContainsPlace` giờ đúng
   tối đa 10 thay vì 11), bổ sung `ItemList` cho `/diem-den` và `/search`.
7. ✅ Thêm cấp "Trang chủ" vào đầu breadcrumb Detail.
8. ✅ Viết lại template title/description Detail — dùng thêm `Type`/`ProvinceName`, cắt
   description qua `TextUtil.Truncate` khi quá dài, fallback khi mô tả gốc quá ngắn.
9. ✅ Bỏ `async` sai trên `<link rel="stylesheet">` của `common.css`, thêm `defer` cho
   `common.js` (đã xác nhận an toàn — không script nào phụ thuộc `common.js` chạy đồng bộ).

Đã build + chạy thử local (`npm run prod`, `dotnet build`, curl view-source Home/`/diem-den`/
1 trang chi tiết/`/search`) — xác nhận canonical, robots noindex, JSON-LD, breadcrumb,
link `/search?q=`, ảnh lazy/aspect-ratio đều hoạt động đúng như thiết kế.

**Nhóm B — cần schema mới (v2) hoặc thay đổi kiến trúc lớn hơn:**
10. **⏸ CHƯA LÀM — bạn xác nhận để sau (07/2026).** Migrate `Thumbnail` thành cột DB thật.
    Đã xác nhận lại (07/2026): ảnh hiển thị trên site **vẫn 100% layout CŨ** —
    `DestinationRepository.cs:45` (`Image = x.des.Id + ".webp"`) và 3 view
    (`_ChildDestination`, `_DestinationList`, `_DestinationGroup`) vẫn tự dựng
    `"../diem-den/thumbnail/" + item.Id + ".webp"`; entity `Destination.cs` không có cột
    `Thumbnail`. Pipeline zinoflow (upload/migrate ảnh → `{slug}/{slug}-hero|medium|thumb.webp`
    + ghi mirror/SQL Server) đã sẵn sàng nhưng **không có tác dụng hiển thị** cho tới khi
    làm xong việc này. 4 bước cần khi bắt tay vào (chi tiết ở
    [dichoithoi-web-image-refactor-notes.md](dichoithoi-web-image-refactor-notes.md)):
    1. Thêm cột `Thumbnail nvarchar(256) NULL` vào `dbo.Destination` (DB thật, cần xác nhận
       riêng trước khi chạy — thay đổi schema production).
    2. Thêm property `Thumbnail` vào entity `Destination.cs` + `DestinationModel.cs`
       (property đã có sẵn trên model, hiện là "cột chết" không ai đọc).
    3. Sửa `DestinationRepository.cs` đọc cột `Thumbnail`, fallback layout cũ khi `NULL`.
    4. Sửa 3 view hardcode ở trên (+ `Detail.cshtml:14`, `SchemaUtil.cs` dùng HERO url) qua
       1 helper duy nhất, xoá "cột chết" khỏi model.
    Làm hết "cột chết" `DestinationModel.Thumbnail` sau khi xong.
11. SSR phần khách sạn trong Detail thay vì AJAX sau load.
12. Thêm review/rating, gallery ảnh, bản đồ nhúng, FAQ (khớp `RelatedJson`/`FaqJson` schema v2).
13. Thêm phân trang/filter thật cho `/diem-den` (hiện đang hiển thị toàn bộ 1 danh sách phẳng).

Nhóm A đã xong toàn bộ (07/2026). Việc tiếp theo: mục 10 (chuyển ảnh sang cột `Thumbnail`)
khi bạn sẵn sàng — cần xác nhận riêng bước 1 (đổi schema DB production) trước khi chạy.
