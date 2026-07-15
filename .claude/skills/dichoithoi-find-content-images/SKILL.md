---
name: dichoithoi-find-content-images
description: Khi người dùng yêu cầu Claude tự tìm/tải ảnh minh hoạ cho bài viết/tag còn thiếu ảnh trong dichoithoi ("tự tìm ảnh", "quét bài thiếu ảnh", "tìm ảnh cho tag này giúp tôi"). Tự động quét, tìm qua API ảnh MIỄN PHÍ CÓ GIẤY PHÉP (không search web mở), tải về, upload ở trạng thái CHỜ DUYỆT — không bao giờ tự publish/gắn token vào bài mà chưa qua người dùng xác nhận. Xem đầy đủ thiết kế ở docs/dichoithoi/dichoithoi-auto-image-search-plan.md.
---

# Dichoithoi — Tự tìm ảnh minh hoạ cho nội dung

## 2 nguyên tắc BẮT BUỘC, không được bỏ qua dù người dùng có giục nhanh

1. **KHÔNG tìm ảnh qua web search/Google Images mở** — chỉ dùng API ảnh
   miễn phí có giấy phép thương mại rõ ràng (Pexels mặc định — giấy phép
   không yêu cầu credit; nếu chưa cấu hình API key nào, DỪNG LẠI hỏi người
   dùng lấy key ở đâu, không tự ý dùng nguồn khác để "cho nhanh").
2. **KHÔNG tự tìm ảnh cho 1 địa điểm cụ thể có tên riêng** (vd "Biệt Thự
   Hằng Nga", "Thác Datanla") — ảnh stock tìm theo từ khoá gần đúng sẽ
   KHÔNG phải ảnh thật của địa điểm đó, gây hiểu lầm người đọc. Chỉ áp dụng
   cho nhu cầu ảnh MINH HOẠ CHUNG (món ăn, cảnh sinh hoạt, khung cảnh không
   gắn tên riêng). Nếu không chắc 1 yêu cầu có phải "địa điểm cụ thể" hay
   không — hỏi người dùng, không tự đoán.

Chi tiết đầy đủ 2 rủi ro này (bản quyền + sai địa điểm) và lý do:
`docs/dichoithoi/dichoithoi-auto-image-search-plan.md` §1.

## Điều kiện tiên quyết — kiểm tra trước khi chạy

Skill này phụ thuộc bảng `content_images` + pipeline upload đã thiết kế ở
`docs/dichoithoi/dichoithoi-content-image-library-plan.md` (Mức A). Trước
khi chạy:

1. Kiểm tra bảng `content_images` đã tồn tại trong Postgres chưa (`psql`
   hoặc đọc migration mới nhất). Nếu CHƯA build — báo rõ cho người dùng
   "chưa có nơi lưu, cần build plan thư viện ảnh trước" thay vì tự ý ghi
   tạm vào chỗ khác hoặc bỏ qua bước lưu.
2. Kiểm tra biến môi trường API key ảnh đã cấu hình chưa (`PEXELS_API_KEY`
   hoặc tương đương — tên biến thật tuỳ lúc build, xem `.env.example`).
   Thiếu → dừng, hỏi người dùng.

## Quy trình

1. **Xác định phạm vi** — người dùng chỉ định 1 bài cụ thể, hay muốn quét
   toàn bộ Article thiếu ảnh? Nếu quét toàn bộ: query DB đếm bài
   (`articleType=cam-nang`) không có token `[[block:image` trong
   `draftMarkdown`, liệt kê ra TRƯỚC, xác nhận với người dùng danh sách này
   đúng ý trước khi tốn quota API tìm ảnh (đúng thiết kế Giai đoạn 3 —
   tách quét và tìm thành 2 bước).
2. **Với mỗi bài trong phạm vi đã xác nhận**: đọc tiêu đề/đoạn mở bài, tự
   hỏi "đây là nhu cầu ảnh MINH HOẠ CHUNG hay gắn với 1 địa điểm tên riêng?"
   — áp dụng nguyên tắc 2 ở trên. Sinh 2-3 từ khoá tìm kiếm CHUNG (không
   dùng tên riêng địa điểm).
3. Gọi API Pexels (hoặc provider đã cấu hình) qua `curl`/script, lấy 3-5
   ảnh ứng viên — **hiện danh sách ảnh + nguồn cho người dùng xem TRƯỚC khi
   tải về** (link ảnh, không cần tải hết mọi ứng viên).
4. Người dùng chọn ảnh ưng ý (hoặc tự chọn ảnh có vẻ phù hợp nhất nếu người
   dùng muốn tôi tự quyết — vẫn phải nói rõ đã tự chọn, không giả vờ đó là
   lựa chọn của người dùng) → tải về, convert nếu cần, ghi vào
   `content_images` với `status="pending"` + `source`/`sourceUrl`/
   `photographer` đầy đủ (không được thiếu — đây là bằng chứng nguồn gốc
   pháp lý, không phải chi tiết tuỳ chọn).
5. **KHÔNG tự chèn token `[[block:image id=...]]` vào nội dung bài** — chỉ
   dừng ở bước ảnh đã lên `content_images` trạng thái `pending`, đúng
   nguyên tắc "chờ duyệt" đã chốt trong plan. Việc chèn token vào đúng vị
   trí trong bài vẫn là thao tác của người dùng sau khi duyệt ảnh (hoặc hỏi
   rõ nếu người dùng muốn tôi làm luôn bước này — nhưng mặc định KHÔNG tự
   làm).
6. Báo cáo lại danh sách ảnh đã tải + trạng thái pending, để người dùng vào
   trang thư viện ảnh (hoặc xác nhận trực tiếp qua chat nếu trang UI chưa
   build) duyệt.

## Khi trang "Ảnh chờ duyệt" (§2.3 trong plan) CHƯA build

Nếu UI duyệt chưa tồn tại, vẫn có thể chạy skill này thủ công qua DB/script
— nhưng LUÔN hỏi xác nhận từng ảnh qua chat trước khi ghi `status=active`
(hoặc bỏ hẳn khái niệm active, chỉ dừng ở tải về máy cục bộ chờ người dùng
tự upload tay) — không tự chuyển trạng thái active thay cho UI duyệt chưa
tồn tại.
