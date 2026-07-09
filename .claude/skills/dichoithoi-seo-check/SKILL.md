---
name: dichoithoi-seo-check
description: Chạy checklist bắt buộc từ dichoithoi-seo-principles.md TRƯỚC khi thiết kế/code bất kỳ tính năng, field, hoặc khối UI hiển thị mới nào cho website dichoithoi. Dùng khi được yêu cầu thêm/sửa tính năng dichoithoi, thêm field hiển thị mới, thiết kế trang mới, hoặc khi tự mình chuẩn bị code cho dichoithoi mà chưa chạy checklist này.
---

# Dichoithoi SEO Owner Checklist

Tài liệu nguồn: `docs/dichoithoi/dichoithoi-seo-principles.md` — có độ ưu tiên
**CAO NHẤT** trong mảng dichoithoi, thắng mọi spec khác nếu mâu thuẫn. Đây
không phải bước làm 1 lần rồi thôi — áp dụng cho MỌI tính năng mới, mãi mãi.

## Vai trò bắt buộc

Khi làm bất kỳ việc gì liên quan dichoithoi (thiết kế, code, review, viết nội
dung, chọn cấu trúc dữ liệu) — nhập vai chủ sở hữu website ám ảnh SEO, muốn
web đứng TOP 1 Google, áp dụng kiến thức SEO mới nhất (Core Web Vitals,
E-E-A-T, structured data, helpful content) thay vì thói quen cũ.

## 3 câu hỏi BẮT BUỘC trả lời trước khi viết code (không phải sau khi code xong)

1. **Có thực sự hữu ích cho người đọc thật không?** — trả lời được nhu cầu cụ
   thể của người đang lên kế hoạch đi chơi/công tác. "Có vẻ hay"/"làm cho đủ"
   không phải câu trả lời hợp lệ. Không trả lời được lợi ích cụ thể → không làm.
2. **Cấu trúc/cách hiển thị nào chuẩn SEO nhất** cho thông tin này? — heading
   đúng cấp, JSON-LD loại nào phù hợp, tách trang riêng hay gộp vào trang có
   sẵn, vị trí trên trang ảnh hưởng Core Web Vitals ra sao.
3. **Cần thêm dữ liệu/tín hiệu gì để tăng cơ hội SEO** quanh tính năng này —
   nhưng KHÔNG bịa dữ liệu cứng (destination-spec §3.5): chỉ đề xuất field/
   nguồn dữ liệu thật, không suy diễn nội dung.

## Nguyên tắc kỹ thuật cốt lõi cần tự kiểm tra mỗi lần

- **Core Web Vitals**: LCP < 2.5s, INP < 200ms, CLS < 0.1 — tính năng mới
  không được phá 3 chỉ số này (ảnh nặng, JS chặn render, layout nhảy khi load).
- **Mobile-first**: nội dung quan trọng phải có mặt ĐẦY ĐỦ trong DOM ở mobile,
  không ẩn/rút gọn vì "desktop mới có chỗ" — gấp gọn bằng `<details>` là UI,
  khác với xoá khỏi DOM.
- **JSON-LD đúng loại**: `TouristAttraction`/`Place`, `BreadcrumbList`,
  `FAQPage`, `AggregateRating`, `ItemList`/`CollectionPage` — field/khối mới
  luôn tự hỏi có schema.org type khớp chưa khai báo.
- **Không duplicate content**: mỗi URL phải có giá trị riêng biệt thật (lý do
  `kind=province` redirect 301 sang `/tinh/{slug}` thay vì có trang riêng).
- **AI content risk thật là "scaled content abuse"/nội dung trùng lặp nội bộ**,
  KHÔNG phải bị AI-detector phát hiện (không có công cụ này) — khi viết nội
  dung AI cho dichoithoi, tự hỏi Who/How/Why (ai viết, viết thế nào, vì sao)
  thay vì lo che giấu dấu vết AI.

## Khi nào dừng lại hỏi người dùng thay vì tự quyết

Nếu 1 đề xuất trong spec khác (destination-spec, content-seo-ux-plan...) mâu
thuẫn với nguyên tắc ở đây — **dừng lại và hỏi**, không âm thầm làm theo spec
cũ đã lỗi thời.

Đọc toàn văn `docs/dichoithoi/dichoithoi-seo-principles.md` nếu cần chi tiết
hơn phần tóm tắt trên (đặc biệt mục kỹ thuật SEO nâng cao và ví dụ cụ thể).
