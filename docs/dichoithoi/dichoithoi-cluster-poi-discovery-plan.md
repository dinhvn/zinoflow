# Plan: Tìm điểm con trong cụm bằng AI (Gemini + Google Search Grounding)

✅ **ĐÃ BUILD + VERIFY 27/07/2026** — cả 7 giai đoạn code xong, verify bằng
dữ liệu thật trên `dichoithoi_dev` (gọi Gemini thật qua cụm "Bảo Lộc", ra 22
ứng viên, `matchType` phân loại đúng cả 3 nhóm; test tay 1 dòng "new" → tạo
draft đúng `parentSlug`/`provinceCode`/`priority`; test tay 1 dòng
"orphan-match" → gán lại đúng `parentSlug`) + Playwright xem UI thật (panel
hiện đúng vị trí tab "AI hỗ trợ", bảng duyệt render đúng, tab "Quan hệ →
Trực thuộc" đếm đúng 14 khớp DB thật sau khi tạo draft mới). Dữ liệu test
giả (1 điểm orphan tự tạo để test) đã xoá sau khi verify; "Đồi chè Tâm Châu"
là kết quả AI tìm được thật, giữ lại làm draft thật trong `dichoithoi_dev`.

Ghi 27/07/2026. Bối cảnh: người dùng đang rà soát lại toàn bộ Cụm (Kind=2)
theo kiến trúc taxonomy mới, không muốn nhập tay từng điểm con (POI) cho mỗi
cụm — muốn AI tự "cào" danh sách điểm trong 1 cụm đã có sẵn trong DB, duyệt
qua bảng rồi mới ghi thật.

## Hiện trạng đã audit (file:line cụ thể đã đọc)

- Schema cây phân cấp: `v2.Destination` (`Kind` 1 tỉnh/2 cụm/3 điểm, 1
  `ParentId` + 1 `ProvinceId`/node) — `DiChoiThoi.Common/DbEntities/V2/V2Destination.cs`.
- Mirror Postgres: `dichoithoi_destinations` (`slug` PK, `siteId` null =
  chưa publish) — `apps/api/src/modules/destination/infrastructure/entities/destination-mirror.entity.ts`.
- Luồng tạo điểm mới THỦ CÔNG hiện có (2 bước, không publish ngay):
  - `apps/web/src/app/dichoithoi/new/page.tsx` — form nhập, gọi `POST /destinations`.
  - `UpsertDestinationUseCase.create()` (`apps/api/src/modules/destination/application/use-cases/upsert-destination.usecase.ts:33-45`)
    → `DestinationMirrorRepository.createLocal()` (`typeorm-destination-mirror.repository.ts:60-73`)
    → INSERT Postgres-only, `siteId=null`, `hasLocalChanges=true`.
  - `UpsertDestinationUseCase.update()` (dòng 48-93) đổi `parentSlug` → tự
    gọi `RecomputeRelatedService` cho tập bị ảnh hưởng (dòng 82-89).
- **KHÔNG dùng** `MssqlSiteDbAdapter.createDestination()`
  (`mssql-site-db.adapter.ts:351-374`) — hàm này `Status=1` publish thẳng
  SQL Server, dùng cho bước publish bài đã hoàn chỉnh (từ `PublishDestinationUseCase`),
  sai ngữ cảnh cho điểm AI vừa tìm chưa qua nội dung/quality gate.
- Pattern GSG hiện có tái dùng được:
  - `ExtractDestinationInfoGsgUseCase` (`extract-destination-info-gsg.usecase.ts`)
    — gọi `AI_PROVIDER_REGISTRY.resolve("gemini")` rồi `generateStructured()`
    với `useGoogleSearch: true`, model `gemini-3.6-flash`, `temperature: 0.1`.
  - Bảng staging `dichoithoi_destination_ai_extractions` (PK
    `destination_slug`+`source`, cột `fields` jsonb, mỗi field có
    `status: pending|accepted|rejected`) — entity/port/repo tại
    `infrastructure/entities/destination-ai-extraction.entity.ts`,
    `application/ports/destination-ai-extraction.repository.ts`,
    `infrastructure/repositories/typeorm-destination-ai-extraction.repository.ts`.
  - Migration tạo bảng mẫu: `apps/api/src/migrations/1782140000000-DestinationAiExtractionStaging.ts`.
  - Frontend: `DestinationAiExtractionPanel`
    (`apps/web/src/features/dichoithoi/destination-ai-extraction-panel.tsx`) —
    bảng duyệt + checkbox + nút Chấp nhận, gắn trong tab "AI hỗ trợ" của
    `apps/web/src/app/dichoithoi/[slug]/page.tsx` (dòng ~1086-1088).
  - Preview-không-gọi-AI: `DestinationPromptPreviewModal`
    (`apps/web/src/features/dichoithoi/destination-prompt-preview-modal.tsx`)
    + `POST :slug/jobs/preview` (`CreateDestinationJobUseCase.previewPrompt`)
    — CHỈ trả text prompt, KHÔNG có block cấu hình (job đó không dùng GSG).
- Slug util có sẵn: `slugifyVietnamese()`/`normalizeVietnamese()`
  (`apps/api/src/modules/shared/text/vietnamese.ts`).

## Quyết định đã chốt qua trao đổi 27/07/2026

1. KHÔNG có bước tạo cụm mới trong feature này — chỉ áp dụng cho cụm đã tồn
   tại sẵn trong DB (Kind=2).
2. Prompt (bản người dùng đưa, vai trò "Data Crawler") KHÔNG nhận danh sách
   điểm đã có để loại trừ — luôn liệt kê đầy đủ, lọc trùng dồn hết vào bước
   duyệt.
3. Ngưỡng fuzzy-match tên khi tính `matchType` — **LỎNG**, luôn để người
   dùng tự xem lại (thà báo nhầm "có thể trùng" còn hơn bỏ sót trùng thật).
4. Trường mỗi ứng viên: `name`, `priorityLevel` (1-5, khớp thẳng cột
   `Priority` có sẵn), `shortDescription`, `address` (nếu tìm được) —
   KHÔNG có lat/lng (người dùng tự bổ sung tay sau).
5. Bảng staging mới `dichoithoi_cluster_poi_candidates`, PK `cluster_slug`,
   upsert khi chạy lại (không giữ lịch sử nhiều phiên, đúng convention bảng
   extraction hiện có).
6. Khi Chấp nhận, theo `matchType`:
   - `"new"` → `UpsertDestinationUseCase.create()` (draft Postgres-only,
     `siteId=null`, y hệt tạo tay).
   - `"orphan-match"` → `UpsertDestinationUseCase.update()` đổi `parentSlug`
     sang cụm này (điểm orphan có `siteId` khác null vẫn đi qua nhánh ghi
     SQL Server sẵn có trong `update()`, không cần code riêng).
   - `"existing-in-cluster"` → chỉ hiển thị, không thao tác.
7. Nút "Xem trước prompt" bắt buộc, kèm block cấu hình riêng (model,
   `useGoogleSearch`, temperature) — khác preview hiện có (chỉ có text).
8. Vị trí UI: tab "🤖 AI hỗ trợ" trong trang detail cụm, chỉ hiện khi
   `d.kind === "cluster"`. Kết quả sau duyệt hiện tự động ở tab "🔗 Quan hệ"
   → "Trực thuộc" (đã có sẵn, chỉ cần `invalidate()`).

## Giai đoạn

### Giai đoạn 1 — Contracts (packages/contracts)

Độc lập, làm trước tiên (mọi giai đoạn sau phụ thuộc vào đây).

- File mới `packages/contracts/src/dichoithoi/cluster-poi-candidate.ts`:
  - `clusterPoiCandidatePriorityLevelSchema` = `z.union([z.literal(1), ..., z.literal(5)])`.
  - `clusterPoiCandidateMatchTypeSchema` = `z.enum(["new", "existing-in-cluster", "orphan-match"])`.
  - `clusterPoiCandidateStatusSchema` = `z.enum(["pending", "accepted", "rejected"])`.
  - `clusterPoiCandidateItemSchema` = `{ name, priorityLevel, shortDescription, address: nullable, matchType, matchedSlug: nullable, matchedName: nullable, status }`.
  - `clusterPoiCandidateSchema` = `{ clusterSlug, extractedAt, candidates: array }`.
  - `getClusterPoiCandidatesResponseSchema` = `{ candidate: clusterPoiCandidateSchema.nullable() }`.
  - `findClusterPoiCandidatesRequestSchema` = `{ extraNotes: z.string().max(2000).nullable() }` (mô tả bổ sung người dùng nhập).
  - `acceptClusterPoiCandidatesRequestSchema` = `{ acceptedIndexes: z.array(z.number().int().min(0)) }`.
  - `previewClusterPoiPromptResponseSchema` = `{ systemPrompt, userPrompt, config: { model, useGoogleSearch, temperature } }`.
- Export lại ở `packages/contracts/src/dichoithoi/index.ts` (hoặc barrel tương ứng).

**DoD**: `pnpm --filter @zinoflow/contracts build` (hoặc tsc check) qua, không lỗi type.

### Giai đoạn 2 — Migration + Entity + Repository (phụ thuộc Giai đoạn 1)

- Migration mới `apps/api/src/migrations/<timestamp>-ClusterPoiCandidatesStaging.ts`
  (timestamp > `1782610000000`), copy cấu trúc từ
  `1782140000000-DestinationAiExtractionStaging.ts`:
  ```sql
  CREATE TABLE dichoithoi_cluster_poi_candidates (
    cluster_slug varchar(64) PRIMARY KEY REFERENCES dichoithoi_destinations(slug) ON DELETE CASCADE,
    extracted_at timestamptz NOT NULL,
    candidates jsonb NOT NULL
  )
  ```
- Entity `infrastructure/entities/cluster-poi-candidate.entity.ts` (PK
  `clusterSlug`, cột `extractedAt`, `candidates` jsonb).
- Port `application/ports/cluster-poi-candidate.repository.ts`
  (`findByClusterSlug`, `upsert`, `updateCandidates`) — y hệt shape port
  extraction hiện có.
- Impl `infrastructure/repositories/typeorm-cluster-poi-candidate.repository.ts`.
- Đăng ký entity + provider trong `destination.module.ts`
  (`TypeOrmModule.forFeature`, thêm vào mảng `providers`).

**DoD**: chạy migration trên `dichoithoi_dev` local, `\d dichoithoi_cluster_poi_candidates`
đúng cột; app boot không lỗi DI.

### Giai đoạn 3 — Fuzzy-match util (độc lập, làm song song Giai đoạn 2)

- `application/services/fuzzy-match-destination-name.ts` — chuẩn hoá qua
  `normalizeVietnamese()`, so khớp: bằng nhau tuyệt đối SAU chuẩn hoá, hoặc
  1 chuỗi chứa chuỗi kia, hoặc tỷ lệ token chung (Jaccard theo từ) ≥ 0.5 —
  ngưỡng LỎNG theo quyết định 3 ở trên.
- Unit test: vài cặp tên thật có dấu/không dấu/viết tắt khác nhau (ví dụ
  "Hòn Rơm" vs "hon rom", "Chùa Linh Ứng" vs "Linh Ứng Tự") phải match;
  2 tên rõ ràng khác nhau không match.

**DoD**: `pnpm --filter @zinoflow/api test fuzzy-match-destination-name` pass.

### Giai đoạn 4 — Use case sinh + preview + đọc (phụ thuộc 1, 2, 3)

- `FindClusterPoiCandidatesUseCase` — nhận `clusterSlug` + `extraNotes`:
  1. Đọc cụm (mirror), throw nếu không phải `kind === "cluster"`.
  2. Build system/user prompt (đưa nguyên bản prompt người dùng, chèn tên
     cụm + tỉnh + `extraNotes`).
  3. Gọi `AI_PROVIDER_REGISTRY.resolve("gemini").generateStructured(...)`
     với `useGoogleSearch: true`, model `gemini-3.6-flash`, `temperature: 0.1`,
     schema `z.object({ locations: z.array(z.object({ name, priority_level, short_description, address: nullable })) })`.
  4. Với mỗi location, chạy fuzzy-match (Giai đoạn 3) so với: (a) toàn bộ
     điểm con hiện có của cụm này → `"existing-in-cluster"`; (b) toàn bộ
     điểm orphan (`parentSlug === null`, `kind === "poi"`) trong CÙNG tỉnh
     → `"orphan-match"` (kèm `matchedSlug`/`matchedName`); còn lại →
     `"new"`.
  5. Upsert bảng staging, ghi `ai_usage_logs` qua `AI_USAGE_RECORDER`.
- `PreviewClusterPoiPromptUseCase` — dựng system/user prompt y hệt bước 4.2
  NHƯNG không gọi AI, trả kèm block `config`.
- `GetClusterPoiCandidatesUseCase` — đọc bảng staging theo `clusterSlug`.

**DoD**: gọi thật `POST /destinations/{slug-cum-that}/cluster-poi-candidates`
trên `dichoithoi_dev` với 1 cụm có sẵn — kiểm tra bằng mắt kết quả trả về có
điểm hợp lý, `matchType` đúng khi cụm đã có sẵn ≥1 điểm con (phải ra
`"existing-in-cluster"` cho đúng điểm đó).

### Giai đoạn 5 — Use case Chấp nhận (phụ thuộc Giai đoạn 4)

- `AcceptClusterPoiCandidatesUseCase` — nhận `clusterSlug` + `acceptedIndexes`:
  - Với từng index có `matchType==="new"`: sinh slug (`slugifyVietnamese`
    + hậu tố số nếu trùng), gọi `UpsertDestinationUseCase.create()` với
    `parentSlug=clusterSlug`, `provinceCode` kế thừa từ cụm, `priority=priorityLevel`.
  - Với `matchType==="orphan-match"`: đọc mirror của `matchedSlug`, gọi
    `UpsertDestinationUseCase.update()` chỉ đổi `parentSlug=clusterSlug`
    (giữ nguyên các field khác).
  - `matchType==="existing-in-cluster"` trong `acceptedIndexes` → bỏ qua,
    không lỗi (phòng trường hợp FE lỡ gửi).
  - Đánh dấu `status="accepted"` cho các index đã áp dụng, `upsert` lại
    bảng staging.

**DoD**: duyệt 1 dòng "new" + 1 dòng "orphan-match" (dùng 1 điểm orphan có
sẵn trong `dichoithoi_dev`) qua Postman/curl thật, query DB xác nhận: điểm
mới xuất hiện đúng `parentSlug`, điểm orphan đổi đúng `parentSlug`, không
điểm nào bị tạo trùng.

### Giai đoạn 6 — Controller + module wiring (phụ thuộc 4, 5)

- Thêm 4 route vào `destinations.controller.ts` (đặt sau `:slug/ai-extraction/gsg`,
  theo đúng convention comment giải thích từng route):
  - `POST :slug/cluster-poi-candidates` → `FindClusterPoiCandidatesUseCase`.
  - `POST :slug/cluster-poi-candidates/preview` → `PreviewClusterPoiPromptUseCase`.
  - `GET :slug/cluster-poi-candidates` → `GetClusterPoiCandidatesUseCase`.
  - `POST :slug/cluster-poi-candidates/accept` → `AcceptClusterPoiCandidatesUseCase`.
- Đăng ký 4 use case vào `providers` của `destination.module.ts`.

**DoD**: `pnpm --filter @zinoflow/api build` qua; gọi thử cả 4 route qua curl.

### Giai đoạn 7 — Frontend (phụ thuộc Giai đoạn 6)

- `apps/web/src/features/dichoithoi/cluster-poi-candidates-panel.tsx` —
  theo đúng pattern `DestinationAiExtractionPanel`:
  - Textarea "Mô tả bổ sung" (map `extraNotes`).
  - Nút "👁️ Xem trước prompt" → modal mới (dựa trên
    `DestinationPromptPreviewModal`, thêm khối hiển thị `config`).
  - Nút "🔎 Tìm điểm con bằng AI" → gọi generate, hiện bảng.
  - Bảng duyệt: cột Tên/Ưu tiên/Mô tả/Địa chỉ/Trạng thái khớp (badge màu
    theo `matchType`: xanh lá "Mới", vàng "Có thể trùng orphan → gán lại",
    xám "Đã có trong cụm — bỏ qua") + checkbox (disable khi
    `matchType==="existing-in-cluster"`).
  - Nút "Chấp nhận N mục đã tick".
- Gắn vào `apps/web/src/app/dichoithoi/[slug]/page.tsx`, tab "ai-tools",
  `<Group title="🧭 Tìm điểm con trong cụm (AI)">`, chỉ render khi
  `d.kind === "cluster"`, `onAccepted={() => invalidate()}`.

**DoD**: chạy `dotnet`/`pnpm dev` local, dùng Playwright mở 1 trang cụm thật
trên `dichoithoi_dev`, bấm thử toàn bộ luồng (xem trước prompt → tìm →
duyệt → chấp nhận), xác nhận tab "Quan hệ → Trực thuộc" cập nhật đúng điểm
mới sau khi chấp nhận — xem bằng mắt qua screenshot, không chỉ tin build pass.

## Lệch tài liệu / lỗ hổng phát hiện khi audit (không phải việc mới, ghi để rõ)

- Không phải lỗ hổng thật — chỉ là nhánh use case mới, không có gì trong
  code hiện tại cần sửa để làm feature này (khác với vụ `PrimaryTypeId`
  từng phát hiện thiếu sót ở đợt taxonomy redesign).
