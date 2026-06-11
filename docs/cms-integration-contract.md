# CMS Integration Contract (Old Repo -> New Image Tool)

## Mục tiêu
Dùng CMS cũ làm data source cho image tool mới (Remotion), chạy local-first.

## Integration model
1. Pull model (khuyến nghị giai đoạn đầu):
- Image tool gọi CMS API để lấy dữ liệu product/campaign.
- Image tool tự render và lưu file local.

2. Callback model (tùy chọn):
- Sau khi render xong, image tool gọi ngược CMS để ghi kết quả.

## API contract tối thiểu
### A. Fetch render data
- Method: GET
- Path: /api/image-jobs/{jobId}/render-data
- Response:
  - jobId
  - templateId
  - products[]
  - branding
  - outputConfig

### B. Update render result (optional)
- Method: POST
- Path: /api/image-jobs/{jobId}/result
- Request:
  - status (Succeeded/Failed)
  - outputFiles[] (path/url)
  - errorMessage (optional)

## Auth và bảo mật
1. Dùng API key hoặc Bearer token.
2. Token lưu ở env vars (không hardcode).
3. Timeout cho request outbound.
4. Retry có backoff cho lỗi tạm thời.

## Data normalization rules
1. Ảnh product phải resolve được URL tuyệt đối.
2. Dedupe ảnh trùng key.
3. Fallback ảnh mặc định nếu thiếu ảnh.
4. ID product/campaign phải unique trong job payload.

## Error contract
1. Mọi lỗi trả JSON dạng:
- error: string
- details: string[]
- traceId: string

2. Phân loại lỗi:
- ValidationError
- UpstreamApiError
- RenderError
- StorageError

## Local-first output convention
1. Folder output:
- ./outputs/images/{yyyy}/{MM}/{dd}/{jobId}/

2. File naming:
- {templateId}-{index}-{slug}-{timestamp}.png

3. Manifest file:
- manifest.json chứa danh sách output và metadata render.

## Future-ready notes
1. Giữ contract additive-only trong major version.
2. Không để Remotion worker truy cập DB CMS trực tiếp.
3. Chỉ tích hợp qua HTTP contract hoặc queue message.
