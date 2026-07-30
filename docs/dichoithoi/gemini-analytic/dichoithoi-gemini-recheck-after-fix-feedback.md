# FEEDBACK & BÁO CÁO CẦN SỬA: DỰ ÁN DICHOITHOI (JOB: THÁC TRIỆU HẢI)

> **Mã Job**: `2b30ca7d-eb04-4abc-9df5-8989e188248c`  
> **Model**: `gemini/gemini-3.6-flash`  
> **Trạng thái**: Pilot có kiểm soát (Cần sửa 2 lỗi Prompt + Edit lại 3 đoạn text trước khi Publish).

---

## 1. ĐÁNH GIÁ TỔNG QUAN (AFTER PROMPT IMPROVEMENT)

- **Điểm tổng thể**: `8.1 / 10` (Tăng mạnh so với bản cũ `6.0 / 10`).
- **Đã khắc phục tốt**:
  - [x] Exact Keyword **"Thác Triệu Hải"** xuất hiện ngay ở 3 từ đầu tiên của `intro`.
  - [x] Triệt tiêu hoàn toàn văn mẫu AI (_"Nếu bạn đang tìm kiếm..."_).
  - [x] Đúng cơ chế Graceful Degradation: `an-gi.items` và `qua-mang-ve.items` trả về `[]` khi thiếu source, không bịa đặt món ăn/quà tặng.
  - [x] Loại bỏ hoàn toàn trường `updateNotice` tự bake cứng ngày tháng.
- **Vấn đề tồn đọng / Regression mới**:
  - [ ] **Lỗi Lịch trình (Severe Regression)**: Bị vi phạm phạm vi POI đơn lẻ, sinh ra lịch trình tour 2N1Đ từ Sài Gòn.
  - [ ] **Lỗi Lặp FAQ**: Các câu FAQ bị lặp 100% ý nghĩa với các thẻ `quickFacts`.
  - [ ] **Lỗi Từ ngữ**: Dùng sai cụm từ trong ngữ cảnh (_"thời tiết rảnh rỗi"_).

---

## 2. ACTION ITEMS DÀNH CHO BIÊN TẬP VIÊN (SỬA TRỰC TIẾP TRÊN DRAFT)

Vui lòng cập nhật 3 vị trí sau trên giao diện CMS ZinoFlow trước khi bấm **Publish**:

### 2.1. Sửa đoạn `sections[lich-trinh]`

- **Nội dung AI hiện tại (LỖI)**:
  > _"Thời lượng thích hợp nhất cho chuyến đi là 2 ngày 1 đêm. Ngày đầu tiên, bạn xuất phát từ Sài Gòn tới trung tâm Đạ Tẻh, di chuyển vào chân thác dựng lều, tắm suối và nướng đồ ăn tối qua đêm. Sang ngày thứ hai, sau khi đón bình minh và dọn dẹp bãi trại, bạn có thể kết hợp ghé thăm Thác Xuân Đài cách đó khoảng 5km hoặc tham quan Hồ Đạ Tẻh trước khi khởi hành trở về."_
- **Sửa lại thành (ĐÚNG STANDARD POI)**:
  > _"Thời lượng thích hợp nhất để tham quan Thác Triệu Hải là khoảng 2 - 4 tiếng nếu đi trong ngày, hoặc trọn vẹn một buổi chiều nếu bạn có kế hoạch cắm trại qua đêm. Do thác nằm tương đối gần các điểm đến khác trong huyện Đạ Tẻh, bạn nên kết hợp ghé thăm Thác Xuân Đài (cách khoảng 3,1km) hoặc Hồ Đạ Tẻh (cách khoảng 6,6km) trong cùng một chuyến đi."_

### 2.2. Sửa từ ngữ trong `sections[mua-nao]`

- **Nội dung AI hiện tại (LỖI)**:
  > _"Lúc này, thời tiết **rảnh rỗi** tạnh ráo, dòng nước trong lành hiền hòa..."_
- **Sửa lại thành**:
  > _"Lúc này, thời tiết tạnh ráo, dòng nước trong lành hiền hòa..."_ _(Xóa từ "rảnh rỗi")_.

### 2.3. Sửa câu hỏi lặp trong `faq[0]`

- **Nội dung AI hiện tại (LỖI)**:
  > **Q**: _"Thác Triệu Hải có thu vé tham quan không?"_  
  > **A**: _"Thác hoàn toàn không thu vé vào cổng..."_ _(Lặp y nguyên quickFacts.ticketPrice)_
- **Sửa lại thành (CÓ GIÁ TRỊ THỰC TẾ HƠN)**:
  > **Q**: _"Có sóng điện thoại hoặc mạng 4G tại khu vực Thác Triệu Hải không?"_  
  > **A**: _"Khu vực chân thác nằm gần kề vùng rừng núi nên sóng điện thoại có thể chập chờn. Du khách nên tải sẵn bản đồ ngoại tuyến và hoàn tất các liên lạc quan trọng trước khi vào khu vực chân thác."_

---

## 3. ACTION ITEMS DÀNH CHO DEV TEAM (CẬP NHẬT PROMPT TEMPLATE)

Vui lòng cập nhật Prompt Key `guide-diem-den.content.vi` trong Database/CMS với 2 điều chỉnh nhỏ sau để ngăn chặn triệt để lỗi lặp:

### 3.1. Thêm Negative Few-Shot cho khối `lich-trinh`

Bổ sung đoạn ràng buộc sau vào phần hướng dẫn `lich-trinh`:

```text
- "lich-trinh": Viết văn xuôi gợi ý thời lượng trải nghiệm TẠI ĐIỂM ĐẾN NÀY (VD: "Nên dành từ 2 - 3 tiếng...", "Thích hợp cho nửa ngày...").
  [CẤM TUYỆT ĐỐI]: KHÔNG viết dạng lịch trình tour nhiều ngày như "Ngày 1: Từ Sài Gòn đi... / Ngày 2: Sáng ăn sáng..." (Đó là bài cẩm nang vùng/tour, KHÔNG PHẢI bài POI lẻ).

```

### 3.2. Siết chặt rule Anti-Redundancy cho `faq`

Bổ sung đoạn cấm sau vào phần hướng dẫn `faq`:

```text
- faq: CẤM HỎI LẠI các chủ đề đã xuất hiện ở QuickFacts (như: Giá vé vào cổng, Giờ mở cửa, Có khách sạn không, Cách đi chính).
  CHỈ HỎI các câu hỏi trải nghiệm thực tế ngách: Sóng điện thoại/4G, Mức độ an toàn khi tắm suối, Điểm gửi xe/gửi đồ, Trang phục khuyên dùng.

```

---
