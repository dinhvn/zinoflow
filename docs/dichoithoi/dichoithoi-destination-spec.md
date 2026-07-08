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
| Vị trí (lat/lng) + khoảng cách tới trung tâm | nhập tay / lấy từ mirror |
| Liên hệ (điện thoại, website chính thức) | nhập tay |
| Giờ mở cửa | nhập tay HOẶC đưa URL tham khảo để tool tự lấy |
| Giá vé | nhập tay HOẶC đưa URL tham khảo để tool tự lấy |
| Thông tin tổng quát / ghi chú | nhập tay (tùy chọn) |
| URL tham khảo chung | 0-n link, mỗi trường có thể có nguồn riêng |
| Link mua vé online (`ticketLinks[]` — nhiều nhà cung cấp: Klook, TripVision...) | nhập tay (tùy chọn, 0-n dòng — xem §2.3, thay cho `bookingUrl` 1 link cũ) |
| Khách sạn gợi ý | quản lý ở module Hotel riêng, gán qua `HotelDestinationMap` — không nhập ở form này (kiếm tiền khách sạn — §2.3, xem `dichoithoi-hotel-spec.md`) |

Lưu ý "địa chỉ cũ và mới": sau đợt sáp nhập tỉnh/thành, bài viết phải ghi rõ cả 2
để người đọc tra cứu — đưa vào prompt và structure gate (§6.1).

### 2.2 Khung thông tin "ai cũng cần" của 1 bài điểm đến
Phân tích theo search intent du lịch (người đọc trước chuyến đi cần gì) + các cột
DB website đang render thành mục riêng:

| Khối | Người đọc cần biết | Map sang DB |
|---|---|---|
| Tổng quan | điểm này là gì, vì sao đáng đi | Content (intro) |
| Vị trí & di chuyển | ở đâu, đi bằng gì, mất bao lâu, gửi xe | Transport + Address/Lat/Lng |
| Giờ mở cửa & giá vé | thông tin quyết định lịch trình — PHẢI dễ thấy | OpeningTime + TicketPrice |
| Trải nghiệm / chơi gì | hoạt động chính, khu vực nổi bật, check-in | Content (sections) |
| Món ăn / đặc sản | ăn gì tại chỗ và gần đó | Food |
| Thời điểm đẹp | mùa/giờ nên đi, tránh đông | Content (section) |
| Lưu trú | ở khu nào tiện, gợi ý khách sạn | HotelText + module Hotel (`HotelDestinationMap`) |
| Mẹo & lưu ý | tiết kiệm, an toàn, quy định | Tip |
| FAQ | câu hỏi thực tế theo search intent | Content (cuối bài) |
| Điểm đến gần đó | đi kèm trong cùng chuyến | auto-link + quan hệ (§3.7) |

Prompt pack ép đủ các khối này; khối nào không áp dụng (vd điểm miễn phí không có
giá vé) phải ghi rõ thay vì bỏ trống — structure gate kiểm tra (§6).

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
├─ Dichoithoi                ← khu mới
│   ├─ Điểm đến              /dichoithoi              (màn trung tâm — hub)
│   ├─ Taxonomy              /dichoithoi/taxonomy     (Loại + Tỉnh — giai đoạn 2, ẩn ở MVP)
│   ├─ Review khách          /dichoithoi/reviews      (duyệt review — giai đoạn 2, ẩn ở MVP)
│   └─ Công cụ               /dichoithoi/tools        (re-link, recompute, đồng bộ, log job)
└─ Settings
```

Nguyên tắc: **mọi việc theo TỪNG điểm đến đi từ màn "Điểm đến"** (hub); các job
chạy toàn cục (re-link, recompute related, đồng bộ mirror) nằm ở "Công cụ".
Draft dichoithoi vẫn chạy chung pipeline ai-content → màn review draft TÁI DÙNG
route `/content/[id]` hiện có (thêm panel quick-facts), không xây editor thứ 2;
list ở `/content` thêm filter theo site để tách bài dichoithoi khỏi bài affiliate.

### 7.2 Màn "Điểm đến" `/dichoithoi` (hub)
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
   liên hệ, **danh sách ticketLinks** (thêm/xóa/sắp xếp từng dòng, dán `sourceUrl`
   → preview `affiliateUrl` ngay theo cơ chế chung
   `dichoithoi-affiliate-link-conversion-spec.md`), thumbnail, featured/order —
   KHÔNG có trường chọn khách sạn ở đây (`HotelGroupId` legacy, đã thay bằng
   `HotelDestinationMap`). Khách sạn/tour gợi ý cho điểm đến này quản lý ở module
   riêng (`dichoithoi-hotel-spec.md` §6, `dichoithoi-tour-spec.md` §6), không nằm
   trong form này.
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
1. ✅ Quyền kết nối SQL Server từ máy local — **đã xác nhận kết nối được (12/06/2026)**.
2. ⚠️ Sau go-live phải khóa/ngừng nút import destination trên CMS cũ (tránh wipe).
3. Encoding tiếng Việt khi ghi nvarchar qua driver `mssql` — cần test sớm 1 record.
4. Ảnh điểm đến: ĐÃ CÓ THIẾT KẾ riêng (§14) — M4 giữ luồng FTP tay + cột path
   trong DB; trình upload tích hợp ở giai đoạn 2.
5. Nâng cấp schema (§11) cần sửa code website (.NET) để render trường mới —
   việc bên repo dichoithoi, làm song song Phase A.

## 10) Ngoài phạm vi MVP (để giai đoạn sau)
- Tự động refresh content theo lịch (scheduler) — sau khi nút update tay chạy ổn.
- Tạo hàng loạt từ danh sách điểm đến.
- Quản lý ảnh / sinh ảnh (chờ Image Tool).
- Viết bài Post/Phượt/Tour của dichoithoi (chỉ làm Destination trước).

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

Thuật toán (mỗi điểm), 2 pha:
- Pha 1 — chỉ khi lat/lng đổi hoặc có điểm mới: tính lại `nearby` — khoảng cách
  haversine từ lat/lng tới mọi điểm published cùng tỉnh + tỉnh giáp ranh,
  lấy top 10 trong bán kính 30km → upsert `DestinationRelation (nearby, Weight=mét)`.
- Pha 2 — build RelatedJson: lấy ứng viên theo thứ tự ưu tiên (quy tắc trộn mặc
  định, chỉnh được sau):
  1. Con trực tiếp (nếu là tỉnh/cụm) — tối đa 4;
  2. `related` curated (type 2, theo Weight);
  3. `nearby` (type 1, gần nhất trước);
  4. Anh em cùng cha;
  5. Cùng loại chính trong cùng tỉnh.
  Dedupe, loại chính nó, chỉ lấy Status=published, cắt đủ **8 mục**.
  Mỗi mục: `{slug, name, thumbnail, badge}` (badge = loại hoặc "cách 2,5 km").
- So sánh JSON mới với cũ — **khác mới UPDATE** (tránh write + invalidate cache vô ích).
- `mentioned` (type 3) KHÔNG vào RelatedJson — nó phục vụ thống kê + re-link,
  link đã nằm trong thân bài rồi, lặp lại ở khối liên quan là thừa.

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
