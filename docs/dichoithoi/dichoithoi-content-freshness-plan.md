# Plan: Tín hiệu "cập nhật nội dung" thật (content freshness signal)

✅ **ĐÃ BUILD + VERIFY** (29/07/2026) — Giai đoạn A-F đã implement đầy đủ cả
2 repo (zinoflow + dichoithoi), 468 test zinoflow xanh, `dotnet build`
dichoithoi xanh, migration đã chạy thật trên `dichoithoi_dev`. Plan dưới đây
giữ nguyên làm tài liệu thiết kế/tham chiếu — không xoá sau khi build xong,
vì còn chứa lý do/audit không nằm ở đâu khác.

Bối cảnh xuất phát: trong lúc debug bug ảnh/layout của `thac-trieu-hai`
(29/07/2026, xem `dichoithoi-backlog.md` mục C7 — không liên quan nội dung,
chỉ trùng phiên làm việc), người dùng để ý dòng "Thông tin trong bài cập
nhật tháng X/2026" hiển thị đầu bài và hỏi cơ chế đứng sau nó. Sau khi phân
tích, phát hiện dòng này hiện là **text tĩnh do AI viết cứng lúc generate**,
không phản ánh việc bài có thực sự được rà lại hay không — nếu để nguyên,
theo thời gian nó sẽ tự tố cáo bài cũ (phản tác dụng E-E-A-T); nếu tự động
làm mới vô điều kiện thì vi phạm chính sách "date spam" của Google. Plan này
thiết kế lại cơ chế đúng.

## Hiện trạng đã audit (file:line cụ thể đã đọc)

- `updateNotice` là 1 field trong `DestinationArticle`, AI viết cứng lúc
  generate theo prompt `default-prompts.ts:316-318` (và 3 chỗ prompt khác
  cùng pattern dòng 384/497/558): *"ghi ĐÚNG NGUYÊN VĂN 'Thông tin trong bài
  cập nhật tháng {{currentDate}}...' — KHÔNG tự suy ra"*. Render vào đầu bài
  markdown ở `destination-markdown.renderer.ts:14` (`> ${article.updateNotice}`,
  ngay sau intro, trước "Thông tin nhanh").
- Quality gate hiện có bắt buộc `updateNotice` phải chứa tháng/năm dạng số
  (`destination-gates.ts:215-228`, hàm `evaluateDestinationPolicyGate`) —
  chỉ check ĐỊNH DẠNG, không check nội dung có thật hay không.
- `SchemaUtil.cs` (dichoithoi repo) **không có** `dateModified`/`datePublished`
  ở bất kỳ đâu — grep xác nhận không có match.
- Sitemap hiện tại LẤY `lastmod` từ `v2.Destination.UpdatedAt`
  (`HomeController.cs:368-401`, comment tự ghi "SEO audit 25/07/2026"). Cột
  `UpdatedAt` này bị nhiều thao tác KHÔNG liên quan nội dung đụng vào, xác
  nhận qua `mssql-site-db.adapter.ts`: đổi slug (dòng 406), tính lại khoảng
  cách cụm — chạy hàng loạt qua `recompute-cluster-distances.usecase.ts`
  (dòng 754), đổi thumbnail (dòng 742), auto-link mô tả taxonomy (dòng 390).
  → Không dùng được cột này làm nguồn "nội dung được rà lại thật".
- `v2.DestinationContent` (`V2DestinationContent.cs`) **không có cột
  timestamp nào** — không có `UpdatedAt`/`ContentUpdatedAt` sẵn có ở bảng
  nội dung, chỉ có ở bảng `v2.Destination` (bảng metadata, không phải bảng
  nội dung).
- **CHỈ CÓ 1 điểm ghi nội dung xuống site DB** —
  `PublishDestinationUseCase.execute()` (`publish-destination.usecase.ts:49-192`)
  → `MssqlSiteDbAdapter.publishDestination()` (`mssql-site-db.adapter.ts:173-256`).
  Mọi luồng (biên tập viên gõ tay sửa trong `destination-article-editor.tsx`,
  AI gợi ý từng khối rồi bấm "Áp dụng" — `onApplySuggestion` dòng 73/135/268,
  hay AI tạo lại toàn bộ draft) đều đi qua **CÙNG 1 lệnh publish này** — không
  có đường ghi trực tiếp `ContentHtml` nào khác. → Sửa lệch với giả định ban
  đầu của người dùng: không cần phân biệt "luồng AI regenerate" với "luồng
  sửa tay" bằng cách nào đó ở tầng UI/usecase riêng — chỉ cần so sánh
  **giá trị CŨ (đang publish) và MỚI (sắp ghi) ngay tại đúng 1 điểm này**.
- Đã có sẵn `fetchDestinationContent(siteId)` (`mssql-site-db.adapter.ts:135-151`)
  đọc lại bản ĐANG publish trước khi ghi đè — nhưng hiện chỉ SELECT
  `ContentHtml, OpeningTime, TicketPrice, Transport, Food, HotelText, Tip`,
  **thiếu** `PriceBreakdownJson`, `PracticalNotesJson`, `FaqJson` (3 field
  cần cho so sánh giá trị cũ/mới ở giai đoạn 2 dưới đây) — cần bổ sung SELECT.
- `ContentHash` (`SHA2_256(ContentHtml)`, tính ở cuối câu SQL publish, dòng
  244-246) hiện chỉ dùng để phát hiện "sửa tay ngoài AI tool"
  (`decideSyncAction`, `destination-mirror.ts:68-93`) lúc đồng bộ — mục đích
  khác hoàn toàn, nhưng xác nhận hạ tầng hash-so-sánh đã tồn tại, có thể học
  theo pattern (không tái dùng trực tiếp vì mục đích khác).
- Dashboard alerts pattern tái dùng được:
  `get-dichoithoi-dashboard-alerts.usecase.ts:101-141` — style thêm 1 alert
  mới (filter mirror rows theo điều kiện → count → object `{key, label, count,
  href}`, chỉ hiện khi `count > 0`).
- `docs/dichoithoi/dichoithoi-content-seo-ux-plan.md:467-482` (§8.5 E-E-A-T)
  là nguồn gốc ý tưởng ban đầu — đề xuất "1 dòng trust signal... cập nhật
  tháng X/2026" nhưng CHƯA phân tích sâu rủi ro date-spam/staleness — plan
  này bổ sung phần đó.

## Thiết kế đã chốt

### 1. Hai mốc thời gian tách biệt, khác mục đích (KHÔNG dùng `v2.Destination.UpdatedAt`)

Thêm 2 cột mới vào `v2.DestinationContent`:

- **`ContentUpdatedAt` (datetime2, nullable)** — chỉ bump khi **nội dung
  thật sự đổi** (định nghĩa ở mục 2). Đổ ra 3 nơi:
  1. Badge hiển thị cho người đọc ("Cập nhật tháng X/Y").
  2. `dateModified` trong JSON-LD (`SchemaUtil.cs` — field mới, hiện chưa có).
  3. `lastmod` sitemap — **đổi nguồn** từ `v2.Destination.UpdatedAt` sang cột
     này cho riêng URL `/diem-den/{slug}` (giữ nguyên `UpdatedAt` cho mục
     đích khác nếu có, không đụng).
- **`LastVerifiedAt` (datetime2, nullable)** — bump khi biên tập viên bấm nút
  "✅ Đã kiểm tra, vẫn đúng" trong CMS dù không sửa chữ nào. **Chỉ** đổ vào
  badge người đọc — KHÔNG đổ vào `dateModified`/`lastmod` (không có
  content-diff thật, đưa vào 2 chỗ đó là tái phạm đúng lỗi date-spam).

Badge hiển thị giá trị **mới nhất trong 2 cột**, đổi câu chữ theo loại:
- `ContentUpdatedAt` mới hơn → "Cập nhật tháng X/Y".
- `LastVerifiedAt` mới hơn → "Đã kiểm tra & xác nhận thông tin — tháng X/Y".
- Cả 2 đều null, hoặc cả 2 đều cũ hơn 6 tháng so với hiện tại → **ẩn badge
  hoàn toàn** (xem mục 4) — không hiện ngày cũ, không tự đoán.

### 2. Quy tắc "meaningful update" — so sánh giá trị CŨ/MỚI ngay tại `publishDestination()`

Không phân biệt theo "luồng" (AI regenerate hay sửa tay) — không cần thiết,
vì chỉ có 1 điểm ghi (xem audit). Thay vào đó, **ngay trước khi UPDATE**
trong `PublishDestinationUseCase.execute()`, đọc bản đang publish qua
`fetchDestinationContent(siteId)` (đã có sẵn, cần bổ sung 3 field), so với
giá trị sắp ghi:

- **So sánh giá trị trực tiếp** (không cần AI) cho: `TicketPrice`,
  `OpeningTime`, `PriceBreakdownJson`, `PracticalNotesJson`, `FaqJson`. Field
  nào trong nhóm này đổi giá trị (chuỗi khác nhau sau trim) → tự động bump
  `ContentUpdatedAt`, im lặng.
- **AI phân loại (Haiku)** riêng cho `ContentHtml` — vì field này vừa có thể
  là sửa chính tả/câu chữ (không meaningful) vừa có thể viết lại nội dung
  thật (meaningful), không thể phân biệt bằng so sánh giá trị đơn thuần.
  Gọi model `claude-haiku-4-5` (đúng quy ước "light tasks" — CLAUDE.md §5),
  gửi (`oldContentHtml`, `newContentHtml`), hỏi: *"Đây là thay đổi thông
  tin/nội dung thực sự, hay chỉ sửa câu chữ/chính tả/định dạng?"* → boolean +
  lý do ngắn. Chỉ gọi khi `oldContentHtml !== newContentHtml` (bỏ qua hoàn
  toàn khi publish lại y hệt, ví dụ publish lại sau khi chỉ đổi ảnh đại diện).
  - Kết quả hiển thị ngay cho biên tập viên trong CMS ngay sau khi publish
    xong (không phải hỏi TRƯỚC khi publish — publish không nên bị chặn bởi
    bước phân loại phụ này).
  - Có 1 nút override thủ công cạnh kết quả, cho phép lật lại nếu AI đoán
    sai — nút này **bắt buộc có đoạn giải thích SEO ngắn ngay cạnh** (đúng
    quy tắc bắt buộc "Giải thích tính năng ngay tại chỗ dùng",
    `.github/copilot-instructions.md`): vì sao đánh dấu đúng ảnh hưởng SEO
    (tránh date-spam nhưng vẫn giữ tín hiệu freshness thật cho Google).
  - Field khác (`Transport`, `Food`, `HotelText`, `Title`, `MetaTitle`,
    `MetaDescription`, `GalleryJson`...) — **không** đưa vào cơ chế này ở
    giai đoạn đầu, coi là ngoài phạm vi (không ảnh hưởng trực tiếp tới
    "thông tin hành động được" như giá vé/giờ mở cửa mà người đọc dựa vào).

### 3. `LastVerifiedAt` — nút xác nhận thủ công trong CMS

Thêm 1 action mới (ví dụ nút trong tab nội dung của trang chi tiết điểm đến,
`apps/web/src/app/dichoithoi/[slug]/page.tsx`) — "✅ Đã kiểm tra, vẫn đúng"
— bấm là bump `LastVerifiedAt = now()` ngay, không cần publish lại, không
qua AI phân loại gì (đây là hành động xác nhận của con người, tự thân đã rõ
ràng). Chỉ hiển thị khi điểm đã publish (`siteId != null`).

### 4. Ngưỡng ẩn badge — 6 tháng

- `max(ContentUpdatedAt, LastVerifiedAt)` cũ hơn **6 tháng** so với ngày hiện
  tại (hoặc cả 2 đều null) → **ẩn badge hoàn toàn** trên trang detail — không
  hiện ngày cũ (gây cảm giác bị bỏ bê), không tự động refresh giả (date-spam).
  Ẩn = trung thực bằng im lặng.
- Cảnh báo dashboard vận hành bắn **sớm hơn 1 tháng (5 tháng)** — thêm 1
  alert mới kiểu `missingCoordsCount`
  (`get-dichoithoi-dashboard-alerts.usecase.ts:101-141`): đếm số điểm đã
  publish có `max(ContentUpdatedAt, LastVerifiedAt)` cũ hơn 5 tháng (hoặc
  null), href trỏ tới danh sách lọc sẵn — cho người dùng khoảng đệm 1 tháng
  để rà lại trước khi badge biến mất khỏi trang public.

## Giai đoạn thực hiện

### Giai đoạn A — Schema + đọc/ghi 2 cột mới (nền tảng, làm trước tiên)
- Migration dichoithoi: thêm `ContentUpdatedAt`, `LastVerifiedAt`
  (`datetime2 NULL`) vào `v2.DestinationContent`.
- `V2DestinationContent.cs` — thêm 2 property.
- `mssql-site-db.adapter.ts`: mở rộng `fetchDestinationContent()` SELECT
  thêm `PriceBreakdownJson, PracticalNotesJson, FaqJson, ContentUpdatedAt,
  LastVerifiedAt`; thêm hàm `markContentVerified(siteId)` (UPDATE
  `LastVerifiedAt = SYSUTCDATETIME()`).
- **DoD**: migration chạy được trên `dichoithoi_dev`, verify bằng
  `sys.columns` (như cách đã làm ở migration `06-taxonomy-group-province-autolink-columns.sql`
  trước đó) + query tay xác nhận cột tồn tại, giá trị mặc định NULL.
- Phụ thuộc: độc lập, làm trước được.

### Giai đoạn B — Gate so sánh giá trị (field không cần AI)
- `PublishDestinationUseCase.execute()`: đọc `fetchDestinationContent(siteId)`
  trước bước UPDATE (chỉ khi `siteId !== null`, tức không phải publish lần
  đầu — publish lần đầu luôn coi là meaningful, bump ngay).
- So sánh `TicketPrice/OpeningTime/PriceBreakdownJson/PracticalNotesJson/FaqJson`
  cũ/mới (trim rồi so chuỗi) — có khác → truyền cờ `contentChanged: true`
  cho `publishDestination()`, SQL UPDATE thêm
  `ContentUpdatedAt = SYSUTCDATETIME()` khi cờ bật.
- **DoD**: unit test cho hàm so sánh (pure function, tách riêng dễ test) —
  case đổi giá vé → true, case chỉ đổi ảnh đại diện (field ngoài danh sách)
  → false, case cả 2 cũ/mới đều null → false. Test thật trên `dichoithoi_dev`:
  publish 1 điểm, đổi `TicketPrice`, publish lại, query
  `SELECT ContentUpdatedAt FROM v2.DestinationContent` xác nhận đổi.
- Phụ thuộc: cần Giai đoạn A xong (cột đã tồn tại).

### Giai đoạn C — AI phân loại `ContentHtml` + nút override
- Usecase mới `ClassifyContentChangeUseCase` (hoặc method riêng), gọi
  `IContentAIProvider` với model `claude-haiku-4-5`, input
  (oldContentHtml, newContentHtml) → output `{ isMeaningful: boolean, reason: string }`.
  Log vào `ai_usage_logs` như quy ước chung (CLAUDE.md §5).
  Chỉ gọi khi `oldContentHtml.trim() !== newContentHtml.trim()`.
- Lưu kết quả phân loại (bảng nào đó hoặc field tạm trên job/response) để
  CMS hiển thị ngay sau khi publish xong + nút override.
- UI: sau khi publish xong ở `apps/web/src/app/dichoithoi/[slug]/page.tsx`
  tab nội dung — hiện kết quả phân loại + nút lật + đoạn giải thích SEO ngắn
  cạnh nút (bắt buộc theo copilot-instructions.md).
- **DoD**: test usecase với `stub-content-ai.provider.ts` (mock 2 case: câu
  trả lời "meaningful"/"không meaningful"). Playwright xem UI thật: publish 1
  bài có sửa nội dung thật → thấy badge/kết quả đúng "meaningful"; publish
  lại không sửa gì `ContentHtml` → không gọi AI, không có UI này hiện ra.
- Phụ thuộc: cần Giai đoạn A + B xong (cùng chỗ trong `publishDestination` flow).

### Giai đoạn D — Nút "Đã kiểm tra, vẫn đúng" (`LastVerifiedAt`)
- Endpoint mới `POST /destinations/:slug/verify-content` (hoặc tương tự) →
  `markContentVerified(siteId)`.
- Nút trong CMS (tab nội dung, chỉ hiện khi `siteId != null`).
- **DoD**: bấm nút thật trên `dichoithoi_dev`, query xác nhận
  `LastVerifiedAt` đổi, `ContentUpdatedAt` KHÔNG đổi (đúng tách biệt 2 cột).
- Phụ thuộc: cần Giai đoạn A xong. Độc lập với B/C.

### Giai đoạn E — Badge hiển thị + ẩn theo ngưỡng 6 tháng
- `Detail.cshtml` (dichoithoi repo) — thay đoạn `updateNotice` tĩnh trong
  `ContentHtml` (hiện render bởi `destination-markdown.renderer.ts:14`, đã
  bake cứng vào HTML publish) bằng badge tính động từ
  `ContentUpdatedAt`/`LastVerifiedAt` đọc trực tiếp cột DB — **không** còn
  đọc từ trong thân `ContentHtml` nữa.
  - Cần sửa `default-prompts.ts` (4 chỗ dòng 316/384/497/558) + `destination-markdown.renderer.ts:14`
    — **bỏ hẳn** `updateNotice` khỏi output AI (không cần AI viết dòng này
    nữa, badge giờ tính động phía website) — kèm sửa
    `destination-gates.ts:215-228` (gate không còn check `updateNotice`
    nữa, có thể xoá hẳn hoặc đổi gate khác nếu §6.3/§19.5.3 vẫn cần).
  - **CẢNH BÁO**: đây là thay đổi output AI + gate — ảnh hưởng
    `restructure-pasted-content.usecase.spec.ts`,
    `destination-gates.spec.ts`, `update-draft.usecase.spec.ts`,
    `review-draft.usecase.spec.ts` (đều có fixture `updateNotice` — xem audit)
    — cần sửa test cùng lúc, không phải task phụ.
- Logic ẩn: `max(ContentUpdatedAt, LastVerifiedAt)` cũ hơn 6 tháng hoặc cả 2
  null → không render badge.
- `SchemaUtil.cs` — thêm `dateModified` (JSON-LD) từ `ContentUpdatedAt`
  (không set nếu null — không bịa ngày).
- `HomeController.cs:398-401` — sitemap `lastmod` cho URL `/diem-den/{slug}`
  đổi nguồn từ `v2.Destination.UpdatedAt` sang `ContentUpdatedAt` (fallback
  giữ `UpdatedAt` nếu `ContentUpdatedAt` null — điểm chưa từng qua cơ chế
  mới, ví dụ dữ liệu cũ trước migration).
- **DoD**: Playwright xem thật trên `dichoithoi_dev` — 1 điểm mới publish
  (như `thac-trieu-hai`) hiện đúng badge "Cập nhật tháng 7/2026"; giả lập 1
  điểm có `ContentUpdatedAt` set về 7 tháng trước → badge ẩn, view-source
  xác nhận không còn text `updateNotice` tĩnh trong HTML; xem JSON-LD có
  `dateModified` đúng giá trị; xem `/sitemap.xml` có `lastmod` đúng.
- Phụ thuộc: cần Giai đoạn A + B + C + D xong (cần cả 2 cột có dữ liệu thật
  để test badge/ẩn đúng theo mọi trường hợp).

### Giai đoạn F — Cảnh báo dashboard 5 tháng
- Thêm alert `stale-content` vào `get-dichoithoi-dashboard-alerts.usecase.ts`
  theo đúng pattern `missing-coords` (dòng 101-141) — đếm điểm publish có
  `max(ContentUpdatedAt, LastVerifiedAt)` cũ hơn 5 tháng hoặc null.
- **DoD**: dashboard CMS hiện đúng số lượng, href lọc đúng danh sách (verify
  bằng query tay so khớp count).
- Phụ thuộc: cần Giai đoạn A + B + C + D (cần dữ liệu thật ở 2 cột).

## Rủi ro/lưu ý (đã xử lý — giữ lại làm căn cứ quyết định)

- Xoá `updateNotice` khỏi output AI (Giai đoạn E): đã audit toàn bộ chỗ đọc
  field này (contract, prompt, renderer, gate, UI CMS) và xoá hẳn (không giữ
  optional/deprecated) — quyết định qua `AskUserQuestion` khi bắt đầu
  implement 29/07/2026, phương án "xoá hẳn" được chọn.
- Bài ĐÃ publish trước migration (Giai đoạn A) có `ContentUpdatedAt=NULL` —
  chấp nhận KHÔNG backfill từ `UpdatedAt` (quyết định qua `AskUserQuestion`
  cùng thời điểm, vì `UpdatedAt` không đáng tin — xem audit). Badge các bài
  này ẩn ngay cho tới lần publish/verify tiếp theo — đúng tinh thần trung
  thực, không bịa ngày.

## Vì sao thiết kế 2 cột tách biệt là BẮT BUỘC, không phải thận trọng thừa (29/07/2026)

Bổ sung sau khi rà lại tài liệu chính thức Google
(`docs/dichoithoi/dichoithoi-google-seo-guidelines.md` — đọc toàn bộ trước
khi sửa plan này nếu có thay đổi) — câu hỏi gốc: *"Google xác định nội dung
update có giá trị thật hay không, để không bị coi là spam, bằng cách nào?"*

Câu trả lời trực tiếp, trích nguyên văn từ `creating-helpful-content`
(khung tự đánh giá "search-engine-first" — dấu hiệu XẤU):

> Are you changing the date of a page to make it appear fresh, **when
> content has not been substantively changed**?

Và từ `build-sitemap` (về `<lastmod>`):

> Google uses the `<lastmod>` value **if it's consistently and verifiably
> accurate** (for example by comparing to the last modification of the
> page).

Hai trích dẫn này xác nhận: đây **không phải rủi ro suy diễn**, mà là chính
sách Google công bố rõ ràng, và Google **tự đối chiếu** ngày khai báo với thay
đổi thực tế trên trang — nếu lệch, Google **ngừng tin cậy tín hiệu ngày cho
toàn site**, không chỉ 1 trang bị ảnh hưởng. Đây là lý do:
1. `ContentUpdatedAt`/`LastVerifiedAt` phải tách 2 cột riêng (không gộp 1
   "ngày sửa gần nhất" đơn giản) — vì chỉ `ContentUpdatedAt` (nội dung đổi
   THẬT) mới được phép đổ vào `dateModified`/`lastmod`; `LastVerifiedAt`
   (xác nhận không đổi gì) đổ vào 2 nơi đó sẽ TÁI PHẠM đúng câu cảnh báo
   trên.
2. Gate so sánh giá trị (Giai đoạn B) + AI phân loại `ContentHtml` (Giai
   đoạn C) phải chạy TRƯỚC khi bump `ContentUpdatedAt`, không được "cứ
   publish là bump" — nếu làm vậy, mọi lần biên tập viên chỉ sửa lỗi chính
   tả cũng bump ngày, tích luỹ theo thời gian tạo đúng pattern site bị Google
   giảm tin cậy tín hiệu freshness.
3. Ngưỡng ẩn badge 6 tháng (thay vì tự động "làm mới" ngày hiển thị) đúng
   tinh thần Google: im lặng (ẩn) khi không có gì mới, thay vì bịa tín hiệu
   fresh giả.
