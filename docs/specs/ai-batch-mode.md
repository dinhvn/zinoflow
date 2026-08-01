# Batch AI (Gemini Batch API)

## Vì sao có tính năng này

Kế hoạch viết bài AI hàng loạt (nhiều bài, nhiều site) cần tối ưu chi phí
token. Nghiên cứu tài liệu chính thức Gemini API (`ai.google.dev`) cho thấy
2 đòn bẩy độc lập, cộng dồn được:

- **Context caching**: tự động (implicit), không cần code — Gemini giảm giá
  ~90% cho phần token trùng prefix giữa các lần gọi gần nhau (ngưỡng tối
  thiểu 2.048-4.096 token tuỳ model, TTL trung bình 3-5 phút, tối đa 24h nếu
  liên tục có request giữ "ấm"). Không nằm trong phạm vi tính năng này —
  chưa đo/ghi nhận trong `ai_usage_logs` (việc khác, để riêng).
- **Batch API** (tính năng này): giảm **~50%** cả input lẫn output, đổi lại
  **không có kết quả ngay** (Google xử lý bất đồng bộ, SLA mục tiêu 24h
  nhưng thực tế thường nhanh hơn nhiều) — chỉ đáng dùng khi gửi nhiều item
  cùng lúc.

Batch API dùng SDK `@google/genai` (`client.batches.create/get`) — 2 lệnh
gọi này đều **nhanh** (đăng ký / hỏi trạng thái), không phải AI generation
chờ lâu, nên gọi thẳng trong HTTP handler vẫn ổn, không cần qua pg-boss.

## Kiến trúc: pluggable theo taskType

Không gắn cứng batch vào 1 tác vụ cụ thể — dùng pattern giống
`ArticleTypeProfile`/`getArticleTypeProfile()` đã có sẵn trong code: 1 core
dùng chung (`SubmitAiBatchUseCase`, `CheckAiBatchUseCase`) + mỗi loại tác vụ
tự khai báo 1 `BatchTaskHandler`.

```ts
// apps/api/src/modules/ai-content/application/ports/batch-task-handler.port.ts
interface BatchTaskHandler {
  readonly taskType: string;
  buildRequest(entityId, params?, override?): Promise<{ request, schema, providerKey }>;
  onSubmitted?(entityId): Promise<void>; // tuỳ chọn, gọi SAU khi submit thành công
  applyResult(entityId, rawOutput, usage, batchContext): Promise<void>;
  applyError(entityId, errorMessage): Promise<void>;
}
```

`entityId` là id của đối tượng được xử lý — ý nghĩa tuỳ `taskType`
(`contentJobId` | destination slug | cluster slug). `params` là JSON tự do
cho tham số phụ theo từng item (vd `cluster-poi-discovery` đọc
`params.extraNotes`).

`override` (thêm 08/2026): người dùng chọn provider/model **1 lần cho cả
batch** ở trang `/ai-batches` (dropdown "Model") — ghi đè giá trị mặc định
của từng item (job.aiModel với viết bài, model cố định với GSG/cluster-POI),
**không đổi** field lưu trên job. `batchContext` (đọc từ `AiBatch.provider`/
`model` — nguồn sự thật duy nhất, đã phản ánh đúng override nếu có) truyền
vào `applyResult` để ghi `ai_usage_logs` đúng model thực tế đã chạy. Ràng
buộc: tất cả item trong batch phải cùng 1 provider (`batches.create()` chỉ
gửi được cho 1 model) — UI chỉ liệt kê model Gemini vì hiện chỉ Gemini hỗ
trợ batch. Handler nào không cho đổi provider (GSG/cluster-POI cần
`useGoogleSearch`, chỉ chạy được Gemini) thì bỏ qua `override.provider`, chỉ
áp `override.model`.

### Tự đăng ký (self-registration) — tránh vòng lặp module

`DestinationModule` đã `imports: [AiContentModule]` (1 chiều). Nếu để
`AiContentModule` quay lại import `DestinationModule` để lấy handler thì
vòng lặp module. Giải quyết: `BATCH_TASK_HANDLER_REGISTRY` (export từ
`AiContentModule`) là 1 registry mutable — **mỗi handler tự đăng ký chính
nó** trong `onModuleInit()`, không module nào cần biết trước module kia có
gì:

```ts
@Injectable()
export class MyBatchTaskHandler implements BatchTaskHandler, OnModuleInit {
  readonly taskType = "my-task";
  constructor(@Inject(BATCH_TASK_HANDLER_REGISTRY) private readonly registry) {}
  onModuleInit(): void {
    this.registry.register(this);
  }
  // ...
}
```

## Cách thêm 1 loại tác vụ batch mới

1. Nếu tác vụ đã có luồng đơn lẻ (gọi AI đồng bộ trong 1 usecase) — tách
   logic thành 2 hàm dùng chung: `buildXxxRequest(...)` (build
   `StructuredGenerationRequest` + schema) và `applyXxxResult(...)` (validate
   + lưu kết quả + ghi usage). Xem ví dụ thật:
   `gsg-extraction-result-applier.ts`, `cluster-poi-result-applier.ts`
   (module `destination`), `content-generation-result-applier.ts` (module
   `ai-content`). Usecase đơn lẻ gọi 2 hàm này tuần tự — hành vi HTTP cũ giữ
   nguyên 100%.
2. Viết 1 class implement `BatchTaskHandler` + `OnModuleInit`, gọi lại đúng
   2 hàm ở bước 1 trong `buildRequest`/`applyResult`.
3. Đăng ký class đó vào `providers` của module sở hữu nó — KHÔNG sửa gì ở
   `AiContentModule`.
4. Thêm `taskType` mới vào `aiBatchTaskTypeSchema`
   (`packages/contracts/src/ai-content/ai-batch.ts`).
5. Thêm option vào `TASK_TYPE_OPTIONS` + viết picker item tương ứng ở trang
   `apps/web/src/app/ai-batches/page.tsx`.

## 4 taskType hiện có

| taskType | entityId | params | Module sở hữu |
|---|---|---|---|
| `content-outline` | contentJobId | — | ai-content |
| `content-article` | contentJobId | — | ai-content |
| `destination-gsg-extraction` | destination slug | — | destination |
| `cluster-poi-discovery` | cluster slug | `extraNotes?: string` | destination |

**Viết bài (`content-outline` → `content-article`)** dùng chung cho MỌI
`articleType` (kể cả `guide-diem-den` — bài điểm đến dichoithoi), vì handler
gọi `getArticleTypeProfile(job.articleType)` tổng quát, không đặc thù
cẩm-nang. 2 nơi tạo job ở chế độ batch:
- Bài cẩm nang: chọn "Chế độ sinh bài: Batch AI" ở `/dichoithoi/articles/new`.
- Bài điểm đến (hàng loạt, thêm 08/2026): panel "Tạo job Batch AI hàng loạt
  cho điểm đến" ngay trên `/ai-batches` (chỉ hiện điểm đến/cụm
  `contentState="chua-co-bai"` — an toàn, không đụng job đang chạy dở) — gọi
  lặp `POST /destinations/:slug/jobs` với `generationMode: "batch"`
  (`CreateDestinationJobUseCase`, trước đây hard-code `"sync"`). **Lưu ý UX**:
  luồng tạo bài điểm đến gốc (nút "Tạo bài viết AI" trên trang chi tiết điểm
  đến) là luồng RIÊNG, hiện gợi ý AI **inline ngay trên trang** — CHỈ hoạt
  động với `generationMode="sync"` (mặc định, không đổi). Batch mode job sẽ
  KHÔNG hiện gì trên trang điểm đến, phải theo dõi qua `/ai-batches`.

2 pha tách rời vì content phụ thuộc outline. Job phải `generationMode="batch"`
(chọn lúc tạo, KHÔNG tự enqueue pg-boss) và đúng trạng thái: `Created` cho
outline, `OutlineReady` cho content (trạng thái mới trong state machine, CHỈ batch
flow dùng — luồng sync không bao giờ dừng ở đây).

## Giới hạn đã biết

- Chỉ Gemini hỗ trợ Batch API (`ContentAiProvider.supportsBatch`) — batch
  của 1 job dùng Anthropic/OpenAI sẽ bị từ chối lúc gửi.
- Tất cả item trong CÙNG 1 batch phải cùng 1 provider (do 1 lệnh
  `batches.create()` chỉ gửi được cho 1 model/provider).
- **Không tự động poll** — người dùng phải tự bấm "Kiểm tra" ở trang
  `/ai-batches`. Đây là quyết định có chủ đích (v1), không phải hạn chế kỹ
  thuật — `checkBatch()` là 1 lệnh gọi nhanh, hoàn toàn có thể tự động hoá
  sau này nếu cần (vd cron/pg-boss recurring job).
- TTL/ngưỡng cache tham khảo ở phần "Vì sao có" không được Google công bố
  chính thức — số liệu quan sát được, có thể thay đổi.
- 1 item lỗi (schema sai, entity không tồn tại...) không làm hỏng cả batch —
  `CheckAiBatchUseCase` bắt lỗi riêng từng item, gọi `handler.applyError()`,
  các item khác vẫn xử lý bình thường.
