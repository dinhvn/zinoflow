---
name: dichoithoi-extract-destination-info
description: Khi người dùng cung cấp tên điểm đến dichoithoi + link Google Maps + danh sách website tham khảo và yêu cầu Claude đọc/trích xuất thông tin ("trích xuất thông tin cho điểm đến X", "đọc giúp Google Maps + web tham khảo của X"). Đọc kỹ từng nguồn, trích xuất tên/địa chỉ/SĐT/website/giờ mở cửa/mô tả ngắn/link đánh giá ngoài/tóm tắt cho AI viết bài, lưu vào bảng staging dichoithoi_destination_ai_extractions để CMS hiện bảng so sánh cũ/mới cho người dùng duyệt. Xem đầy đủ thiết kế ở docs/dichoithoi/dichoithoi-destination-ai-extraction-plan.md. Thay thế skill dichoithoi-summarize-references (đã gộp).
---

# Dichoithoi — Trích xuất thông tin điểm đến từ Google Maps + web tham khảo

## Bối cảnh

Skill này ghi vào bảng `dichoithoi_destination_ai_extractions` (Postgres,
zinoflow) — thiết kế ở `docs/dichoithoi/dichoithoi-destination-ai-extraction-plan.md`
§2.1. Giai đoạn 1 (bảng staging + 2 cột thật `opening_hours`/`ai_reference_summary`)
và Giai đoạn 3 (UI xem + duyệt trong CMS) đã build xong — skill này là Giai
đoạn 2, chạy trực tiếp qua Claude Code. API zinoflow phải đang chạy local
(`pnpm dev`, mặc định `http://localhost:3001/api`) để dùng được 2 script hỗ
trợ ở dưới.

## Nguyên tắc bắt buộc — không được bỏ qua

1. **KHÔNG dùng kiến thức nền (trí nhớ/kiến thức chung) cho dữ liệu CỨNG**
   (số điện thoại, giờ mở cửa, địa chỉ, giá vé, link Facebook/TripAdvisor/
   đánh giá ngoài) — CHỈ điền nếu tìm thấy trực tiếp trong Google Maps hoặc website
   tham khảo được cung cấp. Không tìm thấy → đánh dấu `found:false`, ghi
   `newValue:null`, KHÔNG suy đoán. Lý do: kiến thức nền có thể cũ/sai, và
   sai ở dữ liệu cứng (SĐT, giá, giờ) nguy hiểm hơn nhiều so với văn bản tự
   do vì người đọc khó tự phát hiện.
2. Field MỀM (mô tả ngắn, tóm tắt cho AI viết bài `aiReferenceSummary`,
   đánh giá biên tập `editorialReview`) — được dùng kiến thức nền để viết
   mượt câu chữ, nhưng KHÔNG thêm sự thật mới ngoài nguồn. **Giá trị các
   field này CHỈ chứa nội dung hữu ích cho người đọc/viết bài** — KHÔNG
   chèn ghi chú kiểu "(xác nhận bởi N nguồn)", "(chưa rõ...)", "(cần xác
   minh)" vào GIỮA câu văn; mọi ghi chú về độ tin cậy/nguồn/nghi vấn
   chuyển hết sang `note` của field (cột "Ghi chú" riêng trong CMS).
3. **Nguồn MÂU THUẪN nhau (vd giá vé/ngưỡng chiều cao/giờ khác nhau giữa
   2 web) — TỰ ĐÁNH GIÁ VÀ CHỌN 1 giá trị hợp lý nhất** (ưu tiên đa số
   nguồn thống nhất, nguồn chính thức/Google Maps đáng tin hơn blog/web
   tổng hợp) để `newValue` NGẮN GỌN, ĐÚNG ĐỊNH DẠNG, sẵn sàng dùng ngay
   nếu người dùng chấp nhận — KHÔNG nhét cả 2 phương án vào `newValue`
   làm giá trị dài dòng khó đọc. Toàn bộ lý do chọn + phương án còn lại bị
   loại ghi vào `note` của field để người dùng tự quyết có chấp nhận hay
   không (đổi từ nguyên tắc cũ 16/07/2026 — người dùng xác nhận muốn vậy
   sau khi thấy `note` bị nhồi quá nhiều thông tin vào value).
4. Tiếng Việt có dấu đầy đủ cho mọi giá trị text.

## Quy trình

1. **Xác định điểm đến + lấy bối cảnh hiện có**: người dùng chỉ cần cho
   TÊN điểm đến (không bắt phải nhớ/nhập lại slug, link Google Maps, hay
   danh sách web tham khảo mỗi lần). Chạy ngay:

   ```
   node .claude/skills/dichoithoi-extract-destination-info/scripts/get-context.js "<tên điểm đến>"
   ```

   Script tự tìm slug (khớp trực tiếp hoặc tìm kiếm theo tên qua API — nếu
   ra nhiều kết quả sẽ liệt kê để chạy lại với đúng slug), rồi in:
   `googleMapsUrl`, `contactWebsite`, danh sách `aiReferenceUrls` đã lưu
   sẵn, giá trị HIỆN TẠI của cả 11 field (dùng làm `currentValue`), và
   trạng thái bảng staging lần trước (nếu có). KHÔNG tự bịa/đoán các URL
   này — nếu script báo "chưa có", hỏi người dùng cung cấp trước khi đọc
   nguồn nào. Nếu người dùng đã tự cho sẵn URL trong yêu cầu, dùng đúng
   URL đó, không cần chạy script (script chỉ để tự tra khi thiếu).
2. **Đọc Google Maps** bằng WebFetch — đây là nguồn TỐT NHẤT cho giờ mở
   cửa (business listing Google thường có giờ theo từng ngày trong tuần)
   và địa chỉ/toạ độ chuẩn. Trích `openingHours` dạng:
   `{ note: "7h30 - 17h00 hằng ngày", periods: [{days:["Mo",...,"Su"], opens:"07:30", closes:"17:00"}] }`
   — nếu các ngày trong tuần giống nhau, gộp 1 period; nếu khác nhau theo
   ngày, tách nhiều period. KHÔNG tự suy ngày đóng cửa/giờ nếu Maps không
   ghi rõ.
   **WebFetch THƯỜNG THẤT BẠI với Google Maps** (trang JS nặng, trả về
   rỗng/"không có nội dung") và với site có chặn bot như Klook (403) —
   khi gặp trường hợp này, chuyển sang đọc bằng **Playwright** (đã kiểm
   chứng hoạt động tốt 16/07/2026): `browser_navigate` tới URL, nếu là
   link share ngắn/không ra đúng địa điểm thì gõ lại tên điểm đến vào ô
   tìm kiếm Maps (combobox) rồi Enter, bấm vào đúng kết quả khớp tên, sau
   đó bấm nút "Hours" trong panel để mở bảng giờ đầy đủ 7 ngày (dùng
   `browser_find` với regex tìm "Monday|Tuesday|..." để lấy nhanh). Chỉ
   báo `found:false` sau khi ĐÃ THỬ CẢ WebFetch lẫn Playwright mà vẫn
   không ra được — không bỏ cuộc ngay sau WebFetch đầu tiên.
3. **Đọc website CHÍNH THỨC** (`contactWebsite`) — dò kỹ: đọc trang chủ
   trước, liệt kê các link menu/điều hướng, rồi ĐỌC THÊM các trang con
   liên quan (giới thiệu, giờ mở cửa, bảng giá, liên hệ...) nếu trang chủ
   có dẫn tới — mục tiêu là hiểu đầy đủ về điểm đến, không dừng ở trang
   chủ. Giới hạn hợp lý (không cần đọc hết mọi trang tin tức/blog nếu
   không liên quan tới 11 field cần trích).
4. **Đọc từng website THAM KHẢO khác** (`aiReferenceUrls`) bằng WebFetch —
   CHỈ đọc đúng 1 URL được cho, đọc TOÀN BỘ nội dung trang đó (không cắt
   cứng như fetch thô 8.000 ký tự trong app), KHÔNG tự crawl sang trang
   con khác của cùng site (khác với website chính thức ở bước 3). Trang
   chặn bot (403 qua WebFetch, vd Klook) — thử lại bằng Playwright
   (`browser_navigate` + `browser_find`/`browser_snapshot`) trước khi kết
   luận không đọc được.
5. **Trích xuất theo đúng 11 field**: `name`, `addressNew`, `contactPhone`,
   `contactWebsite`, `shortDescription`, `metaTitle` (gợi ý nếu chưa có,
   50-60 ký tự, không bắt buộc), `openingHours`, `aiReferenceSummary`,
   `externalReviewUrl`, `priceBreakdown`, `editorialReview`. Chi tiết
   format từng field mềm/đặc biệt:
   - `openingHours`: `note` là câu NGẮN GỌN dạng "Mở cửa hàng ngày
     7h30-17h00" — KHÔNG lặp lại chi tiết periods trong `note` (UI tự ẩn
     `periods` khi lịch đều đặn mỗi ngày, chỉ hiện khi có gì ĐẶC BIỆT).
     Chỉ tách nhiều `periods` (và nhắc trong `note`) khi giờ THỰC SỰ khác
     nhau theo ngày hoặc có ngày nghỉ riêng.
   - `aiReferenceSummary`: tóm tắt tổng hợp — ưu tiên dữ liệu thực tế hữu
     ích cho bài viết: đặc điểm nổi bật, mẹo thực tế. KHÔNG nhét giá vé
     vào đây (đã có field riêng `priceBreakdown`). Xem quy tắc §2 về việc
     không chèn ghi chú nguồn/nghi vấn vào giữa câu.
   - `externalReviewUrl`: mỗi link Facebook/TripAdvisor/trang đánh giá
     tìm được là 1 phần tử riêng, dạng `{label, url}`.
   - `priceBreakdown`: giá vé theo đối tượng — mỗi mức giá 1 phần tử
     riêng, dạng `{audience, price, note}` với `audience` là tên nhóm
     tiếng Việt có dấu NGẮN GỌN (vd "Người lớn", "Trẻ em (1m2-1m4)", "Trẻ
     nhỏ"), `price` là số nguyên VNĐ, `note` (tuỳ chọn) chỉ ghi ĐIỀU KIỆN
     áp dụng thật ngắn (vd "trên 1m4 tính giá người lớn") — KHÔNG ghi
     nguồn/độ tin cậy vào đây. Áp dụng nguyên tắc §3: nếu nguồn cho
     NGƯỠNG/MỨC GIÁ khác nhau, tự chọn 1 phương án hợp lý nhất cho từng
     phần tử, đưa lý do + phương án bị loại vào `note` CỦA FIELD (không
     phải note của từng price item).
   - `editorialReview`: **tái sử dụng cột `editorialReview` đã có sẵn**
     (Phase 28.0, KHÔNG cần cột mới) — viết như 1 đoạn đánh giá biên tập
     mang giọng văn CÁ NHÂN của người đã từng trải nghiệm thực tế (không
     phải liệt kê thông tin khô khan), dựa trên đặc điểm/tiện ích/cảm
     nhận THẬT tìm được từ các nguồn (vd nội dung review thật trên Google
     Maps/Klook) — KHÔNG bịa chi tiết trải nghiệm cụ thể không có căn cứ
     (ngày giờ, tên người, con số chính xác không tìm thấy). Tối đa 500
     ký tự (giới hạn cột `editorial_review`). Nên kết ở nhận định "phù
     hợp với ai / không phù hợp với ai".
6. Với mỗi field: dùng `currentValue` đã đọc được từ script `get-context.js`
   ở bước 1 (giá trị TẠI THỜI ĐIỂM CHẠY, đọc trước khi ghi), để bảng so
   sánh trong CMS ổn định dù DB đổi sau đó.
7. **Upsert vào Postgres qua script** (không tự viết SQL tay) — ghi 1 file
   JSON tạm (vd trong scratchpad) đúng shape:

   ```json
   {
     "sourceUrls": ["<link Google Maps>", "<url tham khảo 1>", "..."],
     "fields": [
       { "key": "addressNew", "newValue": "...", "currentValue": "...", "found": true, "note": null },
       { "key": "externalReviewUrl", "newValue": { "label": "Facebook", "url": "..." }, "currentValue": null, "found": true, "note": null }
     ]
   }
   ```

   (không cần điền `status` — script tự tính), rồi chạy:

   ```
   pnpm --filter @zinoflow/api exec ts-node -T scripts/upsert-destination-ai-extraction.ts <slug> <đường-dẫn-file-json>
   ```

   Script tự SO SÁNH với dòng staging cũ (nếu có): field cùng `key` (khớp
   theo `label` riêng với `externalReviewUrl` vì key này có thể lặp) có
   `newValue` GIỐNG HỆT lần trước VÀ đã `status:accepted` → giữ nguyên
   `accepted` (không đề xuất lại cái đã duyệt); giá trị MỚI khác — tự đặt
   `pending`. In ra số field tìm được + số field giữ nguyên accepted để
   đối chiếu trước khi báo cáo người dùng.
8. **Báo cáo lại người dùng**: field nào trích được, field nào không tìm
   thấy (`found:false`), mâu thuẫn gì giữa các nguồn, URL nào lỗi không
   đọc được, đã đọc thêm những trang con nào của website chính thức —
   người dùng cần biết trước khi mở CMS duyệt.

## Lưu ý

- Đây là quy trình CHỈ chạy được qua chat/VS Code (Claude Code) — không có
  nút gọi trực tiếp trong app (app dùng `IContentAIProvider` qua Anthropic
  API, khác hẳn phiên Claude Code tương tác này).
- KHÔNG tự động ghi đè field thật trong `dichoithoi_destinations` — skill
  này CHỈ ghi vào bảng staging; việc áp dụng vào field thật là hành động
  CMS "Chấp nhận" do người dùng bấm, ngoài phạm vi skill này.
- Không trích xuất gộp nhiều điểm đến vào 1 lượt chạy mơ hồ — mỗi điểm đến
  xử lý riêng, dù các web tham khảo trùng nhau giữa 2 điểm đến.
