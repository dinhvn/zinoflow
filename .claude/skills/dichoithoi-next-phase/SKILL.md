---
name: dichoithoi-next-phase
description: Khi người dùng nói "tiếp"/"tiếp tục" cho dichoithoi mà không nói rõ việc gì, đọc dichoithoi-implementation-plan.md (và dichoithoi-backlog.md) để xác định phase/sub-phase kế tiếp đúng thứ tự phụ thuộc, tóm tắt mục tiêu + DoD trước khi code. Dùng ở đầu 1 phiên mới hoặc khi ngữ cảnh hội thoại không còn cho biết phase hiện tại là gì.
---

# Dichoithoi — Xác định phase kế tiếp

## Khi nào dùng

- Người dùng gõ "tiếp"/"tiếp tục" nhưng hội thoại hiện tại KHÔNG có phase nào
  đang dở (không phải "tiếp" giữa các sub-phase đã chốt sẵn trong 1 phiên —
  trường hợp đó cứ tiếp tục theo breakdown đã có, không cần đọc lại plan).
- Bắt đầu phiên mới, không có ngữ cảnh compact/summary nhắc phase đang làm.

## Quy trình

1. Đọc `docs/dichoithoi/dichoithoi-implementation-plan.md`, tìm phase đầu
   tiên theo thứ tự CHƯA có nhãn `(ĐÃ XONG ...)` ở tiêu đề `## Phase N`.
   Phase đánh số không nhất thiết tuần tự về thời gian hoàn thành — vài phase
   sau có thể xong trước phase số nhỏ hơn nếu không phụ thuộc — đọc mục
   "Phụ thuộc" của từng phase để xác nhận, không chỉ lấy số nhỏ nhất còn
   thiếu nhãn ĐÃ XONG.
2. Đối chiếu `git log --oneline` gần đây ở CẢ 2 repo (zinoflow, dichoithoi)
   để xác nhận thực tế đã làm tới đâu — plan doc có thể chưa kịp cập nhật
   nhãn ĐÃ XONG dù code đã xong (luôn tin code/git hơn doc nếu lệch nhau, và
   nếu lệch thì cập nhật lại doc).
3. Kiểm tra `docs/dichoithoi/dichoithoi-backlog.md` xem phase sắp làm có
   quyết định/rủi ro nào còn treo cần hỏi người dùng trước không.
4. Nếu phase kế tiếp CHƯA có breakdown chi tiết thành sub-phase (như Phase 18
   từng được chia 18.0–18.5 trước khi code) và là việc lớn ảnh hưởng nhiều
   phần — vào **plan mode** trước, không code thẳng luôn.
5. Nếu phase kế tiếp đã có breakdown rõ (trong plan doc hoặc trong 1 file
   plan riêng đã duyệt) — tóm tắt ngắn gọn mục tiêu + DoD của sub-phase đầu
   tiên rồi bắt đầu code luôn, không cần hỏi lại (đúng tinh thần "tiếp" đã
   được xác lập trong dự án này).
6. Trước khi code phase liên quan tới dichoithoi — chạy qua skill
   `dichoithoi-sync-check` (đồng bộ 2 repo) và skill `dichoithoi-seo-check`
   (nếu phase thêm/sửa tính năng/field hiển thị công khai).

## Lưu ý

- KHÔNG tự chọn phase tiếp theo chỉ vì "nghe hợp lý" — luôn bám theo thứ tự
  phụ thuộc thật ghi trong plan, không phải danh sách ước muốn.
- Nếu plan doc và thực tế code lệch nhau đáng kể (vd phase ghi "chưa làm"
  nhưng code đã có), báo rõ cho người dùng trước khi giả định trạng thái nào
  đúng.
