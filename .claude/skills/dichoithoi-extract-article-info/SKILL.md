---
name: dichoithoi-extract-article-info
description: Khi người dùng cung cấp 1 job bài cẩm nang dichoithoi (jobId hoặc tiêu đề tạm) + 2-3 website tham khảo và yêu cầu Claude đọc/trích xuất thông tin trước khi AI viết bài ("trích xuất thông tin cho bài X", "đọc giúp mấy trang tham khảo cho bài này"). Đọc kỹ từng nguồn, tổng hợp thông tin có ích thành 1 đoạn văn (không tách field như điểm đến), lưu vào bảng staging article_ai_extractions để CMS hiện cho người dùng đọc/sửa trước khi dùng làm sourceContext. Xem đầy đủ thiết kế ở docs/dichoithoi/dichoithoi-article-ai-extraction-plan.md.
---

# Dichoithoi — Trích xuất thông tin nguồn cho bài cẩm nang

## Bối cảnh

Skill này ghi vào bảng `article_ai_extractions` (Postgres, zinoflow) —
thiết kế ở `docs/dichoithoi/dichoithoi-article-ai-extraction-plan.md` §3
Giai đoạn 2. **Đơn giản hơn hẳn** skill chị em
`dichoithoi-extract-destination-info`: bài cẩm nang không có field cố định
(tên/địa chỉ/SĐT...) — chỉ cần **1 đoạn văn tổng hợp thông tin có ích**,
không tách nhiều field.

## Nguyên tắc bắt buộc

1. **Chỉ dùng thông tin thật sự đọc được** từ website tham khảo được cung
   cấp + kết quả tìm kiếm liên quan trực tiếp chủ đề — KHÔNG bịa số
   liệu/sự kiện không có căn cứ trong nguồn.
2. Nguồn mâu thuẫn nhau (vd giá cả/số liệu khác nhau giữa 2 web) — tự chọn
   1 phương án hợp lý nhất (ưu tiên nguồn chính thức/số đông thống nhất),
   có thể ghi rõ trong đoạn tổng hợp là "theo X" nếu cần thiết cho người
   viết bài biết, không cần giấu.
3. Tiếng Việt có dấu đầy đủ.
4. Đoạn tổng hợp phải THỰC SỰ hữu ích cho người viết bài — ưu tiên: số
   liệu/giá cả cụ thể, kinh nghiệm thực tế, lưu ý quan trọng, thông tin mà
   chỉ nguồn tham khảo mới có (không phải kiến thức phổ biến ai cũng biết).
   Không có gì đáng chú ý thì ghi ngắn gọn nói rõ, không viết dài dòng cho
   có.

## Quy trình

1. **Xác định job + đọc ngữ cảnh hiện có**: người dùng cho `jobId` (hoặc
   tiêu đề tạm để tìm) + danh sách website tham khảo. Nếu chỉ có tiêu đề,
   gọi API để tìm job:
   ```
   GET http://localhost:3001/api/content/jobs?articleType=cam-nang
   ```
   rồi lọc theo `topic` khớp gần đúng. Đọc `referenceUrls` đã lưu sẵn trên
   job (nếu người dùng không cho lại URL, dùng đúng URL đã lưu) — không tự
   bịa URL.
2. **Đọc từng website tham khảo** bằng WebFetch (2-3 trang theo đúng
   `referenceUrls`) — đọc toàn bộ nội dung liên quan tới chủ đề bài, không
   cắt cứng. Trang chặn bot (403) → thử Playwright
   (`browser_navigate` + `browser_snapshot`/`browser_find`) trước khi kết
   luận không đọc được.
3. **Tổng hợp thành 1 đoạn văn** (`summary`, không giới hạn cứng độ dài
   nhưng nên súc tích, không lan man) gồm thông tin có ích tìm được — theo
   đúng nguyên tắc ở trên.
4. **Upsert vào Postgres qua script** (không tự viết SQL tay) — ghi 1 file
   JSON tạm (vd trong scratchpad) đúng shape:

   ```json
   {
     "sourceUrls": ["<url tham khảo 1>", "<url tham khảo 2>"],
     "summary": "..."
   }
   ```

   rồi chạy:

   ```
   pnpm --filter @zinoflow/api exec ts-node -T scripts/upsert-article-ai-extraction.ts <jobId> <đường-dẫn-file-json>
   ```

5. **Báo cáo lại người dùng**: tóm tắt đã đọc được gì, URL nào lỗi không
   đọc được — người dùng cần biết trước khi mở CMS xem/sửa đoạn tổng hợp.

## Lưu ý

- Đây là quy trình CHỈ chạy được qua chat/VS Code (Claude Code) — song
  song với nhánh tự động qua Gemini + Google Search Grounding (nút "Chạy
  Google Search Grounding" trong CMS, không cần Claude Code). 2 nguồn ghi
  vào 2 dòng riêng (`source='claude-skill'` vs `'gemini-gsg'`), không đè
  nhau.
- KHÔNG tự động ghi vào `sourceContext` của job — người dùng đọc/sửa đoạn
  tổng hợp trong CMS rồi tự bấm "Lưu vào ngữ cảnh nguồn" trước khi sinh
  nội dung.
