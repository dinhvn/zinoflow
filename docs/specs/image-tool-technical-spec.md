# Image Tool Technical Spec — Product Collage cho Facebook (Remotion)

> Cập nhật 2026-06-27: viết lại để khớp use case thật — ghép NHIỀU sản phẩm vào MỘT
> ảnh (collage/grid) để đăng Facebook, có editor tương tác + preview realtime.
> Engine render: **Remotion** (đã chốt — server-side renderStill cho export).

## 1) Scope

Tool tạo **ảnh ghép sản phẩm** đăng Facebook:
- Load danh sách sản phẩm từ CMS cũ (có filter), người dùng tự chọn tập sản phẩm.
- Chọn loại ảnh (hình chữ nhật / hình vuông) + số sản phẩm trên mỗi ảnh.
- Hệ thống tự **chia batch**: N sản phẩm, k sản phẩm/ảnh → ceil(N/k) ảnh, mỗi ảnh
  có **layout grid riêng theo k** (vd k=12 → 3 hàng × 4 cột).
- **Preview realtime dạng GALLERY**: hiện tất cả ảnh trong batch cùng lúc (lưới Player),
  KHÔNG bấm Next từng ảnh. Toolbar chỉnh màu/ẩn-hiện info **áp cho cả batch** (global).
- **Export** 1 ảnh hoặc nhiều ảnh cùng lúc (server-side renderStill), tải về (zip khi nhiều).

Tham chiếu tool cũ (client-side `dom-to-image`): `CmsKhuyenMai.Web/Views/Tool/Index.cshtml`.
Bản này nâng cấp lên Remotion để preview/export parity và render server-side ổn định.

## 2) Non-goals (MVP)

- Không build scene editor tự do kiểu Figma (kéo-thả từng phần tử bất kỳ).
- Không auto post Facebook (phase sau).
- Không render video — chỉ still image.
- Không kéo-thả tự do vị trí Ô trong ảnh — vị trí ô do template + số lượng quyết định.
  (Riêng ẢNH bên trong mỗi ô thì CÓ zoom/kéo để canh khung — xem §7.1.)

## 3) User flow (5 bước — bám đúng yêu cầu)

```
B1 Load sản phẩm  →  B2 Chọn (sort/xóa)  →  B3 Chọn loại ảnh  →  B4 Cấu hình  →  B5 Export
   (filter API)       (working set)          (ratio)             (k/ảnh, màu...)   (1 hoặc nhiều)
```

1. **Load sản phẩm**: gọi CMS `GET /api/v1/product/search` với filter (keyword, supplier,
   category, isDiscount/isNew/isHot/isChanged/isFixed...). Hiển thị bảng kết quả + phân trang.
2. **Chọn sản phẩm** → đẩy vào *working set*. Trong working set: **sort** (kéo đổi thứ tự),
   **xóa 1 / nhiều / xóa hết**. Thứ tự này quyết định thứ tự sản phẩm trong các ảnh.
3. **Chọn loại ảnh + template**: aspect ratio (§5) + **template định sẵn** (§5.1) — template
   quyết định bố cục ô và khởi tạo theme màu + các mặc định hiển thị/logo.
4. **Cấu hình ảnh** — số sản phẩm/ảnh (k) + tinh chỉnh qua 2 toolbar (ghi đè mặc định của
   template) — xem §6, §7.
5. **Export** — chia batch, render server-side, tải 1 ảnh hoặc tất cả (zip) — xem §9.

## 4) Layout phía web (3 vùng) + preview GALLERY

```
┌───────────────┬──────────────────────────────────────────────────────┐
│ Cột trái      │ Toolbar NGANG — màu sắc (áp cho TẤT CẢ ảnh)           │
│ - Filter +    ├──┬───────────────────────────────────────────────────┤
│   bảng SP     │T │  ┌────────┐ ┌────────┐ ┌────────┐                  │
│ - Working set │o │  │ Ảnh 1/3│ │ Ảnh 2/3│ │ Ảnh 3/3│  ← lưới Player   │
│   (sort/xóa)  │o │  │(Player)│ │(Player)│ │(Player)│    tất cả ảnh    │
│               │l │  └───[⬇]──┘ └───[⬇]──┘ └───[⬇]──┘    cùng lúc      │
│               │b │                                                     │
│               │dọc                              [⬇ Tải tất cả (zip)]   │
│               │ẩn/hiện info (áp cho TẤT CẢ ảnh)                        │
└───────────────┴──┴───────────────────────────────────────────────────┘
```

- **Preview = GALLERY**: render tất cả ảnh trong batch dạng lưới Player cùng lúc (không bấm Next).
  Mỗi ô có nút tải riêng; có nút "Tải tất cả (zip)". Batch nhiều (>~20) → phân trang lưới /
  lazy render, KHÔNG quay về kiểu Next từng ảnh.
- **Toolbar ngang** (trên preview): màu sắc — background, accent/màu giá, màu border, độ dày
  border, theme. Đổi 1 lần → **mọi ảnh trong batch đổi ngay**.
- **Toolbar dọc** (cạnh trái preview): bật/tắt hiển thị — tên SP, giá gốc, giá KM, % giảm,
  badge (New/Hot), logo, border từng ô. Cũng **áp cho cả batch**.
- **Điều khiển canh ảnh** (zoom + kéo dọc/ngang): nằm ở toolbar, sửa `BatchConfig.imageFit` →
  áp đồng loạt mọi ô. Click 1 ô để override riêng ô đó (§7.1).
- **Logo overlay**: kéo di chuyển + rê góc để resize trực tiếp trên preview; toggle bật/tắt ở
  toolbar dọc. Là global → kéo/resize 1 lần áp cho mọi ảnh (§7.2).
- Cả 2 toolbar sửa **`BatchConfig` dùng chung** (§7) → mọi Player nhận cùng style/visibility/imageFit →
  re-render tức thì.

UI dùng primitive ở `apps/web/src/shared/ui/` (Button/Select/Input/Badge/DataTable/Pagination).
Không hand-write `<button>/<select>/<table>` — theo §4 CLAUDE.md.

## 5) Loại ảnh (aspect ratio)

| Code | Tên | Kích thước render (px) | Dùng cho |
|---|---|---|---|
| `square` | Hình vuông | 1080×1080 | Post vuông FB/IG |
| `landscape` | Hình chữ nhật ngang | 1200×630 | Share link FB |
| `portrait` | Hình dọc | 1080×1350 | (tuỳ chọn) |

- Kích thước là composition size Remotion (`durationInFrames = 1`).
- Aspect ratio + k (số SP/ảnh) cùng quyết định grid (§6).

## 5.1) Template định sẵn (preset bundle)

Template = một "look" dựng sẵn, chọn xong là ra ngay bố cục + theme, không cần chỉnh tay từ đầu.
Mỗi template gói sẵn:

- **Bố cục ô** (`cellLayout`): cách sắp tên / giá / % giảm / badge trong một ô (vd giá đè góc,
  tên dưới ảnh, badge góc trên...).
- **Grid rules**: mapping `k → rows×cols` theo từng aspect (§6) — có thể khác nhau giữa template.
- **Theme màu mặc định** (`style`): background, accent, màu giá, border... (toolbar ngang ghi đè).
- **Mặc định hiển thị** (`visibility`) + **logo mặc định** (vị trí/size) — toolbar dọc ghi đè.
- **Aspect hỗ trợ**: template có thể chỉ hợp một số ratio (vd template share-FB chỉ landscape).

Quy tắc áp dụng: **chọn template → khởi tạo `BatchConfig` từ defaults của template** (§7);
mọi chỉnh tay sau đó qua toolbar là **override** đè lên, không sửa template gốc.
MVP: template là **preset dựng sẵn trong shared composition package** (single source of truth cho
cả Player + worker). Cho user tự lưu template là việc phase sau.

## 6) Layout grid động (single source of truth)

Mapping `k → (rows × cols)` là **nguồn sự thật duy nhất**, đặt trong shared composition
package, dùng chung cho Player (preview) và worker (export). KHÔNG hardcode lại ở UI.

Ví dụ bảng mặc định (tinh chỉnh khi làm template):

| k (SP/ảnh) | rows × cols | Ghi chú |
|---|---|---|
| 2 | 1×2 | |
| 4 | 2×2 | |
| 6 | 2×3 | |
| 8 | 2×4 | |
| 9 | 3×3 | |
| 12 | 3×4 | ví dụ trong yêu cầu |
| 16 | 4×4 | |

- Mỗi loại ảnh (square/landscape) có thể có bảng grid riêng (vd landscape ưu tiên nhiều cột hơn).
- Ô cuối nếu thiếu sản phẩm → bỏ trống / co grid theo rule template (định nghĩa rõ trong composition).
- `numbers` cho phép chọn: lấy từ tool cũ `[2,4,5,6,8,9,10,12,...]`, nhưng chỉ expose số có layout hợp lệ.

## 7) Props contract (single source of truth — Zod trong `packages/contracts`)

Cấu hình toolbar là **global cho cả batch** → tách thành `BatchConfig` (1 object dùng chung)
và phần riêng từng ảnh (`aspect`, `perImage`, `products`). Khi render/export, mỗi ảnh =
`BatchConfig` ⊕ phần riêng → `ImageProps`. **`ImageProps` là object dùng chung cho Player + worker.**

```
BatchConfig {                   // GLOBAL — 2 toolbar sửa object này
  style: {                      // toolbar NGANG
    backgroundColor, accentColor, priceColor,
    borderColor, borderWidth, theme
  }
  visibility: {                 // toolbar DỌC (mặc định true)
    showName, showOriginalPrice, showSalePrice,
    showDiscountPercent, showBadge, showCellBorder
  }                             // (bật/tắt logo nằm ở logo.visible — §7.2)
  logo: LogoOverlay             // 1 logo overlay cho cả ảnh — kéo/resize tự do (§7.2)
  imageFit: ImageFit            // GLOBAL zoom/kéo ảnh — áp cho mọi ô (§7.1)
}

LogoOverlay {                   // 1 logo thương hiệu đè lên ảnh (watermark)
  url: string
  visible: boolean              // bật/tắt ở toolbar dọc
  x: number                     // 0..1 — vị trí tâm logo theo % chiều rộng ảnh
  y: number                     // 0..1 — theo % chiều cao ảnh
  scale: number                 // kích thước logo theo % cạnh ảnh (vd 0.2 = 20%)
}

ImageFit {                      // canh ảnh trong ô (object-fit: cover + transform)
  scale: number                 // >= 1, zoom; 1 = vừa khít cover
  offsetX: number               // -1..1, kéo ngang theo % vùng dư
  offsetY: number               // -1..1, kéo dọc (ảnh dài hay dùng cái này)
}

ImageProps {                    // PER-IMAGE = BatchConfig + phần riêng
  templateId: string            // template định sẵn → bố cục ô + grid rules (§5.1)
  aspect: 'square' | 'landscape' | 'portrait'
  perImage: number              // k — số SP/ảnh, dùng để chọn grid
  products: ProductCell[]       // đã cắt đúng cho ảnh này (<= k)
  style, visibility, logo, imageFit  // copy từ BatchConfig (global)
}

ProductCell {
  id, name, imageUrl,
  originalPrice, salePrice, discountPercent,
  badges: ('new'|'hot'|...)[],
  imageFitOverride?: ImageFit   // null = dùng global; có = override riêng ô này
}
```

### 7.1) Canh ảnh trong ô — zoom/kéo (global + override lẻ)

Nhiều ảnh sản phẩm là **ảnh dài**; `object-fit: cover` mặc định sẽ crop sai phần. Cho phép
zoom + kéo để chọn đúng khung hiển thị. Quy tắc:

- **Global**: thanh trượt zoom + kéo dọc/ngang ở toolbar → sửa `BatchConfig.imageFit` →
  áp cho **mọi ô của mọi ảnh** cùng lúc (đúng tinh thần đồng loạt).
- **Override lẻ**: click 1 ô trên preview → kéo/zoom trực tiếp ô đó → ghi
  `ProductCell.imageFitOverride`. Ô có override KHÔNG bị ảnh hưởng bởi chỉnh global nữa
  (đến khi reset override).
- **Resolve khi render**: `effectiveFit = cell.imageFitOverride ?? batch.imageFit`. Cùng công
  thức ở Player (preview) và worker (export) → parity.
- Transform lưu dạng **số chuẩn hóa** (scale, offset -1..1), KHÔNG lưu px tuyệt đối — để render
  đúng ở mọi kích thước composition. Clamp biên để ảnh không hở mép ô.

### 7.2) Logo overlay — kéo/resize tự do trên preview

1 logo thương hiệu đè lên cả ảnh (watermark), là **global** (`BatchConfig.logo`) → áp đồng loạt
mọi ảnh trong batch. Quy tắc:

- **Mặc định**: có vị trí + kích thước mặc định (vd trên-giữa, scale 0.2). Map từ preset
  `LogoAlignType` cũ sang `(x, y)` để giữ tương thích.
- **Kéo di chuyển**: rê chuột vào logo trên preview → kéo tới vị trí bất kỳ → cập nhật `logo.x/y`.
- **Resize**: rê **góc logo** (handle) → kéo to/thu nhỏ → cập nhật `logo.scale`.
- **Bật/tắt**: toggle ở toolbar dọc → `logo.visible`. (Thay cho `visibility.showLogo` cũ —
  gộp về `logo.visible` cho gọn.)
- **Chuẩn hóa**: `x, y` (0..1) theo % kích thước ảnh, `scale` theo % cạnh ảnh — KHÔNG lưu px →
  parity giữa Player và worker ở mọi composition size. Clamp để logo không ra ngoài khung.
- Vì global: kéo/resize logo trên **một** preview → tất cả ảnh trong batch cập nhật theo.

- Preview: tất cả Player nhận **cùng** `BatchConfig` + danh sách `products` riêng → đổi toolbar
  là đổi đồng loạt.
- Export: build `ImageProps[]` = merge `BatchConfig` vào từng ảnh, gửi sang API.
- Khởi tạo: chọn template (§5.1) → seed `BatchConfig` (style/visibility/logo) từ defaults của
  template; toolbar chỉnh tay là override đè lên seed này.

Validation (Zod, boundary): độ dài text tối đa, `products.length <= perImage`, URL ảnh tuyệt đối,
border width min/max, màu hợp lệ (hex). Field thêm mới theo **additive-only** (giữ guardrails).

## 8) Kiến trúc render (Remotion — parity bắt buộc)

```
[Browser] Remotion Player  ──┐  cùng composition + cùng ImageProps
                             ├──►  preview == export (1:1)
[Server]  renderStill        ──┘
```

- **Preview realtime (gallery)**: mỗi ảnh trong batch là một `@remotion/player` render `ImageProps`
  trong browser, hiện cùng lúc dạng lưới. Toolbar đổi `BatchConfig` (global) → tất cả Player cập
  nhật tức thì. KHÔNG dùng CSS overlay tạm để "chữa" preview (anti-pattern).
- **Export**: UI gửi **nguyên `ImageProps[]`** (đã chia batch) sang API. API tạo job → pg-boss →
  Remotion worker `renderStill` từng item → lưu PNG. NEVER render AI/inline trong request handler.
- Shared composition package = nguồn sự thật cho layout; sửa layout sửa ở đây trước (guardrails §1).
- **Font tiếng Việt có dấu — load TRƯỚC khi render** (P0): dùng `delayRender()`/`continueRender()`
  (`@remotion/google-fonts` hoặc font local nhúng) để đảm bảo font sẵn sàng trước khi worker chụp.
  Nếu render khi font chưa load, chữ có dấu (ô, ơ, ệ...) bị vỡ/sai — vi phạm yêu cầu bắt buộc
  tiếng Việt có dấu của dự án. Áp cho cả Player (preview) và worker (export).

## 9) Chia batch & export

- **Chia batch** (frontend khi build payload, hoặc backend khi nhận): products[] theo thứ tự
  working set, cắt cửa sổ k → tạo `ceil(N/k)` `ImageProps`. Ví dụ N=12, k=4 → 3 ảnh.
- **Export 1 ảnh**: render item đang xem.
- **Export tất cả**: render cả batch; trả manifest + cho tải zip.
- File naming: `{templateId}-{index}-{slug}-{timestamp}.{ext}`.
- Output local: `./outputs/images/{yyyy}/{MM}/{dd}/{jobId}/` + `manifest.json`.
- **ExportOptions** (§19.7): `format` (`png` nét / `jpeg` nhẹ cho FB), `quality` (jpeg ~85),
  `scale`. FB nén ảnh → mặc định khuyến nghị JPEG q85. Cảnh báo nếu file vượt ngưỡng nặng.

## 10) Domain model

**ImageRenderJob**: id, aspect, perImage, status (Created/Rendering/Completed/Failed),
totalItems, completedItems, outputDir, createdAt, createdBy.

**ImageRenderItem**: id, jobId, index, propsJson (ImageProps), outputFile, status.

**ImageTemplate** (preset bundle — §5.1): id, code, version, isActive,
gridRulesJson (mapping k→rows×cols theo aspect), cellLayoutJson (bố cục tên/giá/badge trong ô),
defaultStyle (theme màu), defaultVisibility, defaultLogo, supportedAspects[].

Value objects: `GridLayout`, `ImageStyle`, `VisibilityFlags`, `ImageFit`, `LogoOverlay`, `ExportOptions`.

## 11) API contract

Base: `/api/images`

- `POST /api/images/jobs` — body: `{ templateId, items: ImageProps[], exportOptions }` →
  `{ jobId, status, totalItems }`. (UI đã chia batch, mỗi item = 1 ảnh.)
- `GET /api/images/jobs/{jobId}` → `{ status, totalItems, completedItems, outputs[] }`.
- `GET /api/images/jobs/{jobId}/manifest` → `{ files[], metadata }` (để tải zip).
- `POST /api/images/preview` *(optional)* — render server 1 `ImageProps` (fallback khi cần ảnh
  server-side, vì preview chính đã chạy bằng Player trong browser).

Sản phẩm KHÔNG đi qua endpoint này — UI tự gọi CMS `GET /api/v1/product/search` (§12) rồi build props.

## 12) Tích hợp CMS (data source)

- Endpoint: `GET /api/v1/product/search?key=...` (+ filter: keyword, supplier, category,
  isDiscount/isNew/isHot/isChanged/isFixed, paging). Key auth lưu **env var**, không hardcode.
- Adapter ở `infrastructure/` sau interface (vd `IProductCatalog`) — application không gọi HTTP trực tiếp.
- Normalize: URL ảnh tuyệt đối, dedupe theo id, fallback ảnh mặc định, id unique trong payload.
- Timeout + retry/backoff ở adapter.
- **Render-safe ảnh external (P0)**: ảnh sản phẩm fetch từ CMS dễ dính CORS / timeout / ảnh
  chết → fail cả batch. Cần **proxy ảnh qua API service** (`GET /api/images/asset?src=...`,
  whitelist host) + **cache local** + **placeholder khi ảnh lỗi** (không fail item). Proxy đồng
  thời giải CORS cho canvas/Player. Worker dùng `<Img>`/`staticFile` render-safe, không fetch raw.

## 13) Persistence (PostgreSQL)

Bảng: `image_render_jobs`, `image_render_items`, `image_templates`, `image_output_manifests`,
`image_drafts` (§19.4).
Index: job `status`, `createdAt`, `templateId`. Migration tường minh (NO `synchronize`).

## 14) Error handling

Envelope chuẩn: `errorCode`, `message`, `details[]`, `traceId`.
Nhóm: `ValidationError`, `UpstreamApiError` (CMS), `RenderError` (Remotion), `StorageError`.
External call (CMS) có timeout + retry. Không silent catch.

## 15) Security

- Sanitize fileName, chặn path traversal.
- API key/token CMS qua env vars; không log key.
- Chỉ admin role tạo render job.
- Sanitize mọi text sản phẩm trước khi đưa vào composition.

## 16) Observability

Log: queue latency, render duration/item, lý do fail, output path.
Metrics: render success rate, avg time/item, retry rate.

## 17) Testing

- Unit: bộ chia batch (N,k → đúng số ảnh & phân bổ), mapping grid `k→rows×cols`, payload validator,
  resolve imageFit (`override ?? global`) + clamp biên.
- Integration: Remotion worker adapter, CMS product adapter (mock), storage adapter.
- Golden dataset: ≥5 bộ — so preview (Player) vs export (renderStill) trong tolerance.

## 18) Definition of Done

1. Load + filter + chọn/sort/xóa sản phẩm hoạt động đúng.
2. Chọn ratio + k → preview realtime đúng grid, đổi màu/ẩn-hiện info phản hồi tức thì.
3. Chia batch đúng (vd 12 SP, 4/ảnh → 3 ảnh) và export 1/nhiều ảnh ra file + manifest.
4. Preview (Player) và export (renderStill) **không lệch** trên ≥5 bộ mẫu.
5. Có logs, error envelope, retry; API docs có ví dụ request/response.
6. Font tiếng Việt có dấu render đúng (không vỡ chữ) ở cả preview và export.
7. Ảnh sản phẩm lỗi → hiện placeholder, không fail cả batch.

## 19) Bổ sung — chất lượng render & thao tác

### 19.1) Format giá tiền (P1)
Formatter dùng chung trong `packages/contracts` (Player + worker cùng dùng): giá VND dạng
`1.250.000đ`, **gạch ngang giá gốc**, badge `-30%`. Không tự format rời ở UI/worker (tránh lệch).

### 19.2) Auto-fit tên sản phẩm dài (P1)
Tên dài dễ tràn ô. Rule trong composition: tối đa 2 dòng → truncate `…` hoặc co font tự động
(min font size). Không để vỡ grid. Cảnh báo khi text bị cắt (tùy chọn).

### 19.3) Sort nhanh working set (P1)
Ngoài kéo tay đổi thứ tự: sort 1-click theo **% giảm / giá / tên**. Thứ tự working set quyết
định thứ tự sản phẩm trong các ảnh (§9).

### 19.4) Lưu & tái dùng phiên — Draft (P1)
Lưu tập sản phẩm đã chọn + `BatchConfig` + template thành **draft** để quay lại tạo tiếp / tạo
lại cùng bộ (hợp việc làm ảnh định kỳ). Bảng `image_drafts` (id, name, payloadJson, updatedAt).

### 19.5) Ảo hóa gallery (P2)
Batch 20+ Player cùng lúc rất nặng. Lazy render / virtualize: ô ngoài viewport hiển thị ảnh
`renderStill` server (hoặc placeholder) thay vì Player sống. Giữ ô đang xem là Player thật.

### 19.6) Lịch sử batch (P2)
UI xem lại / tải lại các lần render trước từ `image_output_manifests` (dữ liệu đã có, chỉ thêm UI).

### 19.7) Định dạng & chất lượng xuất (P1)
`ExportOptions { format: 'png'|'jpeg', quality, scale }`. PNG nét, JPEG nhẹ cho FB (mặc định
khuyến nghị JPEG q≈85 vì FB nén lại). Cảnh báo khi file vượt ngưỡng nặng.

### 19.8) Lấp ô trống / chia đều (P2)
Khi N không chia hết k, rule cho ảnh cuối thiếu ô: căn giữa các ô còn lại / co grid / chèn
placeholder. Định nghĩa rõ trong template (`cellLayout`), thống nhất Player + worker.
