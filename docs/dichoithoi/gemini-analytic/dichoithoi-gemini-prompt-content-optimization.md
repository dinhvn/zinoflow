# Gemini Prompt Pack — Tối ưu Prompt Tạo Content Dichoithoi

Tài liệu này là prompt copy-paste để gửi Gemini khi mục tiêu chính là nâng chất
lượng prompt tạo nội dung cho trang cụm và trang điểm đến, không mở rộng sang
audit kỹ thuật toàn hệ.

## 1) Prompt chuyên sâu tối ưu prompt tạo nội dung

```text
Bạn là chuyên gia Prompt Engineering + SEO Content Strategy cho website du lịch.

BỐI CẢNH
- Tôi đã có briefing dự án dichoithoi (cấu trúc tỉnh -> cụm -> điểm đến, Type/Tag,
  route public, prompt hiện tại).
- Tôi có kèm ví dụ job thật (outline prompt + outline response, content prompt + content response,
  và quality check nội bộ).
- Tôi chỉ muốn bạn tập trung vào: cải tiến prompt tạo content cho trang điểm đến
  và trang cụm/flagship.

NHIỆM VỤ BỔ SUNG BẮT BUỘC
1. Đọc kỹ ví dụ job thật trước khi phân tích.
2. Trích dẫn bằng chứng từ ví dụ (câu/đoạn cụ thể) khi nhận xét.
3. Chỉ ra rõ:
   - chất lượng tổng thể,
   - mức độ chuẩn SEO,
   - văn phong có giống người thật không,
   - chỗ nào nghe như AI viết,
   - rủi ro lặp ý/thin content.

MỤC TIÊU
1. Làm nội dung hữu ích hơn cho người dùng thật.
2. Khớp search intent hơn theo từng loại trang.
3. Giảm lặp ý, giảm sáo rỗng, tăng chiều sâu thông tin có ích.
4. Tăng SEO bền vững, tránh scaled-content feeling.
5. Hỗ trợ conversion tự nhiên (vé, khách sạn, tour) mà không thành quảng cáo lộ liễu.

RÀNG BUỘC BẮT BUỘC
1. Không đề xuất chung chung.
2. Không đề xuất thêm section mới nếu chưa chỉ ra section cũ thiếu gì.
3. Không phá vỡ ranh giới giữa trang điểm đến và trang cụm.
4. Không tạo nội dung theo kiểu nhồi từ khóa hoặc template hóa máy móc.
5. Luôn ưu tiên theo thứ tự:
   - tổ chức nội dung khoa học,
   - giá trị thực cho người dùng,
   - SEO đúng chuẩn Google.

ĐẦU RA YÊU CẦU
A0. Đánh giá ví dụ job thật trước khi đề xuất cải tiến
1. Tóm tắt nhanh ví dụ đã đọc
2. Điểm mạnh của output hiện tại
3. Điểm yếu của output hiện tại
4. Vấn đề SEO nổi bật
5. Vấn đề văn phong "giống AI"
6. 5 câu/đoạn cần sửa ngay (trích nguyên văn từ ví dụ + lý do)

A. Chẩn đoán prompt hiện tại
1. Điểm mạnh
2. Điểm yếu
3. Rủi ro lặp ý
4. Rủi ro thin content
5. Rủi ro không khớp user intent

B. Tách rõ 2 prompt strategy
1. Strategy cho trang điểm đến (POI)
2. Strategy cho trang cụm/flagship
3. Bảng so sánh khác biệt bắt buộc giữa 2 loại prompt

C. Đề xuất cải tiến prompt ở cấp nguyên tắc
1. Cải tiến input
2. Cải tiến rule viết
3. Cải tiến kiểm soát factual
4. Cải tiến kiểm soát anti-repetition
5. Cải tiến kiểm soát helpfulness
6. Cải tiến kiểm soát conversion fit

D. Viết lại prompt có thể dùng ngay
1. 1 prompt hoàn chỉnh cho POI
2. 1 prompt hoàn chỉnh cho Cụm/Flagship
3. Mỗi prompt phải có:
   - Vai trò model
   - Input context bắt buộc
   - Yêu cầu output rõ ràng
   - Rule cấm
   - Checklist tự kiểm trước khi trả kết quả

E. Bộ tiêu chí chấm đầu ra sau khi AI sinh bài
1. User value score
2. Search intent fit score
3. Distinctiveness score
4. SEO safety score
5. Conversion usefulness score

F. Kế hoạch áp dụng nhanh
1. 3 thay đổi prompt nên làm ngay tuần này
2. 3 thay đổi cần A/B test
3. 3 thay đổi làm sau khi có dữ liệu hành vi user

LƯU Ý VỀ PHONG CÁCH TRẢ LỜI
- Cụ thể, hành động được ngay.
- Tránh lý thuyết dài dòng.
- Mỗi đề xuất phải có lý do và tác động kỳ vọng.
- Không được bỏ qua phần nhận xét ví dụ job thật.
- Không được kết luận nếu không có dẫn chứng từ ví dụ.
```

## 2) Prompt siêu ngắn (khi cần chạy nhanh)

```text
Phân tích prompt tạo content của dichoithoi cho 2 loại trang: điểm đến (POI) và cụm/flagship.

Trước khi đề xuất, bắt buộc đọc ví dụ job thật tôi cung cấp (outline/content prompt + output)
và cho nhận xét ngắn:
- Chất lượng hiện tại ổn/chưa ổn ở đâu
- SEO lỗi gì
- Đoạn nào nghe "AI viết"
- 3 sửa đổi prompt ưu tiên cao nhất rút ra trực tiếp từ ví dụ

Yêu cầu:
1. Chỉ ra 10 vấn đề lớn nhất của prompt hiện tại theo góc nhìn user value + SEO + tránh lặp.
2. Viết lại 2 prompt hoàn chỉnh (POI và flagship) dùng được ngay.
3. Thêm checklist chấm đầu ra gồm: hữu ích, đúng intent, khác biệt, an toàn SEO, hỗ trợ conversion.
4. Đề xuất 5 thay đổi ưu tiên cao nhất có thể triển khai ngay.

Ràng buộc:
- Không nhồi keyword.
- Không viết sáo rỗng.
- Không làm POI và flagship giống nhau.
- Ưu tiên cấu trúc khoa học, giá trị cho người dùng, SEO bền vững.
```
