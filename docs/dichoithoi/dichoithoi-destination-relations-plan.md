# Dichoithoi — Kế hoạch nâng cấp liên kết giữa các điểm đến (chưa build)

Ghi lại 15/07/2026, xuất phát từ yêu cầu người dùng: "muốn khi khách vào trang
thấy được mối liên kết dữ liệu giữa các điểm đến, gợi ý đúng ý người dùng" +
"phân loại điểm đến hợp lý để có liên kết phù hợp theo nhiều tiêu chí".
**Chưa code — đây là plan để làm sau.** Khi bắt tay làm, cập nhật
`dichoithoi-destination-spec.md` §12.3 (không chỉ thêm doc mới, spec đó mới
là nguồn sự thật cho thuật toán RelatedJson).

## 0) Hiện trạng đã audit (15/07/2026)

Đọc kỹ trước khi làm — tránh làm lại cái đã có:

- **3 loại quan hệ đã lưu** trong `dichoithoi_destination_relations`
  (Postgres) / `DestinationRelation` (SQL Server): `nearby` (haversine
  ≤30km), `related` (curated tay), `mentioned` (tự động khi auto-link tên
  điểm đến trong bài viết — chỉ log, không vào RelatedJson).
- **Thuật toán build RelatedJson** — `apps/api/src/modules/destination/domain/related-builder.ts`,
  hàm `buildRelatedItems()`: ưu tiên con trực tiếp (≤4) → related curated →
  nearby → anh em cùng cha → **cùng tỉnh**.
- **Lỗ hổng cốt lõi đã xác nhận trong chính code**: `related-builder.ts`
  dòng 108-109 ghi rõ bước 5 lẽ ra phải là **"cùng loại chính"** (đúng spec
  gốc `dichoithoi-destination-spec.md` §12.3) nhưng bị thay bằng "cùng tỉnh"
  vì lúc viết code, `RelatedCandidate`/mirror Postgres CHƯA có field loại
  hình. Xác nhận: `destination-mirror.entity.ts` không có cột `type`/`types`
  nào — đây không phải oversight, là nợ kỹ thuật đã ghi chú sẵn, giờ trả.
- **`extras.Types`** (loại hình: biển núi/di tích/tâm linh...) đã tồn tại và
  hiển thị dạng badge trên trang detail (dichoithoi, đọc trực tiếp từ SQL
  Server live) nhưng KHÔNG được đưa vào mirror Postgres, nên
  `related-builder.ts` không dùng được.
- **QUAN TRỌNG — sửa lại giả định sai (audit 15/07/2026)**: taxonomy là quan
  hệ **NHIỀU-NHIỀU** (`v2.DestinationTypeMap`), KHÔNG phải "1 loại/điểm" như
  giả định lúc đầu ở §1. Cấu trúc thật: 3 nhóm (Thiên nhiên / Văn hoá-Lịch sử
  / Vui chơi-Trải nghiệm) × 18 loại. Dữ liệu thật (`dichoithoi_dev`, 272
  điểm, 399 lượt gán): 112 điểm có 1 loại, 118 điểm có 2 loại, 17 điểm có 3
  loại, **25 điểm (9,2%) CHƯA có loại nào**. Phân bố lệch nặng ("Check-in
  sống ảo" chiếm ~37,5% lượt gán — dùng như tag chung chung). Đã ghi nhận
  sai lệch cụ thể trong `dichoithoi-destination-spec.md`: Vịnh Hạ Long bị
  gán "Di tích lịch sử" — sai rõ ràng (là vịnh/thắng cảnh thiên nhiên).
  **Hệ quả**: không thể dùng field đơn `primary_type` như thiết kế ban đầu ở
  §1.1/§1.4 mục 1 — phải mirror hoá TOÀN BỘ tập loại (many-to-many), và công
  thức chấm điểm §1.3 phải so khớp theo TẬP hợp (bao nhiêu loại trùng), xem
  bản sửa ở §1.2b. Ngoài ra, dữ liệu có sai lệch đã biết — KHÔNG nên bật
  tiêu chí "cùng loại hình" làm yếu tố chi phối (1000 điểm) trước khi rà lại
  taxonomy toàn bộ — xem công cụ rà soát ở mục 6.
- **`ArticleDestinationMap`** (nối bài cẩm nang ↔ điểm đến theo topic:
  itinerary/food/nightlife/souvenir) đã có bảng + usecase đọc/ghi, hiện chỉ
  hiển thị riêng lẻ trên trang detail ("Xem thêm lịch trình"), KHÔNG liên
  thông với khối "Điểm đến liên quan".
- **JSON-LD** (`SchemaUtil.CreateDestinationJsonLD`, dichoithoi) chỉ thể
  hiện quan hệ cha-con (`ContainsPlace`/`ContainedInPlace`, text tỉnh không
  link entity). Hoàn toàn không có structured data cho nearby/related/cùng
  loại hình — Google không nhìn thấy các liên kết ngang cấp này.

## 1) Thuật toán chấm điểm quan hệ (thay waterfall cứng) + mô hình khoảng cách 2 tầng

Đào sâu 15/07/2026 (hội thoại dài với người dùng) — thay cho ý tưởng ban đầu
"chỉ thêm 1 bước cùng-loại-hình vào waterfall", chốt phương án **chấm điểm
(scoring)** vì diễn đạt đúng yêu cầu: "ưu tiên cùng type trong cùng cụm →
khoảng cách → cùng type ngoài cụm cũng được" — thứ tự này không thể hiện được
bằng waterfall cứng theo NGUỒN (con/curated/nearby/anh em/tỉnh) như cũ, cần
xếp theo MỨC ĐỘ LIÊN QUAN thật.

### 1.1 Dữ liệu ưu tiên/nổi bật — gộp `IsFeatured` thành field `Priority` mới (1-5)

Xác nhận (grep 2 repo 15/07/2026): `IsFeatured` (bool), `Order` (int),
`ContentTier` (`flagship`/`standard`) đã tồn tại trên `v2.Destination` VÀ đã
được mirror sang Postgres (`destination-mirror.entity.ts:113-122`).
`RelatedCandidate` (`related-builder.ts`) đã nhận `isFeatured`/`order` nhưng
hiện KHÔNG dùng để xếp hạng gợi ý (chỉ dùng cho lưới "Điểm tham quan nổi
bật", Phase 28.2).

Đào sâu 15/07/2026 — người dùng muốn gộp `IsFeatured` + ý tưởng "độ ưu tiên"
mới thành **1 field duy nhất `Priority` (tinyint, 1-5, 1 = cao nhất, 5 =
thấp nhất)**, đánh giá tay bởi admin. **`Order` KHÔNG gộp vào** — xác nhận
bằng code thật (`Destination/Detail.cshtml:57`:
`.Where(c => c.IsFeatured).OrderBy(c => c.Order)`) rằng `Order` đang phục vụ
đúng 1 việc khác: sắp xếp CHÍNH XÁC thứ tự hiển thị trong nhóm đã nổi bật
(vd. theo lộ trình tham quan) — khác câu hỏi "mức độ quan trọng", nếu gộp
chung sẽ mất khả năng chỉ định thứ tự chính xác giữa các điểm cùng mức ưu
tiên. `ContentTier` cũng KHÔNG gộp — vẫn là phân loại độ sâu nội dung, mục
đích khác `Priority`.

Việc cần làm khi build (chưa làm):
1. Migration `v2.Destination`: thêm cột `Priority tinyint NOT NULL DEFAULT 3`
   (3 = mức bình thường, chưa được admin đánh giá tay). Backfill 1 lần từ dữ
   liệu cũ: `IsFeatured=1` → `Priority=1`; `IsFeatured=0` → giữ `Priority=3`.
   Sau khi verify ổn, xoá cột `IsFeatured` (không giữ 2 field song song lâu
   dài — dễ lệch dữ liệu nếu chỉ update 1 trong 2).
2. Cập nhật mirror Postgres (`destination-mirror.entity.ts`): đổi cột
   `is_featured boolean` → `priority smallint default 3`.
3. Ngưỡng thay thế `IsFeatured` cũ ở lưới "Điểm tham quan nổi bật"
   (`Destination/Detail.cshtml:57`): đổi `c.IsFeatured` → `c.Priority <= 2`
   (ngưỡng cụ thể cần bạn duyệt lại khi build — có thể chỉnh), `OrderBy(c
   => c.Order)` giữ nguyên không đổi.
4. `RelatedCandidate`/`ChildRef` (`related-builder.ts`,
   `ancestors-children-builder.ts`): đổi field `isFeatured: boolean` →
   `priority: number`.

### 1.2 Mô hình khoảng cách 2 tầng (tính sẵn trong CMS/Postgres, dichoithoi chỉ đọc)

Quyết định (thay vì tính haversine cặp-cặp cho mọi cặp điểm trên toàn bộ
dataset — tốn kém khi dữ liệu lớn dần):

1. **Bảng mới `dichoithoi_cluster_distances`** (Postgres): `cluster_a_slug,
   cluster_b_slug, distance_meters` — khoảng cách giữa toạ độ TRUNG TÂM của
   các node cấp cao (kind=province hoặc cluster, hiện ~17 tỉnh + 8 cụm →
   tối đa ~300 cặp). Tính 1 lần, chỉ tính lại khi toạ độ trung tâm 1 node
   đổi (hiếm) — không nằm trong job recompute-related chạy thường xuyên.
2. **`DistanceFromCenter` giữ nguyên như hiện tại** — khoảng cách 1 điểm tới
   trung tâm cụm/cha trực tiếp của nó (đã có sẵn, xác nhận dữ liệu thật
   `dichoithoi_dev`: 246/247 điểm kind=poi đã có `Lat`/`Lng` riêng, 99,6%).
3. **2 pha tính khoảng cách khi so 2 điểm khác cụm** (đã chốt phương án
   chính xác, không dùng phương án đơn giản-nhưng-sai-số):
   - **Pha xếp hạng** (quét toàn bộ ứng viên, cần rẻ): khoảng cách xấp xỉ =
     `DistanceFromCenter(A) + khoảng_cách_cụm(cụm A, cụm B) +
     DistanceFromCenter(B)` — đường gấp khúc qua 2 tâm cụm, tra bảng nhỏ
     `dichoithoi_cluster_distances` thay vì haversine cặp-cặp toàn dataset.
     Lưu ý: theo bất đẳng thức tam giác, số này LUÔN ≥ khoảng cách thật — chỉ
     dùng để XẾP HẠNG tương đối (gần hơn/xa hơn), không hiển thị cho người dùng.
   - **Pha hiển thị** (chỉ chạy cho ≤8 mục đã được chọn ở pha xếp hạng): tính
     lại khoảng cách CẶP-CẶP thật bằng `haversineMeters()` (đã có sẵn trong
     `related-builder.ts`) từ `Lat`/`Lng` riêng của 2 điểm, dùng số này cho
     badge "cách X km" hiển thị công khai — chính xác, vì chỉ tính cho nhóm
     nhỏ đã lọc, không tốn kém dù toàn dataset lớn.
   - Trong cùng 1 cụm (A, B cùng `parentSlug`) hoặc khi cần khoảng cách với
     `nearby` hiện tại (cùng tỉnh, có toạ độ) — giữ nguyên haversine cặp-cặp
     trực tiếp như code hiện tại, không cần đi qua mô hình 2 tầng (chỉ mô
     hình 2 tầng mới cần cho so sánh XUYÊN CỤM ở diện rộng).

### 1.3 Công thức chấm điểm

```
typeOverlapScore(self, candidate) =
    1000 * |self.types ∩ candidate.types| / max(|self.types|, 1)
    // self co 2 loai, candidate trung 1 => 500; trung ca 2 => 1000;
    // self chua co loai nao (25/272 diem) => luon 0, roi xuong cac
    // thanh phan sau (khoang cach/tinh) — khong loi, chi mat uu the
    // "cung loai" cho toi khi duoc gan loai (xem muc 6).

score(candidate) =
    typeOverlapScore(self, candidate)
  + (cùng cụm/cha ? 200 : cùng tỉnh ? 100 : 0)
  + (điểm gần — chuẩn hoá nghịch đảo khoảng cách, tối đa 100;
     dùng khoảng cách xấp xỉ 2 tầng §1.2 khi khác cụm, haversine
     trực tiếp khi cùng cụm/cùng tỉnh)
  + (6 - Priority) * 4        // Priority 1 (cao nhất) => +20, Priority 5 (thấp nhất) => +4
  + (ContentTier = flagship ? 10 : 0)
```

Sửa so với bản trước (đã sai vì giả định 1 loại/điểm — xem §0): loại hình là
tập hợp nhiều-nhiều, nên so khớp theo **tỉ lệ giao nhau** giữa 2 tập, không
phải so bằng 1 giá trị đơn. Trùng CÀNG NHIỀU loại càng được điểm cao — 1
điểm có 3 loại trùng cả 3 với ứng viên sẽ luôn thắng ứng viên chỉ trùng 1/3,
đúng trực giác "giống nhau nhiều hơn thì liên quan hơn".

Hệ số cùng-loại-hình (1000) áp đảo mọi thành phần khác — đúng ý người dùng
"cùng type ngoài cụm cũng được", vì cùng-loại-ở-xa vẫn thắng khác-loại-ở-gần.
`Priority`/`ContentTier` CHỈ là trọng số phụ (tối đa 20/10 điểm) — không được
phép đảo ngược thứ tự cùng-loại-hình/cùng-cụm, tránh ưu tiên biên tập phá vỡ
tính liên quan thật. Kể cả `Priority=5` (thấp nhất) vẫn được cộng +4 chứ
không phải 0 hay âm — tránh 1 điểm ít được đánh giá bị loại vĩnh viễn khỏi
mọi gợi ý dù đúng loại hình/gần nhất (đã bàn ở bước trước: `Priority` không
phải bộ lọc cứng).

Vẫn giữ 2 bậc cứng đứng TRƯỚC bảng điểm (không đưa vào scoring): **con trực
tiếp** (≤4, quan hệ cây bắt buộc) và **`related` curated tay** (quyết định
biên tập, override thuật toán) — đây là quyết định của con người, thuật toán
không nên tự ý xếp lại.

### 1.4 Việc cần làm khi build (chưa làm — chỉ ghi kế hoạch)

1. Mirror hoá TOÀN BỘ tập loại (many-to-many, sửa từ thiết kế "1 loại chính"
   sai trước đó — xem §0) vào Postgres: bảng mới `dichoithoi_destination_types`
   (`destination_slug, type_slug`) phản chiếu `v2.DestinationTypeMap`, hoặc
   cột mảng `types varchar(64)[]` trên `destination-mirror.entity.ts` nếu
   muốn đơn giản hơn (không cần join riêng, đủ dùng vì chỉ đọc, không query
   phức tạp theo từng loại). Cập nhật đồng bộ mirror
   (`typeorm-destination-mirror.repository.ts`, `mssql-site-db.adapter.ts`).
   **Không build bước này trước khi hoàn thành rà soát taxonomy ở mục 6** —
   đồng bộ dữ liệu còn sai lệch (vd. Vịnh Hạ Long) vào mirror rồi dùng ngay
   cho scoring sẽ tạo gợi ý sai ngay từ đầu.
2. Migration `Priority` thay `IsFeatured` — 4 bước đã ghi chi tiết ở §1.1.
3. Bảng mới `dichoithoi_cluster_distances` + job tính (chạy khi toạ độ trung
   tâm 1 node cấp cao đổi, không chạy mỗi lần recompute-related).
4. Viết lại phần "sau 2 bậc cứng" của `buildRelatedItems()` thành hàm chấm
   điểm theo công thức §1.3, thay cho waterfall bước 3-5 hiện tại.
6. `related-builder.spec.ts` — test riêng: (a) cùng loại hình khác cụm phải
   thắng khác loại hình cùng cụm; (b) `Priority` không được đảo thứ tự loại
   hình (kể cả Priority=1 vs Priority=5); (c) khoảng cách xấp xỉ 2 tầng dùng
   đúng khi khác cụm, haversine trực tiếp khi cùng cụm.
7. Cập nhật `dichoithoi-destination-spec.md` §12.3 — thay toàn bộ mô tả
   waterfall cũ bằng thuật toán chấm điểm + mô hình khoảng cách 2 tầng này.

## 2) Tách nhãn hiển thị theo tiêu chí trên UI

**Mục tiêu**: người dùng THẤY lý do gợi ý (đúng yêu cầu "thấy được mối liên
kết"), không chỉ 1 danh sách phẳng không giải thích.

Việc cần làm:
1. `RelatedItem` (`related-builder.ts`) đã có field `badge` — mở rộng thêm 1
   field mới `criterion: "child" | "curated" | "same-type-cluster" |
   "same-type" | "nearby" | "same-province"`, suy ra từ **2 thành phần điểm
   cao nhất** trong công thức §1.3 (vd. cùng-loại-hình + cùng-cụm cao nhất →
   `same-type-cluster`; chỉ cùng-loại-hình cao → `same-type`; chỉ điểm
   khoảng cách cao → `nearby`) — không phải nhãn theo NGUỒN như thiết kế cũ,
   mà theo LÝ DO thật sự khiến ứng viên đó được chọn.
2. `_QuickDecisionCard`/khối "Điểm đến liên quan" (`Destination/Detail.cshtml`,
   phần render `extras.Related`) — group theo `criterion`, hiển thị dưới
   dạng các mục con có tiêu đề: "Gần đây" (nearby) / "Cùng loại hình"
   (same-type) / "Trong khu vực" (same-province/sibling) thay vì 1 lưới
   phẳng 8 ảnh. Con trực tiếp/curated giữ nguyên không cần nhãn (đã rõ ngữ
   cảnh qua vị trí trên trang).
3. Cần review UI thật (Playwright) trước khi coi là xong — đúng quy ước dự
   án (skill `qa-audit`), không chỉ build pass.

## 3) Nối ArticleDestinationMap vào khối liên quan

**Mục tiêu**: liên kết dữ liệu bài cẩm nang ↔ điểm đến hiện đang tách rời,
người dùng không thấy 2 nguồn này "nói chuyện" với nhau.

Việc cần làm:
1. Trang detail điểm đến: nếu điểm đến có mặt trong ≥1 `ArticleDestinationMap`
   (topic bất kỳ), thêm 1 dòng riêng trong khối liên quan (không tính vào
   8 mục Related, hiển thị tách biệt) — "Có trong lịch trình: {tên bài}" link
   thẳng tới bài, không cần thay đổi schema, chỉ thêm 1 query đọc + 1 khối
   render mới (đã có sẵn use-case đọc `ArticleDestinationMap`, xem
   `DestinationExtrasRepository`).
2. Cân nhắc chiều ngược lại (bài cẩm nang → hiện "Điểm đến liên quan tới bài
   này" ở cuối bài) — chưa chốt, đánh giá sau khi làm xong chiều detail→bài.

## 4) JSON-LD cho quan hệ ngang cấp

**Mục tiêu**: khoảng trống SEO thật — Google hiện không có tín hiệu cấu trúc
nào cho nearby/related/same-type, chỉ có cha-con.

Việc cần làm:
1. `SchemaUtil.cs` (dichoithoi) — thêm `ItemList` riêng (không gộp vào
   `TouristAttraction` chính) liệt kê các mục trong `extras.Related`, đặt
   `name` = "Điểm đến liên quan tới {Name}". Tham khảo cách content-seo-ux-plan
   đã dùng `ItemList` cho trang danh sách tỉnh/cụm (cùng loại schema, khác
   ngữ cảnh).
2. Không thêm `isPartOf`/`hasPart` mới cho quan hệ nearby/related (những
   thuộc tính này đúng ngữ nghĩa schema.org cho cấu trúc bộ phận-tổng thể,
   KHÔNG phù hợp cho "gần đây"/"cùng loại" — tránh lạm dụng schema sai ngữ
   cảnh, Google có thể phạt structured data đánh lừa).

## 5) Trang bản đồ tổng quan điểm đến + lớp quan hệ/khoảng cách (chưa build)

Đào sâu 15/07/2026 — ban đầu người dùng muốn 1 trang riêng để XEM + SỬA quan
hệ/khoảng cách giữa các cụm/tỉnh trực quan dạng "mạng lưới" (ảnh mẫu: chấm =
node, đường kẻ = quan hệ). Sau đó mở rộng: **trang này còn phải là bản đồ
tổng quan TOÀN BỘ điểm đến** (không chỉ phục vụ mục đích tính khoảng cách) —
nghĩa là mặc định hiện TẤT CẢ điểm đến (mọi `kind`: tỉnh/cụm/poi) trên bản
đồ thật, còn phần quan hệ/khoảng cách (§5.3-5.5) là 1 LỚP BẬT/TẮT được trên
nền bản đồ đó, không phải 2 trang riêng biệt hay 2 "chế độ" tách rời.

Giá trị phụ đáng ghi nhận (không phải mục tiêu chính nhưng nên tận dụng):
bản đồ tổng quan giúp phát hiện lỗi dữ liệu (điểm có toạ độ sai sẽ hiện lệch
vị trí rõ ràng, dễ nhận ra hơn nhìn bảng số) và phát hiện khoảng trống nội
dung (tỉnh/vùng nào còn ít điểm đến) — hỗ trợ trực tiếp hướng "đào sâu 1
khu vực" đã bàn ở phần chiến lược cạnh tranh trước đó.

### 5.1 Quyết định: bản đồ thật (Leaflet), không phải sơ đồ trừu tượng

Lý do chốt: dữ liệu là khoảng cách ĐỊA LÝ THẬT — đặt node đúng toạ độ thật
trên bản đồ Việt Nam giúp nhìn là biết ngay đường nối có hợp lý không (đường
dài trên màn hình = xa thật). Sơ đồ trừu tượng (force-directed layout, node
tự sắp xếp theo thuật toán) sẽ làm méo cảm nhận khoảng cách, dễ hiểu lầm.

- Trang này chỉ chạy TRONG CMS nội bộ (zinoflow admin), không phải website
  công khai dichoithoi.com — nguyên tắc "không dùng thư viện ngoài/tối giản
  CSS" (§10.5 content-seo-ux-plan) chỉ áp dụng cho site công khai vì ảnh
  hưởng Core Web Vitals của người dùng cuối, KHÔNG áp dụng ở đây.
- Thư viện đề xuất: **Leaflet + react-leaflet**, nền bản đồ OpenStreetMap —
  miễn phí, không cần API key (khác Google Maps JS API có tính phí).
- Khoảng cách tính bằng haversine (toán thuần từ `Lat`/`Lng` đã có trong
  DB) — **hoàn toàn miễn phí, không gọi API ngoài, không giới hạn số lần
  chạy**. Chỉ tốn phí nếu sau này muốn đổi sang "khoảng cách đường bộ thật"
  (Google Distance Matrix API) — KHÔNG cần thiết cho mục đích xếp hạng/hiển
  thị hiện tại, đường chim bay đã đủ dùng.

### 5.2 Nội dung hiển thị — 1 nền bản đồ đủ toàn bộ, gom cụm khi zoom xa

Đổi từ thiết kế trước (ẩn điểm con, chỉ hiện khi click chọn 1 cụm) sang
**hiện mặc định TẤT CẢ ~272 điểm đến** (province + cluster + poi), dùng
**gom cụm marker** (`leaflet.markercluster`, plugin miễn phí phổ biến cho
Leaflet) để giữ bản đồ gọn khi zoom toàn quốc — nhiều điểm gần nhau tự động
gộp thành 1 bubble ghi số lượng, zoom vào hoặc bấm bubble để tách ra từng
điểm. Đây là cách chuẩn cho bản đồ nhiều điểm, không cần thao tác "click cụm
trước mới thấy con" như thiết kế cũ (giờ mục tiêu là xem tổng quan trước).

- **Kiểu marker phân biệt theo `kind`**: tỉnh/cụm = chấm lớn hơn, poi = chấm
  nhỏ; có thể tô màu thêm theo `ContentTier` (flagship nổi bật hơn standard)
  hoặc `primaryType` (loại hình, dùng lại field mirror ở §1.4 mục 1) — chọn
  1 chiều màu chính để không rối, còn lại để trong panel chi tiết khi click.
- **Bộ lọc trên thanh công cụ**: theo tỉnh, loại hình, trạng thái (published/
  draft), `ContentTier` — ẩn/hiện marker theo lựa chọn, không đổi dữ liệu.
- **Click 1 marker**: popup nhanh (tên, ảnh thumbnail nhỏ, trạng thái, link
  "Sửa" mở đúng trang chi tiết điểm đến trong admin, link "Xem trên web"
  mở trang public) — hữu ích cho cả mục đích QA dữ liệu, không chỉ quan hệ.
- **Lớp quan hệ/khoảng cách (đường nối, §5.3-5.5) là 1 TOGGLE riêng** (nút
  bật/tắt trên thanh công cụ) — khi bật, chỉ vẽ đường nối cho **node cấp
  cụm/tỉnh** (đúng thiết kế cũ) + với điểm poi đang được click chọn thì vẽ
  thêm 1 đường duy nhất về tâm cụm cha (dùng `DistanceFromCenter` có sẵn,
  KHÔNG vẽ mesh điểm-con-tới-điểm-con — giữ đúng yêu cầu ban đầu). Khi tắt
  toggle, bản đồ trở về chế độ xem tổng quan thuần, không có đường nối.

### 5.3 Kiểu vẽ đường nối — phân biệt tự tính vs curated

- Đường mảnh, màu xám nhạt: khoảng cách tự tính (`dichoithoi_cluster_distances`
  cấp cụm/tỉnh, `DistanceFromCenter` cấp điểm con) — độ đậm/độ dày tỉ lệ
  nghịch với khoảng cách (gần → đậm hơn) để nhìn trực quan không cần đọc số.
- Đường đậm, màu nổi bật riêng: quan hệ `related` curated tay ở cấp cụm/tỉnh
  (admin chủ động chọn "2 cụm này nên gợi ý nhau" dù không gần) — bấm chọn
  2 node liên tiếp để bật/tắt, ghi thẳng vào `dichoithoi_destination_relations`.

### 5.4 Bộ lọc "level" khoảng cách

Dropdown/slider chọn ngưỡng hiển thị ở lớp cụm/tỉnh (vd. "≤100km / ≤300km /
tất cả") — vì hiện đủ ~300 cặp sẽ rối; lọc theo ngưỡng chỉ ảnh hưởng VIEW,
không đổi dữ liệu đã tính sẵn trong `dichoithoi_cluster_distances`.

### 5.5 Panel chi tiết + 2 nút tính lại (phân biệt rõ 2 loại — dễ nhầm)

- Click 1 node: panel bên hiện tên, toạ độ, danh sách khoảng cách tới mọi
  node khác cùng lớp, sắp gần → xa.
- **2 nút tính lại RIÊNG BIỆT, không gộp** (người dùng hỏi 15/07/2026, dễ
  nhầm nếu gộp chung 1 nút "tính lại"):
  1. "Tính lại khoảng cách cụm" — chạy haversine toàn bộ cặp node cấp cụm/
     tỉnh, ghi đè `dichoithoi_cluster_distances` (§1.2). Nhanh (~300 cặp),
     an toàn chạy thường xuyên.
  2. "Recompute related toàn bộ" — **tính năng đã có sẵn từ trước** (nút
     này hiện đang nằm ở `/dichoithoi/tools`, `RecomputeRelatedService`),
     đề xuất thêm 1 bản sao/link tắt ngay trên trang bản đồ cho tiện (không
     xây lại logic, chỉ gọi cùng 1 API) — vì đây mới là nút tính `RelatedJson`
     thật cho từng điểm theo thuật toán chấm điểm §1.3, khác hẳn nút 1.

### 5.6 "Spotlight" — xem chi tiết quan hệ 1 điểm cụ thể (đen = nền, đỏ = chi tiết)

Theo đúng ý tưởng ảnh mẫu người dùng gửi (15/07/2026): không vẽ quan hệ của
TẤT CẢ 247 điểm cùng lúc (sẽ ra hàng nghìn đường chồng chéo, không đọc được)
— chỉ vẽ khi người dùng chủ động chọn 1 điểm.

- **Lớp nền (đen/xám, luôn hiện khi bật toggle quan hệ)**: mạng lưới cấp
  cụm/tỉnh (~25 node, quy mô vừa phải, xem §5.3) — cho cảm nhận tổng thể.
- **Lớp "spotlight" (đỏ, chỉ hiện khi click 1 marker bất kỳ — kể cả điểm
  poi lẻ, không riêng cụm/tỉnh)**: vẽ đúng `RelatedJson` THẬT của điểm đó
  (kết quả thuật toán chấm điểm §1.3, tối đa 8 mục) — không phải dữ liệu
  mới, chỉ là hiển thị trực quan cái đã tính sẵn.
- **Giá trị cụ thể** (không chỉ đẹp mắt): (1) QA thuật toán — nhìn đường đỏ
  phát hiện ngay chọn sai loại hình/bỏ sót điểm gần đúng loại; (2) curate
  tay có ngữ cảnh — thêm quan hệ thủ công trong lúc đang thấy quan hệ tự
  động, tránh trùng/mâu thuẫn; (3) bắt lỗi toạ độ — đường đỏ "nhảy" bất
  thường dễ nhận ra hơn đọc bảng số km. Giới hạn: đây là công cụ ADMIN nội
  bộ, không có mặt trên website công khai, không trực tiếp ảnh hưởng SEO.

### 5.7 Sửa quan hệ trực tiếp trên bản đồ — nối tay + loại trừ gợi ý sai

Người dùng hỏi 15/07/2026: có nối được điểm bất kỳ, có bỏ được điểm bất hợp
lý không? Trả lời: có, nhưng cần 2 CƠ CHẾ KHÁC NHAU tuỳ loại quan hệ đang sửa
— không thể xử lý như nhau vì `nearby`/cùng-loại-hình là kết quả THUẬT TOÁN
tính lại mỗi lần recompute, còn `related` là dữ liệu TAY:

1. **Nối tay 2 điểm bất kỳ** (không giới hạn ở cấp cụm/tỉnh như §5.3 bản
   đầu — mở rộng cho cả poi-poi, cụm-poi...): click chọn 2 marker liên
   tiếp → ghi 1 dòng `related` curated mới vào
   `dichoithoi_destination_relations`. Cơ chế này ĐÃ CÓ SẴN trong hệ thống
   (đúng loại quan hệ `related` type=2 đã tồn tại từ trước), trang bản đồ
   chỉ là giao diện trực quan hơn để tạo, không phải tính năng backend mới.
2. **Xoá 1 quan hệ `related` curated đã có**: xoá thẳng dòng tương ứng —
   đơn giản, không có tác dụng phụ.
3. **"Bỏ điểm bất hợp lý" khi đó là quan hệ TỰ TÍNH (`nearby`/cùng loại
   hình do thuật toán §1.3 chọn)**: KHÔNG thể chỉ "xoá" — vì lần
   "Recompute related toàn bộ" tiếp theo (mục 2, §5.5) sẽ tính lại và có
   thể chọn đúng điểm đó lần nữa, âm thầm phục hồi lỗi admin vừa sửa. Cần
   thêm **1 loại quan hệ mới `excluded`** (loại trừ) vào enum hiện có
   (`nearby`/`related`/`mentioned` → thêm `excluded`) — khi thuật toán
   chấm điểm (§1.3) xây `RelatedJson`, lọc bỏ mọi ứng viên có quan hệ
   `excluded` với điểm đang xét TRƯỚC khi chấm điểm, bất kể điểm đó lẽ ra
   được điểm cao thế nào. Việc cần làm khi build: thêm giá trị enum
   `excluded` (Postgres + SQL Server `DestinationRelation.RelationType`),
   sửa `buildRelatedItems()` nhận thêm `excludedSlugs: Set<string>`, lọc
   ngay đầu hàm trước khi chạy §1.3.
4. Trên bản đồ: click vào 1 ĐƯỜNG NỐI (không phải marker) → menu nhỏ hiện
   "Xoá quan hệ này" — nếu là curated thì xoá dòng (mục 2), nếu là tự tính
   thì ghi `excluded` (mục 3), UI không cần người dùng tự phân biệt loại
   nào, hệ thống tự xử lý đúng cơ chế theo loại quan hệ đang click.

## 6) Công cụ rà soát + gán lại taxonomy theo cụm (ĐIỀU KIỆN TIÊN QUYẾT cho mục 1)

Đào sâu 15/07/2026, xuất phát từ phát hiện chất lượng dữ liệu ở §0 (25 điểm
chưa phân loại, phân bố lệch, có sai lệch cụ thể như Vịnh Hạ Long). Người
dùng xác nhận sẽ phải tự rà lại taxonomy toàn bộ — cần 1 công cụ trực quan
để làm việc này CÓ HỆ THỐNG, theo từng cụm/tỉnh một, thay vì mò từng điểm.

**Đây là điều kiện tiên quyết, không phải việc song song**: mục 1 (thuật
toán chấm điểm ưu tiên tuyệt đối theo loại hình) chỉ nên bật SAU khi rà xong
taxonomy — bật trước sẽ khuếch đại sai lệch dữ liệu thành gợi ý sai trên
diện rộng, đúng ngược với mục tiêu ban đầu "gợi ý đúng ý người dùng".

**Chốt 15/07/2026: trang ĐỘC LẬP riêng** (không gộp vào trang bản đồ §5) —
đề xuất route `/dichoithoi/phan-loai`. Lý do: bản chất dữ liệu và thao tác
khác hẳn bản đồ (bảng Kanban vs bản đồ địa lý), gộp chung dễ làm cả 2 trang
đều rối.

**Quy trình 3 bước** (người dùng chốt 15/07/2026, thay cho "chỉ có công cụ
sửa tay" ở bản trước):

1. **Chuẩn hoá ĐỊNH NGHĨA 18 loại trước** (không phải gán lại từng điểm ngay)
   — xem §6.0b, cần chốt trước khi làm bước 2 vì đổi định nghĩa sau khi đã
   gán hàng loạt sẽ phải làm lại.
2. **AI tự động đánh giá + đề xuất gán lại HÀNG LOẠT** dựa trên định nghĩa
   đã chuẩn hoá — xem §6.3 (bản cập nhật, thay "cân nhắc giai đoạn sau" bằng
   "làm ngay, đây là bước chính", nhưng vẫn giữ nguyên tắc không tự ghi
   thẳng — luôn ở dạng đề xuất chờ duyệt).
3. **Người dùng duyệt/sửa trong trang Kanban** (§6.1-6.2) — xem đề xuất của
   AI đã điền sẵn, tick xác nhận hoặc sửa lại nếu chưa hợp lý.

### 6.0b Chuẩn hoá định nghĩa 18 loại — phát hiện cần bạn quyết trước

Soi lại danh sách 18 loại hiện tại (3 nhóm: Thiên nhiên / Văn hoá-Lịch sử /
Vui chơi-Trải nghiệm), phát hiện **2 loại đang lẫn giữa 2 trục khác nhau**:
"loại hình place LÀ gì" (biển, núi, di tích, kiến trúc — đặc điểm CỐ ĐỊNH
của nơi chốn) và "tính chất/trải nghiệm nơi đó CÓ" (không cố định, cắt ngang
mọi loại khác):

- **"Check-in sống ảo"** — 1 bãi biển, 1 ngôi chùa, 1 công trình kiến trúc
  đều có thể "check-in sống ảo" như nhau, không phải đặc điểm phân loại nơi
  chốn. Đây là lý do nó chiếm 37,5% lượt gán (102/399, xem §0) — không phải
  do admin gán ẩu, mà do bản chất tag này cắt ngang mọi loại, ai cũng gán
  được. Nếu để nguyên trong trục "loại hình chính" dùng cho công thức chấm
  điểm §1.3, sẽ tạo tín hiệu YẾU giả (2 nơi cùng "check-in sống ảo" không
  thực sự giống nhau như 2 nơi cùng "hang động").
- **"Nghỉ dưỡng"** — cùng vấn đề, mô tả mục đích/trải nghiệm chứ không phải
  loại nơi chốn.

**Chốt hướng 15/07/2026**: đồng ý tách — giữ lại 2 tag này (vẫn hữu ích để
hiển thị/lọc trên website) nhưng **tách khỏi trục "loại hình chính"** dùng
trong phép so khớp tập hợp ở §1.3, chuyển thành 1 field riêng
`experienceTags` không tham gia scoring. **Chi tiết thực hiện (tên field
cuối cùng, có tag nào khác còn cần tách nữa không, cách migrate dữ liệu đã
gán) để lại phân tích kỹ khi thực sự bắt tay làm bước chuẩn hoá — đây mới
chỉ là hướng đã chốt trên doc, chưa phải thiết kế chi tiết cuối cùng.**

### 6.1 Bố cục — bảng Kanban theo cụm, cột = loại hình

1. **Chọn 1 cụm/tỉnh** (dropdown/search, giống bộ lọc ở §5.2) — vd. chọn
   "Đà Lạt".
2. **Hiện dạng bảng Kanban**: mỗi CỘT là 1 loại hình trong số 18 loại (chỉ
   hiện cột có ≥1 điểm thuộc cụm đang chọn, tránh 18 cột trống rỗng gây rối
   khi cụm nhỏ) — mỗi điểm đến trong cụm hiện dạng thẻ nhỏ (ảnh thumbnail +
   tên) nằm trong TỪNG cột ứng với loại nó đang được gán. 1 điểm có nhiều
   loại → xuất hiện ở nhiều cột (đúng bản chất nhiều-nhiều, không giấu).
3. **Cột riêng "Chưa phân loại"** — luôn hiện đầu tiên, tô màu cảnh báo
   (vd. viền đỏ/cam) — liệt kê các điểm trong cụm chưa có loại nào, đây là
   danh sách ưu tiên xử lý trước.
4. **Thanh tiến độ đầu trang**: "X/Y điểm trong cụm đã phân loại" — giúp
   theo dõi tiến độ rà soát khi làm tuần tự từng cụm, không mất dấu đã làm
   tới đâu (dự án có ~25 cụm/tỉnh, cần cách theo dõi tiến độ tổng thể).

### 6.2 Sửa trực tiếp trên bảng

- Click 1 thẻ điểm đến → popover nhỏ hiện toàn bộ 18 loại (nhóm theo 3 nhóm
  Thiên nhiên/Văn hoá-Lịch sử/Vui chơi-Trải nghiệm) dạng checkbox, tick/bỏ
  tick → lưu ngay (ghi thẳng `v2.DestinationTypeMap`, tương tự cơ chế nối
  quan hệ tay ở §5.7 — không cần trang riêng để "submit").
- Cân nhắc thêm (không bắt buộc phải làm ngay đợt đầu): kéo-thả thẻ từ cột
  này sang cột khác cũng coi như gán loại mới — trực quan hơn checkbox
  nhưng phức tạp hơn khi cài đặt; đề xuất làm checkbox trước, đánh giá thêm
  kéo-thả sau khi dùng thực tế thấy cần.

### 6.3 AI đánh giá + đề xuất gán lại hàng loạt (bước 2 trong quy trình) — LUÔN chờ duyệt

Chốt 15/07/2026: đây là bước CHÍNH (không phải "cân nhắc giai đoạn sau" như
bản trước) — sau khi chuẩn hoá xong định nghĩa loại (§6.0b), chạy 1 job đánh
giá TOÀN BỘ 272 điểm (không chỉ 25 điểm chưa phân loại — cả những điểm ĐÃ có
loại cũng cần đánh giá lại, vì dữ liệu cũ "có thể đang sai rất nhiều" theo
đúng lời người dùng, không chỉ thiếu):

1. **Input cho AI**: Tên điểm đến + nội dung đã có thật (`Content`/mô tả,
   không dùng field nào khác) + danh sách 16 loại-hình-place chuẩn hoá
   (không gồm 2 tag trải nghiệm đã tách ở §6.0b). Đúng nguyên tắc "không
   bịa dữ liệu cứng" (destination-spec §3.5) — đây là bài toán PHÂN LOẠI
   trên dữ liệu thật đã có (tên + nội dung đã viết), không phải suy diễn/
   sáng tác thông tin mới, nên dùng AI ở đây khác bản chất với việc AI tự
   bịa sự kiện/số liệu.
2. **Output**: với MỖI điểm — danh sách loại AI đề xuất (có thể khác hoàn
   toàn danh sách cũ) + 1 dòng lý do ngắn (vd. "có công trình kiến trúc độc
   đáo, không phải di tích lịch sử truyền thống" cho trường hợp như Biệt
   Thự Hằng Nga) — lý do giúp người dùng duyệt nhanh hơn ở bước 3, không
   phải đọc lại toàn bộ nội dung gốc để tự suy luận lại.
3. **KHÔNG ghi thẳng vào `DestinationTypeMap`** — lưu vào bảng nháp riêng
   (vd. `dichoithoi_taxonomy_suggestions`: `destination_slug, suggested_types
   jsonb, reason text, status enum(pending/accepted/rejected)`), trang
   Kanban (§6.1-6.2) đọc bảng nháp này để hiện SẴN các checkbox đã tick theo
   đề xuất AI — người dùng chỉ cần xác nhận (bấm 1 nút "Áp dụng cho cả cụm")
   hoặc sửa từng điểm nếu chưa hợp lý, KHÔNG phải tự tick lại từ đầu.
4. Sau khi người dùng xác nhận (từng điểm hoặc cả cụm) → mới ghi thật vào
   `v2.DestinationTypeMap`, đồng thời đánh dấu `status=accepted` trên bảng
   nháp để không đề xuất lại lần đánh giá sau.

## Kế hoạch triển khai theo giai đoạn (phân tích phụ thuộc thật, 15/07/2026)

Thay cho ghi chú thứ tự thô ở bản trước — phân tích lại PHỤ THUỘC THẬT giữa
6 mục (cái gì bắt buộc phải xong trước cái gì, cái gì độc lập làm song song
được) trước khi xếp thứ tự, theo đúng format Definition of Done như
`dichoithoi-implementation-plan.md`. Nguyên tắc xuyên suốt: mỗi giai đoạn
build + test xong, verify thật (không chỉ build pass) rồi mới sang giai đoạn
sau — không gộp nhiều giai đoạn cùng lúc để dễ audit nếu có phát sinh (bài
học "MỤC KHẨN" trong `dichoithoi-backlog.md`).

### Giai đoạn A — Nền tảng độc lập (làm trước, không phụ thuộc gì nhau)

Không có phụ thuộc chéo giữa các việc dưới đây — có thể làm theo bất kỳ thứ
tự nào trong giai đoạn này, kể cả song song nếu muốn, nhưng KHÔNG được bỏ
qua vì các giai đoạn sau đều cần ít nhất 1 trong số này:

- ✅ **A1. Migration `Priority` thay `IsFeatured` — ĐÃ XONG (16/07/2026)** (§1.1)
  — độc lập hoàn toàn. Đã đổi toàn bộ 2 repo: Postgres mirror (`priority
  smallint default 3`, migration `1782160000000-DestinationPriority.ts`),
  SQL Server (`v2.Destination.Priority tinyint`, script
  `scripts/dichoithoi-sqlserver/01-create-new-schema.sql` idempotent cho
  install cũ), contracts (`priority: z.number().int().min(1).max(5)`), toàn
  bộ domain/port/use-case/CMS form liên quan (form đổi checkbox "Nổi bật"
  thành `Select` 1-5), ngưỡng "nổi bật" bên dichoithoi đổi từ `IsFeatured`
  sang `Priority <= 2` (`DestinationTaxonomyRepository.cs`, `Detail.cshtml`,
  `get-coverage-scores.usecase.ts`). Backfill: `IsFeatured=true → Priority=1`,
  `false → Priority=3`. Verify: `dotnet build` sạch, `tsc --noEmit` (api+web)
  sạch, jest 364/364 pass, đã chạy migration thật trên LocalDB `dichoithoi_dev`
  + Postgres dev, Playwright xác nhận nhóm "Nổi bật" trang Đà Lạt vẫn hiện
  đúng 2 điểm (Hồ Xuân Hương, Thung lũng tình yêu) sau khi đổi ngưỡng.
- **A2. Bảng `dichoithoi_cluster_distances` + job tính** (§1.2) — độc lập,
  chỉ cần toạ độ trung tâm cụm/tỉnh đã có sẵn.
- ✅ **A3. Nối `ArticleDestinationMap` vào khối liên quan — ĐÃ XONG (16/07/2026)**
  (mục 3) — độc lập hoàn toàn với mọi phần còn lại của plan này. Thêm field
  `DestinationExtrasModel.RelatedArticles` (distinct theo bài viết, topic bất
  kỳ — khác 4 field theo-topic có sẵn `ItineraryArticles`/`FoodArticles`/...),
  populate trong `DestinationExtrasRepository.GetExtrasBySlugAsync` từ đúng
  query `articleLinksByTopic` đã có sẵn (không thêm query mới). View
  `Destination/Detail.cshtml` thêm khối riêng "Có trong bài cẩm nang:
  {tên bài} →" ngay sau chuỗi if/elseif "Điểm đến liên quan" (độc lập, không
  tính vào 8 mục `RelatedItems`). Verify: `dotnet build` sạch; test thật qua
  Playwright — chèn tạm 1 dòng `v2.Article`+`v2.ArticleDestinationMap` cho
  `da-lat`, xác nhận link hiện đúng vị trí (sau "Điểm đến liên quan", trước
  "Ăn gì ở"), trỏ đúng `/cam-nang/{slug}`, đã xoá dữ liệu test sau khi verify.
- **A4. Trang bản đồ tổng quan — PHẦN NỀN** (§5.1-5.2, §5.5 phần "click
  marker xem panel", KHÔNG gồm lớp quan hệ §5.3-5.7): hiện toàn bộ điểm đến
  trên bản đồ thật, bộ lọc, popup — chưa cần vẽ đường quan hệ, chưa cần
  thuật toán chấm điểm. Độc lập, có thể dùng ngay làm công cụ QA dữ liệu dù
  các giai đoạn sau chưa xong.

**DoD giai đoạn A**: build .NET + zinoflow pass; Playwright xác nhận trang
bản đồ hiện đúng toàn bộ điểm đến thật (không phải dữ liệu giả); `Priority`
đã thay `IsFeatured` ở lưới "Điểm tham quan nổi bật" không vỡ layout cũ.

### Giai đoạn B — Chuẩn hoá taxonomy (mục 6) — ĐIỀU KIỆN CHẶN cho giai đoạn C

**Phải xong hoàn toàn trước khi bắt đầu giai đoạn C** — đây là ràng buộc
cứng, không phải gợi ý (lý do: bật thuật toán ưu tiên tuyệt đối theo loại
hình trên dữ liệu taxonomy còn sai sẽ khuếch đại lỗi thành gợi ý sai diện
rộng, xem §6).

1. **B1. Chuẩn hoá định nghĩa 18 loại** (§6.0b) — tách 2 tag trải nghiệm
   (Check-in sống ảo, Nghỉ dưỡng) khỏi trục chính, chi tiết phân tích khi
   bắt tay làm (đã chốt hướng, chưa chốt chi tiết).
2. **B2. Trang Kanban rà soát taxonomy** (§6.1-6.2, route
   `/dichoithoi/phan-loai`) — xây trước phần khung (chọn cụm, hiện cột,
   click sửa tay), CHƯA cần tích hợp AI đề xuất ở bước này — có thể dùng
   ngay để rà tay nếu muốn bắt đầu trước khi AI-đề-xuất sẵn sàng.
3. **B3. Job AI đánh giá + đề xuất hàng loạt** (§6.3) — bảng nháp
   `dichoithoi_taxonomy_suggestions`, chạy cho toàn bộ 272 điểm, không ghi
   thẳng vào `DestinationTypeMap`.
4. **B4. Người dùng duyệt qua trang Kanban** (dùng B2, đọc đề xuất từ B3) —
   xác nhận/sửa từng cụm cho tới khi phủ hết ~25 cụm/tỉnh.

**DoD giai đoạn B**: toàn bộ 272 điểm đã được rà soát tay ít nhất 1 lần qua
trang Kanban (không còn ở trạng thái "chưa xem lại từ khi có AI đề xuất");
0 điểm còn ở cột "Chưa phân loại" trừ khi admin chủ động để trống có chủ
đích; danh sách 16 loại-hình-place chính thức đã chốt (không còn lẫn tag
trải nghiệm).

### Giai đoạn C — Thuật toán chấm điểm + lớp quan hệ trên bản đồ (phụ thuộc A + B)

Phụ thuộc: cần A1 (Priority) + A2 (cluster distances) xong, và **bắt buộc
B xong hoàn toàn** (không phải đang dở).

1. **C1. Mirror hoá tập loại hình đã chuẩn hoá** vào Postgres (§1.4 mục 1,
   bản sửa many-to-many) — chỉ đồng bộ SAU khi giai đoạn B xong, tránh mirror
   dữ liệu còn sai.
2. **C2. Viết thuật toán chấm điểm** (§1.3, hàm mới thay `buildRelatedItems()`
   bước 3-5 cũ) + `related-builder.spec.ts` đầy đủ test case đã liệt kê ở
   §1.4.
3. **C3. Thêm loại quan hệ `excluded`** (§5.7 mục 3) vào enum
   `nearby/related/mentioned`, sửa thuật toán C2 lọc trước khi chấm điểm.
4. **C4. Lớp quan hệ trên trang bản đồ** (§5.3-5.4, §5.6-5.7) — vẽ đường nối
   cụm-cụm (đọc A2), toggle bật/tắt, spotlight đỏ (đọc RelatedJson từ C2),
   nối/xoá quan hệ tay + loại trừ (ghi qua C3).
5. **C5. Cập nhật `dichoithoi-destination-spec.md` §12.3** — thay mô tả
   waterfall cũ bằng thuật toán chấm điểm mới (spec đó mới là nguồn sự thật
   lâu dài, doc này chỉ là kế hoạch tạm).

**DoD giai đoạn C**: `related-builder.spec.ts` pass đủ test case; recompute
related toàn bộ chạy trên `dichoithoi_dev`, spot-check bằng mắt qua trang
bản đồ (không phải chỉ đọc JSON) một số trường hợp đã biết trước là "nên
đúng" (vd. Biệt Thự Hằng Nga phải ưu tiên gợi ý các công trình kiến trúc
khác); Playwright xác nhận trang bản đồ vẽ đúng lớp quan hệ.

### Giai đoạn D — UI nhãn + JSON-LD (phụ thuộc C)

1. **D1. Tách nhãn hiển thị theo tiêu chí** (mục 2) — cần `criterion` suy ra
   từ kết quả C2, nên phải sau C2.
2. **D2. JSON-LD cho quan hệ ngang cấp** (mục 4) — nên làm sau cùng, tránh
   phải sửa lại JSON-LD nếu thuật toán C2 còn thay đổi trong lúc verify C.

**DoD giai đoạn D**: Playwright xác nhận khối "Điểm đến liên quan" hiện đúng
nhãn theo nhóm; Rich Results Test (Google) xác nhận JSON-LD `ItemList` hợp
lệ, không lỗi.

### Tổng thứ tự: A → B → C → D (A3/A4 có thể chạy sớm hơn, không cần chờ gì)
