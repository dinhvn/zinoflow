# Copilot Guardrails for Image Tool (Product Collage)

> Cập nhật 2026-06-27: model **product collage** (ghép nhiều sản phẩm vào 1 ảnh đăng FB),
> render Remotion. Doc chuẩn: `docs/specs/image-tool-technical-spec.md`.

## Mục đích
Chuẩn hóa cách yêu cầu Copilot để code ảnh đúng kiến trúc và không lệch preview/export.

## Guardrails bắt buộc
1. Mọi thay đổi layout (grid, cell layout, công thức imageFit/logo) phải sửa trong **shared
   composition package** trước — nguồn sự thật duy nhất cho cả Player và worker.
2. Không nhân bản logic layout ở UI hoặc render service.
3. Toolbar chỉ sửa `BatchConfig`; UI gửi nguyên `ImageProps[]` (đã merge) sang export API.
4. KHÔNG dùng CSS overlay tạm để "chữa" preview — chỉnh là chỉnh trong props.
5. Transform lưu **chuẩn hóa** (scale, offset/x/y dạng 0..1 hoặc -1..1), không px tuyệt đối.
6. Mọi payload mới có Zod schema (contracts) + ví dụ request/response.
7. Field mới theo additive-only (không rename field cũ).
8. Font tiếng Việt có dấu phải load trước render (delayRender) — không để vỡ chữ.

## Checklist khi thêm template mới
1. Update shared types (`packages/contracts`).
2. Thêm composition / cell layout + grid rules (`k → rows×cols` theo aspect) trong shared package.
3. Update schema validate backend.
4. Update UI controls (chọn template seed `BatchConfig`).
5. Update docs payload + ví dụ.

## Prompt mẫu cho Copilot
### Prompt 1 - Thêm field vào BatchConfig
"Thêm field `style.cornerRadius` vào `BatchConfig` theo backward-compatible. Cập nhật Zod schema
trong contracts, seed default từ template, UI toolbar control, và composition đọc field. Không
rename field cũ, không thêm logic layout ở UI."

### Prompt 2 - Sửa cell layout
"Sửa cell layout template `SaleGridSquare` trong shared composition để tên sản phẩm không tràn khi
> 40 ký tự (auto-fit 2 dòng). Không thêm logic layout ở UI overlay hoặc backend."

### Prompt 3 - Thêm template mới
"Tạo template `SaleGridLandscape` từ shared composition: grid rules cho landscape (k=6→2×3, k=12→3×4),
default theme + logo overlay. Giới hạn aspect = landscape. Cập nhật type, schema, UI form, API docs
với ví dụ request/response."

## Anti-pattern cần tránh
1. Sửa preview cho đúng bằng CSS tạm nhưng không update props.
2. Worker render dùng component/công thức khác với Player.
3. Lưu transform bằng px tuyệt đối (lệch khi đổi composition size).
4. Bỏ validate payload để tăng tốc dev.
5. Frontend fetch ảnh CMS raw (CORS/timeout) thay vì proxy render-safe.
6. Render khi font tiếng Việt chưa load (vỡ dấu).

## Quy tắc review PR
1. Có thay đổi shared composition chưa (nếu đụng layout)?
2. Có cập nhật schema + docs contract chưa?
3. Có test chia batch / resolve imageFit / parity với dataset mẫu chưa?
4. Transform có chuẩn hóa, có clamp biên chưa?
5. Ảnh lỗi có fallback placeholder (không fail batch) chưa?
