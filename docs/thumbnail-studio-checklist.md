# Thumbnail Studio Checklist for ZinoFlow

## Mục tiêu
Đảm bảo tool tạo ảnh dùng Remotion trong repo này có:
- Preview và export PNG trùng 1:1.
- Payload ổn định, dễ mở rộng.
- Tích hợp được với CMS cũ qua API.

## P0 - Bắt buộc trước khi code
1. Chốt single source of truth:
- Shared composition package là nguồn duy nhất cho layout.
- UI và backend đều dùng cùng composition ID.

2. Chốt runtime local:
- UI chạy local.
- Render service chạy local.
- Export lưu local folder theo campaign/job.

3. Chốt contract với CMS cũ:
- Endpoint lấy product data.
- Endpoint callback kết quả export (nếu cần).
- Quy ước auth key và timeout/retry.

## P1 - Preview/Export Parity
1. Dùng đúng một object props cho cả:
- Player preview.
- Payload export API.

2. Không tách layout logic ở 2 nơi:
- Không viết layout riêng ở UI overlay và backend.
- Overlay editor chỉ update dữ liệu props.

3. Composition chuẩn:
- 1280x720, durationInFrames = 1.
- Font load an toàn trước render.
- Media load qua render-safe helper.

## P1 - Payload Contract
1. Trường tối thiểu:
- templateId
- title
- backgroundImageUrl
- highlights

2. Trường mở rộng:
- subtitle, kicker, badgeText
- accentColor
- layoutOverrides (percent)
- fontSizeMultipliers

3. Rule validate:
- Max length cho text.
- Min/Max multiplier.
- Giới hạn số lượng highlights theo template.
- API thay đổi theo additive-only trong cùng major.

## P1 - Editor Drag/Resize
1. Lưu state theo dữ liệu:
- xPercent, yPercent
- scale
- anchor/alignment

2. Khi drag/resize:
- Tính delta theo viewport thực.
- Convert sang percent.
- Clamp biên.
- Snap grid (tùy chọn).

3. Không ghi pan/zoom vào export props.

## P1 - Security và Stability
1. Backend validate payload bằng schema.
2. Trả lỗi JSON có error + details actionable.
3. Sanitize fileName và chặn path traversal.
4. Retry có giới hạn cho network/API tới CMS.

## P2 - Testing
1. Smoke test:
- Payload hợp lệ.
- Thiếu field bắt buộc.
- highlights vượt giới hạn.

2. Golden dataset test:
- Ít nhất 5 bộ dữ liệu mẫu.
- So preview/export pixel-level tolerance.

3. Build check:
- UI pass build.
- Render service pass build.
- Type contract không mismatch.

## Definition of Done
1. 5/5 dataset mẫu không lệch preview-export.
2. Export route có validate và lỗi rõ ràng.
3. Kết quả ảnh được lưu và truy xuất ổn định ở local.
4. Tài liệu API request/response đã có ví dụ.
