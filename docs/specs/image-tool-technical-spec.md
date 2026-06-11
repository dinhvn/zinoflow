# Image Tool Technical Spec (MVP, Remotion)

## 1) Scope
MVP Image Tool phuc vu:
- Tao anh social tu product dataset theo template.
- Preview va export PNG/JPG 1:1.
- Chay local-first, trigger on-demand.

## 2) Non-goals (MVP)
- Khong build scene editor phuc tap nhu Figma.
- Khong auto post Facebook trong phase 1.
- Khong render video dai, chi uu tien still images.

## 3) Architecture placement
Thanh phan:
1. Web UI (editor + preview)
2. API service (job + validation + output tracking)
3. Remotion worker (render still)
4. Shared compositions package (single source of truth)

Rule bat buoc:
- Preview va export dung cung composition + cung props type.

## 4) Domain model
### 4.1 Entities
1. ImageRenderJob
- id
- templateId
- sourceRef
- status (Created, Rendering, Completed, Failed)
- outputPath
- createdAt
- createdBy

2. ImageRenderItem
- id
- jobId
- index
- payloadJson
- outputFile
- status

3. ImageTemplate
- id
- code
- version
- rulesJson
- isActive

### 4.2 Value objects
- LayoutPercent
- RenderPayload
- ExportOptions

## 5) Payload contract
Truong toi thieu:
- templateId
- title
- backgroundImageUrl
- highlights[]

Truong mo rong:
- subtitle
- badgeText
- accentColor
- layoutOverrides
- fontSizeMultipliers

Validation rules:
- max text length
- highlight count theo template
- min/max multiplier

## 6) API contract (MVP)
Base path: /api/images

### 6.1 Create render job
POST /api/images/jobs
Request:
- sourceRef
- templateId
- items[]
- exportOptions
Response:
- jobId
- status

### 6.2 Get job details
GET /api/images/jobs/{jobId}
Response:
- status
- totalItems
- completedItems
- outputs[]

### 6.3 Render preview
POST /api/images/preview
Request:
- templateId
- payload
Response:
- previewUrl or base64 (phase choice)

### 6.4 Download output manifest
GET /api/images/jobs/{jobId}/manifest
Response:
- files[]
- metadata

## 7) Remotion worker design
Worker interface:
- enqueueRender(jobId)
- renderStill(itemPayload)
- emitResult(jobId, itemId, outputFile)

Render settings:
- composition size 1280x720 (MVP default)
- durationInFrames = 1
- deterministic styles

Media safety:
- render-safe image helper
- timeout + retry cho external image fetch

## 8) Preview/export parity rules
1. Shared composition package la source of truth.
2. UI preview va worker render dung cung props object.
3. Khong giu transform tam chi trong DOM overlay.
4. Editor thao tac xPercent/yPercent/scale va commit vao payload.

## 9) Persistence (PostgreSQL)
Bang toi thieu:
- image_render_jobs
- image_render_items
- image_templates
- image_output_manifests

Index:
- job status
- createdAt
- templateId

## 10) File storage (local-first)
Thu muc output:
- ./outputs/images/{yyyy}/{MM}/{dd}/{jobId}/

File naming:
- {templateId}-{index}-{slug}-{timestamp}.png

Manifest:
- manifest.json luu metadata render va file list.

## 11) Integration with old CMS
Pull model phase 1:
- API service goi CMS old API lay render data theo sourceRef.

Callback model optional:
- Sau khi render xong, goi CMS endpoint de update status/output.

## 12) Error handling
Error envelope:
- errorCode
- message
- details[]
- traceId

Error groups:
- ValidationError
- UpstreamApiError
- RenderError
- StorageError

## 13) Security
- sanitize fileName, chan path traversal.
- secret/API key luu env vars.
- chi admin role moi tao render job.

## 14) Observability
Log bat buoc:
- queue latency
- render duration per item
- failed render reasons
- output generation path

Metrics MVP:
- render success rate
- avg render time/item
- retry rate

## 15) Testing strategy
1. Unit tests:
- payload validator
- layout clamp/snap logic

2. Integration tests:
- remotion worker adapter
- file storage adapter

3. Golden dataset tests:
- it nhat 5 data sets
- preview/export parity tolerance

## 16) Definition of done
1. Tao job render batch va xuat file thanh cong.
2. Co manifest output day du.
3. Preview va export khong lech layout tren bo mau.
4. Co logs, error details, va retry strategy.
5. API docs co examples.
