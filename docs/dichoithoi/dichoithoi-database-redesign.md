# Dichoithoi — Đại tu Database (thiết kế 12/06/2026)

Mục tiêu: thiết kế lại database cho https://dichoithoi.com/ để **viết lại website**
hiển thị theo schema mới. Ưu tiên số 1: **tốc độ render**. Nguồn nội dung: AI Content
Tool (zinoflow) ghi trực tiếp — xem `dichoithoi-destination-spec.md`.

Phạm vi đợt này: nhóm bảng ĐIỂM ĐẾN (Destination + taxonomy + quan hệ + review).
Các nhóm khác (Hotel, Tour, Phượt, Sim, Post) giữ nguyên, chỉ nối qua FK — đại tu sau.

---

## 1) Hiện trạng và vấn đề (phân tích từ source + DB)

### 1.1 Các bảng hiện tại
`Destination` (PK = slug nvarchar(64)), `DestinationDetail` (1-1, cột nội dung),
`DestinationGroup`, `DestinationType`, `Area`, `Province`, `District`,
`DestinationReview`, `HotelGroup`/`Hotel`.

### 1.2 Vấn đề cấu trúc
1. **Phân cấp nhét vào flags**: `IsProvince`/`IsArea`/`IsGroup` trên cùng 1 bảng +
   bảng `DestinationGroup` riêng nhưng trùng vai trò "điểm cha" → mọi query phải
   nhớ lọc `!IsGroup`, thêm 1 cấp mới là phải thêm flag mới.
2. **Denormalize sai chỗ**: `ProvinceName`, `DestinationGroupName` copy vào từng dòng —
   đổi tên tỉnh (sáp nhập!) phải update hàng loạt.
3. **Type là CSV string** (`"bien,dao"` trong nvarchar(128)) → lọc theo loại phải
   `LIKE '%bien%'` (scan, sai khi tên loại là substring của loại khác), không
   làm được trang landing theo loại.
4. **Taxonomy hành chính lỗi thời**: `Area`/`Province`/`District` theo mô hình cũ —
   sau cải cách 2025: 34 tỉnh/thành, **bỏ cấp huyện** → bảng `District` chết,
   data `Province` sai, địa chỉ cần cả bản cũ + mới.
5. **Quan hệ không tường minh**: "liên quan" suy từ cùng `DestinationGroupId`;
   không có khái niệm "gần đó", "đi cùng chuyến", "được nhắc trong bài".
6. **Lat/Lng là string** — không tính khoảng cách/sort theo geo được.
7. **PK = slug**: đổi tên/sửa slug = đổi PK + gãy URL + gãy ảnh
   (ảnh suy từ slug: `Image = Id + ".webp"` hardcode trong repository).
8. **Thiếu vết vận hành**: không có Status (draft/published), nguồn (tay/AI),
   ngày cập nhật, meta SEO (đang string.Format trong controller).

### 1.3 Vấn đề tốc độ (đọc từ `DiChoiThoi.Service/DestinationRepository.cs`)
1. `GetTopListAsync`: **load toàn bộ bảng** order by `Order` rồi mới Take ở
   controller — không có cột IsFeatured/index.
2. Search: `SearchKeyword.Contains(...)` + `Type.Contains(...)` → LIKE `%...%`
   scan toàn bảng mỗi lần gõ.
3. Trang detail: ngoài query chính còn query "liên quan" theo group + sort/filter
   Type CSV **trong C#** mỗi request (xem `DestinationController.Detail`).
4. Đếm/aggregate (review count, child count) tính lúc render thay vì lưu sẵn.

---

## 2) Nguyên tắc thiết kế (chốt trước khi vào schema)

1. **Ghi đắt, đọc rẻ**: mọi thứ tính được lúc publish (AI tool ghi) thì tính sẵn —
   render chỉ SELECT theo index, không xử lý chuỗi, không aggregate, không suy diễn.
   Website mới chỉ đọc; toàn bộ ghi đi qua AI tool.
2. **Mỗi trang ≤ 2 query** (mục 7 liệt kê từng trang dùng query + index nào).
3. **Int PK + slug unique**: index hẹp, FK rẻ; slug đổi được (có bảng redirect 301),
   URL hiện tại giữ nguyên vì giá trị slug giữ nguyên.
4. **Tách bảng nóng/lạnh**: cột dùng cho danh sách/card nằm ở `Destination` (hẹp,
   cache tốt); nội dung dài nằm `DestinationContent` (chỉ trang detail đụng tới).
5. **Lookup nhỏ cache trong app**: Province (34 dòng), Type (vài chục dòng) —
   .NET load 1 lần vào memory, KHÔNG join lúc render, KHÔNG denormalize tên vào dòng.
6. **Quan hệ: chỉ lưu cái không suy ra được** — cha-con qua `ParentId`, cùng loại
   qua junction (suy ra rẻ bằng index); "gần đó/liên quan/được nhắc" lưu tường minh.

---

## 3) Mô hình phân cấp & quan hệ (phần phân tích kỹ)

### 3.1 Tách 2 trục: hành chính ≠ du lịch
Bài học từ schema cũ: trộn tỉnh/khu vực/nhóm điểm vào một khái niệm gây ra flags.
Thiết kế mới tách rõ:

- **Trục hành chính** (để ghi địa chỉ + lọc theo tỉnh): bảng `Province` (34 tỉnh mới,
  có `Region` Bắc/Trung/Nam). KHÔNG còn District. Không cần bảng Ward —
  địa chỉ là text, du lịch không lọc theo xã.
- **Trục du lịch** (cây cha-con): chính là `Destination.ParentId` — một cây duy nhất:

```
[province-page] Quảng Ninh (Kind=province)        ← trang tỉnh cũng là 1 Destination
   └─ [cluster] Vịnh Hạ Long (Kind=cluster)       ← nhóm/quần thể (thay DestinationGroup)
        ├─ [poi] Hang Sửng Sốt (Kind=poi)
        └─ [poi] Đảo Ti Tốp (Kind=poi)
   └─ [poi] Núi Bài Thơ                            ← poi gắn thẳng tỉnh, không cần cluster
```

Quyết định quan trọng: **trang tỉnh là 1 dòng Destination (Kind=province)** —
vì hiện tại `/diem-den/ha-noi` đã là 1 bài Destination có content; giữ vậy thì
1 URL space, 1 template, 1 pipeline content cho cả 3 cấp. Bảng `Province` chỉ giữ
data hành chính, nối 1-1 tới dòng Destination tương ứng qua `Province.DestinationId`.

`ProvinceId` trên mỗi Destination là **shortcut denormalize có chủ đích** (gán lúc
ghi, không bao giờ đổi trừ sáp nhập) để lọc "mọi điểm thuộc tỉnh X" bằng 1 index —
không phải duyệt cây lúc render. Cây tối đa 3 cấp (province → cluster → poi),
KHÔNG cho cluster lồng cluster (ràng buộc ở AI tool, giữ query đơn giản).

### 3.2 Cùng loại (biển, núi, chùa, phố cổ...) — 2 tầng, cập nhật 07/2026

Phát hiện khi đối chiếu nhu cầu tìm kiếm thật ("sông suối", "tự nhiên", "kiến
trúc"): người dùng nghĩ theo 2 tầng khác nhau — **nhóm lớn** (tự nhiên, văn hóa,
vui chơi — 3-5 nhóm) và **loại cụ thể** (sông suối, thác, hang động... — vài
chục loại). Thiết kế ban đầu (§9.2 cũ) chỉ có "nhóm" trong TÀI LIỆU, không có
cột DB — không mở được trang gộp theo nhóm, mất 1 tầng điều hướng + 1 tầng silo
SEO (pillar page nhóm → cluster page loại → bài điểm đến). Thêm bảng cha:

```sql
CREATE TABLE DestinationTypeGroup (
  Id      int IDENTITY PRIMARY KEY,
  Slug    varchar(64)  NOT NULL UNIQUE,   -- /loai/{slug} — trang pillar theo nhóm
  Name    nvarchar(128) NOT NULL,          -- "Thiên nhiên", "Văn hóa - Lịch sử", "Vui chơi - Trải nghiệm"
  [Order] int NOT NULL DEFAULT 0
);
```
- `DestinationType` thêm cột `GroupId int NOT NULL` (FK `DestinationTypeGroup`) —
  mỗi loại cụ thể thuộc ĐÚNG 1 nhóm (nhóm là phân loại thô, không cần M:N).
- `DestinationTypeMap` (DestinationId, TypeId) — M:N thay CSV, lọc bằng index seek.
- `Destination.PrimaryTypeId` — loại chính để hiện badge/sort mà không join map.
- URL 2 tầng: `/loai/{groupSlug}` (trang nhóm — liệt kê điểm đến từ MỌI loại
  trong nhóm, vd mọi điểm "Thiên nhiên") và `/loai/{groupSlug}/{typeSlug}`
  (trang loại cụ thể, vd `/loai/thien-nhien/thac-ho-suoi`) — cấu trúc URL lồng
  thể hiện đúng quan hệ cha-con, tốt cho breadcrumb + internal link theo silo.

### 3.2.1 Trục thứ 3 — chủ đề cắt ngang: `DestinationTag` (CHỐT 07/2026)

Khác `DestinationType` (bản chất vật lý, mỗi điểm 1 loại chính) — tag là
**chủ đề cắt ngang nhiều loại** (vd "Kiến trúc": Biệt Thự Hằng Nga + Nhà thờ
Con Gà + Ga Đà Lạt — 3 type khác nhau cùng chủ đề). Mở lại từ backlog "tag
tự do: chưa cần" — nhu cầu đã phát sinh thật.

```sql
CREATE TABLE DestinationTag (
  Id          int IDENTITY PRIMARY KEY,
  Slug        varchar(64)   NOT NULL UNIQUE,  -- /chu-de/{slug}
  Name        nvarchar(128) NOT NULL,          -- "Kiến trúc độc đáo"
  Description nvarchar(max),                   -- mô tả chủ đề — nhóm E (AI soạn, người duyệt)
  Status      tinyint NOT NULL DEFAULT 0       -- 0 nháp, 1 published (đủ điều kiện index)
);
CREATE TABLE DestinationTagMap (
  DestinationId int NOT NULL,
  TagId         int NOT NULL REFERENCES DestinationTag(Id),
  PRIMARY KEY (DestinationId, TagId)
);
```

Luật vận hành (chống tag sprawl kiểu WordPress — thin page/index bloat):
- **Bộ từ vựng ĐÓNG, tạo tay trong CMS** (~10-20 chủ đề ban đầu) — form điểm
  đến chỉ CHỌN từ danh sách, không nhập tự do.
- Tag KHÔNG được trùng nghĩa với `DestinationType` sẵn có (vd không tạo tag
  "thác nước" — `/loai/thien-nhien/thac-ho-suoi` đã có) — tránh
  cannibalization; CMS cảnh báo khi tạo tag tên gần trùng type.
- Trang `/chu-de/{slug}` chỉ published + index khi: có `Description` đã
  duyệt **và** gắn đủ ≥5 điểm đến; chưa đủ → `noindex`/chưa mở.
- Quy trình AI gán tag + soạn mô tả: `destination-spec.md` §2.4.

### 3.3 Quan hệ tường minh — bảng `DestinationRelation`
Chỉ 3 loại KHÔNG suy ra được từ cây/loại:

| RelationType | Nguồn sinh | Dùng để render |
|---|---|---|
| `nearby` (1) | AI tool tính từ lat/lng lúc publish (top 10, kèm khoảng cách) | khối "Gần đây có gì" |
| `related` (2) | curated tay hoặc AI gợi ý (cùng chuyến, cùng chủ đề) | khối "Điểm đến liên quan" |
| `mentioned` (3) | engine auto-link ghi lại mỗi link đã chèn vào content | thống kê + re-link + "bài nào nhắc tới X" |

"Cùng nhóm" và "cùng loại" KHÔNG có trong bảng này — suy từ `ParentId`/`TypeMap`.

### 3.4 Precompute khối "liên quan" — quyết định tốc độ quan trọng nhất
Trang detail KHÔNG query bảng relation lúc render. Lúc publish, AI tool tính sẵn
danh sách hiển thị (trộn: con cái → nearby → related → cùng loại, đủ 8 mục) và ghi
vào `DestinationContent.RelatedJson` (mảng `{slug, name, thumbnail, badge}`).
→ Trang detail = **1 query duy nhất**. Bảng `DestinationRelation` là nguồn sự thật
để tính lại; RelatedJson là read-model. Đổi quan hệ → job re-publish RelatedJson.

**Đề xuất bổ sung 07/2026 (phân tích cây phân cấp tỉnh → khu vực → điểm con, vd
Lâm Đồng → Đà Lạt/Di Linh/Đức Trọng → điểm cụ thể) — CHƯA thêm vào DDL thật, chỉ
ghi nhận**: `RelatedJson` phục vụ mục đích "gợi ý" (trộn nhiều tiêu chí, cắt 8
mục) — KHÁC mục đích với việc **liệt kê đầy đủ cây cấu trúc** (breadcrumb + danh
sách con không giới hạn). Đề xuất thêm 2 cột JSON riêng, cùng tính lúc publish
trong `RecomputeRelatedService` (tái dùng job/trigger đã có, không tạo job mới):
- `AncestorsJson` — mảng từ gốc đến chính nó `[{slug,name,kind}]` (vd điểm ở Đà
  Lạt → `[{Lâm Đồng},{Đà Lạt}]`) — render breadcrumb ngay, không cần query đệ
  quy (`ParentId`/`parentSlug`) lúc load trang.
- `ChildrenJson` — danh sách **đầy đủ** con trực tiếp (không cắt 8 như
  `RelatedJson`) — dùng cho trang tỉnh/cụm cần liệt kê hết khu vực con/điểm con.

Cây `kind` (`province`/`cluster`/`poi`) + `ParentId`/`parentSlug` + `ProvinceId`
hiện có đã đủ mô hình hoá đúng ví dụ trên, không cần đổi cấu trúc — chỉ thêm 2
cột đọc-nhanh này. Không khuyến nghị lồng quá 1 cấp `cluster` trong `cluster`
(dù `ParentId` tự tham chiếu không giới hạn được) — giữ breadcrumb/URL/sitemap
đơn giản, thực tế du lịch hiếm khi cần sâu hơn 3 tầng.

**Đề xuất bổ sung 07/2026 (phân tích lại — `kind` không đủ mô tả độ quan
trọng, xem `content-seo-ux-plan.md` §10.6.1) — CHƯA thêm vào DDL thật**: thêm
cột `ContentTier` (tinyint hoặc varchar ngắn: `Flagship`/`Standard`, mặc định
`Standard`) trên `Destination`, chỉ có ý nghĩa với `Kind IN (province, cluster)`.
Gán tay bởi admin qua form điểm đến (§7.3 destination-spec) — không cần thuật
toán gợi ý ở giai đoạn này. Node `Flagship` (vd Đà Lạt, TP.HCM, Hội An) được
cộng thêm nội dung "điểm đến" đầy đủ + JSON-LD `TouristAttraction` + đủ điều
kiện vào `RelatedJson`/`IsFeatured` — chi tiết xem `content-seo-ux-plan.md`
§10.6.1. Không đổi cách query con cái (`ParentId` như trên).

**THAY THẾ 07/2026 (mở rộng từ đề xuất `HotelCardsJson`/`TourCardsJson` ban đầu
— nâng 1 bước xa hơn theo đúng nguyên tắc "website chỉ đọc, không xử lý",
system-design §5 mục 1, sau khi phân tích khối nội dung trang Flagship
Đà Lạt, `content-seo-ux-plan.md` §10.6.2)**: thay vì tính sẵn JSON (website vẫn
phải loop + render Razor mỗi request), zinoflow tính sẵn luôn **HTML cuối
cùng** cho MỌI khối "card động" trên trang điểm đến — đúng pattern
`Article.ContentHtml` đã dùng (`article-spec.md` §4, §8) — website chỉ echo
ra, không JOIN/loop/render gì thêm.

Thêm 1 cột `DestinationContent.DynamicBlocksJson` (nvarchar(max), dạng map
`{blockKey: html}`) thay vì nhiều cột `*CardsHtml` riêng (không cần migration
DB mỗi khi thêm loại khối mới):
```json
{
  "hotels": "<div class=\"grid ...\">...</div>",
  "tours": "<div ...>...</div>",
  "transports": "<div ...>...</div>",
  "souvenirProducts": "<div ...>...</div>",
  "articleLinkItinerary": "<a href=\"/blog/...\">Xem lịch trình chi tiết →</a>",
  "articleLinkFood": "<a href=\"/blog/...\">Xem thêm: ... →</a>",
  "articleLinkSouvenir": "...", "articleLinkNightlife": "...",
  "articleLinkPoiGuide": "..."
}
```
(1 blockKey cho mỗi topic của `ArticleDestinationMap` — bộ topic đầy đủ:
`article-spec.md` §8.1; bake lại khi bài gắn map được publish/gỡ.)
Website (Razor) chỉ quyết định VỊ TRÍ từng khối trong layout
(`@Html.Raw(content.DynamicBlocksJson["hotels"])` đúng chỗ đã định ở
`content-seo-ux-plan.md` §2/§10.6.2) — không còn JOIN/query sống cho bất kỳ
khối nào trong danh sách trên, kể cả Product (§8 dưới — nhờ vậy Product
**không cần đồng bộ SQL Server/tag-map riêng**, zinoflow tính HTML thẳng từ
Postgres `products`/`tags` lúc bake).

**Trigger tính lại HTML** (tái dùng đúng cơ chế Article "Làm mới khối động",
không xây job mới):
1. Lúc publish/republish destination (như `RelatedJson`).
2. Trigger theo chiều ngược — khi 1 Hotel/Tour/Transport/Product nguồn đổi
   giá/rating/mapping/tag, quét mọi destination liên quan (qua
   `*_destination_map` hoặc tag khớp) và bake lại đúng `blockKey` đó (không
   bake lại toàn bộ `DynamicBlocksJson`, chỉ key bị ảnh hưởng).
3. Nút "Làm mới khối động" thủ công ở màn sửa điểm đến (giống Article) — dùng
   khi cần ép bake lại ngay, không đợi trigger tự động.

⚠️ **Đánh đổi cần biết** (không phải lý do từ chối, chỉ cần lường trước): đổi
giao diện card (CSS/layout) sau này KHÔNG tự áp dụng cho HTML đã bake trước đó
— phải chạy job bake lại toàn bộ khi đổi template, khác cách JSON-thuần (chỉ
sửa 1 Razor partial là áp dụng ngay mọi trang). Chấp nhận đánh đổi này để lấy
tốc độ tối đa (ưu tiên đã chọn 07/2026).

**URL vẫn giữ PHẲNG bất kể độ sâu cây** (chốt 07/2026 — chi tiết + lý do đầy đủ
xem `content-seo-ux-plan.md` §10.7): `/diem-den/{slug}`, KHÔNG nhúng đường dẫn
cha/cụm/tỉnh vào URL. Cấp bậc truyền tải qua Breadcrumb + JSON-LD
`BreadcrumbList` dùng `AncestorsJson` ở trên, không phải qua cấu trúc URL.

---

## 4) Schema mới (DDL)

### 4.1 `Province` — 34 tỉnh/thành sau sáp nhập
```sql
CREATE TABLE Province (
  Id            int IDENTITY PRIMARY KEY,
  Slug          varchar(64)  NOT NULL UNIQUE,
  Name          nvarchar(128) NOT NULL,
  Region        tinyint      NOT NULL,        -- 1 Bắc, 2 Trung, 3 Nam
  OldNames      nvarchar(512) NULL,           -- "Quảng Nam, Đà Nẵng" (tỉnh cũ gộp vào)
  DestinationId int NULL,                     -- dòng Destination Kind=province tương ứng
  [Order]       int NOT NULL DEFAULT 0
);
```

### 4.2 `Destination` — bảng nóng (chỉ cột cần cho list/card/filter)

Cập nhật 07/2026: bỏ cột `BookingUrl` (1 link) khỏi bảng này — chuyển thành danh
sách nhiều link (`TicketLinksJson`) trên `DestinationContent` (§4.3), vì cùng đặc
điểm với `FaqJson`/`RelatedJson`: dữ liệu có cấu trúc lặp (nhiều dòng), chỉ trang
detail cần, không dùng để lọc/sort ở trang danh sách.

```sql
CREATE TABLE Destination (
  Id            int IDENTITY PRIMARY KEY,
  Slug          varchar(64)   NOT NULL,       -- giữ NGUYÊN giá trị slug cũ → URL không đổi
  Kind          tinyint       NOT NULL,       -- 1 province, 2 cluster, 3 poi
  ParentId      int NULL,                     -- cây du lịch (§3.1)
  ProvinceId    int NULL,                     -- shortcut lọc theo tỉnh (null với Kind=province)
  PrimaryTypeId int NULL,
  Name          nvarchar(128) NOT NULL,
  NameUnaccented varchar(128) NOT NULL,       -- persisted, phục vụ search (§6)
  ShortDescription nvarchar(500) NOT NULL,    -- card + meta description fallback
  Thumbnail     varchar(256)  NULL,           -- LƯU CỘT, không suy từ slug nữa
  Lat           decimal(9,6)  NULL,
  Lng           decimal(9,6)  NULL,
  AddressNew    nvarchar(256) NULL,           -- địa chỉ sau sáp nhập (hiển thị chính + JSON-LD)
  AddressOld    nvarchar(256) NULL,           -- website hiển thị CẢ HAI (spec §13.3); build từ mapping dvhcvn
  ContactPhone  varchar(32)   NULL,
  ContactWebsite varchar(256) NULL,
  ContactFacebook varchar(256) NULL,           -- THÊM LẠI 07/2026 (đảo quyết định cũ dưới) — link Fanpage chính chủ, nguồn tham khảo cho người đọc (ảnh mới/giờ đóng cửa đột xuất), KHÔNG phải kênh kinh doanh của DiChoiThoi nên không xung đột affiliate
  HotelGroupId  nvarchar(50)  NULL,           -- LEGACY/fallback — thay bằng bảng HotelDestinationMap (dichoithoi-hotel-spec.md §4, sửa 07/2026), giữ tạm khi chuyển đổi rồi bỏ
  IsFeatured    bit NOT NULL DEFAULT 0,       -- thay cho "load cả bảng rồi Take"
  DistanceFromCenter decimal(6,2) NULL,       -- km tới trung tâm cụm/tỉnh cha — phục hồi từ schema cũ (destination-spec §... cột Order/DistanceFromCenter), bị rớt lúc thiết kế lại; dùng để tự nhóm ChildrenJson theo khu vực (trung tâm/ngoại ô gần/xa) trên trang Flagship (content-seo-ux-plan §10.6.1)
  [Order]       int NOT NULL DEFAULT 0,
  Status        tinyint NOT NULL DEFAULT 1,   -- 0 draft, 1 published, 2 hidden
  ContentSource tinyint NOT NULL DEFAULT 0,   -- 0 tay, 1 AI
  ChildCount    smallint NOT NULL DEFAULT 0,  -- counter cache, AI tool cập nhật lúc ghi
  ReviewCount   smallint NOT NULL DEFAULT 0,
  AvgRating     decimal(3,2) NULL,
  CreatedAt     datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt     datetime2 NOT NULL DEFAULT SYSUTCDATETIME()  -- "cập nhật tháng X/2026"
);
CREATE UNIQUE INDEX UX_Destination_Slug ON Destination(Slug);
CREATE INDEX IX_Destination_Province ON Destination(ProvinceId, Status, Kind)
  INCLUDE (Slug, Name, ShortDescription, Thumbnail, PrimaryTypeId, [Order]);
CREATE INDEX IX_Destination_Parent   ON Destination(ParentId, Status)
  INCLUDE (Slug, Name, ShortDescription, Thumbnail, [Order]);
CREATE INDEX IX_Destination_Featured ON Destination(IsFeatured, [Order])
  WHERE IsFeatured = 1;
```
`INCLUDE` biến các index trên thành **covering index**: trang danh sách/tỉnh/cha-con
trả thẳng từ index, không lookup về bảng.

**Đảo lại 1 phần quyết định cũ (07/2026)**: `ContactFacebook` đã THÊM LẠI ở
§4.2 trên — quyết định gốc lẫn 2 việc khác nhau ("kênh liên hệ kinh doanh của
DiChoiThoi" — đúng là không cần, khác "link Fanpage chính chủ điểm đến làm
nguồn tham khảo cho người đọc" — giống vai trò `ContactWebsite`, nên giữ lại).
Mục tiêu ưu tiên: cung cấp thông tin hữu ích nhất cho người đọc, kiếm tiền hài
hoà — không phải cắt bớt thông tin chỉ vì không trực tiếp ra tiền.

**Vẫn KHÔNG thêm** (giữ nguyên lý do gốc): `ContactZalo` — mang tính "nhắn tin
liên hệ trực tiếp" hơn là nguồn tham khảo công khai, giá trị thông tin thấp
hơn Website/Fanpage với người đọc chưa từng liên hệ; có thể thêm sau nếu thực
tế nhiều điểm đến dùng Zalo làm kênh chính. Dữ liệu "thời điểm đẹp" có cấu trúc
(vd `BestMonths` cho landing theo mùa — giữ dạng văn xuôi trong `ContentHtml`,
không thêm cột/model mới vì chưa có nhu cầu landing theo mùa cụ thể) vẫn không
thêm, không liên quan quyết định trên.

### 4.3 `DestinationContent` — bảng lạnh (chỉ trang detail đọc), 1-1
```sql
CREATE TABLE DestinationContent (
  DestinationId  int PRIMARY KEY,             -- PK = FK, 1-1
  ContentHtml    nvarchar(max) NOT NULL,      -- HTML HOÀN CHỈNH: đã sanitize + auto-link lúc publish
  OpeningTime    nvarchar(512) NULL,          -- quick-facts card (render khối riêng)
  TicketPrice    nvarchar(512) NULL,
  Transport      nvarchar(max) NULL,
  Food           nvarchar(max) NULL,
  Tip            nvarchar(max) NULL,
  HotelText      nvarchar(max) NULL,
  FaqJson        nvarchar(max) NULL,          -- [{q,a}] → render FAQ + JSON-LD FAQPage (SEO)
  RelatedJson    nvarchar(max) NULL,          -- §3.4 — precomputed, render 0 join
  TicketLinksJson nvarchar(max) NULL,         -- [{provider,label,sourceUrl,affiliateUrl,linkStatus}] — nhiều link mua vé (Klook, TripVision...), thay BookingUrl 1 link cũ; affiliateUrl tính sẵn qua dichoithoi-affiliate-link-conversion-spec.md. Ke hoach them field "price" tuy chon/nullable (de xuat 07/2026, chua build — content-seo-ux-plan §5.5, affiliate-conversion-spec §2) — gia rieng tung nha cung cap, KHAC PriceBreakdownJson (gia chinh thuc dia diem quy dinh).
  GalleryJson    nvarchar(max) NULL,          -- [{path,altText,caption,credit}] — CÙNG TÊN FIELD với bảng soạn destination_images (Postgres, destination-spec §14.4) để khỏi phải map đổi tên; path TƯƠNG ĐỐI giống quy ước Thumbnail (base URL riêng, destination-spec §14.2). Vá gap 07/2026: content-seo-ux-plan §5.1 đã đề xuất gallery nhưng chưa có chỗ lưu để website render.
  TicketPriceFrom decimal(12,0) NULL,         -- vá gap 07/2026: giá số cho JSON-LD offers/priceRange (content-seo-ux-plan §6 #4) — TicketPrice vẫn giữ text tự do cho hiển thị, cột này CHỈ dùng khi giá quy về 1 con số được, NULL nếu không (vd giá theo gói)
  MetaTitle      nvarchar(150) NULL,          -- SEO do AI tool quản, hết string.Format ở controller
  MetaDescription nvarchar(300) NULL
);
```
**Kế hoạch thêm cột sau (đề xuất 07/2026, phân tích vai khách du lịch — CHƯA thêm
vào DDL thật, chỉ ghi nhận)**: `PriceBreakdownJson` (giá vé theo đối tượng —
`content-seo-ux-plan.md` §5.5) và `PracticalNotesJson` (bãi xe/nhà vệ sinh/an
toàn/quy định — §5.7), cùng dạng `nvarchar(max)` JSON như `FaqJson`. "Chi phí ước
tính" (§5.4) và "câu chuyện văn hoá" (§5.6) KHÔNG cần cột mới — xem 2 mục đó để
biết vì sao.

Cũng CHƯA thêm vào DDL thật (đề xuất 07/2026, phân tích cây phân cấp — xem §3.4):
`AncestorsJson` (`[{slug,name,kind}]` — breadcrumb precomputed, không query đệ
quy) và `ChildrenJson` (danh sách đầy đủ con trực tiếp, không cắt 8 mục như
`RelatedJson`) — cùng dạng `nvarchar(max)` JSON, cùng nguồn tính (`ParentId`,
`Kind`) đã có sẵn trên `Destination`.

Cũng CHƯA thêm vào DDL thật (THAY THẾ 07/2026 đề xuất `HotelCardsJson`/
`TourCardsJson` ban đầu — xem §3.4): `DynamicBlocksJson` (map `{blockKey:
html}` — HTML cuối cùng đã bake cho khối hotels/tours/transports/
souvenirProducts/articleLink..., THAY query sống hiện tại của website qua
`V2HotelDestinationMap`/`V2TourDestinationMap` JOIN `V2Hotel`/`V2Tour` ORDER BY
Rating). Đây là việc SỬA (đổi từ live query sang bake HTML sẵn), không phải
thêm tính năng mới — chi tiết đầy đủ ở §3.4.

Về review (`AvgRating`/`ReviewCount` đã có sẵn cột cache trên `V2Destination`
— redesign §4.2/`V2Destination.cs`): đề xuất SỬA CÁCH GHI, không cần cột mới —
hiện website đang load TOÀN BỘ list review rồi tính `.Average()` mỗi lần render
(`DestinationExtrasRepository.GetExtrasBySlugAsync`), đúng ra phải UPDATE 2 cột
cache này NGAY lúc ghi review mới (website là single-writer của bảng Review —
system-design §5 mục 2, ngoại lệ duy nhất website được ghi), rồi trang detail
đọc thẳng 2 cột cache, KHÔNG tính `.Average()` lúc render. Chỉ query full list
review riêng khi cần hiện chi tiết từng review (tách khỏi phần trên, không
chặn render phần chính).

Phân tích "chi tiết nên lưu thế nào" — 3 lựa chọn đã cân nhắc:
1. *Tất cả thành 1 HTML*: render nhanh nhất nhưng mất khả năng hiện quick-facts
   thành card/bảng riêng + không cập nhật lẻ giá vé.
2. *Tất cả thành JSON blocks*: linh hoạt nhưng render phải parse + map template,
   chậm hơn và website phức tạp hơn.
3. ✅ *Hybrid (chọn)*: thân bài dài = `ContentHtml` đã render sẵn (đọc là in ra);
   dữ liệu có cấu trúc lặp lại (FAQ, related) = JSON nhỏ; quick-facts hay đổi
   và hiển thị dạng card (giá vé, giờ mở cửa...) = cột riêng — update lẻ được,
   tương lai còn dùng cho so sánh/lọc.

### 4.4 Loại điểm đến — 2 tầng (§3.2)
```sql
CREATE TABLE DestinationTypeGroup (
  Id      int IDENTITY PRIMARY KEY,
  Slug    varchar(64)  NOT NULL UNIQUE,        -- /loai/{slug} — trang nhóm (pillar)
  Name    nvarchar(128) NOT NULL,
  [Order] int NOT NULL DEFAULT 0
);
CREATE TABLE DestinationType (
  Id      int IDENTITY PRIMARY KEY,
  GroupId int NOT NULL REFERENCES DestinationTypeGroup(Id),
  Slug    varchar(64)  NOT NULL UNIQUE,        -- /loai/{groupSlug}/{slug} — trang loại cụ thể (cluster)
  Name    nvarchar(128) NOT NULL,
  [Order] int NOT NULL DEFAULT 0
);
CREATE INDEX IX_DestinationType_Group ON DestinationType(GroupId, [Order]);
CREATE TABLE DestinationTypeMap (
  DestinationId int NOT NULL,
  TypeId        int NOT NULL,
  PRIMARY KEY (TypeId, DestinationId)         -- thứ tự PK phục vụ "mọi điểm thuộc loại X"
);
```
Trang nhóm `/loai/{groupSlug}` query qua `DestinationType.GroupId` rồi
`DestinationTypeMap` (2 query nhỏ, hoặc 1 query JOIN — vẫn giữ nguyên tắc
≤2 query/trang ở §2.2); trang loại cụ thể `/loai/{groupSlug}/{typeSlug}` query
thẳng `DestinationTypeMap WHERE TypeId=@id`.

### 4.5 Quan hệ + redirect
```sql
CREATE TABLE DestinationRelation (
  SourceId     int NOT NULL,
  TargetId     int NOT NULL,
  RelationType tinyint NOT NULL,              -- 1 nearby, 2 related, 3 mentioned (§3.3)
  Weight       smallint NOT NULL DEFAULT 0,   -- nearby: khoảng cách m; related: độ ưu tiên
  IsAuto       bit NOT NULL DEFAULT 1,
  CreatedAt    datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
  PRIMARY KEY (SourceId, RelationType, TargetId)
);
CREATE INDEX IX_Relation_Target ON DestinationRelation(TargetId, RelationType); -- "ai nhắc tới X" (re-link)

CREATE TABLE SlugRedirect (
  OldSlug       varchar(64) PRIMARY KEY,
  DestinationId int NOT NULL
);                                             -- 301 khi đổi slug, bảo toàn SEO
```

### 4.6 `DestinationReview` — giữ nguyên cấu trúc, sửa FK
Đổi `DestinationId nvarchar(128)` → `int` FK; thêm index
`(DestinationId, IsApproved) INCLUDE (Name, Rating, Comment, DateCreated)`.
`ReviewCount`/`AvgRating` trên Destination cập nhật khi duyệt review (counter cache).

### 4.7 Bị loại bỏ
`Area`, `District` (hành chính cũ), `DestinationGroup` (gộp vào cây Destination),
cột flags `IsGroup/IsArea/IsProvince`, cột CSV `Type`, các cột denormalize
`ProvinceName`/`DestinationGroupName`.

---

## 5) Website mới render thế nào (mapping trang → query)

| Trang | Query | Index dùng |
|---|---|---|
| Detail `/diem-den/{slug}` | 1: `Destination JOIN DestinationContent WHERE Slug=@s` (FAQ/related từ JSON trong cùng dòng) | UX_Slug |
| — reviews (dưới fold) | lazy load query 2 hoặc defer AJAX | IX review |
| Trang tỉnh | con TRỰC TIẾP (drill-down 1 tầng, giống trang cluster): `WHERE ParentId=@provinceId AND Status=1` — **KHÔNG dùng `ProvinceId`** (sửa 07/2026: `ProvinceId` là field "tắt" gắn trên mọi destination trong tỉnh bất kể tầng sâu bao nhiêu, dùng để query con sẽ trộn lẫn cluster + poi cháu vào 1 danh sách, sai mô hình drill-down — xem `content-seo-ux-plan.md` §10.6.1) | IX_Parent (covering) |
| Trang cluster | `WHERE ParentId=@id AND Status=1` | IX_Parent (covering) |
| Home / Top | `WHERE IsFeatured=1 ORDER BY [Order]` | IX_Featured (filtered) |
| Trang nhóm loại `/loai/{groupSlug}` | `DestinationType WHERE GroupId=@g` → `TypeMap JOIN Destination` | IX_DestinationType_Group |
| Trang loại cụ thể `/loai/{groupSlug}/{typeSlug}` | `TypeMap JOIN Destination WHERE TypeId=@t` | PK(TypeId,...) |
| Search | in-memory (§6), 0 query | — |
| Slug cũ | miss UX_Slug → check SlugRedirect → 301 | PK |

Lớp cache phía .NET (giữ pattern IMemoryCache sẵn có): taxonomy (Province, Type)
cache vĩnh viễn + invalidate khi AI tool gọi webhook/endpoint refresh; trang detail
cache theo slug với sliding expiration như hiện tại; thêm response caching/ETag.

**Bổ sung 07/2026 (ràng buộc hosting SmarterASP .NET Advance — shared, không có
quyền root/Redis)**: thêm tầng 2 **Cloudflare (free tier)** làm CDN/edge cache
ngoài server, đặt trước IIS qua DNS — vì `IMemoryCache` mất theo mỗi lần IIS
Application Pool recycle (shared hosting recycle định kỳ), Cloudflare không bị
ảnh hưởng. Endpoint invalidate cache hiện có (gọi lúc publish — mục 3 dưới)
cần gọi THÊM Cloudflare Purge Cache API theo đúng URL vừa đổi, không chỉ xoá
`IMemoryCache` phía .NET. Chi tiết đầy đủ: `content-seo-ux-plan.md` §10.5.1.

## 6) Search nhanh
Quy mô vài nghìn điểm đến → **search trong memory** nhanh hơn mọi giải pháp DB:
app load `(Id, Slug, Name, NameUnaccented, Kind, ProvinceId, Thumbnail)` toàn bộ
(1 query lúc start, vài trăm KB), search prefix/contains trên RAM, refresh theo cache
invalidation. Cột `NameUnaccented` lưu sẵn (AI tool ghi) thay cho `RemoveUnicode()`
chạy mỗi request. Full-text index của SQL Server: không cần ở quy mô này — ghi nhận
là phương án khi data >50k dòng.

## 7) Migration từ DB cũ (1 lần, script bên repo dichoithoi)

Thứ tự (chạy trong transaction, sau khi backup):
1. Tạo bảng mới (tên mới hoặc schema `new.`), bảng cũ giữ nguyên cho tới khi
   website mới chạy ổn.
2. `Province`: nhập tay 34 tỉnh mới (kèm `OldNames` từ danh sách sáp nhập).
3. `Destination`:
   - dòng cũ `IsProvince=1` → `Kind=1`; map sang tỉnh MỚI (nhiều slug tỉnh cũ
     có thể cùng trỏ 1 tỉnh mới → giữ dòng làm cluster hoặc redirect — rà tay,
     danh sách nhỏ);
   - bảng `DestinationGroup` → dòng mới `Kind=2` (Thumbnail/ShortDescription mang theo);
   - còn lại → `Kind=3`, `ParentId` = cluster (từ DestinationGroupId) hoặc dòng tỉnh;
   - `Slug` = Id cũ (URL không đổi); `Thumbnail` = `{slug}.webp` (ghi tường minh
     giá trị mà trước đây hardcode); `Lat/Lng` parse decimal (log dòng parse fail);
     `ShortDescription` = Description cũ; `NameUnaccented` generate.
4. `Type` CSV: split distinct → seed `DestinationTypeGroup` (3 nhóm, §9.2) trước,
   rồi `DestinationType` (mỗi loại gán đúng `GroupId`) + `DestinationTypeMap`;
   giá trị xuất hiện nhiều nhất của mỗi điểm → `PrimaryTypeId`.
5. `DestinationDetail` → `DestinationContent` (Content cũ đã có sẵn link nội bộ —
   giữ nguyên; Phone cũ → `ContactPhone`; Hotel → HotelText). `RelatedJson`/`FaqJson`
   để NULL — job re-publish của AI tool điền dần.
6. `DestinationReview`: remap DestinationId slug → int qua bảng mới.
7. AI tool sync mirror từ schema mới; chạy job "re-link + recompute related" toàn bộ.
8. Website mới trỏ schema mới; chạy song song kiểm tra; sau 1-2 tuần drop bảng cũ.

Checklist an toàn: so `COUNT(*)` từng bảng trước/sau; spot-check 10 URL giữ nguyên
nội dung; sitemap diff = 0 URL mất.

## 8) Tác động tới AI tool (zinoflow)
1. Publisher (spec `dichoithoi-destination-spec.md`) ghi theo schema MỚI — thay thế
   hoàn toàn §11 của spec đó (phương án additive đã bị quyết định đại tu này thay thế).
2. Việc AI tool nhận thêm lúc publish: render ContentHtml hoàn chỉnh, tính
   `RelatedJson`, `NameUnaccented`, nearby từ lat/lng, cập nhật counter cache,
   gọi endpoint invalidate cache website.
3. Mirror Postgres phản chiếu schema mới (Id int + Slug).
4. Bảng quan hệ giờ nằm ở SQL Server làm nguồn render; AI tool vẫn giữ
   `destination_relations` (Postgres) làm nơi soạn/duyệt trước khi đồng bộ.
5. Ngoài nhóm bảng Destination ở tài liệu này, zinoflow còn ghi thêm 2 bảng mới
   bên SQL Server nằm NGOÀI phạm vi đợt này: `Hotel`/`HotelGroup` (giữ tên cũ,
   đổi ai ghi — `dichoithoi-hotel-spec.md`) và `Tour`/`TourDestinationMap` (mới
   hoàn toàn — `dichoithoi-tour-spec.md`). Cả 2 dùng chung cơ chế
   `sourceUrl → affiliateUrl` với `ticketLinks` ở §4.3
   (`dichoithoi-affiliate-link-conversion-spec.md`); bảng `affiliate_link_rules`
   chỉ tồn tại bên Postgres (zinoflow), KHÔNG cần đồng bộ xuống SQL Server vì
   website chỉ đọc `AffiliateUrl` đã tính sẵn.

## 9) Việc cần chốt tiếp (làm cùng nhau trước khi code)

✅ Toàn bộ 5 mục ở đây đã chốt/build xong từ lâu (giữ lại chỉ để tham khảo
lịch sử quyết định, không còn việc mở): map tỉnh cũ→mới qua dataset dvhcvn
(destination-spec §13); `DestinationType` 2 tầng thật trong DB — 3 nhóm/18
loại con (§3.2, §4.4, đã seed + build Phase 1); quy tắc trộn khối "liên quan"
(destination-spec §12.3 pha 2); giữ .NET cho website, chỉ đổi tầng đọc; Hotel/
Tour làm cùng Giai đoạn 1 (không phải giai đoạn 3 như dự kiến ban đầu). Trạng
thái/việc còn mở mới nhất: xem `dichoithoi-backlog.md`.
