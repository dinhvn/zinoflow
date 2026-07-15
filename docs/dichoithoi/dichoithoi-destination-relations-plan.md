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
- **`ArticleDestinationMap`** (nối bài cẩm nang ↔ điểm đến theo topic:
  itinerary/food/nightlife/souvenir) đã có bảng + usecase đọc/ghi, hiện chỉ
  hiển thị riêng lẻ trên trang detail ("Xem thêm lịch trình"), KHÔNG liên
  thông với khối "Điểm đến liên quan".
- **JSON-LD** (`SchemaUtil.CreateDestinationJsonLD`, dichoithoi) chỉ thể
  hiện quan hệ cha-con (`ContainsPlace`/`ContainedInPlace`, text tỉnh không
  link entity). Hoàn toàn không có structured data cho nearby/related/cùng
  loại hình — Google không nhìn thấy các liên kết ngang cấp này.

## 1) Thêm tiêu chí "cùng loại hình" vào thuật toán gợi ý

**Mục tiêu**: đưa loại hình (không chỉ khoảng cách/tỉnh) vào việc chọn điểm
liên quan — 1 bãi biển không nên ưu tiên gợi ý cạnh 1 ngôi chùa chỉ vì ở gần,
trong khi 1 bãi biển khác cùng loại xa hơn lại đúng ý người dùng hơn.

Việc cần làm:
1. Mirror hoá loại hình chính (`extras.Types`, lấy `Type` đầu tiên/chính là
   đủ, không cần mọi tag) vào `destination-mirror.entity.ts` (cột mới, vd.
   `primary_type varchar(64) nullable`) + cập nhật use-case đồng bộ mirror
   (`typeorm-destination-mirror.repository.ts`, `mssql-site-db.adapter.ts`)
   để field này được ghi mỗi lần sync.
2. Thêm `primaryType: string | null` vào `RelatedCandidate` (`related-builder.ts`).
3. Sửa `buildRelatedItems()`: chèn bước mới **giữa bước 4 (anh em cùng cha)
   và bước 5 (cùng tỉnh)** — "cùng loại hình trong cùng tỉnh", ưu tiên điểm
   gần hơn nếu có toạ độ (dùng lại `distanceBySlug` đã có sẵn trong hàm).
   Bước 5 cũ (cùng tỉnh, không lọc loại) lùi xuống làm fallback cuối cùng
   khi không đủ 8 mục.
4. Cập nhật `related-builder.spec.ts` — test case loại hình khác nhau trong
   cùng tỉnh phải KHÔNG được ưu tiên hơn cùng loại hình khác tỉnh (trong
   phạm vi nearby vẫn theo khoảng cách như cũ, không đổi bước 3).
5. Cập nhật `dichoithoi-destination-spec.md` §12.3 — xoá ghi chú "thay bằng
   cùng tỉnh vì mirror chưa có type map", ghi lại thứ tự 6 bước mới.

## 2) Tách nhãn hiển thị theo tiêu chí trên UI

**Mục tiêu**: người dùng THẤY lý do gợi ý (đúng yêu cầu "thấy được mối liên
kết"), không chỉ 1 danh sách phẳng không giải thích.

Việc cần làm:
1. `RelatedItem` (`related-builder.ts`) đã có field `badge` — mở rộng thêm 1
   field mới `criterion: "child" | "curated" | "nearby" | "sibling" |
   "same-type" | "same-province"` (không đổi `badge` hiện có, chỉ thêm field
   phân loại để UI group theo đó).
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

## Thứ tự làm (người dùng chọn "làm cả 4 tuần tự", tự triển khai sau)

1 (thuật toán) → 2 (UI nhãn) → 3 (nối ArticleDestinationMap) → 4 (JSON-LD).
Mỗi bước build + test (unit cho `related-builder.spec.ts`, Playwright cho
UI) trước khi sang bước kế — không gộp release cả 4 cùng lúc để dễ audit
nếu có phát sinh (đúng bài học từ "MỤC KHẨN" trong `dichoithoi-backlog.md`:
"chốt thiết kế" phải đi kèm code thật, không ghi ĐÃ XONG khi chưa verify).
