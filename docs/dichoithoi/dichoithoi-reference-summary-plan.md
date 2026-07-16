> **ĐÃ GỘP (16/07/2026)** vào
> `docs/dichoithoi/dichoithoi-destination-ai-extraction-plan.md` — ý tưởng
> tóm tắt tham khảo giờ chỉ là 1 field (`aiReferenceSummary`) trong tính
> năng trích xuất nhiều field (tên/địa chỉ/SĐT/giờ mở cửa/tóm tắt...) từ
> Google Maps + web tham khảo, có bảng duyệt cũ/mới trong CMS. Đọc file mới
> đó thay vì làm theo plan này. Giữ file này lại để tham khảo lịch sử phân
> tích ban đầu (hiện trạng audit 15/07/2026 vẫn đúng, không đổi).

# Dichoithoi — Claude tóm tắt sẵn website tham khảo cho AI viết bài (chưa build)

Ghi lại 15/07/2026, từ ý tưởng người dùng: trước khi AI viết bài điểm đến,
người dùng cung cấp danh sách website tham khảo. Muốn Claude (chạy trong
VS Code, không phải trong app) đọc + tóm tắt các website đó thành 1 nội
dung tổng hợp, lưu vào 1 cột — để lần sinh nội dung AI sau có thể dùng bản
tóm tắt này thay vì fetch lại URL thô. Mục tiêu: Claude đọc hiểu tốt hơn
fetch thô, tiết kiệm token AI generate bài. **Chưa code — chỉ phân tích +
ghi doc.**

## 0) Hiện trạng đã audit (15/07/2026)

Cơ chế "website tham khảo" **đã tồn tại sẵn, hoạt động thật** — không phải
xây từ đầu:

- UI: `apps/web/src/app/dichoithoi/[slug]/page.tsx` — field lặp lại
  label+URL "Website nguồn để AI đọc thêm" (tối đa 5), text hướng dẫn có
  sẵn: "Dán link trang chính thức... AI sẽ đọc nội dung trang và dùng làm
  dữ liệu".
- Contract: `referenceUrlSchema`/`createDestinationJobRequestSchema`
  (`packages/contracts/src/dichoithoi/destination.ts:328-353`) —
  `referenceUrls: array.max(5)`, cộng `userNotes` tự do.
- Fetch thật: `HttpReferenceFetcher`
  (`destination/infrastructure/reference/http-reference-fetcher.ts`) —
  fetch tĩnh (không headless browser), bóc HTML, cắt còn **8.000 ký tự**,
  có SSRF guard, timeout 10s + 1 retry. Lỗi 1 nguồn không chặn cả job (ghi
  chú "không tải được, cần kiểm tra tay").
- `create-destination-job.usecase.ts` (`buildSourceContext()`) — chèn text
  đã fetch vào prompt dưới heading `## Nguồn tham khảo cho "{label}" ({url})`
  — **fetch lại MỖI LẦN generate**, không cache/tóm tắt.
- DB (`destination-mirror.entity.ts`): `aiReferenceUrls` (jsonb, chỉ
  label+url) + `aiNotes` (text tự do) — **không có cột lưu bản tóm tắt/
  digest nào**. Đây đúng là khoảng trống ý tưởng người dùng lấp vào.
- Spec (`dichoithoi-destination-spec.md` §3.6) đã mô tả ý định "gợi ý kèm
  nguồn" nhưng không có cơ chế tóm tắt sẵn — khớp đúng hiện trạng.

## 1) Thiết kế — 2 phần tách biệt

**Phần A (code thật trong app)**: thêm cột lưu tóm tắt + sửa
`buildSourceContext()` ưu tiên dùng tóm tắt thay vì fetch lại.
**Phần B (Claude Code skill, chạy qua chat)**: quy trình Claude đọc + tóm
tắt + ghi vào cột đó — CHỈ chạy được qua VS Code, không có nút trong app
(đúng nhận định của người dùng — app không có cách gọi Claude trực tiếp).

### 1.1 Phần A — Cột mới + ưu tiên dùng tóm tắt

- Cột mới (Postgres, `destination-mirror.entity.ts`):
  `ai_reference_summary` (text, nullable), `ai_reference_summary_updated_at`
  (timestamp, nullable) — biết tóm tắt được tạo khi nào.
- **KHÔNG tự động xoá tóm tắt cũ khi danh sách URL đổi** (tránh mất công
  sức tóm tắt trước đó một cách âm thầm) — thay vào đó hiện rõ trên UI
  "tóm tắt cập nhật lúc X, danh sách nguồn hiện tại có Y link" để người
  dùng TỰ nhận ra khi nào cần tóm tắt lại, không tự động quyết thay.
- `buildSourceContext()` — nếu `ai_reference_summary` có giá trị: dùng
  NGUYÊN bản tóm tắt đó làm `## Tổng hợp tư liệu tham khảo` trong prompt,
  **bỏ qua fetch từng URL** (đúng ý người dùng "có thể bỏ qua link cung cấp
  kia"). Nếu rỗng: giữ hành vi cũ (fetch từng URL như hiện tại) — không phá
  vỡ luồng cũ cho điểm đến chưa từng được Claude tóm tắt.

### 1.2 Phần B — Claude Code skill

Chi tiết đầy đủ trong file skill riêng (`dichoithoi-summarize-references`,
xem mục 2). Tóm tắt quy trình: người dùng mở VS Code, gọi Claude cho 1 điểm
đến hoặc toàn bộ điểm đến còn thiếu tóm tắt → Claude đọc từng URL tham khảo
(dùng WebFetch, đọc kỹ hơn fetch thô 8k ký tự vì không bị cắt cứng) → tổng
hợp thành 1 đoạn tóm tắt sạch, tiếng Việt có dấu → ghi thẳng vào cột
`ai_reference_summary` qua Postgres.

### 1.3 Ghi chú trong app — vì skill chỉ chạy được qua VS Code

Đúng yêu cầu người dùng: KHÔNG thể tạo nút trong app để gọi Claude trực
tiếp (app dùng `IContentAIProvider` — model AI qua API, khác hẳn việc gọi
Claude Code đang chạy trong phiên chat của người dùng). Cần 1 dòng ghi chú
NGAY TẠI field "Website nguồn để AI đọc thêm" trong app, đúng quy tắc mới
"giải thích tính năng ngay tại chỗ dùng" vừa chốt cùng ngày — nội dung đề
xuất: *"💡 Muốn AI đọc kỹ hơn & tiết kiệm token: mở VS Code, nhờ Claude tóm
tắt các nguồn này trước — Claude sẽ tự lưu bản tóm tắt, lần sinh bài sau sẽ
tự ưu tiên dùng."* Kèm hiện trạng thái: "Đã có tóm tắt (cập nhật {ngày})"
hoặc "Chưa có tóm tắt — đang dùng fetch trực tiếp".

## 2) Kế hoạch triển khai theo giai đoạn

### Giai đoạn 1 — Phần A (độc lập, code thật)

- Migration cột mới (§1.1).
- Sửa `buildSourceContext()` — ưu tiên tóm tắt.
- Thêm dòng ghi chú + trạng thái vào UI (§1.3).

**DoD**: migration sạch; test tạo job cho 1 điểm đến CÓ tóm tắt sẵn (ghi
tay vào DB để test) → xác nhận prompt dùng đúng tóm tắt, không có log fetch
URL nào chạy; điểm đến CHƯA có tóm tắt vẫn generate đúng như hành vi cũ
(không phá luồng hiện tại).

### Giai đoạn 2 — Phần B (skill, không phụ thuộc Giai đoạn 1 để BẮT ĐẦU dùng thử)

- Viết skill `dichoithoi-summarize-references` (đã tạo, xem mục 2 dưới).
- **Lưu ý**: skill có thể chạy thử ngay cả khi Giai đoạn 1 chưa xong (đọc +
  tóm tắt + ghi vào cột mới bằng SQL tay) — nhưng tóm tắt sẽ CHƯA được
  dùng trong lúc generate bài cho tới khi Giai đoạn 1 xong (`buildSourceContext()`
  chưa biết đọc cột này). Không có giá trị thực tế nếu chỉ làm B mà không
  làm A — cần cả 2.

**DoD**: chạy thử skill cho 1 điểm đến thật có ≥2 URL tham khảo, xác nhận
tóm tắt đọc đúng thông tin chính (spot-check bằng mắt so với trang gốc),
ghi đúng vào cột, không ghi đè nếu cột đã có giá trị mà chưa được người
dùng yêu cầu ghi đè.

## Thứ tự: Giai đoạn 1 → Giai đoạn 2 (để có giá trị thực tế đầy đủ), nhưng Giai đoạn 2 có thể viết/test độc lập trước.
