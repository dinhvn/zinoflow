---
name: dichoithoi-geocode-review
description: Khi người dùng muốn Claude xem lại các điểm đến dichoithoi mà kết quả "Tìm toạ độ" (quét Google Maps qua Playwright, Giai đoạn 1a/1b) không rõ ràng ("xem giúp mấy điểm ambiguous", "review kết quả tìm toạ độ", "kiểm tra bảng chờ duyệt geocode"), hoặc muốn thử tra 1 điểm cụ thể ("thử điểm này cho tôi xem trước: <tên>"). Dùng Playwright MCP để tự mở từng kết quả, so khớp tên/cụm/tỉnh, xác định đúng ứng viên trong bảng staging hoặc để lại cho người dùng tự tìm tay — KHÔNG tự đoán bừa khi không chắc, và KHÔNG tự bấm "Chấp nhận" thay người dùng. Khi đã chắc chắn khớp 1 điểm, TRANH THỦ trích luôn địa chỉ/SĐT/website hiện có trên trang vào bảng staging trích xuất AI (để skill dichoithoi-extract-destination-info không phải mở lại đúng link Maps này lần sau) và liệt kê link "Web results" cho người dùng chọn thêm vào Website nguồn. Bối cảnh đầy đủ ở docs/dichoithoi/dichoithoi-destination-geocode-audit-plan.md và memory dichoithoi-destination-geocode-audit-plan-open.md (lý do dùng scrape thay Google Places API: billing Maps Platform bị chặn ở khu vực VN).
---

# Dichoithoi — Review kết quả "Tìm toạ độ" (Google Maps qua Playwright)

## Bối cảnh

Tính năng "Tìm toạ độ" dùng `PlaywrightGoogleMapsProvider` — mở 1 cửa sổ
Chrome thật trên máy đang chạy `pnpm dev`, quét Google Maps (KHÔNG còn dùng
Google Places API — billing Maps Platform bị chặn ở khu vực VN, xem memory).
Hợp nhất 06/08/2026: CẢ chế độ từng điểm (nút "🔍 Tìm trên Google Maps" ở tab
"🤖 AI hỗ trợ" trang chi tiết, Group "① Tìm Google Maps" — đứng NGAY TRÊN
Group "② Trích xuất AI" Skill/GSG, cùng 1 chuỗi 3 bước) LẪN hàng loạt (nút
trên `/dichoithoi` — theo bộ lọc hoặc theo checkbox đã tick) đều ghi kết quả
vào CÙNG bảng staging `dichoithoi_destination_geocode_candidates` (mỗi dòng 1
điểm đến, tối đa 5 ứng viên đã xếp hạng theo `confidenceScore`, kèm nhãn xem
trước địa chỉ/SĐT/website/`businessStatus` lúc tìm ra, trạng thái `pending`)
— KHÔNG còn tự điền form/DB nữa. Người dùng duyệt trong
`GeocodeCandidatesPanel` — dùng chung 1 component cho cả xem 1 điểm (prop
`slugFilter`, mở từ nút "📋 Xem/duyệt kết quả" cạnh nút tìm) lẫn xem toàn bộ
(nút "📋 Kết quả tìm toạ độ chờ duyệt" trên trang danh sách) — panel mặc định
chọn ứng viên xếp hạng cao nhất (`candidates[0]`) cho mỗi dòng, người dùng
tick chọn dòng rồi bấm "Chấp nhận".

Phần lớn các dòng có ứng viên #1 vượt trội rõ ràng — người dùng tự duyệt
hàng loạt được ngay, không cần Claude. Skill này chỉ xử lý phần **mơ hồ**
(ứng viên #1 điểm thấp, hoặc #1/#2 sát điểm nhau — dễ chọn nhầm nếu duyệt
hàng loạt không xem kỹ).

## Nguyên tắc BẮT BUỘC

1. **KHÔNG tự đoán khi không đủ căn cứ.** Nếu sau khi xem trang mà vẫn không
   chắc kết quả nào đúng (tên trùng nhiều nơi, không có địa danh/tỉnh nào
   khớp rõ), báo "không rõ, để người dùng tự xem trong panel" — không chọn
   đại 1 ứng viên cho có.
2. **KHÔNG tự bấm "Chấp nhận" thay người dùng.** Skill chỉ BÁO CÁO ứng viên
   đúng (tên + URL) để người dùng tự tick chọn trong panel `/dichoithoi` hoặc
   `/dichoithoi/{slug}` — việc ghi thật vào `dichoithoi_destinations` vẫn là
   hành động CMS "Chấp nhận" do người dùng bấm.
3. Mỗi quyết định phải nêu được **căn cứ cụ thể** khi báo cáo lại (khớp tên +
   đúng tỉnh/cụm cha, hay chỉ khớp tên nhưng khác tỉnh nên loại) — không nói
   chung chung "có vẻ đúng".

## Quy trình

1. Liệt kê các dòng cần xem (CHỈ ĐỌC, không ghi gì):
   ```
   pnpm --filter @zinoflow/api exec ts-node -T scripts/list-ambiguous-geocode-candidates.ts
   ```
   In ra slug + danh sách ứng viên (tên, URL, confidenceScore) của các dòng
   `pending` mà ứng viên #1 chưa đủ tin cậy (mặc định ngưỡng 0.7, hoặc #1/#2
   sát điểm dưới 0.1 — chỉnh qua `--min-confidence=`/`--min-gap=` nếu người
   dùng muốn phạm vi khác).
2. Với mỗi slug, tra thêm tên đầy đủ + `parentSlug` (tên cụm) + `provinceCode`
   (tên tỉnh) từ bảng `dichoithoi_destinations` để có đủ ngữ cảnh so khớp
   (script ở bước 1 không in sẵn — cần join thêm nếu chưa rõ).
3. Dùng Playwright MCP mở TỪNG URL ứng viên đã liệt kê (`mcp__playwright__browser_navigate`
   + `browser_snapshot`, ưu tiên đọc DOM text hơn ảnh chụp màn hình) — so
   khớp: tên (chuẩn hoá bỏ dấu để so, ưu tiên khớp dấu chính xác nếu nhiều
   lựa chọn gần giống), tỉnh/cụm cha, loại hình (nếu tên gợi ý loại hình —
   "thác", "chùa", "biệt thự" — kết quả phải cùng loại, không nhận nhầm quán
   cà phê trùng tên).
   - Lấy URL **NGUYÊN VĂN từ `page.url()`/snapshot, KHÔNG tự gõ lại/rút gọn
     tay** (link Google Maps có phần `!16s...!8m2...` là mã định vị ghim
     chính xác — gõ lại thiếu phần này sẽ mở sai vị trí, lỗi thực tế gặp
     05/08/2026).
4. Nếu xác định được đúng 1 ứng viên trong số 5 đã liệt kê: ghi lại
   `slug → placeId (URL) đúng` để báo cáo — KHÔNG tự gọi API accept (nguyên
   tắc 2). Nếu ứng viên đúng nằm ngoài cả 5 (Google scrape không tìm ra),
   ghi chú rõ "không có trong 5 ứng viên, cần tìm tay".
   - **Tranh thủ trích luôn thông tin đang hiện sẵn trên trang đúng** (không
     bấm thêm nút nào khác) vào bảng staging trích xuất AI — để skill
     `dichoithoi-extract-destination-info` sau này KHÔNG phải mở lại đúng
     link Maps này: đọc `addressNew` (nút "Address"), `contactPhone` (nếu
     có, bỏ qua nếu chỉ thấy "Add phone number"), `contactWebsite` (nếu có,
     bỏ qua nếu chỉ thấy "Add website"). Ghi qua đúng script có sẵn (không
     tự viết SQL):
     ```
     pnpm --filter @zinoflow/api exec ts-node -T scripts/upsert-destination-ai-extraction.ts <slug> <file-json>
     ```
     với `source: "skill"`, `sourceUrls: [url đúng]`, mỗi field tìm được có
     `found: true`; field không thấy trên trang thì BỎ QUA (không ghi
     `found:false` giả — đây chỉ là tiện thể trích nhanh lúc đang mở trang,
     không phải lượt trích xuất đầy đủ). Nếu bảng đã có dòng `source:"skill"`
     từ trước, script tự merge theo `key` (giữ nguyên field đã `accepted`).
   - **Đọc mục "Web results"/"Các kết quả trên web"** ở cuối trang (thường
     là TripAdvisor/Facebook/trang tổng hợp đánh giá) — liệt kê các link tìm
     được cho người dùng xem, **không tự ý ghi vào `aiReferenceUrls`**
     ("Website nguồn để AI đọc thêm" trên CMS) — field này giới hạn CỨNG tối
     đa 5 và ghi THẲNG không qua bước duyệt, nên chỉ thêm link nào người
     dùng xác nhận muốn thêm — ghi qua `POST /destinations/:slug/ai-inputs`
     (`{ userNotes, referenceUrls: [{label, url}, ...] }`, tối đa 5 phần tử,
     PHẢI gửi kèm các `referenceUrls` hiện có — đây là ghi đè toàn bộ mảng,
     không phải append, nên phải GET chi tiết điểm đến trước để lấy
     `aiReferenceUrls`/`aiNotes` hiện tại rồi mới ghép thêm). Nếu đã đủ 5
     slot, báo rõ cho người dùng biết đang đầy, hỏi có muốn thay link nào
     không thay vì tự ý ghi đè.
5. Nếu KHÔNG khớp rõ (nhiều ứng viên na ná, hoặc không có ứng viên nào cùng
   tỉnh/cụm): ghi chú "không rõ" trong báo cáo cuối, không kết luận thay.
6. Báo cáo cho người dùng: với mỗi slug đã xem — ứng viên nào đúng (kèm căn
   cứ ngắn gọn) để họ vào panel "📋 Kết quả tìm toạ độ chờ duyệt" tick đúng
   dòng đó (panel mặc định chọn #1, nếu đúng ứng viên không phải #1 phải nói
   rõ để người dùng đổi lựa chọn trước khi bấm Chấp nhận); slug nào vẫn
   "không rõ" cần tự tìm tay.

## Khi số dòng ambiguous quá nhiều (vài chục+)

Không cố xử lý hết trong 1 lượt — xử lý theo lô nhỏ (vd 15-20 slug/lượt),
báo cáo giữa chừng, để người dùng quyết có tiếp tục lượt sau không. Tránh 1
phiên chat phải mở hàng chục trang liên tiếp — vừa chậm (mỗi trang cách nhau
8-20s do throttle chống bị Google chặn) vừa tốn ngữ cảnh.
