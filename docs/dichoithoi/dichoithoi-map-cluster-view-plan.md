# Dichoithoi — Chế độ xem theo cụm/tỉnh cụ thể trên `/dichoithoi/ban-do`

**ĐÃ XONG + VERIFY 23/07/2026** — toàn bộ Giai đoạn A→E đã build, verify qua
Playwright thật trên `dichoithoi_dev` (xem "Tóm tắt verify" cuối file). Ghi
plan 23/07/2026.

Bối cảnh: người dùng đã có khoảng cách đường bộ thật giữa các điểm trong cùng
1 cụm (`dichoithoi-poi-distance-plan.md` Giai đoạn 1-3, ĐÃ XONG 21/07/2026) và
muốn khai thác dữ liệu này trực quan hơn trên trang bản đồ CMS
`/dichoithoi/ban-do`. Yêu cầu gốc gồm 4 ý — phân tích cho thấy 3/4 ý phụ thuộc
vào 1 tính năng nền tảng còn thiếu (chọn 1 cụm/tỉnh cụ thể để thu hẹp phạm vi
xem), nên gộp thành 1 plan có thứ tự rõ thay vì 4 việc rời rạc.

## Hiện trạng đã audit (không suy đoán — đã đọc code thật)

- [ban-do/page.tsx](../../apps/web/src/app/dichoithoi/ban-do/page.tsx): đã có
  filter `provinceCode`/`status`/`tier` (dòng 70-72, chỉ ẩn/hiện marker, không
  đổi dữ liệu tải về) và toggle `relationsOn`/`spotlightSlug`/`connectMode`
  (dòng 74-78). **Chưa có filter theo cụm** (`kind=cluster`, VD "Đà Lạt") —
  chỉ lọc được theo cả tỉnh (VD toàn bộ Lâm Đồng, nhiều cụm gộp lại).
- [destination.ts:878-894](../../packages/contracts/src/dichoithoi/destination.ts#L878):
  `destinationMapItemSchema` đã có sẵn `kind` (`province`/`cluster`/`poi`) và
  `parentSlug` — đủ để dựng danh sách cụm (`items.filter(kind==='cluster')`)
  và lọc con thuộc 1 cụm (`item.slug===chosen || item.parentSlug===chosen`)
  **hoàn toàn ở phía frontend, không cần đổi contract/API cho phần chọn cụm**.
- [destination-map-cluster-layer.tsx:82-109](../../apps/web/src/features/dichoithoi/destination-map-cluster-layer.tsx#L82):
  dùng `L.markerClusterGroup()` (thư viện `leaflet.markercluster`) cho MỌI
  trường hợp, không có nhánh tắt clustering. Marker luôn là chấm tròn
  `L.divIcon` (dòng 20-29, `iconFor`), tên chỉ xuất hiện trong popup DOM lúc
  bấm (`buildPopupContent`, dòng 32-75) — không có tooltip thường trực.
- [destination-map-relations-layer.tsx](../../apps/web/src/features/dichoithoi/destination-map-relations-layer.tsx):
  đã vẽ 3 loại `L.polyline` — nền tự động cụm↔cụm/tỉnh↔tỉnh (`clusterDistances`,
  xám, dòng 61-69), curated tay (tím, dòng 72-87), spotlight RelatedJson
  (đỏ nét đứt, dòng 90-115). **Không có loại đường con↔con trong cùng cụm**
  (dữ liệu ORS thật vừa tính) — thiếu cả prop truyền vào lẫn logic vẽ.
- [get-relations-map-data.usecase.ts](../../apps/api/src/modules/destination/application/use-cases/get-relations-map-data.usecase.ts):
  trả về `clusterDistances` (từ `ClusterDistanceRepository.findAll()`) +
  `curatedRelations`. **Không trả `poi_distances`** (bảng
  `dichoithoi_poi_distances`, con↔con) dù dữ liệu đã tồn tại đầy đủ.
- [poi-distance.repository.ts](../../apps/api/src/modules/destination/application/ports/poi-distance.repository.ts)
  đã có sẵn `findAll(): Promise<PoiDistancePair[]>`
  ([TypeOrmPoiDistanceRepository:17](../../apps/api/src/modules/destination/infrastructure/repositories/typeorm-poi-distance.repository.ts#L17))
  và đã được inject sẵn trong `destination.module.ts` (dòng 219) — **method
  đọc đã có, chỉ thiếu nơi gọi nó cho mục đích hiển thị bản đồ**. Đúng pattern
  `clusterDistances` đang dùng (trả TOÀN BỘ bảng, lọc theo phạm vi ở frontend
  bằng `parentSlug`/`clusterDistanceKey`) — không cần query param theo cụm ở
  backend, giữ endpoint đơn giản như hiện tại.
- Chưa có bảng liệt kê cặp khoảng cách nào trên trang `ban-do` — chỉ có badge
  km lúc bấm popup từng điểm (thuộc trang chi tiết `/dichoithoi/[slug]`, khác
  trang bản đồ).
- `shared/ui/` đã có `DataTable` (copilot-instructions §4, mục Reusability) —
  dùng lại, không tự dựng bảng HTML tay.

## Tổng kết phụ thuộc

```
Giai đoạn A (chọn cụm/tỉnh cụ thể — filter + fit bounds)   [NỀN TẢNG, làm trước]
  ├─ Giai đoạn B (tắt clustering khi đã chọn cụm)            — phụ thuộc A
  ├─ Giai đoạn C (hiện tên marker thường trực khi đã chọn cụm) — phụ thuộc A
  ├─ Giai đoạn D (endpoint + vẽ đường con↔con)                — ĐỘC LẬP với A
  │                                                             (backend độc
  │                                                              lập hoàn toàn;
  │                                                              phần vẽ nên
  │                                                              làm sau A để
  │                                                              tránh rối mắt
  │                                                              khi xem cả
  │                                                              nước)
  └─ Giai đoạn E (bảng liệt kê cặp khoảng cách)                — phụ thuộc A
                                                                  (cần biết
                                                                  đang xem
                                                                  cụm nào để
                                                                  biết lọc gì)
```

Giai đoạn D (backend) có thể làm song song/trước Giai đoạn A vì không đụng
chung file. Nhưng **B, C, E đều cần A xong trước** vì chúng đọc state
"đang chọn cụm nào" mà A tạo ra.

## Đánh giá độ phức tạp/giá trị từng phần (phân tích trước khi build)

| Giai đoạn | Giá trị | Độ phức tạp | Ghi chú |
|---|---|---|---|
| A — chọn cụm | Cao (nền tảng, giải quyết luôn ý (1)+(3) gián tiếp) | Thấp (lọc dữ liệu đã có, không đổi API) | Bắt buộc làm trước |
| B — tắt clustering | Cao (đúng yêu cầu (1), UX rõ ràng) | Rất thấp (1 điều kiện if) | |
| C — hiện tên | Trung bình-cao (đúng yêu cầu (3), nhưng chỉ nên bật có điều kiện) | Thấp (Leaflet `bindTooltip({permanent:true})` có sẵn) | Không nên bật khi xem cả nước (272 điểm chồng chữ) |
| D — đường con↔con | Cao (khai thác đúng dữ liệu ORS vừa có, đúng yêu cầu (2)+(4) gốc) | Thấp-trung bình (backend trả thêm 1 mảng đã có sẵn `findAll()`; frontend thêm 1 loại polyline theo pattern đã có) | Nên GATE theo cụm đang chọn — vẽ hết cả nước sẽ ra hàng nghìn đường rối |
| E — bảng cặp | Cao (đúng yêu cầu (5), công cụ QA khoảng cách trực quan) | Thấp (tái dùng `DataTable`, dữ liệu đã tải sẵn ở D) | |

**Khuyến nghị thứ tự build**: A → B → C → D → E (D đặt sau C dù không phụ
thuộc kỹ thuật, vì D cần dữ liệu từ 1 thay đổi backend nhỏ và nên test trực
quan sau khi đã có khung nhìn theo cụm ở B/C — dễ nhìn thấy đường vẽ đúng/sai
hơn là test trên toàn bản đồ cả nước).

---

## Giai đoạn A — Chọn 1 cụm/tỉnh cụ thể (filter + tự động fit bounds) (ĐÃ XONG)

**Phụ thuộc**: không, làm trước tất cả.

- Thêm 1 `<Select>` "Xem cụm/tỉnh cụ thể" trong `ban-do/page.tsx`, danh sách =
  `items.filter(i => i.kind === 'cluster' || i.kind === 'province')`, group
  theo tỉnh cho dễ tìm (dùng `provinceName` đã có sẵn trên item).
- Khi chọn 1 giá trị `focusSlug`:
  - `filtered` (đang dùng cho `matchesStatus`/`provinceCode`/`tier`) thêm điều
    kiện: giữ lại item nếu `item.slug === focusSlug || item.parentSlug ===
    focusSlug` (chỉ node đó + con trực tiếp — đủ cho mọi cụm hiện có, không
    cần đệ quy nhiều cấp vì cấu trúc hiện tại chỉ 2 cấp cụm→con).
  - `DestinationMapView` cần fit bounds tự động tới các marker còn lại (thêm 1
    `useEffect` gọi `map.fitBounds()` khi `items` đổi do chọn cụm — tương tự
    cách `destination-map-relations-layer.tsx` đã dùng `useMap()`).
- Xoá lựa chọn (`focusSlug = null`) → quay lại toàn bản đồ cả nước như hiện
  tại (không đổi hành vi cũ).

**DoD**: chọn "Đà Lạt" trong Select mới → bản đồ chỉ còn Đà Lạt + con của nó
(so khớp số lượng với `RecomputeGroupDistancesUseCase` đã chạy trước đó —
Đà Lạt có 45 con theo DoD Giai đoạn 2 của poi-distance-plan), bản đồ tự
zoom/pan tới đúng vùng chứa hết các điểm đó (không cần zoom tay). Xoá lựa
chọn → quay lại 272 điểm cả nước, không lỗi console. Playwright screenshot
xác nhận bằng mắt trước/sau khi chọn.

## Giai đoạn B — Tắt marker clustering khi đã chọn cụm (ĐÃ XONG)

**Phụ thuộc**: Giai đoạn A (cần biết đang ở "chế độ cụm" hay "chế độ cả nước").

- `destination-map-cluster-layer.tsx`: nhận thêm prop `disableClustering:
  boolean` (truyền `focusSlug !== null` từ trang cha). Khi `true`, thay
  `L.markerClusterGroup()` bằng `L.layerGroup()` thường (vẽ marker trực tiếp,
  không gom cụm) — giữ nguyên toàn bộ logic `iconFor`/`buildPopupContent`.
- Không cần disable khi xem cả nước — 272 điểm vẫn cần clustering để không vỡ
  hiệu năng/rối mắt như thiết kế gốc.

**DoD**: chọn "Đà Lạt" → cả 45 marker con hiện riêng lẻ ngay ở zoom mặc định
sau khi fit bounds (không thấy chấm số gộp nhóm của markercluster). Bỏ chọn
cụm → quay lại thấy chấm số gộp nhóm như cũ khi zoom xa. Kiểm tra bằng mắt qua
Playwright.

## Giai đoạn C — Hiện tên điểm đến thường trực khi đã chọn cụm (ĐÃ XONG)

**Phụ thuộc**: Giai đoạn A (và nên làm sau B vì cùng sửa 1 file).

- Cùng `destination-map-cluster-layer.tsx`: khi `disableClustering` (tức đã
  chọn cụm), gọi thêm `marker.bindTooltip(item.name, { permanent: true,
  direction: "top", className: "..." })` cho mỗi marker — tooltip luôn hiện,
  không cần bấm.
- Khi xem cả nước (chưa chọn cụm): **không bật tooltip thường trực** — 272 tên
  chồng chéo sẽ không đọc được và giảm hiệu năng render. Popup lúc bấm giữ
  nguyên như hiện tại cho trường hợp này.

**DoD**: chọn "Đà Lạt" → thấy tên từng điểm hiện ngay cạnh chấm, không cần
bấm. Bỏ chọn cụm → hết tooltip, hành vi giống hệt trước khi có Giai đoạn C.
Playwright screenshot xác nhận đọc được tên ít nhất 3-5 điểm mẫu.

## Giai đoạn D — Endpoint + vẽ đường quan hệ con↔con (dữ liệu ORS thật) (ĐÃ XONG)

**Phụ thuộc kỹ thuật**: không phụ thuộc Giai đoạn A-C (backend độc lập hoàn
toàn). **Khuyến nghị thực hiện**: làm sau B/C để test trực quan dễ hơn (xem ở
trên).

### D1 — Backend: expose `poi_distances`

- `GetRelationsMapDataUseCase`: inject thêm `POI_DISTANCE_REPOSITORY`, gọi
  `poiDistanceRepo.findAll()` song song với 2 query hiện có (`Promise.all`),
  thêm field mới `poiDistances: { poiASlug, poiBSlug, distanceMeters }[]` vào
  response — **đúng pattern `clusterDistances` đang làm** (trả toàn bộ bảng,
  không lọc theo cụm ở backend).
- `packages/contracts`: thêm `poiDistances` vào
  `getRelationsMapDataResponseSchema` (kiểu giống `ClusterDistancePairDto`
  nhưng field `poiASlug`/`poiBSlug` thay vì `clusterASlug`/`clusterBSlug`).
- Không cần endpoint mới — dùng lại `GET /destinations/relations-map-data` đã
  có, chỉ mở rộng response.

### D2 — Frontend: vẽ đường

- `destination-map-relations-layer.tsx`: thêm prop `poiDistances:
  PoiDistancePairDto[]`, vẽ thêm 1 loại `L.polyline` màu mới (VD xanh lá nhạt
  `#22c55e`, phân biệt rõ với xám/tím/đỏ đã dùng) nối từng cặp `poiASlug`↔
  `poiBSlug` có toạ độ, `bindTooltip(formatKm(distanceMeters))` — copy đúng
  pattern khối "1) Nền tự động" đã có (dòng 60-69).
- **Gate hiển thị**: chỉ vẽ khi `focusSlug !== null` (đã chọn 1 cụm cụ thể) —
  vẽ toàn bộ cặp con↔con cả nước cùng lúc (hàng nghìn cặp, VD Đà Lạt riêng đã
  990 cặp) sẽ vỡ hiệu năng và không đọc được gì. Trong phạm vi 1 cụm đã chọn,
  lọc `poiDistances` theo `coordBySlug` sẵn có (item nào không thuộc cụm đang
  focus thì không có trong `allItems` đã lọc, tự động không vẽ được — không
  cần lọc tường minh theo `focusSlug` nếu `allItems` truyền vào layer đã đúng
  phạm vi).
- **✅ CHỐT 23/07/2026** (thay cho mục "cần hỏi lại" trước đó): vẽ HẾT mọi cặp
  của cụm đang chọn theo mặc định (đồ thị đầy đủ, không cắt bớt ngầm), kèm 1
  ô kéo (range slider) để người dùng tự lọc theo ngưỡng km khi thấy rối —
  khác lớp cụm/tỉnh (`distanceLevelKm`, `<Select>` bậc thang cố định 100/300km)
  vì khoảng cách con↔con trong 1 cụm dao động rất khác nhau giữa các cụm
  (vài trăm mét tới vài chục km) nên bậc thang cố định không hợp, cần range
  động theo đúng dữ liệu thật của cụm đang xem.

### D3 — Control lọc ngưỡng (range slider, kéo tay)

- Component `<input type="range">` (hoặc dùng lại `Slider` nếu `shared/ui/`
  đã có primitive tương ứng — nếu chưa có, tạo mới `shared/ui/slider.tsx`
  1 component per file, export qua `index.ts`, theo đúng quy tắc "primitive
  còn thiếu thì tạo trong shared/ui/, không inline" ở copilot-instructions).
- Bound động theo dữ liệu thật: `min = 0`, `max = Math.max(...poiDistancesTrongCum.map(p => p.distanceMeters))`
  (KHÔNG hard-code — mỗi cụm có tầm khoảng cách khác nhau, VD Đà Lạt có thể
  vài km trong khi 1 cụm khác trải dài vài chục km).
- State `poiDistanceThresholdMeters` ở `ban-do/page.tsx`, mặc định = `max`
  (hiện hết — đúng quyết định "vẽ hết" mặc định), truyền xuống
  `destination-map-relations-layer.tsx` để lọc `poiDistances` trước khi vẽ
  (giống cách `distanceLevelKm` đang lọc `clusterDistances`, dòng 62).
  Label hiện giá trị hiện tại dạng "≤ X km" cạnh thanh kéo, cập nhật realtime
  khi kéo (không cần debounce — số cặp tối đa vài nghìn, filter JS rẻ).
- Chỉ hiện control này khi `focusSlug !== null` VÀ `poiDistances` (đã lọc
  theo cụm) có ít nhất 1 cặp — ẩn hoàn toàn khi chưa chọn cụm (đồng bộ gate
  của D2).

**DoD D2+D3**: chọn "Đà Lạt" (Giai đoạn A) → mặc định thấy ĐỦ 990 đường (đồ thị
đầy đủ, khớp `C(45,2)` đã verify ở poi-distance-plan Giai đoạn 2), tooltip
hiện đúng số km. Kéo thanh range xuống 1 mức bất kỳ (VD giữa min/max) → số
đường hiển thị giảm đúng theo ngưỡng (đếm lại `poiDistances.filter(p =>
p.distanceMeters <= thresholdMeters).length` khớp số đường vẽ trên bản đồ).
Kéo về `max` → quay lại hiện đủ 990 đường. Không chọn cụm nào → không thấy
đường loại này lẫn control kéo (gate đúng). `tsc --noEmit` sạch
api+web+contracts.

## Giai đoạn E — Bảng liệt kê toàn bộ cặp + khoảng cách trong cụm đang xem (ĐÃ XONG)

**Phụ thuộc**: Giai đoạn A (biết đang xem cụm nào) + D1 (cần `poiDistances` đã
tải).

- Component mới (feature-specific, đặt `features/dichoithoi/`) render
  `DataTable` (shared/ui) bên dưới bản đồ, chỉ hiện khi `focusSlug !== null`.
- Dữ liệu: lọc `poiDistances` (đã tải từ D1) theo `allItems` đã lọc theo
  `focusSlug` (2 đầu `poiASlug`/`poiBSlug` đều phải nằm trong tập con của cụm
  đang chọn) — không cần query riêng, tái dùng data đã có trong tay.
- Cột: Tên điểm A, Tên điểm B, Khoảng cách (km, sort mặc định tăng dần).
  Join tên qua `bySlug` map có sẵn từ `allItems`.
- Nút xuất CSV — **không cần** trong scope này trừ khi người dùng yêu cầu
  thêm (giữ tối thiểu, tránh tính năng không ai dùng).

**DoD**: chọn "Đà Lạt" → bảng hiện đúng 990 dòng (`C(45,2)`, khớp số liệu đã
verify ở poi-distance-plan Giai đoạn 2), sort theo khoảng cách tăng dần đúng,
tên 2 cột A/B khớp đúng điểm trên bản đồ (spot-check 2-3 dòng bằng mắt so với
bản đồ). Bỏ chọn cụm → bảng ẩn, không lỗi console.

---

## Mức đầu tư — không có nhiều phương án A/B ở đây

Khác các plan trước có "Mức A/B" phải hỏi người dùng, plan này chỉ có 1
hướng thiết kế hợp lý rõ ràng cho từng giai đoạn (không có đánh đổi lớn về
kiến trúc). Điểm duy nhất từng để ngỏ (Giai đoạn D2 — lọc bớt cặp theo ngưỡng
km hay vẽ đồ thị đầy đủ) **đã CHỐT 23/07/2026**: vẽ hết mặc định + thêm
control range slider (Giai đoạn D3) để người dùng tự kéo lọc ngưỡng khi cần —
không còn điểm nào cần hỏi lại trước khi code.

---

## Tóm tắt verify (ĐÃ XONG + VERIFY 23/07/2026)

Build đúng theo thứ tự A → B/C → D1 → D2 → D3 → E đã khuyến nghị ở trên.

- **Contract mới**: `poiDistancePairSchema` + field `poiDistances` trong
  `getRelationsMapDataResponseSchema` (`packages/contracts/src/dichoithoi/
  destination-relations-map.ts`).
- **Backend (D1)**: `GetRelationsMapDataUseCase` inject thêm
  `POI_DISTANCE_REPOSITORY`, trả `poiDistances` (toàn bộ bảng
  `dichoithoi_poi_distances`, đúng pattern `clusterDistances`).
- **Frontend**:
  - `destination-map-cluster-layer.tsx`: prop `disableClustering` — khi bật
    (đã chọn cụm), dùng `L.layerGroup()` thay `L.markerClusterGroup()` (Giai
    đoạn B) + `marker.bindTooltip(name, {permanent:true})` (Giai đoạn C).
  - `destination-map-view.tsx`: component `MapFitBounds` mới (`useMap()` +
    `map.fitBounds()`) chạy khi `focusSlug` đổi (Giai đoạn A).
  - `destination-map-relations-layer.tsx`: thêm prop `poiDistances`, vẽ thêm
    loại `L.polyline` màu xanh lá `#22c55e` (Giai đoạn D2).
  - `destination-poi-distance-table.tsx` (mới, `features/dichoithoi/`): bảng
    `DataTable` liệt kê toàn bộ cặp trong cụm, sort tăng dần theo km (Giai
    đoạn E).
  - `ban-do/page.tsx`: `<Select>` "Xem cụm/tỉnh cụ thể" (Giai đoạn A),
    `<Slider>` (primitive `shared/ui/slider.tsx` có sẵn, không cần tạo mới)
    lọc ngưỡng km cho lớp đường con↔con (Giai đoạn D3), mặc định vẽ hết
    (`manualThresholdMeters=null` → theo max thật của cụm), reset khi đổi cụm.

**Phát hiện + sửa 1 bug thật lúc verify** (không nằm trong scope gốc của plan
này nhưng lộ ra khi build/verify Giai đoạn D — xem chi tiết đầy đủ ở
`dichoithoi-poi-distance-plan.md` Giai đoạn 5): `RecomputeClusterDistancesUseCase`
(vừa nâng cấp lên ORS cùng đợt) ghi `0m` sai cho 47/300 cặp cụm/tỉnh do ORS
trả `null` (không tìm được tuyến) mà code cũ không kiểm tra — đã sửa bỏ qua
cặp lỗi thay vì ghi sai, thêm field `failedPairs` cảnh báo trên UI.

**Verify qua Playwright thật trên `dichoithoi_dev`** (server dev đang chạy,
không phải mock):
- Chọn "Đà Lạt" ở Select mới → mô tả đầu trang đổi từ "300/300" → "72/300"
  điểm, bản đồ tự pan/zoom vừa khít khu vực Đà Lạt (không cần zoom tay).
- Marker hiện riêng lẻ kèm tên thường trực cạnh mỗi chấm (VD "Vườn Thú
  ZooDoo", "Biệt thự Hằng Nga", "Samten Hills Dalat") — xác nhận KHÔNG còn
  gộp cụm dạng số ("49", "96"...) như khi xem cả nước.
- Bật "Hiện lớp quan hệ" → xuất hiện control "Lọc cặp con↔con theo ngưỡng"
  mặc định `≤ 308,5 km (2485/2485 cặp)` (đúng quyết định "vẽ hết" mặc định) +
  nhiều đường xanh lá toả ra từ các điểm trong cụm. Kéo slider xuống 49,3km
  (qua `browser_evaluate` set value + dispatch event) → số cặp giảm đúng còn
  2331/2485, số đường vẽ trên bản đồ giảm tương ứng.
- Cuộn xuống thấy bảng liệt kê cặp khoảng cách, sort tăng dần đúng (dòng đầu
  ~288km, dòng cuối 308,5km khớp giá trị max hiện ở slider).
- Bỏ chọn cụm (`Select` về "tất cả") → quay lại 300/300 điểm, marker gộp cụm
  dạng số như cũ ("71", "11", "8"...), slider/bảng biến mất — xác nhận không
  phá hành vi cũ khi xem cả nước.
- 132 console error quan sát được đều là lỗi CŨ có sẵn từ trước (thiếu media
  server cổng 5176 để tải thumbnail popup), không liên quan tính năng mới.

**Verify kỹ thuật**: `tsc --noEmit` sạch api+web+contracts; 23 suites/130 test
jest sạch (thêm 3 test mới cho `RecomputeClusterDistancesUseCase` — dùng ORS
thay Haversine, báo lỗi rõ khi thiếu API key, bỏ qua cặp null không ghi 0m).
