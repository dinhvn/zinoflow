# Dichoithoi Vé xe khách — Plan implement (31/07/2026, ✅ ĐÃ BUILD + VERIFY 31/07/2026)

Ghi lại từ yêu cầu: thêm 1 menu CMS zinoflow quản lý nhà xe/tuyến (giống
Khách sạn/Tour/Vé), publish thẳng lên website dichoithoi. Mở rộng/thay thế
`dichoithoi-bus-spec.md` + `dichoithoi-flight-spec.md` §1 mục 2 (đã phân
tích trước nhưng chưa build) — plan này CHỐT kiến trúc cụ thể để build,
không viết lại phần đã đúng ở 2 file kia.

**Cập nhật sau khi build (31/07/2026)**: 2 điểm lệch so với bản chốt ban đầu,
phát hiện trong lúc code — xem "Sửa sau audit" ở §2:
1. Model gắn theo TỈNH ban đầu bị đổi giữa hội thoại sang gắn theo TUYẾN có
   điểm dừng (điểm đầu/cuối/trung gian, mỗi điểm là node cụm/tỉnh thật) —
   đã cập nhật §2 trước khi build, không phải phát hiện lúc code.
2. **Hiển thị website**: audit sâu hơn lúc code phát hiện Hotel/Tour **đã có
   sẵn** cơ chế bake-per-destination (`HotelCardsJson`/`TourCardsJson`, Phase
   15) — KHÔNG phải live-query như bản ghi đầu tiên của hội thoại này kết
   luận (đã nhầm giữa query zinoflow dùng để TÍNH card với cách website ĐỌC
   card). Đã build Transport theo ĐÚNG pattern Phase 15 này
   (`TransportCardsJson`), không phải live-query như dự kiến ban đầu — xem
   §2 "Sửa sau audit".

## 1) Hiện trạng đã audit (code thật, không suy đoán)

- `apps/web/src/app/dichoithoi/ve/page.tsx` — trang "Vé" hiện có CHỈ quản lý
  vé tham quan (`destination_tickets`, gắn theo POI cụ thể qua
  `DestinationTicketLinksEditor`), không liên quan vé xe/máy bay.
- `apps/web/src/shared/sidebar.tsx:30-59` — nhóm "Dichoithoi" có sẵn mục
  Khách sạn/Tour/Vé cạnh nhau, đúng chỗ để thêm "Vé xe".
- `apps/web/src/app/dichoithoi/khach-san/page.tsx` — khuôn mẫu CRUD MVP
  nhập tay, publish thẳng không qua duyệt, có "Nhập từ Sheet" + form 1 khối.
- `apps/api/src/modules/hotel/` — khuôn mẫu module đầy đủ: entity Postgres
  (`hotel.entity.ts`), repository TypeORM, use-cases (list/upsert/import),
  controller, và **adapter ghi trực tiếp SQL Server**
  (`mssql-hotel-site-db.adapter.ts`) — KHÔNG có class tên "*Publisher"
  riêng, ghi thẳng qua `mssql`/`msnodesqlv8` driver trong adapter này.
- `mssql-hotel-site-db.adapter.ts:50-73` — `upsertHotel()` build câu
  `INSERT/UPDATE v2.Hotel`, tự resolve `ProvinceId` từ `provinceCode` text
  qua `SELECT Id FROM v2.Province WHERE Code=@provinceCode` — **Postgres
  KHÔNG có bảng `admin_provinces` FK thật** (khác giả định sai ở
  `dichoithoi-bus-spec.md` §2 dòng "REFERENCES admin_provinces(id)") — cột
  Postgres là `provinceCode varchar` tự do, giống hệt `typeorm-hotel.repository.ts:20`.
  → **Lệch tài liệu**: bus-spec.md cần sửa `arrival_province_id int
  REFERENCES admin_provinces(id)` thành `arrival_province_code varchar(16)`
  khi build thật (đã ghi ở đây, không sửa lại bus-spec.md vì đang là file
  phân tích cũ).
- `DiChoiThoi.Service/Repositories/DestinationExtras/DestinationExtrasRepository.cs`
  — Hotel/Tour trên website đọc qua EF Core query SQL Server sống (JOIN
  `V2HotelDestinationMap`/`V2Hotel`), KHÔNG qua `DynamicBlocksJson`.
- `dichoithoi-database-redesign.md` §3.4 (dòng 412-418) — `DynamicBlocksJson`
  là đề xuất THAY THẾ cơ chế live-query hiện tại, ghi rõ "CHƯA thêm vào DDL
  thật" — chưa build cho BẤT KỲ khối nào (kể cả Hotel/Tour đang chạy).
  → **KHÔNG dùng DynamicBlocksJson cho Vé xe** (việc lớn hơn phạm vi, ảnh
  hưởng cả Hotel/Tour/Gallery/FAQ).
- `database-redesign.md` dòng 504-505, 543: cây du lịch là `ParentId` 1
  cấp trực tiếp — trang cluster query con qua `WHERE ParentId=@id`; 1 POI
  có `ParentId` trỏ THẲNG tới cụm chứa nó (hoặc thẳng tới tỉnh nếu không có
  cụm) — không cần đệ quy để tìm "cụm cha" của 1 POI, chỉ 1 lần đọc
  `ParentId`.

## 2) ĐỔI HƯỚNG so với bản ghi lần đầu — gắn theo TUYẾN có điểm dừng, không
chỉ theo tỉnh (chốt lại trong hội thoại 31/07/2026)

Yêu cầu mới: 1 tuyến xe = **chọn điểm đầu, điểm cuối, và các điểm trung
gian** (đi ngang qua) — mỗi điểm là 1 node cụm/tỉnh có thật trong cây
`Destination` (không còn `departure_city`/`arrival_province_code` dạng text
tự do như bản đầu). Điều này đưa Transport về gần mô hình Hotel hơn (cần 1
bảng map), nhưng khác Hotel ở chỗ **có vai trò (role) khác nhau cho từng
điểm** thay vì tất cả ngang hàng.

**Quyết định hiển thị** (đã hỏi + chốt với người dùng):
- Điểm đầu + điểm cuối: hiện card "🚌 Vé xe khách" trên đúng trang cụm/tỉnh
  đó.
- Điểm trung gian: **KHÔNG hiện card** — chỉ lưu để biết lộ trình đầy đủ
  (dữ liệu nội bộ, có thể dùng sau cho mục đích khác như gợi ý "tuyến này
  có đi qua X" trong mô tả, nhưng không phải card riêng).
- POI con: **kế thừa** card của cụm cha (đầu/cuối, không kế thừa trung
  gian) qua `ParentId` — đúng tinh thần mọi node đều hiển thị được như đã
  chốt ở flight-spec §1 mục 2.

```
zinoflow (Postgres, nguồn sự thật)              dichoithoi (SQL Server, website chỉ đọc)
┌──────────────────┐                            ┌──────────────────────┐
│ transports        │      upsert trực tiếp      │ v2.Transport          │
│ (mode, operator...)│ ─────────────────────────▶ │ (Id, Mode, ...)       │
├──────────────────┤      (adapter mssql,        ├──────────────────────┤
│ transport_stops   │       giống Hotel nhưng     │ v2.TransportStop      │
│ (transport_id,     │      ghi thêm bảng stop)   │ (TransportId,         │
│  destination_slug,│ ─────────────────────────▶ │  DestinationId, Role,│
│  role, seq)        │                            │  SeqOrder)            │
└──────────────────┘                            └──────────────────────┘
                                                          │ SELECT stop.DestinationId
                                                          │ = @currentDestinationId
                                                          │ (hoặc = ParentId nếu là POI)
                                                          │ AND Role IN (origin,destination)
                                                          ▼
                                                 Card "🚌 Vé xe khách" trong
                                                 mục "Cách tới đây"
```

**Sửa sau audit lúc code (31/07/2026)**: sơ đồ trên (website SELECT trực
tiếp `v2.TransportStop` mỗi lần render) ĐÃ BỊ THAY bằng bake-per-destination
— giữ nguyên bảng `v2.Transport`/`v2.TransportStop` làm nguồn tính, nhưng
thêm cột `DestinationContent.TransportCardsJson` (giống hệt
`HotelCardsJson`/`TourCardsJson` đã có từ Phase 15). zinoflow tính lại JSON
này (`RecomputeTransportCardsUseCase`) và ghi đè mỗi khi 1 tuyến được
tạo/sửa — cho CẢ điểm đầu/cuối LẪN mọi POI con trực tiếp của chúng (fan-out
qua `ParentId`, vì POI phải có JSON riêng, không thể kế thừa lúc render).
Website (`DestinationExtrasRepository.cs`) chỉ đọc thẳng cột này, giống
Hotel/Tour — không JOIN `TransportStop` nào lúc render trang.

- Postgres `transports`: `id, mode smallint (1=flight dự phòng/2=bus),
  operator_name, phone, vehicle_type, price_from, thumbnail_url, provider,
  source_url, affiliate_url, link_status ('converted'|'no-rule'|
  'manual-override'|'no-link'), source smallint, site_id int, status
  smallint, created_at, updated_at` — **bỏ `departure_city`/
  `arrival_province_code`**, dời sang bảng stops.
- Postgres `transport_stops` (map, pattern giống `hotel_destination_map`
  nhưng thêm `role`/`seq_order`): `transport_id uuid, destination_slug
  varchar(64), role smallint (1=origin, 2=destination, 3=waypoint),
  seq_order smallint` — PK `(transport_id, destination_slug)`. Ràng buộc ở
  application layer (không phải DB constraint): đúng 1 dòng role=origin,
  đúng 1 dòng role=destination, 0..N dòng role=waypoint theo `seq_order`
  tăng dần. Picker chọn `destination_slug` CHỈ trong `kind IN
  ('cluster','province')` — không cho chọn POI lẻ (xe không tới 1 điểm
  tham quan cụ thể), tái dùng UI kiểu `AddTicketDestinationPicker` đã có ở
  `ve/page.tsx`.
- SQL Server: `v2.Transport` (bỏ cột Province/departure) + `v2.TransportStop
  (TransportId, DestinationId int, Role tinyint, SeqOrder tinyint)`, index
  `(DestinationId, Role)` — đây là JOIN THẬT SỰ cần thiết (khác nhận định
  sai ở bản ghi lần đầu "không cần bảng map").
- Adapter `MssqlTransportSiteDbAdapter`: `upsertTransport()` (bảng
  Transport) + `replaceStops()` (xoá/ghi lại toàn bộ `TransportStop` của 1
  transport — giống pattern `replaceTypeAssignments` đã có cho Type/Tag) +
  `findCardsForDestination(destinationId, mode, take)`: `SELECT ... FROM
  v2.TransportStop s JOIN v2.Transport t ON t.Id=s.TransportId WHERE
  s.DestinationId=@id AND s.Role IN (1,2) AND t.Mode=@mode AND t.Status=1
  ORDER BY t.PriceFrom`.
- Website: repository resolve `destinationId` hiện tại — nếu `Kind=POI`
  dùng `ParentId` thay vì `Id` (1 lần đọc, không đệ quy) — rồi gọi
  `findCardsForDestination`. Partial view "🚌 Vé xe khách" trong mục "Cách
  tới đây" (đúng vị trí đã chốt ở `content-seo-ux-plan.md` §5.8) — ẩn hẳn
  nếu rỗng.

## 3) Giai đoạn build

### Giai đoạn 1 — zinoflow: schema + CRUD backend (độc lập, làm trước được)
- Migration Postgres `transports` + `transport_stops` (TypeORM migration,
  theo mẫu `hotel.entity.ts` + `hotel-destination-map.entity.ts`).
- `packages/contracts/src/dichoithoi/transport.ts`: `transportSchema`
  (không còn field địa điểm text), `transportStopSchema`
  (`destinationSlug`, `destinationName` để hiện tên khi list, `role`,
  `seqOrder`), `transportLinkStatusSchema` riêng (thêm `no-link` so với
  Hotel/Tour).
- `apps/api/src/modules/transport/`: entity `TransportEntity` +
  `TransportStopEntity`, repository (có `replaceStops(transportId,
  stops[])` xoá/ghi lại toàn bộ, giống pattern `replaceTypeAssignments`),
  use-cases (`list-transports`, `upsert-transport` — nhận kèm mảng stops
  trong 1 request, validate đúng 1 origin + 1 destination trước khi lưu),
  controller `/transports` (`?mode=2` filter).
- **DoD**: `POST /transports` tạo được 1 nhà xe kèm `stops: [{slug: "sapa",
  role: "origin"}, {slug: "ha-noi", role: "destination"}]`, `GET
  /transports?mode=2` trả về đúng kèm tên điểm đầu/cuối, migration chạy
  sạch trên `zinoflow_dev`, validate chặn được case thiếu origin/destination
  hoặc >1 origin.

### Giai đoạn 2 — zinoflow: CMS UI (phụ thuộc Giai đoạn 1 — cần API trước)
- Trang `apps/web/src/app/dichoithoi/van-chuyen/page.tsx` (route đổi từ
  `xe-khach` sang tên chung 31/07/2026 — bảng dữ liệu đã thiết kế sẵn cho
  nhiều phương tiện, không muốn đổi URL khi thêm mode khác) — copy cấu trúc
  `khach-san/page.tsx` cho phần thông tin nhà xe (tên *, SĐT, loại xe text
  tự do, giá từ, provider + sourceUrl optional, preview affiliate URL) +
  tái dùng UI kiểu `AddTicketDestinationPicker` (`ve/page.tsx`) cho 3 ô
  chọn: **Điểm đầu*** (1), **Điểm cuối*** (1), **Điểm trung gian** (0..N,
  thêm/xoá dòng tự do, có thể kéo sắp thứ tự đơn giản bằng nút lên/xuống)
  — picker chỉ tìm trong destination `kind IN (cluster, province)`.
- `FeatureIntro` bắt buộc theo rule CMS inline explanation — giải thích: xe
  gắn theo tuyến (điểm đầu/cuối/trung gian là cụm hoặc tỉnh, không phải 1
  điểm tham quan cụ thể); điểm trung gian chỉ để biết lộ trình, KHÔNG hiện
  card trên trang đó.
- Thêm mục "Vé xe" vào `DICHOITHOI_ITEMS` trong `sidebar.tsx`, cạnh "Vé".
- **DoD**: thêm/sửa 1 nhà xe với đủ điểm đầu/cuối/1 điểm trung gian qua UI
  thật, danh sách hiện đúng tên 3 điểm, không lưu được nếu thiếu điểm
  đầu/cuối.
- ✅ **Bổ sung 31/07/2026 — nhập hàng loạt từ Google Sheet**: modal cùng
  luồng dry-run/apply/xác nhận gộp như Hotel/Tour/Vé (`ImportTransportsModal`,
  `ImportTransportsUseCase`) — KHÔNG dùng chung matcher với Hotel vì
  `sourceUrl` có thể RỖNG (nhiều nhà xe chỉ có SĐT): khớp theo `sourceUrl`
  khi có, fallback tên nhà xe + tuyến (origin/destination slug) khi trùng
  → `needsConfirm`, không tự ghi đè. Xác nhận gộp theo INDEX dòng (không
  phải sourceUrl, vì có thể trùng rỗng). Đã verify qua API thật: dry-run,
  apply, phát hiện trùng, xác nhận gộp đều đúng.
- ✅ **Bổ sung 31/07/2026 — xoá tuyến**: `DeleteTransportUseCase` xoá cả
  Postgres lẫn SQL Server (`v2.Transport`/`v2.TransportStop`), tính lại
  `TransportCardsJson` cho điểm đầu/cuối cũ sau khi xoá (card biến mất
  đúng). Nút "Xoá" + `confirm()` trong trang CMS. Sheet URL mặc định đã
  đặt sẵn trong modal Nhập từ Sheet (vẫn sửa được). Đã verify qua API
  thật: tạo → xác nhận card bake → xoá → xác nhận card về rỗng.

### Giai đoạn 3 — dichoithoi: SQL Server schema + write path (phụ thuộc
Giai đoạn 1 — cần shape dữ liệu Postgres đã chốt)
- Script tạo `v2.Transport` + `v2.TransportStop` (thêm vào
  `scripts/dichoithoi-sqlserver/01-create-new-schema.sql` hoặc file mới nối
  tiếp, theo đúng convention hiện có) — index `(DestinationId, Role)` trên
  TransportStop.
- `MssqlTransportSiteDbAdapter` trong `apps/api`: `upsertTransport()` +
  `replaceStops()` (resolve `destination_slug` → `v2.Destination.Id` qua
  `SELECT Id FROM v2.Destination WHERE Slug=@slug`, xoá/ghi lại toàn bộ
  stops của transport đó trong 1 transaction).
- Gọi adapter trong `upsert-transport.usecase.ts` sau khi ghi Postgres —
  publish thẳng, không qua duyệt (giống Hotel).
- **DoD**: tạo 1 nhà xe qua CMS → query trực tiếp `v2.Transport`/
  `v2.TransportStop` trên `dichoithoi_dev` (LocalDB) thấy đúng
  origin/destination/waypoint đã resolve đúng `DestinationId`.

### Giai đoạn 4 — dichoithoi: hiển thị trên website (phụ thuộc Giai đoạn 3)
- Repository method mới (thêm vào `DestinationExtrasRepository.cs` hoặc file
  riêng `TransportRepository.cs` nếu tách gọn hơn): resolve
  `destinationId` hiện tại (nếu `Kind=POI` dùng `ParentId`), rồi
  `findCardsForDestination(destinationId, mode=2)` — `WHERE
  s.DestinationId=@id AND s.Role IN (1,2)`.
- Partial view "🚌 Vé xe khách" trong mục "Cách tới đây" (View
  Destination/Detail — xác định đúng file `.cshtml` khi vào giai đoạn này,
  chưa audit trong phiên này). Ẩn hẳn nếu danh sách rỗng.
- **DoD**: mở trang 1 cụm đã có nhà xe test (điểm đầu HOẶC điểm cuối) → thấy
  card đúng; mở trang 1 POI con của cụm đó → thấy card kế thừa giống hệt
  (verify `ParentId` resolve đúng); mở trang cụm chỉ là điểm TRUNG GIAN của
  1 tuyến test → KHÔNG thấy card (đúng quyết định "trung gian không hiện");
  cụm chưa có data → không thấy card (không có div rỗng).

## 4) Việc cần chốt trước khi build (kế thừa bus-spec §6, chưa đổi)
1. Chọn nguồn cào trước (vexere.com hay nguồn khác) — MVP có thể bỏ qua,
   chỉ nhập tay trước.
2. Xác nhận mạng affiliate vé xe đã cấp rule dạng nào.
3. Tần suất cập nhật giá tham khảo — không ảnh hưởng Giai đoạn 1-4 (MVP
   nhập tay, không có job cào).

## 5) Việc KHÔNG làm trong plan này (out of scope)
- Vé máy bay (`mode=1`) — bảng đã thiết kế sẵn sàng nhận thêm nhưng không
  build UI/adapter cho flight trong plan này.
- `DynamicBlocksJson` generic — không đụng tới, Hotel/Tour giữ nguyên cơ
  chế live-query hiện tại.
- Job cào (pg-boss) — MVP nhập tay như Hotel.
