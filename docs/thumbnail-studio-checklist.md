# Image Studio Checklist for ZinoFlow

> Cập nhật 2026-06-27: đổi sang model **product collage** (ghép nhiều sản phẩm vào 1 ảnh đăng FB).
> Doc chuẩn: `docs/specs/image-tool-technical-spec.md`. File này là checklist thực thi.

## Mục tiêu
Đảm bảo tool tạo ảnh (Remotion) trong repo có:
- Preview (Remotion Player, gallery) và export (renderStill) trùng 1:1.
- Props ổn định, dễ mở rộng (BatchConfig global + per-image).
- Lấy sản phẩm từ CMS cũ qua `product/search`.

## P0 - Bắt buộc trước khi code
1. Single source of truth:
- Shared composition package là nguồn DUY NHẤT cho layout grid + cell layout + công thức imageFit/logo.
- Player (preview) và worker (export) dùng cùng composition ID + cùng `ImageProps`.

2. Runtime local:
- UI chạy local, render service chạy local.
- Export lưu local theo job: `./outputs/images/{yyyy}/{MM}/{dd}/{jobId}/`.

3. Data source CMS:
- `GET /api/v1/product/search` (filter + paging), auth key qua env var.
- Proxy ảnh `GET /api/images/asset` (render-safe, CORS, cache, fallback placeholder).

4. Font tiếng Việt có dấu:
- Load font TRƯỚC render (`delayRender`/`@remotion/google-fonts`) — chữ có dấu không vỡ.

## P1 - Preview/Export Parity
1. Dùng đúng MỘT object props cho cả Player preview và payload export.
2. Không tách layout logic 2 nơi — toolbar chỉ sửa `BatchConfig`, không CSS overlay tạm để "chữa" preview.
3. Composition chuẩn: size theo aspect (square 1080², landscape 1200×630...), `durationInFrames = 1`,
   font + ảnh load an toàn trước render.
4. `effectiveFit = cell.imageFitOverride ?? batch.imageFit` — cùng công thức ở Player + worker.

## P1 - Props Contract (collage)
1. `BatchConfig` (GLOBAL — 2 toolbar): `style` (theme màu), `visibility`, `logo` (overlay kéo/resize),
   `imageFit` (zoom/kéo ảnh).
2. `ImageProps` (PER-IMAGE) = `BatchConfig` ⊕ `{ templateId, aspect, perImage, products[] }`.
3. `ProductCell`: `id, name, imageUrl, originalPrice, salePrice, discountPercent, badges[],
   imageFitOverride?`.
4. Rule validate: max length text, `products.length <= perImage`, URL ảnh tuyệt đối, scale/offset
   chuẩn hóa (không px), màu hex hợp lệ. Field mới additive-only trong cùng major.

## P1 - Editor tương tác
1. Lưu state theo DỮ LIỆU chuẩn hóa (0..1 / -1..1), không px tuyệt đối:
- imageFit: `scale`, `offsetX`, `offsetY` (kéo ảnh trong ô — ảnh dài hay dùng offsetY).
- logo overlay: `x`, `y`, `scale`, `visible` (kéo di chuyển + rê góc resize trên preview).
2. Khi drag/resize: tính delta theo viewport thực → convert sang chuẩn hóa → clamp biên.
3. Global áp đồng loạt cả batch; override lẻ chỉ ô/ảnh được chọn.

## P1 - Batch & Export
1. Chia batch: N sản phẩm, k/ảnh → `ceil(N/k)` ảnh; layout grid theo k (12→3×4...).
2. Export 1 ảnh hoặc tất cả (zip) + manifest.
3. ExportOptions: `format` (png/jpeg), `quality` (jpeg ~85 cho FB), `scale`.

## P1 - Security và Stability
1. Backend validate payload bằng Zod schema (contracts).
2. Lỗi JSON có `errorCode` + `details` actionable + `traceId`.
3. Sanitize fileName, chặn path traversal; proxy ảnh whitelist host (chống SSRF).
4. Retry có giới hạn cho call CMS; ảnh lỗi → placeholder, không fail cả batch.

## P2 - Testing
1. Smoke: payload hợp lệ; thiếu field bắt buộc; `products.length > perImage`.
2. Unit: chia batch (N,k), mapping grid, resolve imageFit (override ?? global) + clamp.
3. Golden dataset: ≥5 bộ — so preview (Player) vs export (renderStill) trong tolerance.
4. Build check: UI + render service pass build; type contract không mismatch.

## Definition of Done
1. 5/5 dataset mẫu không lệch preview-export.
2. Chia batch đúng (vd 12 SP, 4/ảnh → 3 ảnh); export 1/nhiều ảnh ra file + manifest.
3. Font tiếng Việt có dấu render đúng; ảnh lỗi → placeholder, không fail batch.
4. Tài liệu API request/response có ví dụ.
