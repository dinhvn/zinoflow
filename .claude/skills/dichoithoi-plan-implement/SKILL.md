---
name: dichoithoi-plan-implement
description: Khi phân tích xong 1 tính năng/nâng cấp dichoithoi và cần ghi thành plan doc (chưa build), hoặc khi được yêu cầu "lên plan implement"/"lên kế hoạch triển khai" — đảm bảo plan có cấu trúc giai đoạn + phụ thuộc + Definition of Done, và LUÔN làm 3 bước để plan không bị quên khi hỏi "việc cần làm" sau này (pointer backlog.md, pointer system-overview.md nếu là doc mới, lưu auto-memory). Dùng SAU KHI đã phân tích/audit code thật xong, TRƯỚC KHI coi plan là hoàn tất.
---

# Dichoithoi — Viết plan implement + đảm bảo không bị quên

## Khi nào dùng

- Sau khi đã phân tích/audit code thật xong (không phải trước — plan phải
  dựa trên hiện trạng thật đã verify, không suy đoán) và cần ghi lại thành
  1 plan doc "chưa build" trong `docs/dichoithoi/`.
- Khi người dùng nói rõ "lên plan implement"/"lên kế hoạch triển khai".
- KHÔNG dùng cho việc code ngay — skill này chỉ áp dụng khi mục tiêu là ghi
  doc kế hoạch, chưa code (nếu người dùng muốn code luôn, dùng
  `dichoithoi-next-phase`/`dichoithoi-sync-check` như bình thường).

## Cấu trúc bắt buộc của 1 plan doc

1. Tiêu đề + ngày ghi + 1 câu tóm tắt bối cảnh (từ yêu cầu gì).
2. Mục "Hiện trạng đã audit" — liệt kê rõ đã kiểm tra code thật gì, KHÔNG
   suy đoán ("có thể là...", "chắc là..." không được chấp nhận — phải là
   file:line cụ thể đã đọc).
3. Chia GIAI ĐOẠN (không phải danh sách việc phẳng) — mỗi giai đoạn:
   - Việc cụ thể trong giai đoạn đó.
   - PHỤ THUỘC thật vào giai đoạn nào khác (hoặc "độc lập, làm trước được")
     — không liệt kê thứ tự tuỳ tiện, phải phân tích cái gì THẬT SỰ chặn
     cái gì (dữ liệu cần có trước, schema cần tồn tại trước...).
   - **Definition of Done cụ thể** — không chỉ "build pass", phải có bước
     verify thật (Playwright xem bằng mắt, spot-check ví dụ cụ thể đã biết
     trước kết quả đúng, query dữ liệu thật để xác nhận).
4. Nếu có nhiều mức đầu tư khả thi (như Mức A/B ở plan ảnh) — nêu rõ đánh
   đổi, KHÔNG tự chọn hộ người dùng trừ khi họ đã xác nhận hướng.
5. Nếu phát hiện lệch giữa spec cũ và code thật — ghi rõ là "lệch tài liệu"
   (không phải bug) hoặc "lỗ hổng thật" (cần sửa) — 2 loại khác nhau, đừng
   gộp chung.

## 3 bước bắt buộc SAU KHI viết xong plan — không được bỏ qua

Plan doc viết xong mà không làm 3 bước này thì LẦN SAU hỏi "việc cần làm"
sẽ không nhắc tới nó — đã xảy ra thật trong dự án (phải quay lại bổ sung
sau khi người dùng hỏi thẳng). Luôn làm cả 3, không phải tuỳ chọn:

1. **Thêm pointer vào `docs/dichoithoi/dichoithoi-backlog.md`** — đây là
   nơi skill `dichoithoi-next-phase` và câu hỏi "việc cần làm tiếp" thực sự
   đọc. Format 1 bullet: tên việc + ngày + "(CHƯA BUILD)" + tên file plan +
   tóm tắt 2-3 dòng phần quan trọng nhất (không chép nguyên plan vào đây).
2. **Nếu là plan doc MỚI** (chưa từng có trong danh sách tài liệu) — thêm 1
   dòng vào chuỗi đọc ở `docs/dichoithoi/dichoithoi-system-overview.md`
   (mục "Đọc theo thứ tự").
3. **Lưu 1 memory (auto-memory, type=project)** — tên file
   `dichoithoi-<ten-tinh-nang>-plan-open.md`, nội dung: tóm tắt plan +
   **Why** (bối cảnh/lý do) + **How to apply** (khi nào cần đọc lại plan
   này). Cập nhật `MEMORY.md` index. Đây là kênh nhớ XUYÊN PHIÊN hội thoại
   khác nhau, không phụ thuộc việc có đọc lại chuỗi doc dichoithoi hay
   không — quan trọng cho câu hỏi bất ngờ không nằm trong ngữ cảnh
   dichoithoi rõ ràng.

## Khi plan doc được cập nhật/mở rộng thêm sau (không phải lần viết đầu)

Cập nhật lại tóm tắt ở bước 1 (backlog.md) và memory (bước 3) cho khớp nội
dung mới — đừng để backlog/memory nói về 1 phiên bản cũ của plan đã đổi
nhiều so với lúc ghi lần đầu.

## Khi được hỏi "việc cần làm" (không phải lúc viết plan)

Đọc `dichoithoi-backlog.md` trước — đây là điểm vào duy nhất, không phải tự
nhớ/đoán có plan nào đang mở. Nếu nghi ngờ backlog có thể thiếu (vd câu hỏi
người dùng gợi ý 1 chủ đề cụ thể), tìm thêm trong memory bằng từ khoá liên
quan trước khi trả lời "không có việc gì" — thiếu sót phổ biến là chỉ nhớ
plan gần nhất trong hội thoại hiện tại mà quên các plan cũ hơn đã ghi từ
phiên trước.
