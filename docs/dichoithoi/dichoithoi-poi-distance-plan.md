# Dichoithoi — Khoảng cách đường bộ thật (OpenRouteService) cho gợi ý liên quan

**Cập nhật 21/07/2026: Giai đoạn 1-3 ĐÃ XONG** (build + verify với API key ORS
thật + dữ liệu Đà Lạt thật trên `dichoithoi_dev`). Giai đoạn 4 vẫn để ngỏ, chưa
chốt. **Cập nhật 23/07/2026: Giai đoạn 5 ĐÃ XONG** — mở rộng ORS lên cấp
cụm↔cụm/tỉnh↔tỉnh (bảng `dichoithoi_cluster_distances`), build + verify thật
trên `dichoithoi_dev` (25 node/253 cặp hợp lệ, 47 cặp bị ORS trả null bỏ qua
đúng thiết kế — xem DoD chi tiết). Xem tóm tắt verify ở cuối mỗi giai đoạn bên
dưới.

Ghi 21/07/2026. Bối cảnh: toàn bộ khoảng cách hiện dùng trong "điểm đến liên
quan" (badge hiển thị + thuật toán xếp hạng) đều là đường chim bay
(Haversine). Người dùng muốn thay/bổ sung bằng khoảng cách đường bộ thật qua
OpenRouteService (ORS, có free tier), theo 2 phạm vi: (1) con → tâm cụm/tỉnh
cha, (2) con → con trong cùng cụm — cả 2 gộp làm 1 tính năng vì kỹ thuật cho
phép tính chung trong 1 lần gọi ORS. Thêm 1 tính năng thứ 3 phát sinh trong
lúc bàn: nút tính riêng cho 1 điểm đơn lẻ (khoảng cách tới các điểm *gần đó*
theo bán kính, không giới hạn cùng cụm) — phục vụ đúng lúc soạn/duyệt bài
cho điểm đó.

## Hiện trạng đã audit (không suy đoán — đã đọc code thật)

- `haversineMeters()`, `computeNearby()`, `buildRelatedItems()`,
  `rankingDistanceMeters()`, `scoreCandidate()` — tất cả trong
  [related-builder.ts](../../apps/api/src/modules/destination/domain/related-builder.ts).
  Badge hiển thị (`badgeFor`) và nhánh `sameCluster`/`sameProvince` của
  `rankingDistanceMeters` hiện dùng Haversine trực tiếp từ `lat/lng` — đây là
  2 chỗ sẽ đổi.
- `RelatedCandidate.distanceFromCenter` (dòng 32-33) đã có field, nhưng
  **không có nơi nào trong `apps/web` ghi giá trị này** (grep xác nhận) — chỉ
  đọc từ mirror, nguồn duy nhất là migrate từ `dbo.Destination.DistanceFromCenter`
  ([02-migrate-data.sql:261](../../scripts/dichoithoi-sqlserver/02-migrate-data.sql#L261)),
  dữ liệu DB gốc 2019, không rõ phương pháp tính, nhiều điểm thiếu (code đã tự
  ghi chú "còn thiếu dữ liệu khoảng cách" ở `Detail.cshtml` dòng 46).
- `DistanceFromCenter` là **user-facing thật**, không chỉ nội bộ — hiển thị
  "Cách X km từ trung tâm" ở
  [Detail.cshtml:391](../../../dichoithoi/DiChoiThoi.Web/Views/Destination/Detail.cshtml#L391),
  dòng 681, dòng 723, và
  [_ChildDestination.cshtml:17](../../../dichoithoi/DiChoiThoi.Web/Views/Destination/_ChildDestination.cshtml#L17).
  Cũng là input của 2 thuật toán: nhóm 3 lớp Flagship (`nearChildren`/
  `midChildren`/`farChildren`, Detail.cshtml dòng 58-60) và
  `rankingDistanceMeters` nhánh khác-cụm (relations-plan §1.2).
- `RecomputeClusterDistancesUseCase`
  ([recompute-cluster-distances.usecase.ts](../../apps/api/src/modules/destination/application/use-cases/recompute-cluster-distances.usecase.ts)):
  pattern mẫu để tái dùng — tính Haversine mọi cặp node cấp cao, `replaceAll()`
  ghi đè toàn bộ bảng `dichoithoi_cluster_distances`
  ([migration 1782170000000](../../apps/api/src/migrations/1782170000000-DichoithoiClusterDistances.ts),
  khoá chuẩn hoá `cluster_a_slug < cluster_b_slug`). Bảng `poi_distances` mới
  sẽ theo đúng pattern này (PK 2 cột + CHECK thứ tự chuẩn hoá).
- `RecomputeRelatedService.recomputeFor(slugs)`
  ([recompute-related.service.ts:43](../../apps/api/src/modules/destination/application/services/recompute-related.service.ts#L43))
  **đã hỗ trợ sẵn** nhận 1 danh sách slug cụ thể (không phải toàn site) — chỉ
  thiếu route API cho 1 slug đơn lẻ (route hiện có
  [destinations.controller.ts:485](../../apps/api/src/modules/destination/presentation/destinations.controller.ts#L485)
  `POST /destinations/recompute-related` luôn chạy toàn bộ site).
- Tab "Quan hệ & đồng bộ" (`?tab=relations`) đã tồn tại thật ở
  [apps/dichoithoi/[slug]/page.tsx:1463-1474](../../apps/web/src/app/dichoithoi/%5Bslug%5D/page.tsx#L1463),
  đã có sẵn khối `RefList title="Gần đây" refs={d.nearby} showDistance` (dòng
  1470) — đúng chỗ để thêm nút mới, không cần tạo tab/khối mới.
- Toolbar "Công cụ" (nút `recomputeMutation`/`recomputeClusterDistancesMutation`)
  đã có sẵn ở [app/dichoithoi/page.tsx:460-490](../../apps/web/src/app/dichoithoi/page.tsx#L460)
  — nút "Tính khoảng cách theo cụm/tỉnh" (Giai đoạn 2) sẽ thêm cạnh 2 nút này,
  nhưng cần thêm 1 `<Select>` chọn cụm/tỉnh (2 nút cũ không có tham số).
- **Bổ sung audit 23/07/2026 cho Giai đoạn 5**:
  [recompute-cluster-distances.usecase.ts](../../apps/api/src/modules/destination/application/use-cases/recompute-cluster-distances.usecase.ts)
  (toàn bộ 57 dòng): lấy TẤT CẢ node `kind IN (province, cluster)` có toạ độ,
  tính `haversineMeters()` cho MỌI cặp (vòng lặp `i<j`), ghi đè toàn bộ
  `dichoithoi_cluster_distances` qua `clusterDistanceRepo.replaceAll(pairs)` —
  **KHÔNG inject `DISTANCE_MATRIX_PROVIDER`**, vẫn 100% Haversine dù Giai đoạn
  1 đã có adapter ORS sẵn dùng.
  - Gọi thật `GET /api/destinations/map` (server dev đang chạy) đếm được:
    **17 tỉnh + 8 cụm có toạ độ = 25 node → 300 cặp** (`N*(N-1)/2`) — rất nhỏ
    so với `MAX_ROUTES_PER_REQUEST=3400` của adapter, 1 lần gọi Matrix API là
    đủ, không cần logic chia block (đã có sẵn trong adapter nhưng không cần
    dùng ở quy mô này).
  - UI hiện tại: nút "Tính lại khoảng cách cụm/tỉnh"
    ([app/dichoithoi/page.tsx:521-529](../../apps/web/src/app/dichoithoi/page.tsx#L521)),
    gọi `POST /destinations/recompute-cluster-distances`, không tham số.
  - Dữ liệu bảng này dùng ở 2 chỗ: (1) vẽ đường xám "nền tự động" + tooltip số
    km trên bản đồ CMS
    ([destination-map-relations-layer.tsx:61-69](../../apps/web/src/features/dichoithoi/destination-map-relations-layer.tsx#L61))
    — hiển thị TRỰC TIẾP cho người xem, hiện đang sai bản chất (ghi số nhưng
    là chim bay); (2) `rankingDistanceMeters` nhánh khác-cụm/tỉnh
    ([related-builder.ts:170-181](../../apps/api/src/modules/destination/domain/related-builder.ts#L170))
    — cộng `distanceFromCenter + khoảng_cách_cụm + distanceFromCenter` theo
    bất đẳng thức tam giác, CHỈ dùng xếp hạng (không hiển thị) — giá trị tăng
    thêm ở đây thấp hơn (1) vì bản chất đã là ước lượng có chủ đích, nhưng vẫn
    có ích vì 2/3 số hạng công thức giờ là số thật thay vì 1/3.
- `CreateDestinationJobUseCase.buildSourceContext()`
  ([dòng 144-157](../../apps/api/src/modules/destination/application/use-cases/create-destination-job.usecase.ts#L144)):
  hiện **chỉ gửi TÊN** các điểm cùng tỉnh cho AI (để nhắc đúng tên chuẩn phục
  vụ auto-link) — **không có số khoảng cách nào**. Việc "gửi khoảng cách cho
  AI" là việc CHƯA có, không phải mở rộng cái đã có.

## Giai đoạn 1 — Nền tảng: adapter ORS + bảng `poi_distances` + đọc ưu tiên trong scoring (ĐÃ XONG 21/07/2026)

**Phụ thuộc**: không phụ thuộc gì, làm trước tất cả các giai đoạn sau.

- Port `IDistanceMatrixProvider` (module `destination`, application layer) +
  adapter `OpenRouteServiceMatrixAdapter` (infrastructure) — nhận
  `{ lat, lng }[]` trả về ma trận mét, cùng nguyên tắc "mọi external service
  qua adapter" (copilot-instructions §3). `.env` mới `OPENROUTESERVICE_API_KEY`
  (trống = tắt tính năng, không chặn build/khác — cùng kiểu
  `CLOUDFLARE_API_TOKEN` ở Phase 17).
- Migration Postgres `dichoithoi_poi_distances` — copy đúng khuôn migration
  `1782170000000-DichoithoiClusterDistances.ts`:
  `poi_a_slug`/`poi_b_slug varchar(64) REFERENCES dichoithoi_destinations(slug)`,
  `distance_meters integer NOT NULL`, PK 2 cột, `CHECK (poi_a_slug < poi_b_slug)`.
  Port `PoiDistanceRepository` (`findAll()`, `replaceAllForSlugs(slugs, pairs)`
  — xoá mọi cặp có 1 trong 2 đầu thuộc `slugs` rồi insert lại, để Giai đoạn 3
  ghi upsert theo phạm vi bán kính mà không xoá nhầm dữ liệu của điểm khác).
- `related-builder.ts`: `badgeFor()` và nhánh `sameCluster`/`sameProvince`
  của `rankingDistanceMeters()` nhận thêm tham số `poiDistances: ReadonlyMap<string, number>`
  (khoá `clusterDistanceKey()` tái dùng) — **ưu tiên tra bảng này trước**,
  fallback Haversine nếu thiếu cặp (graceful, đúng kiểu `clusterDistances` đã
  làm cho khác-cụm — không bao giờ chặn/lỗi vì thiếu dữ liệu).
  `RecomputeRelatedService.run()` load thêm `poiDistanceRepo.findAll()` y hệt
  cách đang load `clusterDistancePairs`.

**DoD Giai đoạn 1 (đã xác nhận)**: `related-builder.spec.ts` thêm 2 test (badge +
scoreCandidate ưu tiên `poiDistances`) — 64 suites/402 test jest sạch toàn bộ
api. Migration `1782500000000-DichoithoiPoiDistances` chạy thật trên Postgres
dev. `tsc --noEmit` sạch api+web+contracts. Adapter test bằng lệnh gọi ORS thật
(toạ độ Đà Lạt/Hồ Xuân Hương/Thung Lũng Tình Yêu, key thật) → HTTP 200, parse
đúng ma trận mét (2972m/6749m/4124m — hợp lý với đường đèo thật, khác Haversine
thẳng). `Test.createTestingModule` không cần dựng riêng — xác nhận qua
`nest start` thật: DI graph resolve đủ, 2 route mới map đúng.

## Giai đoạn 2 — Nút "Tính khoảng cách" theo cụm/tỉnh (gộp con→cha + con↔con) (ĐÃ XONG 21/07/2026)

**Phụ thuộc**: Giai đoạn 1.

- Use-case `RecomputeGroupDistancesUseCase(parentSlug)`: lấy toạ độ node cha
  + toàn bộ con published có toạ độ (mirror) → gọi ORS Matrix **1 lần** với
  `locations = [cha, con_1, ..., con_N]`, lấy ma trận đầy đủ (N+1)×(N+1):
  - Hàng 0 (cha → từng con) → ghi `DistanceFromCenter` — cascade Postgres
    mirror + `v2.Destination` SQL Server (transaction, cùng pattern
    `RenameDestinationSlugUseCase` đã cascade 2 DB).
  - Các hàng còn lại (con ↔ con) → `poiDistanceRepo.replaceAllForSlugs(childSlugs, pairs)`
    — **ghi đè TOÀN BỘ cặp của cụm này mỗi lần chạy** (đã chốt: không làm
    incremental — cụm đông nhất hiện tại ~50 điểm, chi phí 1 lần gọi ORS vẫn
    rẻ dù thêm bớt vài điểm; incremental phải xử lý bất đối xứng chiều đi/về
    — phức tạp hơn nhiều so với lợi ích tiết kiệm quota không đáng kể).
- ⚠️ Cần xác nhận lúc code: giới hạn số toạ độ tối đa/1 lần gọi ORS Matrix
  (profile driving-car) — tra tài liệu ORS thật, không đoán số. Nếu cụm vượt
  ngưỡng, chia matrix thành nhiều lần gọi con (không đổi thiết kế tổng thể).
- Endpoint `POST /destinations/groups/:parentSlug/recompute-distances`.
- UI: thêm vào khối "Công cụ" ở `app/dichoithoi/page.tsx` — 1 `<Select>`
  chọn cụm/tỉnh (danh sách `kind IN (province,cluster)`, tái dùng dữ liệu đã
  có ở `getMap()`/taxonomy) + nút "Tính khoảng cách" riêng (khác 2 nút hiện
  có vì cần tham số).

**DoD Giai đoạn 2 (đã xác nhận qua dữ liệu thật)**: gọi
`POST /destinations/groups/da-lat/recompute-distances` trên `dichoithoi_dev`
thật (server đang chạy dev, không phải test giả lập) →
`{"parentSlug":"da-lat","children":45,"pairs":990,"durationMs":3453}` — đúng
`C(45,2)=990`. Query Postgres xác nhận `dichoithoi_poi_distances` có 990 dòng;
`dichoithoi_destinations.distance_from_center` của con đổi đúng số ORS (vd
`nha-ga-da-lat`=1155m). Query SQL Server `v2.Destination.DistanceFromCenter`
cho 3 con có `site_id` (43/53/103) khớp CHÍNH XÁC với mirror (3393/30078/10589)
— xác nhận cascade 2 DB đúng. `tsc --noEmit` + 402 test jest sạch.

## Giai đoạn 3 — Nút tính riêng 1 điểm (tab "Quan hệ & đồng bộ") (ĐÃ XONG 21/07/2026)

**Phụ thuộc**: Giai đoạn 1. Độc lập với Giai đoạn 2 (phạm vi khác: bán kính
vật lý, không giới hạn cùng cụm cha).

- Use-case `RecomputeNearbyDistancesUseCase(slug)`: dùng `computeNearby()`
  có sẵn (Haversine, bán kính 30km, top 10 — cân nhắc tăng ngưỡng vì ORS giờ
  rẻ hơn so với lúc hàm này chỉ phục vụ gợi ý UI) để lọc ứng viên → gọi ORS
  Matrix 1 origin (chính điểm) × N destination → `poiDistanceRepo` upsert
  từng cặp mới (KHÔNG xoá cặp khác của điểm này nằm ngoài top N lần này —
  khác Giai đoạn 2 vì phạm vi bán kính có thể đổi ứng viên qua từng lần chạy).
  Sau khi ghi xong, **gọi luôn `RecomputeRelatedService.recomputeFor([slug])`**
  trong cùng use-case — 1 nút bấm xong cả 2 việc (tính khoảng cách MỚI + build
  lại `RelatedJson` của điểm đó ngay), không cần bấm 2 lần.
- Endpoint mới: `POST /destinations/:slug/recompute-nearby-distances`.
- UI: 1 nút trong `Group title="Quan hệ"` (page.tsx dòng 1467-1474), cạnh
  `RefList title="Gần đây"` — bấm xong reload lại đúng khối này (React Query
  invalidate) để thấy badge mới ngay.

**DoD Giai đoạn 3 (đã xác nhận qua dữ liệu thật)**: gọi
`POST /destinations/cho-dem-da-lat/recompute-nearby-distances` trên
`dichoithoi_dev` thật →
`{"slug":"cho-dem-da-lat","candidates":10,"relatedUpdated":false,"durationMs":1008}`.
Query Postgres xác nhận `dichoithoi_poi_distances` có thêm 10 cặp mới đúng số
ORS cho `cho-dem-da-lat` (vd `doi-cu-dalat`=1698m), KHÔNG xoá 990 cặp cụm Đà
Lạt đã có từ Giai đoạn 2 (upsert đúng, không phải replace). `relatedUpdated:
false` — kiểm tra `RelatedJson` thật xác nhận ĐÚNG THIẾT KẾ, không phải bug:
`cho-dem-da-lat` có nhiều điểm CÙNG LOẠI HÌNH ("phố đi bộ/chợ đêm") ở tỉnh
khác (Phố Tây Bùi Viện, Phố cổ Hội An) áp đảo điểm số so với ứng viên "gần"
cùng cụm — đúng thiết kế thuật toán (type-overlap > khoảng cách, relations-plan
§1.3), nên 10 ứng viên gần vừa tính không lọt vào top 8 hiển thị, badge không
đổi. `tsc --noEmit` sạch, `nest start` xác nhận DI graph + 2 route mới hoạt
động thật (không chỉ compile).

## Giai đoạn 4 (TUỲ CHỌN — cần bạn xác nhận trước khi code, chưa chốt)

Nối khoảng cách vào ngữ cảnh AI khi viết bài (`buildSourceContext`) — thêm
dòng "cách X km" cho từng điểm trong danh sách "Điểm đến liên quan cùng khu
vực" (dòng 154-157), đọc từ `poi_distances`/`DistanceFromCenter` đã tính ở
Giai đoạn 1-3. **Đánh đổi cần cân nhắc**: chỉ có giá trị nếu điểm đó đã được
bấm 1 trong 2 nút tính khoảng cách trước — nếu chưa, danh sách vẫn hiện
TÊN suông như hiện tại (không thêm được số) → cần quyết định có cảnh báo gì
cho người soạn bài biết "chưa có dữ liệu khoảng cách, nên bấm nút Giai đoạn
2/3 trước khi tạo bài" hay không. Việc nhỏ (thêm vài dòng trong
`buildSourceContext`), nhưng phụ thuộc hoàn toàn vào Giai đoạn 1-3 đã chạy có
dữ liệu thật cho điểm đó — nên tách riêng, làm sau khi đã dùng thử Giai đoạn
2-3 một thời gian và thấy dữ liệu đủ dày.

## Giai đoạn 5 — Đổi khoảng cách cụm↔cụm/tỉnh↔tỉnh sang ORS thật (ĐÃ XONG 23/07/2026)

**Phụ thuộc**: chỉ Giai đoạn 1 (adapter `OpenRouteServiceMatrixAdapter` +
port `IDistanceMatrixProvider` đã có sẵn, tái dùng y hệt, không cần thêm gì
mới ở tầng adapter). **Độc lập hoàn toàn với Giai đoạn 2/3/4** — khác bảng
(`dichoithoi_cluster_distances` chứ không phải `dichoithoi_poi_distances`),
khác usecase, không đụng chung code.

**Đánh giá (phân tích trước khi build)**: giá trị CAO (sửa đúng 1 điểm hiện
đang "nói dối" trên bản đồ CMS — đường vẽ ra trông giống đường thật như con↔
con nhưng thực chất vẫn là chim bay), độ phức tạp THẤP (không phải xây mới,
chỉ đổi 1 hàm bên trong 1 usecase đã có, tái dùng port/adapter/UI nguyên
vẹn). Quy mô dữ liệu nhỏ (25 node/300 cặp, xem audit ở trên) nên không phát
sinh vấn đề quota/hiệu năng như lo ngại ban đầu ở cấp con↔con (Đà Lạt riêng
đã 990 cặp).

Việc cụ thể:

- `RecomputeClusterDistancesUseCase`: inject thêm `DISTANCE_MATRIX_PROVIDER`
  (copy pattern `RecomputeGroupDistancesUseCase`). Thay vòng lặp
  `haversineMeters(a.lat, a.lng, b.lat, b.lng)` bằng 1 lần gọi
  `distanceMatrix.computeMatrix(nodes.map(n => ({ lat: n.lat, lng: n.lng })))`
  rồi đọc ma trận N×N ra từng cặp `(i, j)` — cùng cách
  `RecomputeGroupDistancesUseCase` đang đọc `matrix[i+1]![j+1]!` cho con↔con,
  chỉ khác không có "hàng 0" (không có node cha ở đây, mọi node đều ngang
  cấp).
- Giữ nguyên `throw DomainRuleError` rõ ràng nếu `!distanceMatrix.isConfigured()`
  — **không** âm thầm fallback Haversine khi thiếu `OPENROUTESERVICE_API_KEY`
  (đúng nguyên tắc dự án "không che giấu việc chưa cấu hình", giống Giai đoạn
  2 đã làm).
- **Không đổi UI** — nút "Tính lại khoảng cách cụm/tỉnh" hiện có giữ nguyên
  tên/vị trí/không tham số, chỉ đổi thuật toán bên trong. Endpoint
  `POST /destinations/recompute-cluster-distances` giữ nguyên.
- Cân nhắc kỹ thuật (không phải quyết định thiết kế, chỉ là điểm cần lưu ý
  lúc code): tuyến đường bộ rất xa (VD 1 cụm ở miền Bắc ↔ 1 cụm ở miền Nam)
  có thể khiến ORS trả `null`/lỗi nếu không có route đường bộ nối liền (hiếm ở
  Việt Nam, đất liền liên tục) — nếu adapter trả `Infinity`/lỗi cho 1 cặp cụ
  thể, usecase nên log rõ cặp nào lỗi thay vì để cả lần chạy thất bại toàn
  bộ (không có trong `RecomputeGroupDistancesUseCase` vì phạm vi con↔con luôn
  đủ gần để không gặp ca này).

**DoD Giai đoạn 5 (đã xác nhận qua dữ liệu thật, 23/07/2026)**: gọi
`POST /destinations/recompute-cluster-distances` trên `dichoithoi_dev` thật
(server dev đang chạy) → response ban đầu
`{"nodes":25,"pairs":300,"durationMs":2121}` nhưng **phát hiện bug thật khi
audit dữ liệu**: 47/300 cặp ghi `distance_meters=0` dù 2 đầu cách nhau hàng
trăm km (VD `ca-mau<->quang-binh`) — điều tra ra ORS trả `null` cho MỌI cặp
liên quan tới 2 node `lam-dong`/`quang-binh` (có thể do toạ độ centroid tỉnh
rơi vào vùng không có đường số hoá gần đó để snap), code cũ `Math.round(null)`
im lặng ra `0` — SAI nghiêm trọng hơn cả không có dữ liệu (0m bị hiểu nhầm là
2 điểm trùng nhau). **Đã sửa**: usecase kiểm tra `typeof raw !== "number" ||
!Number.isFinite(raw)` → bỏ qua cặp đó (không ghi), log rõ danh sách cặp lỗi,
thêm field `failedPairs` vào response/contract + hiện cảnh báo vàng trên UI
khi có cặp lỗi. Gọi lại API thật sau khi sửa →
`{"nodes":25,"pairs":253,"failedPairs":47,"durationMs":1582}` — query Postgres
xác nhận **0 dòng còn giá trị 0m**, đúng 253 dòng hợp lệ, cặp
`da-lat<->nha-trang`=129469m (129,5km, hợp lý cho quãng đường đèo thật).
5 test mới trong `recompute-cluster-distances.usecase.spec.ts` (dùng ORS
thay vì Haversine, báo lỗi rõ khi thiếu API key, bỏ qua cặp null không ghi
0) — 23 suites/130 test jest sạch. Playwright thật trên
`/dichoithoi/ban-do`: chọn "Đà Lạt" ở Select mới (xem Giai đoạn A bên dưới,
`dichoithoi-map-cluster-view-plan.md`) → bật "Hiện lớp quan hệ" → đường xám
nối cụm/tỉnh hiện đúng số km mới (khác Haversine cũ).

## Tổng kết phụ thuộc

```
Giai đoạn 1 (adapter ORS + bảng poi_distances + doc uu tien trong scoring) — ĐÃ XONG
  ├─ Giai đoạn 2 (nut theo cum/tinh — con→cha + con↔con, full recompute) — ĐÃ XONG
  ├─ Giai đoạn 3 (nut theo 1 diem — ban kinh vat ly, upsert + auto relink) — ĐÃ XONG
  ├─ Giai đoạn 4 (TUY CHON, chua chot — noi vao AI content sourceContext)
  └─ Giai đoạn 5 (doi khoang cach cum/tinh sang ORS — doc lap 2/3/4) — ĐÃ XONG 23/07/2026
```

**Giai đoạn 1-3 hoàn tất 21/07/2026, Giai đoạn 5 hoàn tất 23/07/2026** — build
+ verify với ORS API key thật trên `dichoithoi_dev` (xem DoD từng giai đoạn ở
trên). Chỉ còn Giai đoạn 4 (tuỳ chọn, chưa chốt) — chờ bạn xác nhận trước khi
code.
