AI Content Studio + Thumbnail Studio Engineering Guide
1) Mục tiêu sản phẩm
Xây AI content tool để tạo nội dung video/thumbnail từ dataset có cấu trúc.
Xây Thumbnail Studio cho phép preview tức thời và export PNG đúng 1:1 với preview.
Ưu tiên kiến trúc local-first, module hóa rõ UI, shared composition, backend render/export.
2) Kiến trúc bắt buộc
UI app:
Chỉ xử lý tương tác, state editor, gọi API.
Không chứa render logic phân nhánh phức tạp theo template.
Shared Remotion package:
Chứa toàn bộ composition, types, helper render-safe media.
Là nguồn sự thật duy nhất cho layout thumbnail.
Backend render service:
Validate payload bằng zod.
Chỉ dùng composition từ shared package để render still.
Trả JSON lỗi có error + details rõ ràng.
3) Nguyên tắc vàng để preview và export không lệch
Dùng cùng một component composition cho cả preview và export.
Dùng cùng một kiểu props dùng chung từ shared package.
Dùng cùng composition ID ở UI và backend flow.
UI chỉ build một object props và dùng đúng object đó cho:
Player preview.
API export payload.
Mọi chỉnh sửa kéo-thả/resize phải commit về props dạng dữ liệu, không giữ bằng CSS transform tạm nếu chưa đồng bộ vào props.
4) Luồng dữ liệu chuẩn (tham chiếu implementation hiện tại)
UI chọn source + dataset, map dữ liệu qua data adapter.
UI dựng previewProps theo shared type.
UI preview qua Remotion Player với duration 1 frame cho thumbnail.
UI gọi API export với payload gồm fileName và props.
Backend validate payload qua zod schema.
Backend select composition theo ID, renderStill PNG, trả downloadUrl.
UI tự động tải file sau khi export thành công.
5) Contract payload thumbnail nên giữ ổn định
Trường tối thiểu:
templateId
title
backgroundImageUrl
highlights
Trường mở rộng:
subtitle, kicker, badgeText
accentColor
layout overrides theo phần trăm
font size multipliers
Rule validate:
Giới hạn chuỗi theo độ dài hợp lý.
Giới hạn min/max cho multiplier.
Rule highlight theo template (template nào cho 3, template nào cho 5).
API contract theo hướng additive-only trong cùng major version.
6) Remotion rules quan trọng
Composition thumbnail cố định 1280x720, durationInFrames = 1.
Ảnh và font phải load an toàn:
Dùng render-safe image component.
Dùng delayRender/continueRender khi load font trước render.
Ưu tiên style deterministic, không phụ thuộc runtime random.
Không tách riêng logic layout giữa preview và export.
Khi xử lý media phức tạp hơn still image, kiểm tra tài liệu chính thức của Remotion và FFmpeg trước khi custom pipeline.
7) Asset URL và môi trường host
Asset nội bộ phải resolve qua API host backend, không dùng đường dẫn tương đối frontend.
Cho phép cả URL online và local key.
Data adapter phải normalize path, dedupe candidate, đảm bảo ID unique.
Fallback phải an toàn nếu thiếu ảnh hoặc thiếu dữ liệu phụ.
8) Drag, resize, zoom: nên dùng gì
Trường hợp giống hiện tại (ít layer, overlay text/arrow):
Dùng Pointer Events tự viết.
Tọa độ theo percent để scale đúng mọi độ phân giải.
Clamp biên rõ ràng.
Snap grid tùy chọn.
requestAnimationFrame để update mượt khi kéo.
Trường hợp editor phức tạp hơn (nhiều object, rotate, multi-select):
Ưu tiên Moveable + Selecto.
Trường hợp canvas scene editor nặng:
Ưu tiên React Konva.
Pan/zoom preview:
Dùng react-zoom-pan-pinch.
Chỉ pan/zoom lớp preview viewport.
Tuyệt đối không ghi pan/zoom viewport vào export props.
9) Pattern triển khai drag/resize khuyến nghị
Model dữ liệu:
position xPercent, yPercent
scale
anchor/alignment
Khi drag:
Tính delta theo kích thước vùng preview thực tế.
Convert delta về percent.
Clamp trong biên cho phép.
Snap theo bước lưới khi bật.
Khi resize:
Dùng scale multiplier có min/max.
Cập nhật live state cho overlay editor.
Commit state cuối vào props render khi pointerup.
Không để state editor chỉ tồn tại trong DOM overlay.
10) Checklist done cho Thumbnail Studio
Preview và export trùng layout pixel-level trong 5 bộ dữ liệu mẫu.
Không có mismatch font, asset URL, hoặc tỷ lệ frame.
Export route có validate chặt và lỗi có details.
Có sanitize file name và ngăn path traversal.
Có test smoke cho:
payload hợp lệ
payload thiếu field bắt buộc
highlight vượt giới hạn template
Build UI và backend pass không lỗi TypeScript.
11) Guardrails cho Copilot trong repo mới
Mọi thay đổi liên quan thumbnail phải ưu tiên shared composition trước.
Không nhân bản logic layout sang backend hoặc UI riêng lẻ.
Khi thêm template mới:
update shared type
update composition
update zod schema backend
update UI controls
update docs
Khi sửa payload:
giữ tương thích ngược
tránh rename field phá client cũ
Mọi API mới phải có ví dụ request/response trong docs.
12) Tổ chức thư mục đề xuất cho repo mới
apps/ui-web:
pages/thumbnail-studio
api/thumbnail
adapters/content
apps/render-service:
lib/thumbnails
lib/infra/schemas
remotion/Root
packages/shared-remotion:
compositions/thumbnailStudio
compositions/thumbnailStudio/types
motion/renderSafe media helpers
docs:
architecture/preview-export-parity
api/thumbnail-export
features/thumbnail-studio
13) Mẫu quyết định kỹ thuật
Nếu mục tiêu là consistency preview/export:
chọn shared Remotion composition làm single source of truth.
Nếu mục tiêu là thao tác nhanh UI:
editor overlay chạy tách lớp, commit về props chuẩn hóa.
Nếu mục tiêu là dễ mở rộng:
tách data adapter theo source provider.
Nếu mục tiêu là vận hành ổn định:
backend validate bằng zod và trả lỗi actionable.