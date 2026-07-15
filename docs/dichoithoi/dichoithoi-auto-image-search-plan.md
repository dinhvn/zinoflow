# Dichoithoi — Tự động tìm ảnh minh hoạ cho nội dung (chưa build)

Ghi lại 15/07/2026, từ ý tưởng người dùng: muốn có 1 nút trong zinoflow —
bấm là hệ thống tự quét xem tag/bài viết nào chưa có ảnh, tự tìm ảnh phù
hợp, tự tải về + upload lên thư viện ảnh (đã thiết kế ở
`dichoithoi-content-image-library-plan.md`), rồi người dùng duyệt. Mục
tiêu: làm nhanh, giảm thao tác thủ công. **Chưa code — chỉ phân tích + ghi
doc.** Phụ thuộc trực tiếp vào Mức A của
`dichoithoi-content-image-library-plan.md` (cần bảng `content_images` +
pipeline upload tồn tại trước).

## 0) Hiện trạng đã audit (15/07/2026)

- Không có tích hợp API tìm ảnh nào trong repo (grep `UNSPLASH`/`PEXELS`/
  `PIXABAY` trong `.env.example` và `apps/api/src` — 0 kết quả). Đây là
  tính năng hoàn toàn mới, không có gì để tái dùng ngoài hạ tầng upload
  (`ImageUploader` port) đã có từ plan thư viện ảnh.
- `dichoithoi-content-image-library-plan.md` đã thiết kế bảng
  `content_images` + token `[[block:image id=...]]` — plan này CHỈ thêm 1
  NGUỒN sinh ra bản ghi trong bảng đó (tự động tìm), không thay đổi cách
  lưu trữ/resolve token đã thiết kế.

## 1) 2 rủi ro thật phải xử lý trước khi thiết kế — không phải chi tiết kỹ thuật phụ

### 1.1 Rủi ro bản quyền

"Tự tìm ảnh" nếu hiểu là tìm trên web mở (Google Images...) rồi tải về dùng
— phần lớn ảnh tìm được KHÔNG có quyền sử dụng thương mại. Site có kiếm
tiền (affiliate) → dùng ảnh không rõ giấy phép là rủi ro pháp lý thật
(khiếu nại bản quyền, gỡ ảnh đột ngột, ảnh hưởng uy tín).

**Quyết định**: CHỈ tìm ảnh qua API ảnh miễn phí có giấy phép thương mại rõ
ràng — không search web mở. Ứng viên: **Pexels** (giấy phép không yêu cầu
credit, an toàn nhất — đề xuất mặc định), Unsplash (miễn phí nhưng khuyến
khích/1 số điều khoản API yêu cầu ghi nguồn + gọi tracking khi dùng ảnh —
cần đọc kỹ điều khoản hiện hành lúc build, không giả định), Pixabay (tương
tự Pexels). Lưu `source`/`sourceUrl`/`photographer` trong `content_images`
để có bằng chứng nguồn gốc, phòng khi cần tra lại.

### 1.2 Rủi ro sai địa điểm — QUAN TRỌNG, quyết định phạm vi tính năng

Ảnh MINH HOẠ CHUNG (món ăn, cảnh sinh hoạt, khung cảnh chung) dùng ảnh stock
là hợp lý. Nhưng ảnh cho **1 địa điểm cụ thể** (vd "Biệt Thự Hằng Nga") cần
ĐÚNG LÀ ảnh công trình đó — ảnh stock tìm theo từ khoá gần đúng
("kiến trúc độc đáo Việt Nam") sẽ KHÔNG phải ảnh thật của địa điểm, gây
hiểu lầm cho người đọc (khác nguyên tắc "không bịa dữ liệu" — ở đây là
không bịa hình ảnh đại diện sai sự thật).

**Quyết định phạm vi**: tính năng tự động tìm CHỈ áp dụng cho nhu cầu ảnh
MINH HOẠ CHUNG (Article nói chung, các đoạn mô tả không gắn với 1 địa điểm
cụ thể). KHÔNG tự tìm ảnh cho field gắn trực tiếp với 1 địa điểm có tên
riêng (vd ảnh hero/gallery của Destination) — những chỗ đó giữ nguyên yêu
cầu upload tay như thiết kế hiện có, tính năng này không đụng vào.

## 2) Thiết kế

### 2.1 Bước "quét thiếu ảnh"

Truy vấn thuần DB (không cần AI) — Article nào (job/draft `articleType=cam-nang`)
KHÔNG có bất kỳ tham chiếu `content_images` nào trong `draftMarkdown`/
`ContentHtml` → liệt kê "chưa có ảnh minh hoạ". Không cần suy đoán, chỉ đếm
số lần token `[[block:image` xuất hiện.

### 2.2 Bước tìm + tải + upload (auto, nhưng luôn ở trạng thái CHỜ DUYỆT)

1. Sinh từ khoá tìm kiếm từ tiêu đề/chủ đề bài viết (vd bài "5 món ăn Đà
   Lạt" → từ khoá "món ăn Việt Nam", "ẩm thực Đà Lạt" — từ khoá CHUNG, không
   dùng tên riêng địa điểm cụ thể, đúng §1.2).
2. Gọi API ảnh miễn phí (Pexels mặc định), lấy 3-5 ảnh ứng viên/bài.
3. Tải về, convert WebP qua `ImageUploader` sẵn có, ghi vào `content_images`
   với **`status = "pending"`** (field mới so với thiết kế gốc — chưa có
   trong plan thư viện ảnh, cần bổ sung khi build cả 2 cùng lúc) + lưu
   `source`/`sourceUrl`/`photographer` (§1.1).
4. **Ảnh `pending` KHÔNG hiện trong danh sách chọn ảnh bình thường của
   editor** (tránh nhầm với ảnh đã duyệt) — chỉ hiện trong màn "Ảnh chờ
   duyệt" riêng.

### 2.3 Màn "Ảnh chờ duyệt"

Trang/khu vực riêng trong `/dichoithoi/thu-vien-anh` (đã thiết kế ở plan
thư viện ảnh) — tab "Chờ duyệt": grid ảnh `status=pending`, kèm bài viết
liên quan + từ khoá đã dùng để tìm. Duyệt (chuyển `status=active`, dùng
được bình thường) hoặc Từ chối (xoá + không tìm lại từ khoá đó nữa trong
lần quét sau — tránh lặp lại đề xuất đã bị từ chối).

### 2.4 Nút kích hoạt

Nút "Tự động tìm ảnh còn thiếu" ở trang thư viện ảnh hoặc trang danh sách
Article — chạy đồng bộ hoặc qua job queue (pg-boss, đã có sẵn hạ tầng job
trong dự án) nếu số lượng bài lớn, tránh block UI khi quét nhiều bài cùng
lúc.

## 3) Kế hoạch triển khai theo giai đoạn

**Phụ thuộc cứng**: Giai đoạn 1-3 của Mức A
(`dichoithoi-content-image-library-plan.md`) phải xong trước — không có
bảng `content_images`/pipeline upload thì không có gì để tính năng này ghi
vào.

### Giai đoạn 1 — Hạ tầng API ảnh (độc lập, có thể làm song song lúc chờ plan thư viện ảnh)

- Đăng ký tài khoản Pexels (miễn phí, cần API key thật — người dùng tự làm,
  giống các việc cần tài khoản thật khác trong dự án).
- Port mới `StockImageSearchPort` (interface, tương tự cách `ImageUploader`
  đã được bọc qua interface — dễ đổi provider sau nếu cần, đúng bài học từ
  quyết định KHÔNG tách token lưu trữ riêng ở plan thư viện ảnh, nhưng lần
  này search-provider có lý do chính đáng hơn để bọc vì rủi ro provider đổi
  điều khoản/tắt API).

**DoD**: gọi thử API Pexels qua script, xác nhận trả về ảnh + license info
đúng định dạng mong đợi.

### Giai đoạn 2 — Bổ sung `status` vào `content_images` (phụ thuộc plan thư viện ảnh Giai đoạn 1)

- Thêm cột `status` (`active`/`pending`) — SỬA lại thiết kế bảng đã có ở
  plan thư viện ảnh, không phải bảng mới. Nếu plan thư viện ảnh đã build
  xong TRƯỚC khi làm tới đây → cần 1 migration thêm cột, không phá dữ liệu
  cũ (mặc định `active` cho ảnh đã có).

**DoD**: migration chạy sạch trên dữ liệu đã có (nếu có); UI editor/thư
viện ảnh hiện tại không bị ảnh hưởng (mặc định vẫn hiện đúng ảnh active).

### Giai đoạn 3 — Job quét + tìm + tải + upload

- 2.1 (quét) → 2.2 (tìm/tải/upload pending) — nên tách 2 bước rõ ràng
  (quét trước, xác nhận danh sách bài thiếu ảnh đúng, rồi mới tốn quota API
  để tìm) tránh gọi API lãng phí nếu bước quét sai.

**DoD**: chạy thử trên 5 bài test — xác nhận đúng bài được chọn (không bỏ
sót bài đã có ảnh, không chọn nhầm bài đã đủ), ảnh tải về đúng chủ đề (spot
check bằng mắt), ghi đúng `status=pending` + đủ metadata nguồn.

### Giai đoạn 4 — Màn duyệt + nút kích hoạt

- 2.3 + 2.4.

**DoD**: Playwright xác nhận luồng đầy đủ — bấm nút → job chạy → ảnh pending
xuất hiện trong tab chờ duyệt → duyệt 1 ảnh → ảnh chuyển active, dùng được
ngay trong editor bài viết.

## Ghi chú quan trọng khi build

KHÔNG bỏ qua §1.1/§1.2 dù muốn làm nhanh — đây là lý do plan này tách biệt
với plan thư viện ảnh gốc thay vì gộp chung, để 2 rủi ro này luôn được nhắc
lại rõ ràng mỗi khi đọc plan, không bị lẫn vào chi tiết kỹ thuật.
