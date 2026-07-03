# CMS Integration Contract (CMS cũ -> Image Tool mới)

> Cập nhật 2026-06-27: đổi sang model **search + chọn thủ công**. UI gọi thẳng
> `product/search` của CMS cũ rồi tự build props ảnh — KHÔNG còn pull render-data theo jobId.
> Xem `docs/specs/image-tool-technical-spec.md` (§11, §12) cho bức tranh đầy đủ.

## Mục tiêu
Dùng CMS cũ làm **data source sản phẩm** cho image tool mới (Remotion), chạy local-first.

## Integration model (hiện tại)

**Search-and-select (model chính):**
1. Người dùng lọc + tìm sản phẩm trên UID image tool.
2. UI gọi CMS `GET /api/v1/product/search` lấy danh sách sản phẩm.
3. Người dùng chọn/sort/xóa → working set → image tool tự build `ImageProps` và render.
4. Sản phẩm KHÔNG đi qua API render của image tool — chỉ ảnh + giá + brand được nhúng vào props.

Callback model (tùy chọn, phase sau): sau khi render xong, ghi ngược kết quả về CMS nếu cần.

## API contract

### A. Search sản phẩm (CMS cũ — bắt buộc)
- Method: GET
- Path: `/api/v1/product/search?key={authKey}`
- Query filter: `keyword`, `supplierCode`, `categoryCode`,
  `isDiscount`, `isNew`, `isHot`, `isChanged`, `isFixedProduct`, paging (`page`, `pageSize`).
- Response (tối thiểu mỗi item): `id`, `name`, `imageUrl`, `originalPrice`, `salePrice`,
  `discountPercent`, `brand`/`supplier`, badges (new/hot...).
- Auth: `key` lưu env var (`CMS_PRODUCT_API_KEY`), KHÔNG hardcode, KHÔNG log.

### B. Proxy ảnh sản phẩm (image tool — render-safe)
- Method: GET
- Path: `/api/images/asset?src={absoluteImageUrl}`
- Mục đích: giải CORS cho canvas/Player, cache local, fallback placeholder khi ảnh lỗi.
- Whitelist host nguồn ảnh; chặn SSRF (chỉ cho host CMS/CDN đã biết).

### C. Update render result (optional, phase sau)
- Method: POST
- Path: `/api/image-jobs/{jobId}/result`
- Request: `status` (Succeeded/Failed), `outputFiles[]`, `errorMessage?`.

## Auth và bảo mật
1. API key cho `product/search` lưu env vars (timeout outbound, retry có backoff).
2. Proxy ảnh: whitelist host, chặn path traversal/SSRF.
3. Không hardcode, không log key.

## Data normalization rules
1. URL ảnh phải resolve tuyệt đối trước khi đưa vào props.
2. Dedupe sản phẩm trùng `id` trong working set.
3. Fallback ảnh mặc định/placeholder nếu thiếu hoặc ảnh lỗi (không fail cả batch).
4. `id` sản phẩm unique trong một ảnh/payload.

## Error contract
1. Lỗi trả JSON: `errorCode`, `message`, `details[]`, `traceId`.
2. Phân loại: `ValidationError`, `UpstreamApiError` (CMS), `RenderError` (Remotion), `StorageError`.

## Local-first output convention
1. Folder output: `./outputs/images/{yyyy}/{MM}/{dd}/{jobId}/`.
2. File naming: `{templateId}-{index}-{slug}-{timestamp}.{ext}` (png/jpeg — §9 spec).
3. Manifest: `manifest.json` chứa danh sách output + metadata render.

## Future-ready notes
1. Contract additive-only trong cùng major version.
2. Remotion worker KHÔNG truy cập DB CMS trực tiếp — chỉ qua HTTP contract / props.
3. Mọi tích hợp qua HTTP contract hoặc queue message (pg-boss).
