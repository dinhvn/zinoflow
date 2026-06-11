# Copilot Guardrails for Image Tool

## Mục đích
Chuẩn hóa cách yêu cầu Copilot để tạo code ảnh đúng kiến trúc và không bị lệch preview/export.

## Guardrails bắt buộc
1. Mọi thay đổi liên quan layout phải sửa trong shared composition trước.
2. Không nhân bản logic layout ở UI hoặc render service.
3. UI chỉ build props và gửi nguyên props đó sang export API.
4. Mọi payload mới phải có schema validate và ví dụ request/response.
5. Mọi field mới thêm theo additive-only (tránh rename field cũ).

## Checklist khi thêm template mới
1. Update shared types.
2. Update composition mới.
3. Update schema validate backend.
4. Update UI controls.
5. Update docs payload và ví dụ.

## Prompt mẫu cho Copilot
### Prompt 1 - Thêm field payload
"Thêm field `badgeText` vào thumbnail payload theo hướng backward-compatible. Cập nhật shared type, zod schema validate backend, UI controls, và docs API. Không thay đổi tên field cũ."

### Prompt 2 - Sửa layout component
"Sửa layout template `TemplateA` trong shared composition để title không tràn khi > 70 ký tự. Không thêm logic layout ở UI overlay hoặc backend."

### Prompt 3 - Thêm template mới
"Tạo template mới `TemplateSaleGrid` từ shared composition. Giới hạn highlights tối đa 4. Cập nhật đầy đủ type, schema, UI form, và API docs với ví dụ request/response."

## Anti-pattern cần tránh
1. Sửa preview cho đúng bằng CSS tạm nhưng không update props.
2. Backend render dùng component khác với UI player.
3. Bỏ validate payload để tăng tốc dev.
4. Hardcode URL asset kiểu relative path phía frontend.

## Quy tắc review PR
1. Có thay đổi shared composition chưa?
2. Có cập nhật schema và docs contract chưa?
3. Có test smoke route export chưa?
4. Có kiểm tra preview/export parity với dataset mẫu chưa?
