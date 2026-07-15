---
name: dichoithoi-summarize-references
description: Khi người dùng yêu cầu Claude đọc + tóm tắt website tham khảo (referenceUrls) cho 1 điểm đến dichoithoi hoặc toàn bộ điểm đến còn thiếu ("tóm tắt nguồn tham khảo cho Đà Lạt", "đọc giúp mấy link tham khảo của điểm đến X"). Đọc kỹ từng URL, tổng hợp thành 1 đoạn tóm tắt sạch, ghi vào cột ai_reference_summary để lần sinh bài AI sau ưu tiên dùng thay vì fetch lại URL thô. Xem đầy đủ thiết kế ở docs/dichoithoi/dichoithoi-reference-summary-plan.md.
---

# Dichoithoi — Đọc + tóm tắt website tham khảo cho AI viết bài

## Điều kiện tiên quyết

Skill này ghi vào cột `ai_reference_summary`/`ai_reference_summary_updated_at`
trên bảng mirror Postgres của destination — thiết kế ở
`docs/dichoithoi/dichoithoi-reference-summary-plan.md` §1.1. Nếu cột này
CHƯA tồn tại (Giai đoạn 1 chưa build) — vẫn có thể chạy thử skill và báo
cáo kết quả tóm tắt cho người dùng xem, nhưng PHẢI nói rõ: "cột lưu chưa
tồn tại, tóm tắt này chưa được dùng khi sinh bài AI cho tới khi build xong
Giai đoạn 1" — không được để người dùng tưởng nhầm là đã có tác dụng ngay.

## Quy trình

1. **Xác định phạm vi**: 1 điểm đến cụ thể (theo slug/tên) hay toàn bộ điểm
   đến còn thiếu tóm tắt? Nếu "toàn bộ" — query DB trước, liệt kê danh sách
   điểm đến có `aiReferenceUrls` không rỗng NHƯNG `ai_reference_summary`
   rỗng, xác nhận danh sách với người dùng trước khi đọc hàng loạt (tránh
   đọc nhầm/tốn thời gian nếu danh sách không đúng ý).
2. Với mỗi điểm đến: đọc `aiReferenceUrls` (jsonb, `{label, url}[]`) từ
   Postgres.
3. **Đọc từng URL bằng WebFetch** — đọc TOÀN BỘ nội dung trang, không giới
   hạn cứng như fetch thô trong app (8.000 ký tự) — đây chính là lợi thế so
   với cơ chế cũ. Nếu 1 URL lỗi/không đọc được — ghi chú lại, không chặn
   các URL còn lại.
4. **Tổng hợp thành 1 đoạn tóm tắt sạch, tiếng Việt có dấu đầy đủ** (đúng
   quy tắc dự án) — tập trung dữ liệu thực tế hữu ích cho bài viết điểm
   đến (giờ mở cửa, giá vé, địa chỉ, đặc điểm nổi bật, mẹo thực tế...),
   KHÔNG bịa thêm thông tin không có trong nguồn (đúng nguyên tắc "không
   bịa dữ liệu cứng" — chỉ tổng hợp, không sáng tác). Nếu các nguồn có
   thông tin MÂU THUẪN nhau (vd giá vé khác nhau giữa 2 trang) — ghi rõ cả
   2 trong tóm tắt kèm chú thích nguồn, KHÔNG tự chọn 1 bên đúng.
5. **Trước khi ghi đè**: nếu điểm đến ĐÃ có `ai_reference_summary` — hỏi
   người dùng có muốn ghi đè không (trừ khi người dùng đã nói rõ "làm lại
   toàn bộ"/"ghi đè hết" từ đầu) — tóm tắt cũ có thể đã được người dùng
   dùng và ưng ý, không tự ý thay mà không hỏi.
6. Ghi vào Postgres: `ai_reference_summary` = tóm tắt vừa tạo,
   `ai_reference_summary_updated_at` = thời điểm hiện tại.
7. Báo cáo lại cho người dùng: đã tóm tắt cho những điểm đến nào, URL nào
   đọc lỗi (nếu có), độ dài tóm tắt — để người dùng có thể xem lại nội dung
   trước khi tin tưởng dùng cho lần sinh bài AI tiếp theo.

## Lưu ý

- Không tóm tắt gộp NHIỀU điểm đến vào 1 đoạn chung — mỗi điểm đến 1 bản
  tóm tắt riêng, dù URL tham khảo có trùng nhau giữa 2 điểm đến.
- Đây là quy trình CHỈ chạy được qua chat/VS Code (Claude Code) — không có
  cách gọi từ trong app zinoflow, vì app dùng AI provider qua API
  (`IContentAIProvider`), khác hẳn phiên Claude Code đang chạy tương tác
  với người dùng. Ghi chú này cũng đã hiện trong UI app (field "Website
  nguồn để AI đọc thêm") theo đúng thiết kế ở plan.
