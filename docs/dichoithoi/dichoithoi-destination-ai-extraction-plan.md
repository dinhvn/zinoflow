# Dichoithoi — Claude trích xuất thông tin điểm đến từ nguồn tham khảo, người dùng duyệt (Giai đoạn 1-3 ĐÃ BUILD 16/07/2026; MỞ RỘNG Google Search Grounding §5-6 Giai đoạn A-D ĐÃ BUILD 25/07/2026, test thật với "dalat-fairytale-land"; Giai đoạn E rollout hàng loạt CHƯA làm)

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

## 5) MỞ RỘNG — 2 nguồn trích xuất song song: Skill thủ công + Google Search Grounding tự động (phân tích 25/07/2026, CHƯA BUILD)

### 5.0 Bối cảnh / mục tiêu

Người dùng nêu 25/07/2026: hiện tại điểm đến mới phải tự tìm nguồn (Google
Maps link, web tham khảo) rồi mới nhờ Claude đọc qua skill thủ công (§2.4).
Với Gemini 3.x + Google Search Grounding (`tools: [{google_search: {}}]`,
xem phân tích chi phí/giới hạn ở lịch sử chat 25/07/2026), người dùng chỉ
cần **tên điểm đến** — Gemini tự tìm nguồn trên internet, không cần link có
sẵn. Số liệu thật đo trên DB local cùng ngày: 275 POI, nhưng chỉ **87 có
sẵn `google_maps_url`** và **1 có `ai_reference_urls`** — tức phần lớn điểm
đến hiện KHÔNG đủ input để chạy skill thủ công (`SKILL.md` bắt hỏi người
dùng cung cấp trước khi đọc nếu thiếu URL). Đây là khoảng trống thật mà GSG
tự động giải quyết được, không chỉ là "làm nhanh hơn".

Mục tiêu cuối: khi viết 1 bài, `source_context` gửi AI là **hợp nhất của 3
nguồn** — (1) trích xuất từ Skill thủ công (Claude đọc kỹ qua WebFetch/
Playwright, đã có), (2) trích xuất tự động qua Gemini + GSG (mới), (3) ghi
chú người quản trị tự nhập tay (`request.userNotes`, đã có). Không nguồn
nào thay thế nguồn nào — cả 3 cùng tồn tại song song, người dùng tự quyết
field nào dùng giá trị của nguồn nào.

**Rủi ro kỹ thuật đã xác nhận (giữ nguyên khi lên plan)**: kết hợp
`google_search` + structured output (`responseJsonSchema`) trên Gemini 3.x
làm rỗng `grounding_chunks`/`grounding_support` — GSG **không trả về được
URL nguồn cụ thể** đã dùng cho từng field, chỉ có `web_search_queries`. Vì
vậy nhánh GSG **không thể tuân đúng** nguyên tắc §1 "chỉ điền field cứng
nếu tìm thấy trực tiếp trong 1 nguồn xác định" theo cách kiểm chứng được
như nhánh Skill — cần đánh dấu rõ trong UI đây là nguồn "chưa xác minh theo
từng nguồn cụ thể", không đối xử ngang hàng độ tin cậy với Skill.

### 5.1 Thay đổi dữ liệu cần có

- Bảng `dichoithoi_destination_ai_extractions` (§2.1) hiện PK là
  `destination_slug` (1 dòng/điểm đến) — **phải đổi PK thành
  `(destination_slug, source)`** với `source: "skill" | "gsg"`, để lưu SONG
  SONG 2 kết quả trích xuất khác nguồn cho cùng 1 điểm đến, không ghi đè
  lẫn nhau. `scripts/upsert-destination-ai-extraction.ts` (skill) luôn ghi
  `source="skill"`; use case mới (GSG) ghi `source="gsg"`.
- Logic "giữ nguyên `accepted` nếu giá trị mới giống hệt lần accepted trước"
  hiện nằm trong `upsert-destination-ai-extraction.ts` (chỉ script CLI dùng)
  — cần tách ra 1 hàm dùng chung (vd trong application layer) để cả script
  CLI (skill) LẪN use case backend mới (GSG) cùng gọi, tránh 2 nơi implement
  lệch nhau (nguyên tắc "reuse first" — copilot-instructions §4).
- `aiReferenceSummary` (field mềm, dùng làm ngữ cảnh viết bài chứ không ghi
  đè lẫn nhau) **giữ 2 cột thật RIÊNG** thay vì 1: cột `ai_reference_summary`
  hiện có (đổi ý nghĩa: "từ Skill") + cột MỚI `ai_reference_summary_gsg`
  (+ `ai_reference_summary_gsg_updated_at`) — đúng yêu cầu người dùng "tóm
  tắt cho AI viết bài vẫn tách biệt Skill và GSG", KHÔNG gộp/chọn-1 như các
  field cứng khác.
- 10 field còn lại (name, addressNew, contactPhone, contactWebsite,
  shortDescription, metaTitle, openingHours, externalReviewUrl,
  priceBreakdown, editorialReview) vẫn chỉ có **1 cột thật** trên
  `dichoithoi_destinations` — khi Skill và GSG đề xuất giá trị KHÁC NHAU cho
  cùng field, người dùng phải **chọn 1** (hoặc giữ nguyên hiện tại) trước
  khi ghi — khác với `aiReferenceSummary` (cả 2 cùng tồn tại). Ngoại lệ:
  `externalReviewUrl` vẫn merge theo `label` như hiện tại (§2.3), 2 nguồn có
  thể cùng góp entry mà không xung đột — không cần "chọn 1".

### 5.2 CMS — 3 nút trong tab "🤖 AI hỗ trợ" (thay 1 nút hiện tại)

- **"Xem trích xuất Skill"** — bảng so sánh 2 cột như hiện tại (§2.3),
  không đổi hành vi.
- **"Xem trích xuất Google Search"** — bảng tương tự, dữ liệu từ dòng
  `source="gsg"`, có cảnh báo "nguồn tự động, chưa xác minh theo từng URL cụ
  thể — kiểm tra kỹ hơn trước khi chấp nhận" (đúng rủi ro §5.0).
  Nút chạy trích xuất GSG cũng đặt cạnh đây — gọi endpoint backend mới,
  KHÔNG cần mở Claude Code như Skill (khác biệt cố ý: đây là lý do chính để
  làm nhánh GSG — tự động hoá được, không cần người ngồi chạy tay).
- **"So sánh cả 2 nguồn"** — bảng 4 cột: Hiện tại | Skill | GSG | (control
  chọn nguồn: giữ hiện tại / dùng Skill / dùng GSG — radio thay vì checkbox
  vì loại trừ lẫn nhau, trừ `externalReviewUrl` vẫn checkbox merge). UI chi
  tiết (bố cục, tương tác) để lại phân tích/thiết kế khi lên plan chính
  thức — mục này chỉ chốt YÊU CẦU chức năng.
- Khối "Tóm tắt cho AI viết bài" dưới bảng trích xuất: hiện 2 khối RIÊNG
  (Skill / GSG), không gộp — khớp `ai_reference_summary` +
  `ai_reference_summary_gsg` ở §5.1.

### 5.3 Prompt viết bài — gộp cả 3 nguồn

`buildSourceContext()` (`create-destination-job.usecase.ts:316-325`) hiện
chỉ có 1 khối "## Tóm tắt nguồn tham khảo (đã trích xuất, đã duyệt)" đọc từ
`destination.aiReferenceSummary`. Cần sửa thành tối đa 3 khối riêng, mỗi
khối gắn nhãn rõ nguồn (AI viết bài cần biết độ tin cậy khác nhau giữa các
nguồn để tự cân nhắc, không trộn lẫn):

1. `## Tóm tắt nguồn tham khảo — Skill đọc kỹ (đã duyệt)` — từ
   `aiReferenceSummary` (đổi tên biến/cột theo §5.1).
2. `## Tóm tắt nguồn tham khảo — Google Search tự động (đã duyệt, CHƯA xác
   minh theo từng URL cụ thể)` — từ `aiReferenceSummaryGsg`, nhãn có ghi rõ
   mức độ tin cậy thấp hơn Skill (đúng §5.0).
3. `## Ghi chú từ người quản trị (ưu tiên cao nhất)` — đã có sẵn
   (`request.userNotes`, dòng 316-318), KHÔNG đổi.

Chỉ đưa khối nào ĐANG CÓ giá trị (không ép đủ cả 3) — giữ hành vi "graceful
degrade" hiện tại khi thiếu 1-2 nguồn.

**Bỏ bớt "Thân bài hiện tại" khi ĐÃ có trích xuất (phân tích 25/07/2026,
chưa code)**: `create-destination-job.usecase.ts:38,303-312` hiện luôn gửi
tối đa `MAX_OLD_CONTENT_CHARS = 20_000` ký tự thân bài cũ (đã bỏ HTML) khi
`mode="update"` (tự động khi điểm đến đã có bài, không do người dùng chọn —
`[slug]/page.tsx:417,1330`) — đo trên DB: 247/275 POI đã publish nên đây là
nhánh phổ biến, không phải hiếm. Khối này bị gửi **2 lần/job** (dùng chung
`sourceContext` cho cả `buildOutline` lẫn `buildContent`, xem
`prompt-builder.ts:87-96`) — tốn token nhiều nhất trong toàn bộ
`sourceContext`, và có rủi ro kéo AI lệch theo dữ liệu cũ có thể đã lỗi thời
(đúng lý do pipeline trích xuất ra đời).

Quyết định: **điều kiện hoá theo trạng thái trích xuất**, không cắt đồng
loạt — người dùng xác nhận 25/07/2026 sẽ chạy trích xuất (skill/GSG) cho
TOÀN BỘ điểm đến trước khi viết bài, nên nhánh "chưa có nguồn nào" sẽ chỉ
còn là fallback tạm thời/thiểu số, không phải trạng thái ổn định lâu dài:

- **Chưa có** `aiReferenceSummary` VÀ **chưa có** `aiReferenceSummaryGsg` →
  giữ nguyên hành vi hiện tại (gửi tối đa 20K ký tự) — vẫn cần làm nguồn dự
  phòng duy nhất cho điểm đến chưa từng trích xuất.
- **Đã có ít nhất 1 trong 2** tóm tắt trích xuất (đã duyệt tay) → **bỏ hẳn**
  khối thân bài dài, chỉ giữ 4 dòng quick-fact (`openingTime`/`ticketPrice`/
  `transport`/`tip`, rẻ, KHÔNG đổi) — dữ liệu trích xuất đã xác minh chéo
  đáng tin hơn bản thân bài cũ trên site.

Chưa code ở bước này.

### 5.4 Prompt trích xuất GSG (phân tích 25/07/2026)

**Nguyên tắc: response schema PHẢI TÁI DÙNG đúng
`destinationAiExtractionFieldItemSchema` (§2.1)** — không để Gemini trả JSON
tự do theo cấu trúc riêng (vd `basic_info/highlights/experiences/tips`, ý
tưởng ban đầu người dùng đề xuất). Lý do: toàn bộ pipeline (bảng staging,
UI so sánh, nút "Chấp nhận", merge `externalReviewUrl`...) đã build xoay
quanh đúng 1 shape — trả JSON khác shape sẽ tạo 2 mô hình dữ liệu không
tương thích, phải xây lại UI/accept-flow riêng cho nhánh GSG, phá vỡ lợi
ích tái dùng đã có ở §5.1-5.3.

**Mapping nội dung người dùng muốn trích xuất vào field có sẵn**:

| Field mong muốn | Field trong schema | Ghi chú |
|---|---|---|
| Địa chỉ | `addressNew` | field cứng |
| Giờ mở cửa | `openingHours` | PHẢI đúng shape `{note, periods:[{days,opens,closes}]}` — không phải chuỗi tự do |
| Giá vé tham khảo | `priceBreakdown` | PHẢI đúng shape mảng `{audience, price, note}[]` |
| Thời gian lý tưởng để đi | *(chưa có field cứng)* | gộp vào `aiReferenceSummary` — KHÔNG thêm field mới ở giai đoạn này |
| Điểm đặc biệt / kỷ lục / kiến trúc | `aiReferenceSummary` (bản GSG) | đúng mục đích field này đã định nghĩa ở `SKILL.md` §5: "đặc điểm nổi bật, mẹo thực tế" |
| Trải nghiệm không thể bỏ qua | `aiReferenceSummary` (bản GSG) | gộp cùng đoạn tóm tắt, có thể dùng bullet trong text |
| Kinh nghiệm bỏ túi / trang phục / lưu ý | `aiReferenceSummary` (bản GSG) | idem |

Field khác vẫn nên yêu cầu Gemini trả nếu tìm được (không giới hạn chỉ 4
nhóm người dùng liệt kê): `name`, `contactPhone`, `contactWebsite`,
`shortDescription`, `metaTitle`, `externalReviewUrl`, `editorialReview`.

**Temperature — tách riêng theo operation, mỗi bước 1 giá trị khác nhau**
(cập nhật 25/07/2026, chưa code):

- **Trích xuất GSG: `0.1`** — cần tính nhất quán/đúng định dạng tối đa, số
  liệu (giá vé, giờ mở cửa, SĐT) không được "sáng tạo".
- **Viết bài (outline/section/frame): `0.5 – 0.6`** — cao hơn mốc 0.3 đã
  code tạm trước đó (25/07/2026, xem `gemini-content-ai.provider.ts`), vì
  mức 0.3 thiên về an toàn/bám sát nguồn nhưng câu văn có thể hơi khô; 0.5-0.6
  giúp câu từ mềm mại, giàu cảm xúc, tự nhiên hơn — vẫn đủ thấp để không lạc
  đề khỏi `source_context`. **Việc sửa từ 0.3 → 0.5-0.6 trong code CHƯA làm ở
  bước này** — chỉ ghi nhận quyết định, code sau khi lên plan.

Code hiện tại (`gemini-content-ai.provider.ts`) đang hardcode `temperature:
0.3` cho MỌI request Gemini (kể cả tương lai sẽ có nhánh GSG) — cần thêm
`temperature?: number` vào `StructuredGenerationRequest` (application layer,
dùng chung cross-provider) để mỗi use case tự set đúng giá trị theo operation
(viết bài dùng 0.5-0.6, trích xuất GSG dùng 0.1); Anthropic provider tiếp
tục bỏ qua field này (đã có comment rõ "KHONG truyen temperature" ở đó,
không đổi).

**CMS phải có ghi chú giải thích 2 mức temperature này** (đúng convention
"giải thích tính năng ngay tại chỗ dùng" — copilot-instructions.md): đặt ở
khối ghi chú model Gemini đã thêm trong tab "🤖 AI hỗ trợ" (`[slug]/page.tsx`)
và trang "Tạo bài viết mới" (`articles/new/page.tsx`) — bổ sung câu ngắn giải
thích vì sao 2 thao tác dùng temperature khác nhau (trích xuất ưu tiên chính
xác/nhất quán vs viết bài ưu tiên văn phong mượt mà). Chưa code ở bước này.

**Prompt nháp (system instruction, sẽ tinh chỉnh khi build)**:

```
Dùng Google Search để tìm thông tin ĐẦY ĐỦ, MỚI NHẤT về điểm du lịch:
"{{tên điểm đến}}"{{, {{tên tỉnh/thành}} nếu có}}.

Trả về DUY NHẤT JSON theo đúng schema đã cho (mảng field {key, newValue,
found, note}) — KHÔNG kèm văn bản dẫn dắt, không giải thích ngoài JSON.

Với MỖI field:
- found=true CHỈ KHI tìm thấy thông tin cụ thể qua kết quả tìm kiếm — không
  suy đoán/dùng kiến thức nền nếu search không ra kết quả rõ ràng cho field
  cứng (địa chỉ, SĐT, giờ mở cửa, giá vé, link đánh giá ngoài).
- found=false + newValue=null khi không tìm thấy — không bịa.
- Chủ động tìm thêm 3 mục sau nếu có (KHÔNG bắt buộc, không thấy thì
  found=false bình thường, không ảnh hưởng các field khác):
  · contactWebsite: website chính thức của điểm đến (không phải trang tổng
    hợp/OTA như Klook, Traveloka).
  · externalReviewUrl: link Fanpage Facebook chính thức (label "Facebook").
  · externalReviewUrl: link trang đánh giá TripAdvisor hoặc Google Maps
    review nếu Facebook không có (label "TripAdvisor"/"Google Maps") — mỗi
    link 1 phần tử riêng trong mảng, không gộp chung 1 field.
- Nguồn mâu thuẫn nhau: tự chọn 1 giá trị hợp lý nhất (ưu tiên nguồn chính
  thức/số đông thống nhất), ghi lý do + phương án bị loại vào `note`.
- aiReferenceSummary: tổng hợp CÓ CẤU TRÚC gồm — điểm đặc biệt/kỷ lục/kiến
  trúc nổi bật, trải nghiệm không thể bỏ qua, thời gian/mùa lý tưởng để đi,
  kinh nghiệm thực tế (trang phục, mẹo mua vé/di chuyển, lưu ý quan trọng).
  KHÔNG nhét giá vé vào đây (đã có priceBreakdown riêng).
- Tiếng Việt có dấu đầy đủ cho mọi giá trị text.
```

`responseJsonSchema` truyền vào Gemini = JSON Schema sinh trực tiếp từ
`destinationAiExtractionFieldItemSchema` (Zod, giống hệt cách
`gemini-content-ai.provider.ts` đang làm cho pipeline viết bài — 1 nguồn sự
thật duy nhất, không viết schema tay riêng cho nhánh GSG).

**Còn CHƯA phân tích**: bố cục UI chi tiết của bảng so sánh 4 cột (§5.2) —
chỉ chốt yêu cầu chức năng, chưa thiết kế wireframe.

### 5.5 Trạng thái

Phân tích + chốt yêu cầu chức năng ĐÃ XONG (5.0-5.4) — xem kế hoạch triển
khai theo giai đoạn ở §6.

## 6) Kế hoạch triển khai — mở rộng GSG (viết 25/07/2026, CHƯA build)

Kế thừa đúng cấu trúc giai đoạn ở §3 (Giai đoạn 1-4 cũ, đã build). Toàn bộ
quyết định dưới đây đã chốt qua phân tích §5, không suy đoán thêm.

### Hiện trạng đã audit (25/07/2026, phục vụ riêng cho §6)

- `dichoithoi_destination_ai_extractions` — PK hiện là `destination_slug`
  (`DestinationAiExtractionEntity`, `destination-ai-extraction.entity.ts:11`),
  1 dòng duy nhất trong bảng thật (destinationSlug="dalat-fairytale-land").
- `DestinationAiExtractionRepository.findBySlug()` (port,
  `destination-ai-extraction.repository.ts:19`) — CHỈ trả 1 record, không có
  khái niệm nguồn.
- Logic dedupe "giữ `accepted` nếu giá trị mới giống hệt lần trước" nằm
  NGUYÊN trong `apps/api/scripts/upsert-destination-ai-extraction.ts:72-90`
  (hàm ẩn trong `main()`, không export) — script CLI này là nơi DUY NHẤT
  ghi vào bảng, chưa có use case backend nào ghi.
- `destination-mirror.entity.ts:213-217` — có sẵn `ai_reference_summary`
  (text) + `ai_reference_summary_updated_at`; CHƯA có cột `_gsg` tương ứng.
  `destination-mirror.repository.ts:120` — `setAiReferenceSummary()` là
  method DUY NHẤT, chưa có bản `_gsg`.
- `create-destination-job.usecase.ts:321-325` — chỉ đọc 1
  `destination.aiReferenceSummary`, chưa biết `_gsg`.
  `create-destination-job.usecase.ts:38,303-312` — `MAX_OLD_CONTENT_CHARS =
  20_000`, gửi KHÔNG điều kiện khi `mode="update"`.
- `content-ai-provider.port.ts:27-35` — `StructuredGenerationRequest` CHƯA
  có field `temperature`. `gemini-content-ai.provider.ts` (sau đợt sửa
  25/07/2026 trước đó) hardcode `temperature: 0.3` cho MỌI request, dùng
  chung cho toàn bộ site (laruki/dochoi3s/dichoithoi) vì
  `create-destination-job.usecase.ts:11` dùng CHUNG `PromptBuilder` với
  pipeline content chung (`ai-content/application/services/prompt-builder.ts`)
  — đổi temperature ở đây ảnh hưởng TẤT CẢ site, không riêng dichoithoi.
- `destinations.controller.ts:487-500` — 2 route sẵn có:
  `GET :slug/ai-extraction`, `POST :slug/ai-extraction/accept` (dùng
  `acceptedIndexes` theo INDEX trong 1 mảng `fields` — giả định ngầm chỉ có
  1 nguồn).
- `destination-ai-extraction-panel.tsx` — 1 component, 1 bảng 5 cột (Trường/
  Hiện tại/AI trích xuất/Áp dụng/Ghi chú), gắn thẳng vào tab "🤖 AI hỗ trợ"
  (`[slug]/page.tsx:1066-1068`).
- Migration mới nhất trong `apps/api/src/migrations/`:
  `1782510000000-DestinationMirrorTags.ts` — migration mới dùng số lớn hơn.

### Giai đoạn A — Nền tảng dữ liệu + hạ tầng dùng chung (độc lập, làm trước)

- **A1. Migration đổi PK bảng staging**: `dichoithoi_destination_ai_extractions`
  đổi PK từ `destination_slug` → composite `(destination_slug, source)`,
  thêm cột `source varchar(8) NOT NULL` (`'skill' | 'gsg'`). Backfill dòng
  hiện có (`dalat-fairytale-land`) với `source='skill'` (đúng nguồn gốc thật
  — dòng này được skill thủ công tạo).
- **A2. Migration cột GSG summary**: thêm `ai_reference_summary_gsg` (text,
  nullable) + `ai_reference_summary_gsg_updated_at` (timestamptz, nullable)
  trên `dichoithoi_destinations`, cùng convention với cột `_skill` hiện có
  (`destination-mirror.entity.ts:213-217`).
- **A3. Cập nhật contracts + port + repository theo PK mới**:
  `destinationAiExtractionSchema` thêm `source` field; port
  `DestinationAiExtractionRepository` đổi `findBySlug(slug)` →
  `findBySlugAndSource(slug, source)` + thêm `findAllBySlug(slug)` (trả về
  0-2 dòng, dùng cho màn so sánh §5.2); `updateFields` nhận thêm `source`.
- **A4. Tách hàm dedupe dùng chung**: chuyển logic ở
  `upsert-destination-ai-extraction.ts:72-90` thành 1 hàm export trong
  application layer (vd `application/services/dedupe-extraction-fields.ts`),
  nhận `(prevFields, newFields)` trả `StoredField[]` đã tính `status` —
  script CLI (skill) và use case backend mới (B2) CÙNG import, không viết 2
  lần. `setAiReferenceSummary` thêm bản `setAiReferenceSummaryGsg` trên
  `DestinationMirrorRepository`.
- **A5. Thêm `temperature?: number` vào `StructuredGenerationRequest`**
  (`content-ai-provider.port.ts`) — Gemini provider đọc field này thay vì
  hardcode; không set thì KHÔNG truyền `temperature` cho SDK (để model tự
  default) thay vì ngầm định 0.3, tránh 1 giá trị "ẩn" không ai set tường
  minh. Anthropic provider tiếp tục bỏ qua hoàn toàn field này (không đổi).

**DoD Giai đoạn A**: migration chạy sạch trên DB local (`pnpm migration:run`);
query lại xác nhận dòng `dalat-fairytale-land` có `source='skill'` sau
backfill; unit test hàm dedupe (A4) với 3 case: field mới trùng field cũ đã
accepted → giữ accepted, field mới khác giá trị → về pending, field hoàn
toàn mới → pending; chạy lại đúng luồng skill thủ công cũ (script CLI +
UI xem/duyệt) cho 1 điểm đến khác để xác nhận KHÔNG có gì hỏng sau khi đổi
PK (test hồi quy bắt buộc, vì đây là sửa trên tính năng đang chạy thật).

### Giai đoạn B — Use case backend gọi Gemini + GSG (phụ thuộc A)

- **B1. Quyết định model — ĐÃ CÓ CƠ SỞ CHỌN, không phải mở**: theo đúng
  nguyên tắc người dùng đặt ra từ đầu chuỗi phân tích này (mô hình chính
  Flash cho tác vụ hàng loạt/structured output, Pro chỉ dành cho nội dung
  "Key/Featured" cần văn phong sâu) — trích xuất GSG là tác vụ HÀNG LOẠT
  (300 điểm đến) + CẦN JSON chuẩn xác, không cần văn phong → dùng
  **`gemini-3.6-flash`**, KHÔNG dùng `gemini-3.1-pro-preview` (đắt hơn
  ~1.3-1.6 lần, dành riêng cho viết bài Flagship). Nếu sau khi chạy thử B
  thấy chất lượng trích xuất Flash không đạt (vd bỏ sót field hay có),
  cân nhắc nâng lên Pro CHO RIÊNG các điểm đến Flagship — không đổi mặc
  định chung.
- **B2. `ExtractDestinationInfoGsgUseCase`** (application layer, theo đúng 4
  lớp kiến trúc): input `slug`; đọc destination hiện tại (tên, tỉnh — dùng
  làm ngữ cảnh search); gọi `GeminiContentAiProvider` (hoặc mở rộng
  interface `ContentAiProvider` nếu cần truyền `tools: [{google_search:{}}]`
  — CẦN QUYẾT ĐỊNH: thêm `tools` vào `StructuredGenerationRequest` như
  `temperature` (A5), giữ optional, chỉ Gemini đọc) với `temperature: 0.1`,
  `responseJsonSchema` = `z.toJSONSchema(z.array(destinationAiExtractionFieldItemSchema))`,
  system prompt theo đúng nội dung nháp §5.4; ghi `currentValue` cho từng
  field bằng giá trị THẬT đọc trước khi gọi AI (đúng nguyên tắc skill thủ
  công bước 6); dùng hàm dedupe chung (A4) rồi upsert qua repository
  (`source='gsg'`); log qua `AI_USAGE_RECORDER` với
  `operation: "extract-destination-gsg"`.
- **B3. Endpoint `POST /destinations/:slug/ai-extraction/gsg`** — trigger
  use case B2, trả về `DestinationAiExtraction` (nguồn `gsg`) giống response
  shape hiện có.

**DoD Giai đoạn B**: chạy thật B3 cho "dalat-fairytale-land" (đã có sẵn kết
quả Skill để SO SÁNH — biết trước phần lớn giá trị đúng phải ra gì); spot
check: địa chỉ/giờ mở cửa/giá vé GSG trả về có khớp hợp lý với dữ liệu Skill
đã duyệt không (không cần giống 100%, nhưng lệch lớn phải điều tra prompt);
xác nhận dòng ghi vào bảng có `source='gsg'`, KHÔNG đụng dòng `source='skill'`
đã có; xác nhận log xuất hiện đúng trong `/usage` với `operation` đúng tên,
`costUsd` > 0 (tính đúng theo bảng giá `gemini-pricing.ts`).

### Giai đoạn C — CMS: 3 nút + bảng so sánh 4 cột (phụ thuộc A; nên có B xong để test bằng dữ liệu GSG thật, nhưng có thể dựng UI sớm bằng dữ liệu ghi tay — giống cách Giai đoạn 3 cũ độc lập Giai đoạn 2)

- **C1.** Sửa `GET :slug/ai-extraction` (hoặc thêm route mới) trả về MẢNG
  0-2 phần tử (Skill + GSG nếu có) thay vì 1 object — dùng `findAllBySlug`
  (A3).
- **C2.** Đổi `DestinationAiExtractionPanel` thành 3 nút: "Xem Skill" (bảng
  2 cột như hiện tại, không đổi), "Xem GSG" (bảng tương tự + banner cảnh
  báo "nguồn tự động, chưa xác minh theo từng URL cụ thể" — đúng §5.0),
  "So sánh 2 nguồn" (bảng 4 cột: Hiện tại | Skill | GSG | chọn nguồn — radio
  cho field cứng loại trừ lẫn nhau, checkbox riêng cho `externalReviewUrl`
  vì là merge không loại trừ). Route accept cần nhận thêm thông tin CHỌN
  NGUỒN nào cho từng field (đổi shape request `acceptedIndexes` hiện tại —
  cần thiết kế lại khi code, không chỉ thêm tham số).
- **C3.** Nút "Chạy trích xuất GSG" ngay trong UI (gọi B3) — khác biệt cố ý
  so với Skill (vẫn phải qua Claude Code) — đây là lý do chính làm nhánh
  GSG: tự động hoá được trong app.
- **C4.** 2 khối "Tóm tắt cho AI viết bài" hiển thị RIÊNG (Skill/GSG), không
  gộp — khớp `aiReferenceSummary`/`aiReferenceSummaryGsg`.
- **C5.** Note giải thích 2 mức temperature (trích xuất 0.1 vs viết bài
  0.5-0.6) — thêm vào đúng khối ghi chú model Gemini đã có sẵn
  (`[slug]/page.tsx` quanh dòng 1197, `articles/new/page.tsx` quanh dòng 134).

**DoD Giai đoạn C**: Playwright xác nhận đủ luồng trên "dalat-fairytale-land"
(đã có cả Skill lẫn GSG sau Giai đoạn B) — mở 3 bảng đúng dữ liệu, bấm nút
"Chạy trích xuất GSG" ra kết quả mới, bảng so sánh 4 cột chọn đúng nguồn rồi
ghi đúng field thật (kiểm bằng query DB sau khi bấm Chấp nhận), field
`externalReviewUrl` merge đúng cả 2 nguồn không trùng lặp.

### Giai đoạn D — Prompt viết bài: gộp 3 nguồn + điều kiện hoá thân bài cũ + temperature (phụ thuộc A cho cột tồn tại; CÓ THỂ test bằng cách ghi tay cột `_gsg` trước khi B xong, không phải chờ B)

- **D1.** Sửa `buildSourceContext()` (`create-destination-job.usecase.ts:321-325`)
  — tách 1 khối hiện tại thành tối đa 3 khối tách nhãn nguồn (Skill/GSG/Ghi
  chú người quản trị), chỉ đưa khối đang có giá trị (§5.3).
  - Đổi tên đọc để rõ nguồn: `destination.aiReferenceSummary` (giữ, hiểu là
    "Skill") + `destination.aiReferenceSummaryGsg` (mới).
- **D2.** Điều kiện hoá `MAX_OLD_CONTENT_CHARS` (`create-destination-job.usecase.ts:303-312`):
  bỏ hẳn khối thân bài dài khi ĐÃ có ít nhất 1 trong 2 tóm tắt; giữ 4 dòng
  quick-fact luôn.
- **D3.** **QUYẾT ĐỊNH CẦN CHỌN TRƯỚC KHI CODE** (không tự chọn hộ — 2 mức
  đầu tư khác nhau):
  - **Mức A — áp dụng toàn site**: sửa thẳng `temperature: 0.3` →
    `0.5`-`0.6` trong `gemini-content-ai.provider.ts` (đơn giản, 1 dòng) —
    NHƯNG ảnh hưởng CẢ laruki/dochoi3s (dùng chung `PromptBuilder`), không
    chỉ dichoithoi — cần người dùng xác nhận muốn áp dụng rộng vậy.
  - **Mức B — scope riêng cho bài viết điểm đến**: truyền `temperature` qua
    `PromptJobContext` → `StructuredGenerationRequest` (dùng field mới ở A5)
    từ `create-destination-job.usecase.ts`, để mặc định 0.3 (hoặc để trống)
    cho pipeline chung, chỉ set 0.5-0.6 khi gọi từ destination — nhiều việc
    hơn (phải sửa `PromptBuilder.baseVars`/`buildOutline`/`buildContent`
    nhận thêm tham số) nhưng không ảnh hưởng site khác.
- **D4.** Thực sự tạo cột GSG-summary rồi set nhánh D1 hoạt động — không phụ
  thuộc B code xong, có thể `UPDATE` tay cột `ai_reference_summary_gsg` cho
  1 điểm đến test.

**DoD Giai đoạn D**: tạo job test cho điểm đến ĐÃ có cả 2 tóm tắt (thật từ B
hoặc ghi tay) → `source_context` sinh ra có ĐỦ 3 khối tách nhãn, KHÔNG có
khối "Thân bài hiện tại"; điểm đến KHÁC hoàn toàn chưa có tóm tắt nào → vẫn
có khối "Thân bài hiện tại" như hành vi cũ (test hồi quy — không được làm
hỏng trường hợp chưa trích xuất); nếu chọn Mức A ở D3 — xác nhận 1 job test
trên site laruki/dochoi3s (không phải dichoithoi) vẫn generate được bình
thường với temperature mới, không lỗi.

### Giai đoạn E (sau, KHÔNG phải ưu tiên bây giờ) — Rollout hàng loạt

Sau khi A-D xong và DoD pass hết: chạy GSG cho phần còn lại trong 275 POI
(ưu tiên 188 POI CHƯA có `google_maps_url`/`ai_reference_urls` — nhóm không
chạy được Skill thủ công, xem §5.0) — theo dõi chi phí thực qua `/usage`
(operation `extract-destination-gsg`), review 1 mẫu kết quả trước khi chạy
đại trà toàn bộ (không tự động accept hàng loạt — vẫn qua duyệt tay từng
điểm theo đúng nguyên tắc §1).

### Thứ tự tổng thể

A → (B song song D, cả 2 chỉ phụ thuộc A) → C (nên đợi B để test dữ liệu
thật, có thể dựng UI sớm hơn bằng data tay) → E (sau).

### Việc CẦN người dùng xác nhận trước khi bắt đầu code Giai đoạn A — ĐÃ TỰ QUYẾT khi build 25/07/2026

Người dùng yêu cầu "làm toàn bộ" — 2 điểm mở tự quyết theo hướng rủi ro thấp
nhất, ghi lại ở đây để biết đã chọn gì:

1. D3: chọn **Mức B** (scope riêng dichoithoi, KHÔNG đụng laruki/dochoi3s) —
   qua `PromptJobContext.temperature`, chỉ set 0.5 khi `articleType ===
   "guide-diem-den"` (`generate-content.usecase.ts`).
2. B2: thêm `useGoogleSearch?: boolean` vào `StructuredGenerationRequest`
   (cùng cách với `temperature`) — Gemini provider dịch thành
   `tools: [{ googleSearch: {} }]` (field JS SDK, khác `google_search` raw
   API).

### Giai đoạn A-D — ĐÃ BUILD + VERIFY BẰNG DỮ LIỆU THẬT (25/07/2026)

Test thật trên `dalat-fairytale-land` qua API chạy local (không phải chỉ
đọc code):

- Migration chạy sạch; dòng cũ backfill đúng `source='skill'`.
- Gọi `POST /destinations/dalat-fairytale-land/ai-extraction/gsg` thật (model
  `gemini-3.6-flash` + `google_search`) — Gemini tự tìm đúng địa chỉ/SĐT/giờ
  mở cửa/giá vé/link Facebook, ghi vào dòng `source='gsg'` RIÊNG, không đụng
  dòng `source='skill'` đã có (verify bằng query DB trực tiếp).
- **Bug thật phát hiện qua test, đã sửa**: response schema ban đầu dùng
  `newValue: z.unknown()` cho GSG — quá lỏng, Gemini trả `openingHours.periods`
  sai dạng (`[">",1,0]` thay vì mảng object). Sửa thành union chặt
  (`z.union([z.string(), destinationOpeningHoursSchema,
  externalReviewUrlItemSchema, z.array(priceBreakdownItemSchema)])`) — test
  lại ra đúng shape. Bài học: `responseJsonSchema` cần schema đủ chặt cho
  field lồng nhau, `z.unknown()` không đủ hướng dẫn cho structured output.
- `POST .../ai-extraction/accept` với `source="gsg"` ghi đúng
  `ai_reference_summary_gsg` (KHÔNG đụng `ai_reference_summary` của Skill) —
  verify bằng query DB, 2 cột có nội dung khác nhau như thiết kế.
- `GET /content/jobs?siteCode=dichoithoi` và `?aiProvider=gemini` lọc đúng
  trên data thật (39 job → 28/19 sau lọc).
- `POST /destinations/dalat-fairytale-land/jobs/preview` (mode update) —
  `sourceContext` có ĐỦ 2 nhãn "Skill đọc kỹ"/"Google Search tự động", KHÔNG
  còn khối "Thân bài hiện tại". Test hồi quy điểm đến KHÁC (`ban-lim-mong-yen-bai`,
  chưa từng trích xuất) — vẫn CÓ khối "Thân bài hiện tại" như hành vi cũ.
- Log `ai_usage_logs` có `operation="extract-destination-gsg"`, cost tính
  đúng theo bảng giá `gemini-3.6-flash` ($1.5/$7.5 per 1M).
- `pnpm --filter @zinoflow/api test`: 418/418 pass. Typecheck + `next build`
  production sạch cho web.
- **Sự cố phụ trong lúc verify (không phải bug code)**: `packages/contracts`
  build output (`dist/`) bị cũ sau khi sửa thêm field mới → `.next` cache của
  web dev server tham chiếu vendor chunk đã mất → lỗi 500 "Cannot find module
  './vendor-chunks/zod...'". Sửa bằng rebuild contracts + xoá `.next` + restart
  dev server (PID node ở port 3005) — không phải lỗi logic, chỉ là quy trình
  dev cần rebuild/restart sau khi sửa package dùng chung.
- **Chưa verify**: click-through UI thật qua trình duyệt (3 nút Skill/GSG/So
  sánh, bảng so sánh 4 cột) — Playwright không khả dụng trong phiên build
  này, chỉ verify được qua `next build` sạch + response API đúng + page trả
  200. Nên tự tay bấm thử trong CMS trước khi coi Giai đoạn C là hoàn toàn
  ổn.
