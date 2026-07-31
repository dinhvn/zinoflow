# Dichoithoi — Quy trình soạn bài cẩm nang có trích xuất nguồn trước khi AI viết (31/07/2026, ✅ ĐÃ BUILD 6 GIAI ĐOẠN)

Ghi lại từ yêu cầu: trước khi AI viết bài cẩm nang, cần 6 bước — (1) nhập
tiêu đề tạm, (2) nhập website tham khảo, (3) Claude Code skill trích xuất
thủ công, (4) trích xuất tự động qua Google Search Grounding, (5) AI viết
bài với prompt chuẩn/SEO tốt/giống người viết thật, (6) duyệt. Khối động
(`[[block:...]]`) và auto-link nội bộ phải giữ nguyên hoạt động.

## 1) Hiện trạng đã audit (code thật, không suy đoán)

- `apps/web/src/app/dichoithoi/articles/new/page.tsx:24-190` — trang tạo
  bài cẩm nang hiện có `topic`/`keywords`/`siteCode` + 1 ô textarea tự do
  "Tư liệu tham khảo" bind thẳng vào `sourceContext` (dòng 142-155) —
  KHÔNG có field danh sách URL riêng, không có gì xử lý phía sau nó.
  `create-content-job.usecase.ts:58` chỉ pass-through
  `sourceContext: request.sourceContext ?? null`.
- `docs/dichoithoi/dichoithoi-destination-ai-extraction-plan.md` — quy
  trình TƯƠNG TỰ đã build cho bài điểm đến (`guide-diem-den`): bảng staging
  `dichoithoi_destination_ai_extractions` PK `(destination_slug, source)`,
  cột `source_urls`/`extracted_at`/`fields` (jsonb); skill Claude Code
  `dichoithoi-extract-destination-info` đọc Google Maps + web tham khảo
  thủ công, ghi qua `scripts/upsert-destination-ai-extraction.ts`; nhánh tự
  động `ExtractDestinationInfoGsgUseCase` (Gemini + Google Search
  Grounding), endpoint `POST /destinations/:slug/ai-extraction/gsg`,
  `GET :slug/ai-extraction`, `POST :slug/ai-extraction/accept`
  (`destinations.controller.ts:575-596`); UI so sánh ở
  `destination-ai-extraction-panel.tsx`. **Toàn bộ gắn CỨNG với entity
  destination** — PK bảng là `destination_slug`, schema field cứng theo
  loại dữ liệu địa danh (`addressNew`, `openingHours`...) — không dùng
  thẳng cho Article được (khác PK, khác shape field).
- `default-prompts.ts:680-777` — prompt cẩm nang hiện có: cấu trúc H2/H3
  (`sectionHeadings: 3-8 mục`, dòng 692), độ dài section 100-200 từ (757),
  intro 80-150 từ (771), ràng buộc SEO cơ bản (metaTitle ≤60,
  metaDescription 50-250 ký tự có từ khoá, 773-775), cấm claim tuyệt đối
  (776), cú pháp `[[block:...]]` (759-767). System prompt dùng chung toàn
  site chỉ nói "chuyên gia viết content affiliate... viết trung thực"
  (`SYSTEM_PROMPT_KEY`, 47-51) — **KHÔNG có persona "viết như người thật"**,
  không có checklist chống văn phong AI/rập khuôn, không có E-E-A-T/semantic
  SEO sâu. Ước tính nền có sẵn: cấu trúc/độ dài/khối động ~70%, persona
  "giống người thật" + SEO nâng cao ~0%.
- `publish-article.usecase.ts:45-46,69,79` — khối động (`ArticleBlockCompiler`)
  và auto-link (`ArticleAutoLinkService`) chạy ở bước **publish** (sau khi
  Approved), tách biệt hoàn toàn với bước trích xuất/generate. Thêm bước
  trích xuất trước khi AI viết KHÔNG xung đột gì — chỉ ảnh hưởng
  `sourceContext` đầu vào của outline/content.
- `dichoithoi-destination-prompt-quality-plan.md` — đã build GĐ0-5
  (29/07/2026): nâng cấp persona/style/gate cho bài điểm đến (chống
  redundancy, gate grounding, bỏ mục tiêu 800 từ rập khuôn...) — pattern
  này tái dùng được cho cẩm nang ở Giai đoạn 5 dưới đây, không cần nghĩ lại
  từ đầu.

## 2) Quyết định đã chốt (31/07/2026, đã hỏi người dùng)

**Bảng staging RIÊNG cho Article** (`dichoithoi_article_ai_extractions`),
KHÔNG tổng quát hoá bảng destination hiện có thành polymorphic — tránh
migration + rủi ro ảnh hưởng flow destination đang chạy production. Có thể
gộp chung sau này nếu 2 hệ ổn định và thấy thật sự đáng.

## 3) Giai đoạn implement

### Giai đoạn 1 — CMS input "website tham khảo" (độc lập, làm trước)
- Thêm cột `content_jobs.reference_urls` (jsonb array of string, nullable
  — CHỈ nghĩa với `articleType=cam-nang`, đúng pattern `coverImageId`/
  `category` đã có) + domain/entity/repository/migration Postgres.
- Trang `articles/new/page.tsx`: thêm ô nhập danh sách URL (textarea mỗi
  dòng 1 URL, hoặc input động add/remove) — GIỮ NGUYÊN ô "Tư liệu tham
  khảo" tự do hiện có cho ghi chú thêm, không thay thế.
- DoD: tạo job cam-nang với `referenceUrls`, verify lưu đúng qua API +
  đọc lại được.

### Giai đoạn 2 — Bảng staging + skill Claude Code trích xuất thủ công
(phụ thuộc Giai đoạn 1 có `reference_urls` để skill biết đọc nguồn nào)
- **CHỐT shape (31/07/2026, đã hỏi người dùng)**: ĐƠN GIẢN HƠN destination
  nhiều — không cần danh sách `{label,value}` theo field cố định. Bảng mới
  `dichoithoi_article_ai_extractions`, PK `(job_id, source)` (`source`:
  `claude-skill`|`gemini-gsg`), cột `source_urls` (jsonb array),
  `extracted_summary` (text/markdown TỰ DO — "thông tin có ích" gộp chung
  1 khối, không tách field), `extracted_at`. Người dùng xác nhận: "trích
  xuất thông tin có ích, bỏ vào 1 field là được" — không thiết kế phức tạp.
- Skill Claude Code mới `dichoithoi-extract-article-info`: đọc 2-3
  `reference_urls` của job, đọc kỹ từng nguồn, tổng hợp thông tin có ích
  liên quan `topic` thành 1 đoạn markdown mạch lạc (không phải liệt kê
  field rời rạc), ghi qua script upsert (giống
  `upsert-destination-ai-extraction.ts` nhưng đơn giản hơn — 1 field text).
- CMS: hiện `extracted_summary` để người dùng đọc/sửa trực tiếp trước khi
  dùng làm `sourceContext` (không cần bảng tick-chọn phức tạp như
  destination vì chỉ có 1 khối text, không phải danh sách field).
- DoD: chạy skill thật trên 1 job thật có `reference_urls`, xác nhận ghi
  đúng bảng, CMS hiện đúng nội dung.

### Giai đoạn 3 — Google Search Grounding tự động
(phụ thuộc Giai đoạn 2 — dùng chung bảng/cột `extracted_summary`)
- `ExtractArticleInfoGsgUseCase` (Gemini + Google Search Grounding) —
  khác destination ở chỗ KHÔNG có toạ độ/địa danh cố định để ground, phải
  grounding theo `topic` + `reference_urls` làm ngữ cảnh truy vấn. Kết quả
  cũng ghi vào `extracted_summary` (source=`gemini-gsg`) — cùng shape đơn
  giản đã chốt ở Giai đoạn 2, không phải schema riêng.
- Endpoint `POST /content/jobs/:jobId/ai-extraction/gsg`,
  `GET :jobId/ai-extraction` — đúng khuôn destination đã có (bỏ endpoint
  `accept` theo field vì không còn danh sách field rời rạc để tick).
- DoD: chạy thật với `GEMINI_API_KEY`, xác nhận kết quả có trích dẫn
  nguồn thật (không bịa — nguyên tắc "không dùng kiến thức nền cho dữ liệu
  cứng" áp dụng y hệt destination-ai-extraction-plan).

### Giai đoạn 4 — Ráp `sourceContext` từ nội dung đã trích xuất
(phụ thuộc Giai đoạn 2+3 có `extracted_summary`)
- Khi generate outline/content cho job cam-nang, build `sourceContext` từ
  `extracted_summary` (người dùng có thể đã sửa tay trong CMS ở Giai đoạn
  2/3 trước khi generate) — cần use-case mới hoặc sửa
  `create-content-job.usecase.ts`, tương tự cách
  `create-destination-job.usecase.ts` lắp `sourceContext` từ
  `aiReferenceSummary`. Đơn giản hơn destination vì không cần gộp nhiều
  field theo thứ tự — chỉ nối `extracted_summary` (nếu có nhiều source,
  nối theo thứ tự claude-skill trước, gemini-gsg sau).
- DoD: generate content thật, xác nhận outline/content dùng đúng thông
  tin đã duyệt, KHÔNG bịa thông tin ngoài nguồn (spot-check 1 job thật).

### Giai đoạn 5 — Nâng cấp prompt cẩm nang (độc lập, làm song song 1-4)
- Bổ sung persona "viết như người thật", checklist chống văn phong
  AI/rập khuôn, SEO nâng cao (semantic keyword, E-E-A-T) vào
  `default-prompts.ts` cho `cam-nang` — tái dùng bài học đã build ở
  `dichoithoi-destination-prompt-quality-plan.md` GĐ0-5 (không nghĩ lại
  từ đầu).
- Cân nhắc thêm gate style/redundancy/grounding tương tự destination nếu
  phù hợp — QUYẾT ĐỊNH ở lúc code, không tự chọn hộ trước.
- DoD: chạy corpus thử với provider thật (không stub), blind review chất
  lượng "giống người viết" trước khi activate — đúng quy trình
  prompt-quality-plan đã áp dụng.

### Giai đoạn 6 — Duyệt (không cần build gì mới)
- State machine review/approve đã dùng chung cho mọi articleType — chỉ
  cần verify luồng end-to-end: job có `reference_urls` → trích xuất (thủ
  công + GSG) → duyệt field → generate (dùng `sourceContext` đã ráp) →
  review/approve → publish (khối động + auto-link giữ nguyên, không đổi
  gì ở bước này).
- DoD: chạy trọn 1 bài thật từ đầu đến publish, xác nhận không bước nào
  bị bỏ qua/lỗi.

## 4) Đã chốt xong tất cả quyết định thiết kế (31/07/2026)

Không còn mục nào "cần bàn thêm" — shape bảng staging đã chốt đơn giản (1
field text `extracted_summary`, không tách nhiều field như destination),
tham khảo 2-3 website thật mỗi bài.

## 5) ✅ ĐÃ BUILD toàn bộ 6 giai đoạn (31/07/2026)

**Kiến trúc thực tế** (đổi 1 điểm so với thiết kế ban đầu, phát hiện lúc
code): `CreateContentJobUseCase` trước đây LUÔN tự động `jobQueue.send()`
ngay khi tạo job (Created → queue → worker generate), không có bước dừng
nào để user trích xuất nguồn trước. Đã sửa: **bài `articleType=cam-nang`
KHÔNG tự queue** khi tạo — job dừng ở "Created", chờ user trích xuất +
lưu `sourceContext` rồi tự bấm nút để bắt đầu. Tái dùng 100% hạ tầng có
sẵn cho bước "bắt đầu sinh nội dung": `Created → GeneratingOutline` đã là
transition hợp lệ trong state machine, và `POST /content/jobs/:id/retry`
(`RetryContentJobUseCase`) vốn dùng để "chạy lại" đã đủ dùng làm nút
"Bắt đầu sinh nội dung" — không cần endpoint mới. Tương tự, `PATCH
/content/jobs/:id` (`EditContentJobUseCase` → `updateGenerationParams`)
đã đủ dùng để lưu `sourceContext` sau khi mở rộng schema + thêm `Created`
vào `EDITABLE_STATUSES` — không cần endpoint mới cho Giai đoạn 4.

- **GĐ1**: `referenceUrls` (contracts/domain/entity/migration
  `1782860000000-ArticleReferenceUrls.ts`), CMS thêm ô nhập (tối đa 5 URL)
  ở `articles/new/page.tsx`, `CreateContentJobUseCase` bỏ qua auto-queue
  khi `articleType=cam-nang`.
- **GĐ2**: bảng `article_ai_extractions` (migration
  `1782870000000-ArticleAiExtractions.ts`, PK `(job_id, source)`, 1 field
  `extracted_summary` text) + entity/repository/`GetArticleAiExtractionUseCase`
  + route `GET /articles/:jobId/ai-extraction`; script
  `scripts/upsert-article-ai-extraction.ts` + skill Claude Code
  `dichoithoi-extract-article-info` (`.claude/skills/`).
- **GĐ3**: `ExtractArticleInfoGsgUseCase` (Gemini `gemini-3.6-flash` +
  Google Search Grounding, temperature 0.1) + route
  `POST /articles/:jobId/ai-extraction/gsg` — response schema chỉ
  `{summary: string}` (đơn giản hơn hẳn bản destination nhiều field).
- **GĐ4**: `contentJobSchema` lộ thêm `sourceContext`;
  `updateContentJobRequestSchema` + `ContentJob.updateGenerationParams()`
  nhận thêm `sourceContext`; `EDITABLE_STATUSES` thêm `"Created"`. CMS:
  component mới `ArticleExtractionPanel` (hiện khi job Created +
  cam-nang) — xem danh sách trích xuất, nút "Chạy Google Search
  Grounding", nút "Điền từ kết quả trích xuất", textarea sourceContext,
  nút "Lưu vào ngữ cảnh nguồn" (PATCH) + nút "Bắt đầu sinh nội dung"
  (POST retry).
- **GĐ5**: hằng số `HUMAN_WRITER_RULE_CAM_NANG` (persona "viết như người
  thật", chống câu mở đầu sáo rỗng, chống mọi câu cùng 1 cấu trúc,
  semantic SEO nhẹ) — chèn vào cả 4 prompt cam-nang
  (`outline`/`section`/`frame`/`content`) trong `default-prompts.ts`,
  KHÔNG đụng `SYSTEM_PROMPT_KEY` dùng chung mọi articleType (tránh ảnh
  hưởng toplist/review/guide-diem-den).
- **GĐ6**: không cần build gì — state machine review/approve đã dùng
  chung; khối động/auto-link vẫn chạy ở bước publish, không đổi.

**DoD đã verify**: `tsc --noEmit` sạch cả `apps/api`/`apps/web`; 60 test
suite / 377 test pass (bao gồm 2 test mới cho hành vi auto-queue theo
articleType + test sourceContext editable khi Created); 2 migration
Postgres đã chạy thật thành công trên DB local.
