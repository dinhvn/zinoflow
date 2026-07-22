# Dichoithoi — Khoảng cách đường bộ thật (OpenRouteService) cho gợi ý liên quan

**Cập nhật 21/07/2026: Giai đoạn 1-3 ĐÃ XONG** (build + verify với API key ORS
thật + dữ liệu Đà Lạt thật trên `dichoithoi_dev`). Giai đoạn 4 vẫn để ngỏ, chưa
chốt. Xem tóm tắt verify ở cuối mỗi giai đoạn bên dưới.

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

## Tổng kết phụ thuộc

```
Giai đoạn 1 (adapter ORS + bảng poi_distances + doc uu tien trong scoring) — ĐÃ XONG
  ├─ Giai đoạn 2 (nut theo cum/tinh — con→cha + con↔con, full recompute) — ĐÃ XONG
  ├─ Giai đoạn 3 (nut theo 1 diem — ban kinh vat ly, upsert + auto relink) — ĐÃ XONG
  └─ Giai đoạn 4 (TUY CHON, chua chot — noi vao AI content sourceContext)
```

**Giai đoạn 1-3 hoàn tất 21/07/2026** — build + verify với ORS API key thật +
dữ liệu Đà Lạt thật trên `dichoithoi_dev` (xem DoD từng giai đoạn ở trên). Chỉ
còn Giai đoạn 4 (tuỳ chọn, chưa chốt) — chờ bạn quyết định trước khi code.
