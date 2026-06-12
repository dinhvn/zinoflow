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

### 3.2 Cùng loại (biển, núi, chùa, phố cổ...)
- `DestinationType` (int PK, slug — mở được trang landing `/loai/bien-dao`).
- `DestinationTypeMap` (DestinationId, TypeId) — M:N thay CSV, lọc bằng index seek.
- `Destination.PrimaryTypeId` — loại chính để hiện badge/sort mà không join map.

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
  BookingUrl    varchar(512)  NULL,           -- affiliate vé online
  HotelGroupId  nvarchar(50)  NULL,           -- nối module hotel hiện có (đại tu sau)
  IsFeatured    bit NOT NULL DEFAULT 0,       -- thay cho "load cả bảng rồi Take"
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
  MetaTitle      nvarchar(150) NULL,          -- SEO do AI tool quản, hết string.Format ở controller
  MetaDescription nvarchar(300) NULL
);
```
Phân tích "chi tiết nên lưu thế nào" — 3 lựa chọn đã cân nhắc:
1. *Tất cả thành 1 HTML*: render nhanh nhất nhưng mất khả năng hiện quick-facts
   thành card/bảng riêng + không cập nhật lẻ giá vé.
2. *Tất cả thành JSON blocks*: linh hoạt nhưng render phải parse + map template,
   chậm hơn và website phức tạp hơn.
3. ✅ *Hybrid (chọn)*: thân bài dài = `ContentHtml` đã render sẵn (đọc là in ra);
   dữ liệu có cấu trúc lặp lại (FAQ, related) = JSON nhỏ; quick-facts hay đổi
   và hiển thị dạng card (giá vé, giờ mở cửa...) = cột riêng — update lẻ được,
   tương lai còn dùng cho so sánh/lọc.

### 4.4 Loại điểm đến
```sql
CREATE TABLE DestinationType (
  Id    int IDENTITY PRIMARY KEY,
  Slug  varchar(64)  NOT NULL UNIQUE,         -- /loai/{slug}
  Name  nvarchar(128) NOT NULL,
  [Order] int NOT NULL DEFAULT 0
);
CREATE TABLE DestinationTypeMap (
  DestinationId int NOT NULL,
  TypeId        int NOT NULL,
  PRIMARY KEY (TypeId, DestinationId)         -- thứ tự PK phục vụ "mọi điểm thuộc loại X"
);
```

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
| Trang tỉnh | con trực thuộc: `WHERE ProvinceId=@p AND Status=1` | IX_Province (covering) |
| Trang cluster | `WHERE ParentId=@id AND Status=1` | IX_Parent (covering) |
| Home / Top | `WHERE IsFeatured=1 ORDER BY [Order]` | IX_Featured (filtered) |
| Trang loại `/loai/{slug}` | `TypeMap JOIN Destination` | PK(TypeId,...) |
| Search | in-memory (§6), 0 query | — |
| Slug cũ | miss UX_Slug → check SlugRedirect → 301 | PK |

Lớp cache phía .NET (giữ pattern IMemoryCache sẵn có): taxonomy (Province, Type)
cache vĩnh viễn + invalidate khi AI tool gọi webhook/endpoint refresh; trang detail
cache theo slug với sliding expiration như hiện tại; thêm response caching/ETag.

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
4. `Type` CSV: split distinct → `DestinationType` + `DestinationTypeMap`;
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

## 9) Việc cần chốt tiếp (làm cùng nhau trước khi code)
1. ~~Danh sách map tỉnh cũ → 34 tỉnh mới (rà tay)~~ **ĐÃ CÓ GIẢI PHÁP 12/06/2026**:
   seed dataset dvhcvn (provinces/wards/ward_mappings) vào Postgres của AI tool —
   map tỉnh + phường tự động, chỉ rà các dòng match mờ.
   Chi tiết: `dichoithoi-destination-spec.md` §13.
2. Bộ `DestinationType` chuẩn — **ĐỀ XUẤT 12/06/2026** (đối chiếu với giá trị CSV
   thật lúc migration §7.4, dòng nào không map được thì bổ sung/gộp):

   | Nhóm thiên nhiên | Nhóm văn hóa - lịch sử | Nhóm vui chơi - trải nghiệm |
   |---|---|---|
   | bien-dao (biển - đảo) | di-tich-lich-su | khu-vui-choi (công viên/giải trí) |
   | nui-cao-nguyen | chua-den (chùa - đền - miếu) | check-in-song-ao |
   | thac-ho-suoi | nha-tho | cho-pho-dem (chợ - phố đêm) |
   | hang-dong | lang-nghe-truyen-thong | am-thuc (khu/phố ẩm thực) |
   | rung-vuon-quoc-gia | bao-tang | pho-co-pho-di-bo |
   | dong-que-mien-tay (sông nước) | cong-trinh-kien-truc | nghi-duong (resort/suối khoáng) |

   18 loại, slug không dấu làm `DestinationType.Slug` (mở trang `/loai/{slug}`),
   tên có dấu hiển thị. Mỗi điểm 1-3 loại, loại đầu = PrimaryTypeId.
3. ~~Quy tắc trộn khối "liên quan"~~ **ĐÃ DUYỆT 12/06/2026** theo mặc định ở
   `dichoithoi-destination-spec.md` §12.3 pha 2: con trực tiếp (max 4) → related
   curated → nearby → anh em cùng cha → cùng loại cùng tỉnh; dedupe, published,
   đủ 8 mục. (Chỉnh được sau qua config, không cần đổi schema.)
4. ~~Website mới: giữ .NET hay đổi stack?~~ **ĐÃ CHỐT 12/06/2026: giữ .NET**,
   chỉ sửa tầng đọc theo schema mới; vai trò CMS chuyển sang AI tool —
   xem `dichoithoi-system-overview.md`.
5. Module Hotel/Tour nối vào cây mới thế nào — đại tu đợt 2
   (giai đoạn 3 trong system overview).
