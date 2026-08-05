# Dichoithoi — Tự động geocode 4000 điểm con + audit trùng lặp/sai cụm (plan, ghi 05/08/2026)

**ĐÃ BUILD XONG code Giai đoạn 0 + 1a + 1b + 2 (05/08/2026)** — build API/web sạch
(`tsc`, `nest build`), migration đã chạy thật trên Postgres dev, khởi động
thật xác nhận toàn bộ route map đúng thứ tự, 82 suite/512 test jest pass
(gồm 2 spec mới cho `scoreCandidate`/`matchesGeocodeFilter`). **CHƯA test
được với dữ liệu Google thật** vì Places API (New) chưa được bật trên project
Google Cloud của người dùng (lỗi `SERVICE_DISABLED` lúc kiểm tra key) — cần
bật API rồi chạy lại DoD từng giai đoạn (gọi thử vài điểm đã biết trước kết
quả) trước khi tin tưởng dùng hàng loạt. Chi tiết implementation ghi trong
memory `dichoithoi-destination-geocode-audit-plan-open.md`.

Bối cảnh: đã chạy batch AI "tìm điểm con trong cụm"
(`cluster-poi-discovery`), tạo ra hàng nghìn điểm `kind=poi` mới. Người dùng
nêu 2 vấn đề: (1) mỗi điểm cần `googleMapsUrl` chính xác + thông tin cơ bản,
hiện phải tự tay search Google Maps từng điểm; (2) trong tập lớn này chắc có
điểm trùng lặp hoặc gán sai cụm. Yêu cầu cụ thể của người dùng: lấy toạ độ +
**mọi thông tin Places có** (kể cả ảnh) → **luôn qua bảng duyệt trước khi ghi**
(có chế độ duyệt hàng loạt) → sau đó mới làm bước chuẩn hoá trùng lặp/sai vị
trí.

## Hiện trạng đã audit (code thật + dữ liệu thật, không suy đoán)

**Schema/field liên quan** (`apps/api/src/modules/destination/infrastructure/entities/destination-mirror.entity.ts`):
- `googleMapsUrl` (dòng 63-64, text) — nhập tay, là **nguồn thật duy nhất**;
  `lat`/`lng` (dòng 52-56, decimal 9,6) chỉ là cache tự parse lại mỗi khi cột
  này đổi.
- `parentSlug` (33-34, = cụm/cha), `kind` (30-31: province|cluster|poi),
  `provinceCode` (36-38).
- `addressNew`/`addressOld` (66-70), `contactPhone` (72-73), `openingHours`
  (203-207, jsonb note+periods có cấu trúc — không phải HTML).
- `heroImageMeta` (194-196, jsonb `{altText, caption, credit}`), `gallery`
  (190-192, `GalleryItem[]` cùng cấu trúc).
- `siteId`/`siteStatus` (25-27, 131-132) — `siteId=null` = chỉ sống trong AI
  tool, chưa publish SQL Server (xem Cửa A/B/C ở
  `dichoithoi-system-overview.md` §2.2).

**Dữ liệu thật** (query trực tiếp Postgres dev, 05/08/2026):

| kind | tổng | đã có googleMapsUrl | % |
|---|---|---|---|
| cluster | 235 | 234 | 99.6% |
| poi | 3862 | 105 | 2.7% |
| province | 34 | 0 | 0% (đúng — tỉnh không phải 1 điểm) |

→ Khớp con số "~4000 điểm con" người dùng nêu (3862 poi thật, ~3757 điểm
chưa có `googleMapsUrl`). Quan trọng: **99.6% cụm đã có toạ độ thật** — đủ để
dùng làm tín hiệu định vị (location bias) khi geocode từng điểm con của cụm
đó, dù bản thân cụm `siteId` phần lớn vẫn null (chưa publish — không liên
quan tới việc đã có toạ độ hay chưa, đây là 2 khái niệm độc lập).

**Batch AI hiện tại** (`cluster-poi-discovery-batch-task-handler.ts`,
schema `packages/contracts/src/dichoithoi/cluster-poi-candidate.ts:45-59`):
`ClusterPoiCandidateItem` chỉ có `name/priorityLevel/shortDescription/
address/matchType/matchedSlug/matchedName/...` — **không có
googleMapUrl/toạ độ nào**. Khi Accept, `accept-cluster-poi-candidates.
usecase.ts:81-97` tạo record mới qua `UpsertDestinationUseCase.create()`
nhưng **không set `googleMapsUrl`** — đây chính là lỗ hổng khiến 3757 điểm
mới không có toạ độ.

**Dedup hiện tại** (`fuzzy-match-destination-name.ts`) chỉ so tên (chuẩn hoá
tiếng Việt + Jaccard token), **không dùng toạ độ** — ở quy mô 3862 điểm, so
tên không đủ tin cậy để chặn trùng/sai cụm (nhiều địa danh trùng tên khác
tỉnh, ví dụ "Bãi Dài" đã ghi nhận ở `dichoithoi-backlog.md`).

**Hạ tầng khoảng cách thật đã có, chỉ hoạt động khi có toạ độ**:
`openroute service-matrix.adapter.ts` + bảng `dichoithoi_poi_distances`
(entity `poi-distance.entity.ts`) — dùng đường bộ thật, không phải Haversine
giả lập, nhưng **chỉ tính được cho record đã có lat/lng** → 3757 điểm hiện
ngoài phạm vi pipeline này.

**Pattern staging + review UI đã có 2 lần, sẽ tái dùng nguyên khung**:
- Bảng jsonb 1-dòng-1-đối-tượng: `dichoithoi_cluster_poi_candidates`
  (`cluster-poi-candidate.entity.ts`, PK `clusterSlug`, cột `candidates[]`).
- UI duyệt hàng loạt: `cluster-poi-candidates-panel.tsx` — Modal, checkbox
  "chọn tất cả" chỉ tính dòng actionable (khoá dòng `status != pending`),
  badge trạng thái thay vì filter dropdown, 1 nút gộp "Chấp nhận N mục đã
  tick" gọi usecase nhận `acceptedIndexes: number[]`. Không có nút "Từ chối"
  riêng (không tick = bỏ qua).
- Batch task handler: interface `batch-task-handler.port.ts`, mỗi module tự
  đăng ký trong `onModuleInit()` của chính nó (không đăng ký tập trung ở
  `ai-content.module.ts`) — tránh vòng lặp import giữa `destination.module.ts`
  và `ai-content.module.ts` (ghi chú tại `destination.module.ts:260`).

**Pipeline ảnh hiện có KHÔNG tái dùng được cho ảnh địa điểm**:
`content-image.entity.ts` (bảng `content_images`, pipeline Pexels đã build)
chỉ gắn với `content_jobs` (bài viết), **không có FK tới destination**, và
nguyên tắc đang áp dụng là "chỉ tìm ảnh minh hoạ CHUNG, không tự tìm ảnh cho
1 địa điểm cụ thể" (ghi trong `dichoithoi-auto-image-search-plan.md`, lý do:
tránh gắn nhầm ảnh không phải của đúng địa điểm) — ngược lại đúng nhu cầu ở
đây là ảnh **phải đúng địa điểm cụ thể**, nên cần thiết kế riêng, không mở
rộng pipeline Pexels.

**Chưa có tích hợp Google Places/Geocoding API nào** (`.env.example` chỉ có
`OPENROUTESERVICE_API_KEY`, grep `GOOGLE_MAPS`/`places.googleapis` toàn repo
= 0 kết quả).

**Google Places API (New) — tra cứu chính thức `developers.google.com`,
05/08/2026** (bắt buộc dùng bản New — bản cũ "Places API" đang ở trạng thái
Legacy):
- Endpoint Text Search: `POST https://places.googleapis.com/v1/places:searchText`,
  field mask qua header `X-Goog-FieldMask`, hỗ trợ `locationBias.circle
  {center, radius}` — dùng toạ độ cụm cha (đã có 99.6%) làm tâm bias, tăng
  độ chính xác đúng như người dùng mô tả cách làm tay ("nhập tên → chọn đúng
  kết quả trong danh sách", ở đây thay bằng "ưu tiên kết quả gần cụm cha").
- Giá theo tier, free/tháng theo SKU (đổi từ 01/03/2025, xem trao đổi trước):
  Essentials 10.000 free, Pro 5.000 free (gồm `displayName/formattedAddress/
  location/types/photos/googleMapsUri`), Enterprise 1.000 free (gồm
  `nationalPhoneNumber/regularOpeningHours/rating/websiteUri`). 3757 điểm nằm
  gọn trong 5.000 free/tháng ở tier Pro nếu chạy 1 đợt/tháng.
- **Ràng buộc pháp lý quan trọng cho phần ẢNH** (nguyên văn tài liệu Google):
  *"You cannot cache a photo name... ensure you always get the name from a
  response to a Place Details request"* — `photos[].name` không được lưu để
  gọi lại sau, và khi hiển thị ảnh phải kèm `authorAttributions` nếu có. Điều
  này khác hẳn cơ chế "tải về lưu vĩnh viễn, chờ duyệt" đang dùng cho Pexels
  — không thể áp y nguyên cách đó cho ảnh Places mà không vi phạm điều khoản
  dịch vụ (rủi ro bị khoá API key/tài khoản Cloud).

## Chính sách lưu trữ dữ liệu Places (ảnh + MỌI field khác) — quyết định 05/08/2026

Tra lại kỹ hơn (nhiều nguồn phụ khớp nhau, không chỉ riêng tài liệu ảnh đã
dẫn ở trên) xác nhận Google Maps Platform Terms of Service phân biệt **3
mức lưu trữ**, không phải chỉ ảnh:

| Loại field | Được lưu bao lâu |
|---|---|
| `place_id` | **Vĩnh viễn** — ngoại lệ duy nhất |
| Toạ độ (`location.lat/lng`) | Tối đa **30 ngày**, hết hạn phải gọi lại API làm mới |
| Mọi field còn lại — tên, địa chỉ, SĐT, giờ mở cửa, rating, ảnh... | **Không được lưu trữ lâu dài** — phải lấy bản tươi (live request) mỗi lần cần hiển thị, không phải kho lưu trữ tĩnh |

Người dùng muốn "lưu lại toàn bộ những gì Google trả về, để xem hoặc apply
lại" — yêu cầu này **đụng giới hạn trên nếu hiểu là lưu tĩnh vĩnh viễn** cho
mọi field. Thiết kế dung hoà (giữ đúng trải nghiệm người dùng muốn, tuân thủ
điều khoản):

- Bảng staging (`dichoithoi_destination_geocode_candidates`) lưu **vĩnh
  viễn**: `placeId`, `confidenceScore`, `status` (pending/accepted/rejected),
  `matchedDestinationSlug`, thời điểm tìm thấy — đây là dữ liệu "của mình"
  (kết quả matching + quyết định duyệt), không phải nội dung Google.
- Snapshot đầy đủ (tên/địa chỉ/SĐT/giờ/rating/ảnh) chỉ hiển thị **live** mỗi
  lần mở bảng duyệt hoặc bấm "Xem lại"/"Áp dụng lại" — gọi lại Places API
  bằng `placeId` đã lưu (Get Place Details) để lấy bản tươi, không đọc từ
  cache cũ. Toạ độ nếu quá 30 ngày cũng làm mới cùng lúc.
- Kết quả thực tế cho người dùng: **vẫn xem lại được toàn bộ lịch sử đã
  tìm** (không mất danh sách, không phải chạy batch lại từ đầu — vì
  `placeId` không đổi), **vẫn apply lại được bất cứ lúc nào** — chỉ khác là
  dữ liệu hiển thị luôn là bản mới nhất từ Google thay vì bản cũ có thể đã
  lỗi thời (SĐT/giờ mở cửa đổi thì tự động thấy đúng, không bị lệch) — đây
  thực chất là điểm lợi hơn so với lưu tĩnh.
- Chi phí thêm: mỗi lần "Xem lại"/"Áp dụng lại" 1 candidate cũ tốn thêm 1
  lệnh gọi Place Details — cần tính vào ngân sách free-tier (xem mục cảnh
  báo ngưỡng bên dưới), nhưng chỉ xảy ra khi người dùng chủ động mở lại,
  không tự động chạy nền.
- Ảnh vẫn theo Mức A đã thống nhất trước: chỉ xem trực tiếp lúc duyệt
  (không lưu file), ảnh publish thật (hero/gallery) vẫn qua quy trình Pexels
  đã có sau khi tên/địa chỉ đã được xác nhận đúng.

## Field hữu ích phát hiện thêm khi tra cứu (báo cáo theo yêu cầu)

- **`businessStatus`** (`OPERATIONAL` / `CLOSED_TEMPORARILY` /
  `CLOSED_PERMANENTLY`) — rất đáng thêm vào field mask ngay từ đầu: giúp
  phát hiện điểm đến **đã đóng cửa vĩnh viễn** (khác loại lỗi với trùng
  lặp/sai cụm ở Giai đoạn 2, nhưng cùng mục tiêu "dữ liệu sai", chi phí gần
  như không tăng vì cùng nằm trong request Text Search/Details đã gọi).
  Đề xuất đưa vào field mask mặc định của Giai đoạn 1, gắn badge cảnh báo
  riêng trong bảng duyệt nếu `CLOSED_PERMANENTLY`.
- **`types`/`primaryType`** — có thể đối chiếu chéo với hệ Type/Tag taxonomy
  đã build (`suggest-taxonomy-types.usecase.ts`) để gợi ý phân loại tự động
  cho điểm mới. **Không đưa vào phạm vi lần build này** (tránh phình phạm
  vi) — ghi nhận làm cơ hội mở rộng sau, nếu người dùng thấy giá trị.

## Giai đoạn 0 — Hạ tầng geocoding provider (độc lập, làm trước)

1. Tạo Google Cloud project (hoặc dùng project sẵn có nếu đã có billing) →
   bật Places API (New) → tạo `GOOGLE_MAPS_API_KEY`, thêm vào
   `.env.example` (biến mới, theo đúng convention hiện có).
2. Application layer: port `IPlaceGeocodingProvider` (tương tự cách
   OpenRouteService adapter đang tách port/infrastructure) — method
   `searchText(query, locationBias?, fieldTier)` trả `PlaceCandidate[]`
   (`placeId, displayName, formattedAddress, location{lat,lng}, types,
   googleMapsUri, photos: {name}[], phone?, openingHours?, rating?` tuỳ
   tier field mask truyền vào).
3. Infrastructure: `infrastructure/geocoding/google-places.provider.ts` gọi
   đúng endpoint New (`places:searchText`), field mask theo tier cần
   (mặc định Pro cho đợt geocode chính, Enterprise chỉ khi cần SĐT/giờ mở
   cửa), có timeout + retry/backoff (đúng chuẩn adapter external service
   §7 copilot-instructions).
4. **Definition of Done**: viết 1 script/test gọi thử trên 5-10 điểm đã
   biết trước kết quả đúng (lấy từ 105 poi đã có `googleMapsUrl` thật) —
   xác nhận toạ độ Places trả về lệch < ~50m so với toạ độ hiện có (đo bằng
   Haversine đơn giản trong test, không cần OpenRouteService cho bước
   kiểm thử này).

## Giai đoạn 1 — Geocode + bảng duyệt (phụ thuộc Giai đoạn 0)

### Hiện trạng UI đã audit (để thiết kế đúng convention, không tạo màn hình thừa)

- `destination-metadata-form.tsx:345-362` — ô "Link Google Maps" đang nhập
  tay, `lat/lng` hiển thị read-only ngay dưới (tự parse khi lưu). Đây là nơi
  tự nhiên để đặt nút tìm cho **từng điểm**.
- `apps/web/src/app/dichoithoi/page.tsx:155,907-914` — trang danh sách điểm
  đến **đã có sẵn** checkbox filter "Chỉ cụm/điểm chưa có toạ độ"
  (`missingCoords`, đọc từ `listDestinationsQuerySchema` — schema đã hỗ trợ
  field này) + filter `parentSlug`/`kind`/`provinceCode`. Đây đã là đúng màn
  hình "chọn phạm vi" cần cho chế độ **hàng loạt** — không cần xây thêm màn
  hình chọn phạm vi riêng.
- Trang chi tiết 1 cụm (`app/dichoithoi/[slug]/page.tsx`) đã có nút "Tìm
  điểm con" (trigger `cluster-poi-discovery`) — chỗ tự nhiên để đặt thêm nút
  chạy hàng loạt **giới hạn trong cụm đang xem**, cặp đôi tự nhiên với nút có
  sẵn (tìm điểm con → tìm toạ độ cho các điểm con đó).
- Không có trang bulk list/multi-select nào khác ngoài
  `cluster-poi-candidates-panel.tsx` (Modal) — dùng lại đúng convention này
  cho bảng duyệt kết quả geocode.

### 1a — Chế độ từng điểm (đơn giản, không qua batch/pg-boss)

Trả lời trực tiếp câu hỏi "trong trang detail có nút tìm bằng Place không":
**có**, và không cần hạ tầng batch cho trường hợp này vì chỉ 1 lệnh gọi API
tức thời, không cần async job:

1. Thêm nút "🔍 Tìm bằng Google Places" cạnh ô "Link Google Maps"
   (`destination-metadata-form.tsx`).
2. Bấm → gọi 1 endpoint đồng bộ mới `GET /destinations/:slug/geocode-suggestions`
   (dùng `IPlaceGeocodingProvider` Giai đoạn 0 trực tiếp, không qua bảng
   staging) → mở `Modal` nhỏ hiện top 3-5 kết quả: tên, địa chỉ chuẩn hoá,
   khoảng cách tới cụm cha, badge confidence, ảnh xem trước (Mức A, live).
3. Người dùng chọn 1 kết quả (radio) → "Dùng kết quả này" → **chỉ điền vào
   form phía client** (ô `googleMapsUrl`, và `addressNew`/`contactPhone` nếu
   trống) — KHÔNG tự ghi DB. Người dùng vẫn bấm nút "Lưu" sẵn có của form để
   xác nhận cuối cùng, đúng quy trình hiện tại (Cửa C — sửa metadata ghi
   thẳng SQL Server ngay nếu `siteId != null`, xem `dichoithoi-system-overview.md` §2.2).
4. **Definition of Done 1a**: mở 1 destination cụ thể chưa có `googleMapsUrl`
   thật trong dev, bấm nút, xác nhận modal trả kết quả đúng, chọn 1 kết quả
   → form tự điền → bấm Lưu → query Postgres xác nhận `googleMapsUrl`/`lat`/
   `lng` ghi đúng.

### 1b — Chế độ hàng loạt (qua batch/pg-boss + bảng duyệt)

1. Bảng staging mới `dichoithoi_destination_geocode_candidates` (entity +
   migration, PK `destinationSlug`, cột jsonb `candidates: GeocodeCandidate
   Item[]` — mỗi item gồm field Places tier Pro + `confidenceScore` +
   `photos` (chỉ `name`, không cache lâu — xem lưu ý ToS ở trên) +
   `status`), đúng khuôn `cluster-poi-candidate.entity.ts`.
2. Tính `confidenceScore` = trọng số giữa (a) name similarity — tái dùng
   logic chuẩn hoá tiếng Việt trong `fuzzy-match-destination-name.ts`, và
   (b) khoảng cách Haversine giữa `location` Places trả về và toạ độ cụm
   cha (`parentSlug`). Điểm cao → tự động tick sẵn trong UI (vẫn phải bấm
   "Chấp nhận" mới ghi, không tự động ghi thẳng); điểm thấp/nhiều ứng viên
   ngang nhau → để trống, người dùng tự chọn.
3. Batch handler mới `taskType="geocode-destination"`, tự đăng ký
   `onModuleInit()` trong `destination.module.ts` (đúng pattern tránh vòng
   lặp module đã dùng cho `cluster-poi-discovery`) — nhận payload là 1 bộ
   filter (tái dùng `listDestinationsQuerySchema`: `parentSlug`/`kind`/
   `provinceCode`/`missingCoords`). Người dùng đã chốt: **lấy cả field Pro
   (địa chỉ/toạ độ/ảnh/`businessStatus`) lẫn Enterprise (SĐT/giờ mở
   cửa/rating) ngay từ đợt đầu**, không tách 2 đợt — kèm cơ chế cảnh báo
   ngưỡng bên dưới để không vượt free tier ngoài ý muốn.

### Cơ chế cảnh báo ngưỡng free-tier (chốt 05/08/2026: Pro cảnh báo ở 4000/5000, Enterprise ở 800/1000)

Vì Giai đoạn 1a (từng điểm) và 1b (hàng loạt) **dùng chung 1 quota** theo
tháng lịch của Google, cần 1 bộ đếm dùng chung cho cả 2 chế độ, không tính
riêng:

1. Bảng log nhẹ `dichoithoi_places_api_call_logs` (1 dòng/lần gọi API thật,
   cột `tier` (`pro`/`enterprise`), `calledAt`) — ghi ngay trong
   `google-places.provider.ts` mỗi lần gọi thành công, không phụ thuộc kết
   quả có match hay không.
2. Trước khi cho phép bấm "Bắt đầu" (1b) hoặc "Tìm" (1a nếu người dùng bật
   Enterprise field cho từng điểm), tính tổng số call theo `tier` trong
   tháng lịch hiện tại (`calledAt >= đầu tháng`):
   - Pro: nếu tổng hiện tại + số dự kiến sắp gọi ≥ **4000** (ngưỡng cảnh
     báo, dưới mức free 5000) → hiện banner cảnh báo màu vàng "Sắp chạm
     ngưỡng miễn phí Pro (X/5000 tháng này)", vẫn cho chạy nhưng phải xác
     nhận thêm 1 lần.
   - Enterprise: ngưỡng cảnh báo ở **800** (dưới mức free 1000), cùng cơ
     chế banner + xác nhận.
   - Nếu tổng đã VƯỢT mức free thật (5000/1000) → chặn hẳn nút "Bắt đầu",
     bắt buộc bật riêng 1 toggle "Chấp nhận phát sinh phí ngoài free-tier"
     (mặc định tắt) mới cho chạy tiếp — không tự động chi tiền ngoài ý
     muốn người dùng.
3. Hiện số đếm hiện tại (call tháng này/ngưỡng) ngay trên UI (trang danh
   sách + trang chi tiết cụm) theo đúng quy tắc "giải thích tính năng ngay
   tại chỗ dùng" — không cần vào trang riêng mới xem được đã dùng bao nhiêu.
4. **2 điểm vào (entry point), cùng 1 cơ chế backend, khác payload filter**:
   - Trang danh sách `dichoithoi/page.tsx`: khi đang lọc (đặc biệt tick sẵn
     `missingCoords`), thêm nút "Tìm toạ độ hàng loạt cho N điểm đang lọc"
     (N = tổng số đang khớp filter) — submit batch với đúng filter hiện tại
     trên URL.
   - Trang chi tiết cụm `[slug]/page.tsx`: nút "Tìm toạ độ cho điểm con cụm
     này" — submit batch với `parentSlug` cố định = cụm đang xem, cạnh nút
     "Tìm điểm con" có sẵn.
5. UI duyệt kết quả: panel mới theo đúng convention
   `cluster-poi-candidates-panel.tsx` (Modal, checkbox chọn hàng loạt loại
   trừ dòng khoá, badge trạng thái) + thêm cột ảnh preview (Mức A — proxy
   endpoint gọi live Photo Media, không lưu) + info cơ bản (địa chỉ chuẩn,
   SĐT/giờ nếu đã lấy). Theo quy tắc "giải thích tính năng ngay tại chỗ
   dùng" — panel phải có đoạn giải thích ngắn: đây là gợi ý từ Google Maps,
   người dùng vẫn phải xác nhận đúng địa điểm trước khi lưu.
6. Usecase `AcceptGeocodeCandidatesUseCase` (theo mẫu `accept-cluster-poi-
   candidates.usecase.ts`) nhận danh sách đã tick, ghi `googleMapsUrl`
   (dựng từ `googleMapsUri` trả về, hoặc fallback
   `https://www.google.com/maps/place/?q=place_id:{placeId}`) +
   `addressNew`/`contactPhone`/`openingHours` (nếu có, tuỳ field đã lấy)
   vào destination thật qua `UpsertDestinationUseCase.update()` — **không
   đụng ảnh** (Mức A không lưu ảnh).
7. **Definition of Done 1b**: chạy thật trên 1 cụm nhỏ đã biết rõ (dùng nút
   ở entry point cụm) → mở UI duyệt bằng mắt, xác nhận link Google Maps mở
   ra đúng địa điểm cho phần lớn dòng confidence cao; bấm Chấp nhận → query
   lại Postgres xác nhận `googleMapsUrl`/`lat`/`lng` đã ghi đúng cho các
   dòng đã tick, dòng chưa tick không đổi gì. Thử thêm 1 lượt qua entry
   point trang danh sách với filter `missingCoords=true` phạm vi rộng hơn.

## Giai đoạn 2 — Audit trùng lặp & sai cụm (phụ thuộc Giai đoạn 1)

Chỉ chạy có ý nghĩa **sau khi** phần lớn poi đã có toạ độ thật từ Giai đoạn
1 — so tên/địa chỉ thô hiện tại (`fuzzy-match-destination-name.ts`) không đủ
tin cậy ở quy mô này (đã xác nhận ở phần audit trên).

1. **Nghi trùng lặp**: với mọi cặp poi cùng cụm hoặc cụm liền kề, tính
   Haversine giữa toạ độ 2 điểm (không cần gọi OpenRouteService — khoảng
   cách thẳng đủ để lọc ứng viên, đường bộ thật chỉ cần khi đã nghi ngờ và
   muốn xác nhận thêm). Ngưỡng khởi điểm đề xuất 100-150m + name similarity
   — **cần người dùng tự chỉnh ngưỡng sau khi xem kết quả thật đợt đầu**
   (không đoán được ngưỡng đúng tuyệt đối trước khi có dữ liệu).
2. **Nghi sai cụm**: so khoảng cách từ poi tới `parentSlug` hiện tại vs tới
   cụm gần nhất khác (Haversine trên toàn bộ cụm cùng tỉnh) — flag nếu cụm
   khác gần hơn đáng kể. Ngưỡng cũng cần tinh chỉnh cùng người dùng.
3. Bảng flag mới (staging, cùng khuôn Giai đoạn 1) + UI duyệt tương tự —
   hành động "Chấp nhận" cho việc gộp (giữ 1, archive/xoá điểm còn lại) hoặc
   chuyển cụm (`update parentSlug`). **Không bao giờ tự động gộp/chuyển** —
   đúng nguyên tắc đang áp dụng cho mọi thao tác duyệt hàng loạt khác trong
   dự án.
4. **Definition of Done**: chạy trên toàn bộ dữ liệu đã geocode, spot-check
   thủ công 10-15 cặp nghi trùng/sai cụm — nếu người dùng đã tự biết trước
   vài trường hợp cụ thể (ví dụ đã nghi ngờ khi làm tay), ưu tiên kiểm các
   case đó trước để xác nhận thuật toán bắt đúng trước khi tin tưởng chạy
   full.

## Phụ thuộc tổng quan

```
Giai đoạn 0 (provider)
     │  (bắt buộc trước, không có provider thì không gọi được API)
     ▼
Giai đoạn 1 (geocode + duyệt hàng loạt)
     │  (cần toạ độ thật của phần lớn poi trước khi audit có ý nghĩa)
     ▼
Giai đoạn 2 (audit trùng lặp/sai cụm)
```

Phần khung UI (Modal, bảng, checkbox) của Giai đoạn 1 có thể dựng song song
lúc chờ setup billing/API key ở Giai đoạn 0, nhưng nên làm tuần tự cho đơn
giản trừ khi người dùng muốn rút ngắn thời gian.

## Quyết định người dùng — đã chốt 05/08/2026

1. **Ảnh**: Mức A tạm thời (chỉ xem trực tiếp lúc duyệt, không lưu file).
   Áp dụng luôn cho MỌI field khác ngoài `place_id`/toạ độ (30 ngày) theo
   đúng điều khoản Google — xem mục "Chính sách lưu trữ dữ liệu Places" ở
   trên (thiết kế dung hoà: giữ `placeId` vĩnh viễn để xem/apply lại được,
   snapshot nội dung luôn lấy bản tươi).
2. **Field lấy đợt đầu**: lấy CẢ Pro lẫn Enterprise ngay từ đầu (không tách
   2 đợt) — kèm cơ chế cảnh báo ngưỡng free-tier: Pro cảnh báo ở 4000/5000,
   Enterprise cảnh báo ở 800/1000, chặn hẳn (cần xác nhận thêm) nếu vượt
   free thật — xem mục "Cơ chế cảnh báo ngưỡng free-tier" ở Giai đoạn 1b.
3. **Ngưỡng khoảng cách Giai đoạn 2** (trùng lặp/sai cụm): CHƯA chốt số —
   để xem tình hình dữ liệu thật sau khi Giai đoạn 1 chạy xong rồi mới
   quyết định ngưỡng cụ thể.
