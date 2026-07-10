# Dichoithoi Article — bài viết tổng hợp / cẩm nang (spec tạo 07/2026)

Loại bài MỚI, khác Destination: không mô tả 1 điểm đến, mà **tổng hợp nhiều nơi
theo 1 chủ đề** — vd "Các con thác đẹp tại Việt Nam", "Khách sạn đẹp tại Đà Lạt",
"Món ăn ngon nhất Hà Nội", "1 ngày ở TP.HCM đi đâu ăn gì". Vai trò: kéo traffic
tìm kiếm thông tin (đầu phễu), và là nơi lý tưởng để internal-link hàng loạt tới
bài điểm đến/khách sạn/tour → tăng topical authority + dwell time (bổ sung cho
[dichoithoi-content-seo-ux-plan.md](dichoithoi-content-seo-ux-plan.md)).

Yêu cầu cốt lõi (đầu bài 07/2026): trong bài có thể chèn **khối động** (tag) —
khi publish tự động thay bằng dữ liệu thật (vd danh sách thác) truy vấn từ
mirror, KHÔNG liệt kê tay từng dòng và không lo lạc hậu khi có điểm mới.

## 1) Tái dùng pipeline ai-content — không xây module sinh bài mới

Giống quyết định đã áp dụng cho Destination
([dichoithoi-destination-spec.md](dichoithoi-destination-spec.md) §3.1): Article
là 1 content type mới chạy trên pipeline sẵn có — ContentJob, state machine,
draft/review/version, generate 3 bước (chỉ đổi prompt pack + output schema),
quality gates (bộ mới, §6).

Cái MỚI nằm ở 4 chỗ:
1. **Cơ chế khối động** (tag → HTML) — trọng tâm tài liệu này (§3-5).
2. **Publisher mới** `IArticlePublisher`, ghi vào bảng `Article` mới hoàn toàn
   bên SQL Server (chưa tồn tại, khác Destination/Hotel).
3. **UI**: chèn khối động trong editor, nút "Làm mới khối động".
4. **Luồng tạo bài kép — AI tự động HOẶC viết tay thủ công** (§1.1, yêu cầu
   thêm 07/2026) — đây là năng lực MỚI cho cả pipeline ai-content, không chỉ
   riêng Article, vì hiện tại KHÔNG có cách tạo draft mà không qua AI generate.

### 1.1 Hai luồng tạo bài: AI tự động vs viết tay thủ công

Đã soi code (`create-content-job.usecase.ts`, `content-job-state.ts`): hiện tại
**MỌI** job đều bắt buộc qua AI — `CreateContentJobUseCase` luôn tạo `ContentJob`
ở `Created` rồi enqueue pg-boss ngay (`GeneratingOutline` → gọi AI provider →
`DraftReady`). State machine không có transition nào cho `Created → DraftReady`
bỏ qua bước generate — nghĩa là "viết tay từ đầu, không đụng AI" là năng lực
CHƯA TỒN TẠI, cần xây mới ở tầng module `ai-content` (không phải chỉ trong
module destination/article), vì đây là hạ tầng dùng chung. Article là content
type ĐẦU TIÊN cần năng lực này (destination/affiliate hiện luôn qua AI).

**Thiết kế bổ sung** (ghi song song ở `docs/specs/ai-content-technical-spec.md`
§4.1/§5 để không lệch giữa 2 tài liệu):
1. Thêm giá trị `sourceType = Manual` (cạnh `Topic`/`Campaign`/`ProductSet`).
2. Use case mới `CreateManualDraftUseCase`: tạo `ContentJob` với `sourceType=
   Manual` đi THẲNG `Created → DraftReady` (transition mới, chỉ áp dụng khi
   `sourceType=Manual`) — KHÔNG enqueue pg-boss, KHÔNG gọi AI provider. Tạo kèm
   `ContentDraftEntity` version 1 với nội dung khởi tạo: 1 template rỗng có gợi
   ý cấu trúc (H1 = tiêu đề người dùng nhập, vài dòng comment gợi ý "chèn khối
   động ở đây" theo §3) — không phải trang trắng hoàn toàn, dễ bắt đầu hơn.
3. Sau `DraftReady`, MỌI THỨ dùng NGUYÊN luồng đã có, không phân biệt nguồn gốc
   AI hay tay: sửa nội dung qua `UpdateDraftUseCase` (đã hỗ trợ tốt — mỗi lần
   sửa tạo version mới, tự chuyển `Approved → InReview` nếu sửa sau khi đã
   duyệt), quality gates (§6), Approve, Publish. Bài viết tay PHẢI qua ĐỦ gate
   giống bài AI — không có đường tắt bỏ qua kiểm tra chỉ vì "người viết tay".
4. UI tạo bài (`/dichoithoi/articles/new` hoặc tương đương): 2 lựa chọn ngay từ
   đầu — **"Tạo bằng AI"** (form hiện có: chủ đề, input, chọn provider/model,
   đi qua generate 3 bước) hoặc **"Viết tay"** (chỉ nhập tiêu đề + slug gợi ý →
   mở thẳng editor với template khởi tạo ở mục 2). Cả 2 hội tụ về cùng 1 editor/
   review UI (`/content/[id]`) ngay sau khi có `DraftReady`.
5. MVP có thể để dở: cho phép chuyển từ "Viết tay" sang nhờ AI viết tiếp/viết
   lại 1 phần (vd bôi đen đoạn, AI mở rộng) — đây là tính năng hay nhưng KHÔNG
   bắt buộc cho MVP, ghi nhận làm giai đoạn sau nếu cần.

### 1.2 Ô "Tư liệu tham khảo" trong form tạo bài bằng AI (CHỐT 07/2026)

Giống mẫu đã duyệt ở Destination (`dichoithoi-destination-spec.md` §2.2.1):
thêm 1 ô nhập tự do, KHÔNG bắt buộc, trong form **"Tạo bằng AI"** (§1.1 mục 4)
— người dùng dán trải nghiệm/danh sách/giá thật đã biết (vd "Quán bún đậu ở
đây ngon nhất, giá 50k/suất, mở 10h-22h"). Prompt ràng buộc: *"Tư liệu này là
nguồn ưu tiên 1 — PHẢI dùng đúng chi tiết đã cho, KHÔNG được bịa thêm sự kiện/
số liệu ngoài tư liệu và dữ liệu điểm đến liên quan đã có"* — cùng nguyên tắc
"AI không bịa dữ liệu cứng" áp dụng xuyên suốt dự án.

Lưu cùng `ContentJob` (không phải field riêng trên `Article`) để xem lại lúc
review và dùng lại khi bấm "Làm mới khối động"/viết lại bài. Không bắt buộc
điền — bỏ trống thì AI viết dựa trên kiến thức + dữ liệu mirror như bình
thường, giống hành vi hiện tại.

## 2) Chọn Cách 1 (precompute lúc publish) — xác nhận hướng bạn đề xuất

Cách 1 (replace token → HTML lúc publish, lưu HTML tĩnh) là lựa chọn ĐÚNG,
nhất quán với nguyên tắc "ghi đắt, đọc rẻ" áp dụng xuyên suốt hệ thống này
(`RelatedJson` precompute — database-redesign §3.4; affiliate link conversion
precompute — `dichoithoi-affiliate-link-conversion-spec.md` §6). Cách 2 (resolve
lúc render) vi phạm nguyên tắc "website chỉ SELECT" — thêm query + xử lý mỗi
request cho MỌI bài cẩm nang, trong khi dữ liệu nhúng (danh sách thác, khách
sạn...) không đổi từng phút — không đáng đánh đổi tốc độ để lấy độ mới không
cần thiết (đúng như bạn nhận xét).

### 2.1 Hai bản nội dung
- `RawContent` — nội dung gốc CÓ chứa token khối động; đây là bản EDIT/VERSION
  thật (draft, review, mọi lần sửa) — nằm ở Postgres, giống mọi draft khác.
- `ContentHtml` — nội dung ĐÃ compile (token → HTML thật); đây là bản DUY NHẤT
  website đọc — giống hệt cách `ContentHtml` của Destination hoạt động.

## 3) Cú pháp khối động

```
[[block:destinations type=thac-ho-suoi limit=8 sort=featured]]
[[block:destinations type=thac-ho-suoi province=lam-dong limit=6]]
[[block:hotels province=lam-dong limit=6]]
[[block:tours destination=da-lat limit=4]]
[[block:destination slug=thac-datanla]]   -- 1 điểm cụ thể, card đơn lẻ inline
[[block:products tag=leu-trai,giay-di-bo limit=4]]   -- sản phẩm affiliate theo tag (đề xuất 07/2026, xem dichoithoi-product-spec.md)
[[block:product id=xxx-xxx-xxx]]          -- 1 sản phẩm cụ thể, card đơn lẻ inline
```

- Mỗi token nằm RIÊNG 1 dòng trong markdown nguồn (không lồng trong đoạn văn) —
  đơn giản hoá parser, tránh phá cấu trúc khi replace.
- Tham số lọc theo taxonomy đã có: `type` (`DestinationType.Slug`), `province`
  (`Province.Slug`), `destination` (slug cha, cho tour/hotel gắn theo điểm cụ
  thể). `limit` mặc định 8, TỐI ĐA 12 (tránh nhúng danh sách khổng lồ). `sort`:
  `featured` | `newest` | `order` (mặc định `featured`).

### 3.1 Loại khối hỗ trợ (MVP)

| Block | Query nguồn | Card render |
|---|---|---|
| `destinations` | mirror/SQL Server theo Type/Province/ParentId | giống card "điểm đến liên quan" |
| `hotels` | bảng Hotel (`dichoithoi-hotel-spec.md`) theo Province | giống card "khách sạn gợi ý" |
| `tours` | bảng Tour (`dichoithoi-tour-spec.md`) theo destination/Province | giống card "tour gợi ý" |
| `destination` (số ít) | 1 slug cụ thể | card đơn — dùng khi nhắc 1 nơi giữa đoạn văn |
| `products` *(đề xuất 07/2026, chưa build)* | bảng `products` theo `tag` (OR, khớp bất kỳ) + `category` tuỳ chọn | card sản phẩm affiliate — xem `dichoithoi-product-spec.md` §4 |
| `product` (số ít) *(đề xuất 07/2026, chưa build)* | 1 `id` cụ thể | card đơn — dùng khi nhắc 1 sản phẩm giữa đoạn văn |
| `foodSpots` *(CHỐT 07/2026, chưa build)* | **KHÔNG tạo bảng mới** — dùng lại bảng `products` (product-spec §4), lọc `category IN ('Quán ăn','Ẩm thực', ...)` (free-text category đã có sẵn, không cần bảng "quán ăn" riêng) theo `province`/`destination` | card món ăn/quán ăn — layout riêng (ảnh + tên quán + món đặc trưng), khác card sản phẩm mua-mang-về mặc định |

`foodSpots` chỉ là 1 CÁCH RENDER khác của cùng dữ liệu `products` (giống
`destinations` vs `destination` số ít) — không phải module/bảng mới, giữ đúng
nguyên tắc "tái dùng trước khi tạo mới" (copilot-instructions §4).

## 4) Thuật toán compile (lúc Approve→Publish HOẶC bấm "Làm mới khối động")

1. Parse `RawContent`, tìm mọi dòng khớp `[[block:...]]`.
2. Validate tham số (type/province/slug có tồn tại trong mirror không) — không
   hợp lệ → CHẶN publish, hiện lỗi rõ ràng ở màn review (không để lọt token vỡ
   ra production).
3. Với token hợp lệ: query mirror lấy danh sách (đủ field render card: slug,
   name, thumbnail, badge, priceFrom/rating nếu hotel/tour) → render HTML card
   theo template CHUNG (§5) → thay token bằng khối HTML.
4. Ghép lại → `ContentHtml` hoàn chỉnh → publish (UPSERT `Article.ContentHtml`).
5. Token hợp lệ nhưng **0 kết quả** → KHÔNG render section rỗng (bỏ hẳn khối
   khỏi HTML, không để "tiêu đề trơ trọi không có gì bên dưới"), NHƯNG ghi vào
   report + cảnh báo ở màn review ("khối X trả về 0 kết quả — kiểm tra tham số
   hoặc bỏ khối") để người dùng biết mà sửa, không âm thầm mất 1 đoạn.

## 5) Card HTML dùng chung — tránh lệch giao diện

Khác `RelatedJson` (website tự render từ JSON), khối động ở đây compile thẳng
ra HTML — cần 1 "hợp đồng markup" cố định: zinoflow giữ 1 bộ TEMPLATE CARD
trong code (không để AI tự sinh markup tuỳ tiện), dùng đúng cấu trúc/class CSS
mà website đã style sẵn cho card điểm đến/hotel/tour. Đổi giao diện website sau
này → chạy job "biên dịch lại toàn bộ bài có khối động" (§7) để đồng bộ, không
sửa từng bài tay.

## 6) Quality gate riêng cho Article (bổ sung bộ travel gates)

1. Mọi token phải parse được và resolve theo §4 bước 2 (không lỗi cú pháp/tham
   số) trước khi Approve.
2. Structure: có intro, ≥1 khối động HOẶC danh sách tay tương đương (không bắt
   buộc tuyệt đối — vd bài "1 ngày ở TP.HCM" có thể pha trộn văn xuôi + khối
   động, không nhất thiết toàn khối); MỖI khối động phải có ≥1 dòng H2/H3 giới
   thiệu ngay phía trên (bổ sung 07/2026 — tốt cho SEO listicle, xem
   `dichoithoi-content-seo-ux-plan.md` §8.3), không để token đứng trơ trọi.
3. SEO: giữ nguyên nguyên tắc chung (keyword trong H1/intro, description, slug
   hợp lệ) — tái dùng gate đã có ở destination-spec §6.

## 7) "Làm mới khối động" — khác "Cập nhật bài" (mode=update)

Phân biệt rõ 2 hành động (dễ nhầm):
- **"Cập nhật bài" (mode=update)**: chạy lại AI, viết lại VĂN BẢN — dùng khi
  nội dung prose cần thay đổi (đúng luồng destination-spec §2.1 mode=update,
  có review/approve lại).
- **"Làm mới khối động"** (mới, riêng Article): KHÔNG gọi AI, chỉ re-compile
  `RawContent` hiện tại (văn bản giữ nguyên) → query lại dữ liệu mới nhất →
  publish đè `ContentHtml`. KHÔNG cần qua review lại (văn bản không đổi, chỉ
  danh sách nhúng đổi) — vẫn ghi `PublishRecord` (ai bấm, lúc nào) để audit.
- **Batch "Làm mới toàn bộ bài có khối động"** ở màn Công cụ (cùng khuôn mẫu
  job re-link/recompute — destination-spec §12): chạy sau khi thêm điểm đến/
  khách sạn/tour mới, hoặc định kỳ, hoặc tự động hẹp sau publish 1 điểm đến mới
  (chỉ làm mới các bài có khối khớp type/province của điểm vừa thêm).

## 8) Data model

**Postgres (zinoflow)**: tái dùng `content_drafts` hiện có — chỉ thêm giá trị
`articleType` mới (vd `listicle`), KHÔNG cần bảng riêng cho việc soạn thảo.
`RawContent` (có token) là nội dung draft bình thường, mọi version giữ nguyên
cơ chế đã có.

**SQL Server (mới hoàn toàn — chưa tồn tại, khác Destination/Hotel/Tour)**:
```sql
CREATE TABLE Article (
  Id               int IDENTITY PRIMARY KEY,
  Slug             varchar(128)  NOT NULL UNIQUE,   -- /blog/{slug}
  Title            nvarchar(200) NOT NULL,
  ShortDescription nvarchar(500),
  Thumbnail        varchar(256),
  ContentHtml      nvarchar(max) NOT NULL,           -- ĐÃ compile khối động — website chỉ đọc field này
  MetaTitle        nvarchar(150),
  MetaDescription  nvarchar(300),
  Status           tinyint NOT NULL DEFAULT 1,       -- 0 draft, 1 published, 2 hidden
  PublishedAt      datetime2,
  UpdatedAt        datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);
```
`RawContent` KHÔNG lưu xuống SQL Server — theo nguyên tắc "Postgres = xưởng
soạn, SQL Server = read-model" đã chốt (`dichoithoi-system-overview.md` §2.1):
mọi version + token gốc nằm ở Postgres draft; SQL Server chỉ giữ bản
`ContentHtml` cuối cùng đã compile, đúng cái website cần in ra.

### 8.1 Quan hệ NGƯỢC — Article → Destination (CHỐT 07/2026)

Khác với §3 (khối `[[block:...]]` NHÚNG card destination/hotel/tour VÀO TRONG
bài) — đây là chiều ngược lại: trang điểm đến cần biết **có bài cẩm nang nào
viết về mình** để hiện link ra (vd khối "lịch trình gợi ý" hoặc "ăn gì đặc
trưng" trên trang Đà Lạt hiện link sang bài "Lịch trình Đà Lạt 3N2D chi tiết"/
"Ẩm thực Đà Lạt" — xem `dichoithoi-content-seo-ux-plan.md` §5.2, §10.6.2 khối
6). 2 cơ chế độc lập, không thay thế nhau.

```sql
CREATE TABLE ArticleDestinationMap (
  ArticleId        int NOT NULL REFERENCES Article(Id),
  DestinationSlug  varchar(64) NOT NULL,   -- không FK cứng (khác site DB), giống pattern Hotel/TourDestinationMap
  Topic            varchar(20) NOT NULL,   -- xem bảng topic dưới — khối nào trên trang hiện link này
  [Order]          int NOT NULL DEFAULT 0,
  PRIMARY KEY (ArticleId, DestinationSlug, Topic)
);
CREATE INDEX IX_ArticleDestinationMap_Slug ON ArticleDestinationMap(DestinationSlug, Topic);
```

**Bộ topic (MỞ RỘNG 07/2026** — bản đầu chỉ có itinerary/food/general, không
đủ phủ các khối trang Flagship; đồng bộ với destination-spec §2.2 dùng
`topic=souvenir`**)**:

| Topic | Khối trên trang điểm đến | Ví dụ bài |
|---|---|---|
| `itinerary` | 3b — CTA lịch trình | "Lịch trình Đà Lạt 3N2Đ chi tiết" |
| `food` | 6b — Ăn gì đặc trưng | "Ẩm thực Đà Lạt" |
| `souvenir` | 8b — Quà mang về | "Những nơi mua quà lưu niệm tốt ở Đà Lạt" |
| `nightlife` | Buổi tối làm gì | "Đà Lạt về đêm" |
| `poi-guide` | 5 — Điểm tham quan | "Top 15 điểm check-in Đà Lạt" |
| `general` | Cuối bài / "Đọc thêm" | bài không khớp khối chuyên biệt nào |

Link bài render qua cơ chế **bake vào `DynamicBlocksJson`** đã chốt
(database-redesign §3.4): mỗi topic 1 blockKey (`articleLinkItinerary`,
`articleLinkFood`...), website chỉ echo HTML — KHÔNG query
`ArticleDestinationMap` sống lúc render trang. Bake lại khi publish/gỡ bài
có gắn map (trigger chiều ngược, cùng cơ chế Hotel/Tour đổi giá).

**Cách gán (SỬA 07/2026** — bản đầu chốt "gán tay, không suy luận tự động";
nới thành mô hình gợi ý-rồi-duyệt, cùng pattern E**)**: khi soạn/generate
bài, CMS quét nội dung tìm tên điểm đến khớp DB → **gợi ý sẵn** danh sách
destination + topic (đoán topic từ chủ đề bài) trong form Article — người
dùng tick xác nhận/sửa/xoá trước khi lưu. KHÔNG bao giờ tự gán im lặng —
tránh gán sai (1 bài liệt kê nhiều điểm không chắc bài nào cũng đúng "chủ
đề" cho từng điểm). Query trang điểm đến (chỉ dùng lúc BAKE): `SELECT ...
FROM ArticleDestinationMap WHERE DestinationSlug=@slug AND Topic=@topic ORDER
BY [Order]`.

Điểm đến chưa có bài nào gắn theo topic áp dụng → tính là mục ⚠️ thiếu trong
**Điểm độ phủ nội dung** (destination-spec §2.2.2) — CMS hiện cảnh báo + nút
tạo bài với destination/topic điền sẵn.

### 8.2 Auto-link tên điểm đến trong thân bài (CHỐT 07/2026)

Khi bài nhắc tới 1 điểm đến có trong DB, CMS tự chuyển tên đó thành link nội
bộ tới `/diem-den/{slug}` — internal link là tín hiệu SEO nội bộ mạnh, nhưng
phải có luật chặt để không thành spam:

1. Chỉ link **lần xuất hiện ĐẦU TIÊN** của mỗi điểm trong 1 bài
   (Wikipedia-style), tối đa ~10 link auto/bài.
2. Chạy lúc **compile `ContentHtml`** — cùng bước resolve khối động
   `[[block:...]]` (§4): link được bake sẵn vào HTML, website không xử lý
   gì; người duyệt THẤY link trong preview trước khi Approve.
3. KHÔNG link khi tên nằm trong: heading, link sẵn có, hoặc HTML card của
   khối động (tránh link lồng link).
4. Tên nhập nhằng (vd "Bãi Dài" có ở cả Phú Quốc lẫn Cam Ranh) → chỉ
   auto-link khi ngữ cảnh đã xác định tỉnh (bài đã gán destination cùng
   tỉnh qua §8.1); không xác định được thì BỎ QUA, không đoán — đúng nguyên
   tắc "AI/hệ thống không đoán bừa" xuyên suốt.
5. Anchor text = đúng tên xuất hiện tự nhiên trong câu, không chèn/sửa từ
   khoá vào anchor (tránh over-optimization).

## 9) UI

- Màn tạo bài: 2 lựa chọn ngay từ đầu — **"Tạo bằng AI"** / **"Viết tay"** (§1.1
  mục 4) — hội tụ về cùng 1 editor ngay khi có `DraftReady`.
- Editor: nút **"Chèn khối động"** — palette chọn loại khối (§3.1) + form tham
  số (type/province/destination/limit/sort) → chèn token vào vị trí con trỏ.
- Preview: hiển thị khối động ĐÃ RESOLVE ngay trong preview (không chỉ thấy
  token thô) — người duyệt thấy đúng cái sẽ lên web trước khi Approve.
- Màn review: cảnh báo token lỗi/rỗng (§4 bước 2, 5) trước khi cho Approve.
- Nút "Làm mới khối động" ở màn chi tiết 1 bài đã publish.
- Màn Công cụ: thêm job batch "Làm mới toàn bộ bài có khối động".

## 10) Việc cần chốt trước khi build

1. ✅ **CHỐT 07/2026**: URL bài viết = `/blog/{slug}` (đổi từ đề xuất ban đầu
   `/cam-nang/{slug}` — người dùng chọn giữ tên quen thuộc `/blog/`). Đã đồng
   bộ ở mọi chỗ nhắc route này (§3.2 DDL, `content-seo-ux-plan.md` §5.3/§8.6,
   `database-redesign.md` §3.4 mẫu `DynamicBlocksJson`, `implementation-plan.md`,
   `system-design.md`).
2. Website .NET cần route + view mới cho Article (chưa tồn tại) — việc bên
   repo dichoithoi, song song các route landing khác (`/loai/...`, `/tinh/...`).
3. ✅ **CHỐT 07/2026**: THÊM NGAY khối "món ăn/quán ăn" riêng vào bộ khối hỗ
   trợ MVP (không chờ có module ẩm thực riêng) — xem §3.1 (đã thêm khối
   `foodSpots`).
4. ✅ **CHỐT 07/2026**: AI **tự gợi ý** chèn khối động lúc generate (dựa chủ đề
   bài, chèn sẵn `[[block:...]]` vào outline draft) nhưng chỉ là gợi ý — người
   dùng xem/sửa/xoá trong màn review trước khi Approve→Publish, không tự động
   publish thẳng không qua duyệt. Áp dụng cho MỌI kind kể cả `products` mới
   (`dichoithoi-product-spec.md` §7).
5. Luồng "Viết tay" (§1.1) là thay đổi ở tầng CORE module `ai-content` (state
   machine + use case mới), không nằm gọn trong module destination/article —
   cần làm TRƯỚC hoặc CÙNG lúc với phần publisher/khối động của Article, vì
   Article là nơi đầu tiên cần `sourceType=Manual`.
