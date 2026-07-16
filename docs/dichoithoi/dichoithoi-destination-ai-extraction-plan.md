# Dichoithoi — Claude trích xuất thông tin điểm đến từ nguồn tham khảo, người dùng duyệt (Giai đoạn 1-3 ĐÃ BUILD, đã test thật với "dalat-fairytale-land" 16/07/2026)

Ghi lại 16/07/2026. **Gộp và thay thế** `dichoithoi-reference-summary-plan.md`
(15/07/2026) — ý tưởng ban đầu chỉ tóm tắt 1 đoạn văn cho AI viết bài, nay mở
rộng thành trích xuất NHIỀU field cụ thể (tên, địa chỉ, SĐT, giờ mở cửa, mô
tả ngắn, link đánh giá ngoài, tóm tắt cho AI, giá vé theo đối tượng, đánh giá
biên tập) từ Google Maps + website tham khảo do người dùng cung cấp — Claude
(qua VS Code, skill `dichoithoi-extract-destination-info`) đọc, phân tích,
lưu vào 1 bảng riêng; CMS hiện bảng so sánh dữ liệu cũ/mới, người dùng tick
chọn rồi "Chấp nhận" để ghi đè. Mục tiêu: giảm thao tác tra cứu/nhập tay,
người dùng chỉ cần cung cấp tên điểm đến + link Google Maps + web tham khảo.

**Trạng thái**: Giai đoạn 1 (staging table + 2 cột thật), Giai đoạn 2 (skill
trích xuất), Giai đoạn 3 (UI xem/duyệt trong CMS) đã build và test end-to-end
bằng dữ liệu thật (Google Maps + Klook qua Playwright fallback, web tham khảo
qua WebFetch) cho điểm đến "dalat-fairytale-land" — người dùng đã tự kiểm tra
và xác nhận OK 16/07/2026. Giai đoạn 4 (JSON-LD, cross-repo) vẫn CHƯA làm,
không phải ưu tiên hiện tại (§3, Giai đoạn 4).

## 0) Hiện trạng đã audit (16/07/2026)

- `destination-mirror.entity.ts` — các cột liên quan đã có: `name`(39),
  `shortDescription`(45), `addressNew`(65), `addressOld`(68),
  `contactPhone`(71), `contactWebsite`(74), `metaTitle`(103),
  `externalReviewUrls`(107, jsonb). **Không có** cột giờ mở cửa riêng (chỉ
  nằm trong `draftArticle.quickFacts.openingTime`, text tự do trong bài
  nháp — không phải field độc lập của điểm đến) và **không có**
  `ai_reference_summary`.
- `ticketPrice`(82) là **mirror 1 chiều từ SQL Server** — KHÔNG được ghi đè
  bởi tính năng này. `priceBreakdown`(86, jsonb, nhập tay) — **đã thêm vào
  phạm vi trích xuất 16/07/2026** (`{audience, price, note}`) theo yêu cầu
  người dùng khi thấy giá vé xuất hiện trong tóm tắt AI nhưng chưa có
  dòng riêng để duyệt trong bảng so sánh.
- `editorialReview`(94, text, Phase 28.0) — **đã thêm vào phạm vi trích
  xuất 16/07/2026** (tái sử dụng cột có sẵn, không migration mới): AI viết
  1 đoạn đánh giá biên tập giọng văn cá nhân dựa trên đặc điểm/review thật
  tìm được, người dùng duyệt như các field khác.
- **Quy tắc xử lý mâu thuẫn nguồn đã ĐỔI 16/07/2026**: ban đầu thiết kế là
  "ghi cả 2 phương án vào note, không tự chọn" — người dùng phản hồi cách
  này làm `newValue`/`note` quá dài dòng khó dùng. Quy tắc mới: Claude TỰ
  CHỌN 1 giá trị hợp lý nhất (đa số nguồn/nguồn đáng tin hơn) làm
  `newValue` NGẮN GỌN đúng định dạng; toàn bộ lý do + phương án bị loại
  chuyển sang `note` CỦA FIELD (cột "Ghi chú" riêng trong CMS) để người
  dùng tự quyết. `openingHours.note` cũng chỉ nên là câu ngắn gọn (vd "Mở
  cửa hàng ngày 7h30-17h00"), không lặp lại chi tiết `periods` — UI tự ẩn
  `periods` khi lịch đều đặn (chỉ hiện khi period.length > 1).
- `externalReviewUrlItemSchema` (`packages/contracts/src/dichoithoi/destination.ts:70-74`):
  `{label, url}`, tối đa 5 phần tử (`updateExternalReviewUrlsRequestSchema`,
  dòng 728-730) — Claude ghi được đúng format này.
- Không có cột nào lưu "nguồn dữ liệu"/"đã xác minh"/timestamp riêng theo
  từng field — chỉ có `siteUpdatedAt`/`syncedAt` cấp bản ghi cho mục đích
  đồng bộ mirror↔site.
- Không có UI diff-review field-by-field nào sẵn để tái dùng. Trang
  `dia-chi/page.tsx` chỉ là bảng tra cứu tĩnh (đọc-only). Pattern gần nhất
  là "gợi ý AI theo block → Duyệt/Bỏ qua" (`approveBlockSuggestion`/
  `dismissBlockSuggestion`) nhưng duyệt cả block nội dung, không phải bảng
  key-value cũ/mới — UI này phải xây mới.
- Field "Website nguồn để AI đọc thêm" (`aiReferenceUrls`) đã có sẵn trên
  trang detail (`[slug]/page.tsx:673-720`), tối đa 5 link — tái dùng đúng
  input này cho web tham khảo, KHÔNG cần thêm ô nhập mới.

## 1) Nguyên tắc bắt buộc — đã xác nhận với người dùng 16/07/2026

**Không dùng kiến thức nền (parametric knowledge) của Claude cho dữ liệu
CỨNG** (số điện thoại, giờ mở cửa, địa chỉ, link đánh giá ngoài): CHỈ điền
nếu tìm thấy trong Google Maps hoặc website tham khảo được cung cấp. Không
tìm thấy → `found:false`, KHÔNG tự suy đoán/lấy từ trí nhớ (rủi ro dữ liệu
cũ/sai lọt thẳng vào DB, nguy hiểm hơn văn bản tự do vì người đọc khó phát
hiện SĐT/giờ sai bằng mắt).

Với field MỀM hơn (mô tả ngắn, tóm tắt cho AI viết bài): được dùng kiến
thức nền để viết mượt câu chữ/kết nối ý, nhưng KHÔNG thêm SỰ THẬT mới ngoài
nguồn — đúng nguyên tắc "không bịa dữ liệu cứng" xuyên suốt dự án.

Nguồn có dữ liệu MÂU THUẪN nhau (vd giá vé trẻ em khác nhau giữa 2 web,
từng gặp thật khi thử với "DaLat Fairytale Land" 16/07/2026) — ghi cả 2
kèm chú thích nguồn trong `note`, KHÔNG tự chọn 1 bên.

## 2) Thiết kế

### 2.1 Bảng mới — độc lập, chỉ phục vụ mục đích này

```sql
CREATE TABLE dichoithoi_destination_ai_extractions (
  destination_slug varchar(64) PRIMARY KEY
    REFERENCES dichoithoi_destinations(slug) ON DELETE CASCADE,
  source_urls jsonb NOT NULL,      -- string[]: Google Maps link + web tham khảo đã đọc lần này
  extracted_at timestamptz NOT NULL,
  fields jsonb NOT NULL            -- ExtractedFieldItem[]
);
```

`ExtractedFieldItem`:
```ts
{
  key: "name" | "addressNew" | "contactPhone" | "contactWebsite" |
       "shortDescription" | "metaTitle" | "openingHours" |
       "aiReferenceSummary" | "externalReviewUrl" | "priceBreakdown" |
       "editorialReview",
  newValue: unknown,       // null nếu found=false
  currentValue: unknown,   // snapshot giá trị cũ TẠI THỜI ĐIỂM trích xuất (để diff ổn định dù DB đổi sau đó)
  found: boolean,
  note: string | null,     // vd "2 nguồn không thống nhất: ...", "suy từ Google Maps, chưa xác minh chéo"
  status: "pending" | "accepted" | "rejected",
}
```

1 dòng/điểm đến (upsert khi chạy lại) — không lưu lịch sử nhiều phiên bản,
chưa có nhu cầu đó. `externalReviewUrl` có thể xuất hiện NHIỀU lần trong
mảng `fields` (mỗi candidate 1 phần tử riêng, không gộp). `priceBreakdown`
cũng vậy nếu cần nhiều mức giá theo đối tượng — nhưng khi CHẤP NHẬN, field
này GHI ĐÈ NGUYÊN MẢNG (không merge như `externalReviewUrl`, cùng hành vi
với `UpdatePriceBreakdownUseCase` đã có).

### 2.2 Cột thật mới trên `destination-mirror.entity.ts`

- `opening_hours` (jsonb, nullable) — shape:
  `{ note: string, periods: Array<{ days: string[], opens: string, closes: string }> }`.
  `note` = hiển thị nhanh; `periods` = chuẩn hoá cho JSON-LD sau này (phase
  riêng, phụ thuộc dichoithoi repo, KHÔNG làm trong plan này).
- `ai_reference_summary` (text, nullable) + `ai_reference_summary_updated_at`
  (timestamptz, nullable) — kế thừa nguyên thiết kế từ plan cũ đã gộp.

Cả 2 cột này chỉ được GHI qua bước "Chấp nhận" ở §2.3 — không bị extraction
job ghi trực tiếp (extraction job chỉ ghi vào bảng staging §2.1).

### 2.3 CMS — nút xem + bảng duyệt

- Trang detail điểm đến: nút "Xem thông tin AI trích xuất" — chỉ hiện nếu
  có dòng trong `dichoithoi_destination_ai_extractions` cho slug đó.
- Bấm vào: bảng so sánh — mỗi field 1 dòng: cột "Hiện tại" | "AI trích
  xuất" | checkbox (mặc định tick nếu `found=true`, KHÔNG tick nếu
  `found=false` vì không có gì để áp dụng) | ghi chú/nguồn.
- Nút "Chấp nhận các mục đã tick": với mỗi field tick — ghi giá trị mới vào
  cột thật tương ứng; riêng `externalReviewUrl` là MERGE (thêm nếu chưa
  trùng `label`, tôn trọng giới hạn tối đa 5, không tự xoá entry cũ người
  dùng đã nhập tay). Field đã áp dụng → `status="accepted"` trong bảng
  staging (để lần trích xuất sau không đề xuất lại y hệt cái đã duyệt).
- Field không tick: giữ nguyên `status="pending"`, không đụng vào field
  thật tương ứng.

### 2.4 Skill `dichoithoi-extract-destination-info`

Input người dùng cung cấp (đúng như đã nói): tên điểm đến, link Google
Maps, danh sách website tham khảo (tái dùng field `aiReferenceUrls` có sẵn
trên trang detail — không thêm ô nhập mới).

Quy trình: đọc Google Maps (WebFetch — Maps business listing thường có sẵn
giờ mở cửa theo từng ngày, đây là nguồn TỐT nhất cho `openingHours`) + đọc
từng website tham khảo (đọc đầy đủ, không cắt cứng như fetch thô trong app)
→ trích xuất đúng theo nguyên tắc §1 → tổng hợp `aiReferenceSummary` (có
ghi chú mâu thuẫn nếu có) → upsert vào bảng §2.1 qua Postgres trực tiếp →
báo cáo người dùng: field nào trích được, field nào thiếu, mâu thuẫn gì.

Chi tiết đầy đủ nằm trong file skill riêng
`.claude/skills/dichoithoi-extract-destination-info/SKILL.md`.

## 3) Kế hoạch triển khai theo giai đoạn

### Giai đoạn 1 — Bảng staging + 2 cột thật mới (độc lập, làm trước được)

- Migration bảng `dichoithoi_destination_ai_extractions` (§2.1).
- Migration 2 cột `opening_hours`, `ai_reference_summary` +
  `ai_reference_summary_updated_at` trên `dichoithoi_destinations` (§2.2).
- Sửa `buildSourceContext()` (`create-destination-job.usecase.ts`) — ưu
  tiên dùng `ai_reference_summary` nếu có, bỏ qua fetch từng URL (kế thừa
  nguyên §1.1 của plan cũ đã gộp).

**DoD — ĐÃ XONG**: migration sạch; test tạo job cho 1 điểm đến CÓ
`ai_reference_summary` sẵn (ghi tay để test) → xác nhận prompt dùng đúng tóm
tắt, không fetch URL; điểm đến chưa có tóm tắt vẫn generate như hành vi cũ.

### Giai đoạn 2 — Skill trích xuất (phụ thuộc Giai đoạn 1 để có bảng ghi vào)

- Viết skill `dichoithoi-extract-destination-info` (§2.4).

**DoD — ĐÃ XONG**: chạy thử thật cho "dalat-fairytale-land" (Google Maps +
Klook qua Playwright, các web tham khảo khác qua WebFetch), xác nhận: field
cứng chỉ điền khi có nguồn, mâu thuẫn giữa nguồn được Claude tự chọn 1 giá
trị hợp lý nhất + lý do chuyển vào `note` (quy tắc đã đổi so với thiết kế
ban đầu — xem §0), dữ liệu ghi đúng bảng staging qua
`scripts/upsert-destination-ai-extraction.ts`.

### Giai đoạn 3 — UI xem + duyệt trong CMS (phụ thuộc Giai đoạn 1, độc lập Giai đoạn 2 để build UI trước bằng dữ liệu test)

- Nút + bảng so sánh + nút "Chấp nhận" (§2.3).

**DoD — ĐÃ XONG**: Playwright xác nhận luồng đầy đủ trên dữ liệu thật của
"dalat-fairytale-land" — nút "Xem thông tin AI trích xuất" mở popup
(`Modal`) hiện bảng so sánh đúng cũ/mới cho cả 11 field (bao gồm
`priceBreakdown` nhiều dòng và `editorialReview`), field bỏ tick không đổi,
field `externalReviewUrl` merge đúng.

### Giai đoạn 4 (sau, không phải bây giờ) — JSON-LD `openingHoursSpecification`

Dùng `opening_hours.periods` để dichoithoi repo (Views/SchemaUtil.cs) build
JSON-LD chuẩn schema.org cho `TouristAttraction`/`Place` — tăng cơ hội
Google hiện "Đang mở cửa/đóng cửa lúc..." trên kết quả tìm kiếm. Việc CROSS-REPO
(cần đồng bộ cột này sang `v2.Destination` bên SQL Server + code .NET) —
đúng nguyên tắc dự án "schema owned by dichoithoi, no migrations from
zinoflow repo" — ghi nhận phụ thuộc, KHÔNG làm trong phạm vi plan này.

## Thứ tự: Giai đoạn 1 → (2 song song 3) → 4 (sau, cross-repo, không phải ưu tiên hiện tại).
