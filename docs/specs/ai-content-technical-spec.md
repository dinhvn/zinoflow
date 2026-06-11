# AI Content Technical Spec (MVP)

## 1) Scope
MVP AI Content module phuc vu:
- Tao outline va draft bai viet tu input campaign/topic + product data.
- Human review va approve truoc khi publish.
- Chua auto publish bat buoc trong phase 1, uu tien tao draft chat luong cao.

## 2) Non-goals (MVP)
- Khong tu dong SEO audit toan bo website.
- Khong tu dong publish hang loat khong can duyet.
- Khong thay the CMS cu, chi tich hop qua API.

## 3) Architecture placement
Theo clean architecture:
- Domain: article rules, review state, quality gates.
- Application: use cases generate/review/approve.
- Infrastructure: AI provider adapter, CMS data client, persistence.
- Presentation: web UI + REST API.

Module boundaries:
- Module AI Content khong duoc phu thuoc truc tiep vao Image Tool.
- Tich hop lien module chi qua event/job contract.

## 4) Domain model
### 4.1 Entities
1. ContentJob
- id
- sourceType (Topic, Campaign, ProductSet)
- sourceRef
- status (Created, GeneratingOutline, DraftReady, InReview, Approved, Rejected, Failed)
- createdAt
- createdBy

2. ContentDraft
- id
- jobId
- title
- outlineJson
- draftMarkdown
- seoMetaJson
- qualityScore
- version
- createdAt

3. ReviewRecord
- id
- draftId
- action (RequestChange, Approve, Reject)
- note
- actor
- createdAt

4. PromptTemplate
- id
- templateKey
- version
- content
- isActive

### 4.2 Value objects
- ToneProfile
- KeywordSet
- QualityGateResult

## 5) State machine
1. Created
2. GeneratingOutline
3. DraftReady
4. InReview
5. Approved or Rejected
6. Failed (co retry policy)

Transition rules:
- Chi duoc Approve khi quality gates pass.
- Rejected bat buoc co reason.
- Approved draft bi sua noi dung se tao version moi va quay ve InReview.

## 6) Use cases
1. CreateContentJob
2. GenerateOutline
3. GenerateDraft
4. RunQualityChecks
5. SubmitForReview
6. ApproveDraft
7. RejectDraft
8. ExportDraftHtml

## 7) API contract (MVP)
Base path: /api/content

### 7.1 Create job
POST /api/content/jobs
Request:
- sourceType
- sourceRef
- topic
- keywordSeed[]
- toneProfile
- aiProvider (optional: 'anthropic' | 'openai', default theo SiteProfile)
- aiModel (optional, vd: 'claude-opus-4-8', default theo provider)
Response:
- jobId
- status

### 7.1b List AI providers/models
GET /api/content/ai-providers
Response:
- providers[] (key, displayName, models[] { id, displayName, tier, costNote })

### 7.2 Generate outline
POST /api/content/jobs/{jobId}/outline
Response:
- draftId
- outlineJson

### 7.3 Generate draft
POST /api/content/drafts/{draftId}/generate
Response:
- draftMarkdown
- seoMeta
- qualityScore

### 7.4 Run quality checks
POST /api/content/drafts/{draftId}/quality-checks
Response:
- checks[] (name, pass, details)
- aggregateScore
- canSubmitReview

### 7.5 Review actions
POST /api/content/drafts/{draftId}/review
Request:
- action (Approve, RequestChange, Reject)
- note
Response:
- newStatus

### 7.6 Get draft details
GET /api/content/drafts/{draftId}
Response:
- metadata
- current version
- review history

## 8) AI provider abstraction (multi-provider, chon per-request)

Interface IContentAIProvider (application layer):
- key ('anthropic' | 'openai' | ...)
- listModels()
- generateOutline(input)
- generateSection(input)   // expand tung block rieng, retry duoc tung block
- suggestTitleVariants(input)

AIProviderRegistry:
- Resolve provider theo aiProvider tren content job.
- Them provider moi = them 1 adapter o infrastructure, khong sua core flow.

Provider Anthropic (Claude):
- SDK: @anthropic-ai/sdk
- Models: claude-opus-4-8 (default, bai dai/kho), claude-sonnet-4-6 (can bang),
  claude-haiku-4-5 (task nhe: title, meta).
- Structured output: client.messages.parse() + zodOutputFormat(schema) — schema lay tu
  packages/contracts (8-block framework, muc 17.4).
- Opus 4.8: thinking adaptive, khong truyen temperature/top_p/top_k; streaming cho bai dai.

Provider OpenAI (ChatGPT):
- SDK: openai (chinh thuc), structured output qua JSON schema response format.

Yeu cau chung:
- Co fallback provider khi provider chinh loi (retry policy o application layer).
- Log token usage, cost (USD), latency cho moi call (bang ai_usage_logs).
- Khong hardcode provider trong application layer; API key qua env vars.
- Output AI bat buoc validate bang Zod schema truoc khi luu draft.

## 9) Quality gates
Gate bat buoc truoc approve:
1. Structure gate:
- Co title, intro, body sections, CTA.

2. SEO gate:
- Co primary keyword trong title/intro.
- Co meta title/description.

3. Policy gate:
- Co affiliate disclosure.
- Khong co claim qua da.

4. Data gate:
- Product links hop le.
- Khong co empty block.

## 10) Persistence (PostgreSQL local + TypeORM)
Postgres cai truc tiep tren may (khong Docker). ORM: TypeORM, strict mode,
khong dung synchronize, migration generate + review truoc khi chay.

Bang toi thieu:
- content_jobs (co them cot: ai_provider, ai_model)
- content_drafts
- content_review_records
- prompt_templates
- content_quality_results
- ai_usage_logs (provider, model, inputTokens, outputTokens, costUsd, latencyMs, jobId)

Yeu cau:
- optimistic locking cho draft version (@VersionColumn).
- index cho status, createdAt, sourceRef.
- pg-boss dung chinh database nay lam queue (schema rieng).

## 11) Integrations
1. CMS old repo API:
- Lay product/campaign context cho content generation.

2. Future integration:
- Event ContentDraftApproved de trigger publish module.

## 12) Error handling
Error envelope:
- errorCode
- message
- details[]
- traceId

Error groups:
- ValidationError
- DomainRuleError
- AiProviderError
- UpstreamApiError
- UnknownError

## 13) Observability
Bat buoc log:
- job lifecycle
- quality check result
- ai token usage
- average generation latency

Metrics MVP:
- draft generation success rate
- avg time draft completion
- approval rate

## 14) Security
- API auth cho admin actions.
- Secret key qua env vars.
- sanitize markdown/html truoc preview/export.

## 15) Testing strategy
1. Unit tests:
- state transition rules
- quality gate evaluators

2. Integration tests:
- ai provider adapter mock contract
- CMS data client contract

3. E2E smoke:
- create job -> generate draft -> review approve

## 16) Definition of done
1. Co the tao draft tu source data that bai.
2. Co review workflow va luu lich su day du.
3. Quality gates hoat dong va chan approve khi fail.
4. API docs co request/response examples.
5. Unit + integration tests pass.

## 17) Khung bai viet chi tiet (Article Framework)

### 17.1 Khung chung bat buoc cho moi bai
Moi draft phai theo dung thu tu block sau:
1. Hero block
- H1 title
- subtitle 1-2 cau
- affiliate disclosure ngan

2. Intent block
- Mo ta bai viet danh cho ai
- Nhu cau/chuyen can giai quyet

3. Quick answer block
- Tom tat ket luan nhanh 3-5 bullet
- Neu bai list/comparison thi hien bang tom tat nho

4. Main content sections
- Chia theo H2/H3 ro rang
- Moi section co data-backed points
- Co 1 mini CTA phu hop section

5. Product recommendation block
- Danh sach san pham theo tieu chi
- Moi item co: uu diem, nhuoc diem, gia tam, doi tuong phu hop

6. FAQ block
- 3-6 cau hoi thuc te theo intent tim kiem

7. Final CTA block
- Keu goi hanh dong ro rang
- Goi y next action (xem them bai lien quan, xem deal)

8. Metadata block (khong hien thi noi dung chinh)
- metaTitle
- metaDescription
- slug suggestion
- internal link suggestions

### 17.2 Khung theo loai bai

#### A. Review bai don (single product/brand review)
1. Gioi thieu nhanh san pham va doi tuong su dung.
2. Uu diem va han che.
3. Trai nghiem theo tieu chi cu the:
- chat lieu/do ben
- tinh nang/chuc nang
- gia tri tren gia tien
4. So sanh nhe voi 1-2 lua chon cung phan khuc.
5. Ket luan: co nen mua khong, ai nen mua.

#### B. Top list (best X for Y)
1. Tieu chi xep hang ro rang.
2. Bang top list tom tat.
3. Tung item theo mau:
- Vi sao nam trong danh sach
- Uu/nhuoc
- Muc gia tham khao
- Doi tuong phu hop
4. Phan huong dan cach chon mua theo ngan sach.
5. Ket luan + goi y item uu tien.

#### C. Comparison (A vs B vs C)
1. Dinh nghia boi canh so sanh.
2. Bang so sanh theo tieu chi.
3. Phan tich tung tieu chi quan trong.
4. Ket qua theo tung nhu cau nguoi dung.
5. Ket luan scenario-based (neu uu tien X thi chon Y).

#### D. Promotion/Deal page
1. Tom tat deal dang co gia tri nhat.
2. Muc dieu kien ap dung/han su dung.
3. Danh sach deal theo brand/category.
4. Canh bao thay doi gia/het ma.
5. CTA chuyen doi nhanh.

### 17.3 Rule noi dung cho tung section
1. H1 chi co 1 cai, do dai 50-70 ky tu uu tien.
2. Intro 80-120 tu, co primary keyword tu nhien.
3. Moi H2 nen co 120-250 tu noi dung.
4. Moi bai co it nhat 2 internal links va 1 related post suggestion.
5. CTA khong duoc claim qua da, khong su dung ngon ngu gian doi.

### 17.4 Output schema de frontend render
Draft output nen duoc tra ve ca 2 dang:
1. Structured JSON blocks:
- hero
- quickAnswer
- sections[]
- productRecommendations[]
- faq[]
- finalCta
- metadata

2. DraftMarkdown:
- De editor sua nhanh
- De export sang HTML khi can

### 17.5 Mapping voi quality gates
1. Structure gate:
- Kiem tra du 8 block bat buoc.

2. SEO gate:
- Kiem tra primary keyword trong H1 + intro.
- Kiem tra metaTitle/metaDescription co mat.

3. Policy gate:
- Kiem tra affiliate disclosure block.
- Kiem tra tu/cum tu claim bi cam.

4. Data gate:
- Kiem tra product blocks co URL hop le.

### 17.6 Prompting guideline cho AI generation
1. Prompt theo 2 buoc:
- Buoc 1: Tao outline theo block framework.
- Buoc 2: Expand tung block thanh draft day du.

2. Prompt phai ep AI output theo JSON schema truoc, sau do moi render markdown.

3. Neu thieu du lieu tu CMS:
- Ghi ro phan thieu du lieu trong notes block.
- Khong tu che thong so.

## 18) Mẫu thực tế (Top List) - tiếng Việt có dấu

### 18.1 Bài toán mẫu
- Loại bài: Top list
- Chủ đề: Top 7 túi xách nữ đi làm bền đẹp, dễ phối đồ dưới 1.500.000đ
- Đối tượng: Nữ 22-35 tuổi, cần túi dùng hằng ngày
- Mục tiêu: Tăng click sang trang sản phẩm và giữ tỷ lệ thoát thấp

### 18.2 Mẫu output dạng Structured JSON blocks
```json
{
	"hero": {
		"title": "Top 7 túi xách nữ đi làm bền đẹp, dễ phối đồ dưới 1.500.000đ",
		"subtitle": "Danh sách được chọn theo tiêu chí độ bền, thiết kế tối giản và mức giá dễ mua trong năm 2026.",
		"affiliateDisclosure": "Bài viết có chứa liên kết tiếp thị liên kết. Khi bạn mua qua liên kết, chúng tôi có thể nhận hoa hồng mà không làm tăng giá của bạn."
	},
	"intent": {
		"forWho": "Phù hợp cho nữ văn phòng, cần túi gọn, đựng đủ vật dụng cơ bản và dễ phối với trang phục công sở.",
		"problem": "Khó chọn túi vừa đẹp vừa bền trong tầm giá phổ thông, đặc biệt khi mua online."
	},
	"quickAnswer": {
		"bullets": [
			"Ưu tiên chất liệu da tổng hợp chống bong tróc và đường may chắc chắn.",
			"Túi có ngăn phụ riêng cho điện thoại và ví sẽ tiện dùng hằng ngày.",
			"Nếu đi làm bằng xe máy, nên chọn form cứng vừa phải để giữ dáng.",
			"Ngân sách dưới 1.500.000đ vẫn có nhiều mẫu bền, đẹp, dùng 1-2 năm."
		]
	},
	"sections": [
		{
			"heading": "Tiêu chí xếp hạng",
			"content": "Chúng tôi chấm điểm theo 4 tiêu chí: chất liệu, độ hoàn thiện, tính tiện dụng và mức giá. Mỗi tiêu chí được quy đổi theo thang điểm 10 để đảm bảo đánh giá đồng nhất giữa các mẫu."
		},
		{
			"heading": "Gợi ý chọn nhanh theo nhu cầu",
			"content": "Nếu bạn cần túi nhẹ, ưu tiên mẫu mini tote. Nếu cần đựng iPad, chọn tote cỡ vừa có đáy rộng. Nếu cần phong cách tối giản để đi làm và gặp khách, ưu tiên tông đen hoặc be."
		}
	],
	"productRecommendations": [
		{
			"name": "Túi Tote Nữ Basic Office A1",
			"whyInList": "Form cứng vừa phải, ngăn chứa khoa học, phù hợp môi trường công sở.",
			"pros": ["Dễ phối đồ", "Đường may chắc", "Có ngăn khóa kéo riêng"],
			"cons": ["Không phù hợp nếu cần đựng laptop 14 inch"],
			"priceRange": "890.000đ - 1.090.000đ",
			"bestFor": "Nữ văn phòng cần túi đi làm hằng ngày",
			"productUrl": "https://example.com/product/a1"
		},
		{
			"name": "Túi Đeo Vai Thanh Lịch B2",
			"whyInList": "Thiết kế tối giản, hợp đi làm và đi cà phê sau giờ làm.",
			"pros": ["Nhẹ", "Khóa kéo mượt", "Màu trung tính dễ dùng"],
			"cons": ["Sức chứa vừa phải"],
			"priceRange": "690.000đ - 850.000đ",
			"bestFor": "Người ưu tiên phong cách tối giản",
			"productUrl": "https://example.com/product/b2"
		}
	],
	"faq": [
		{
			"question": "Túi đi làm nên chọn màu nào dễ phối nhất?",
			"answer": "Đen, be, nâu nhạt là ba màu dễ phối với đa số trang phục công sở và ít lỗi mốt."
		},
		{
			"question": "Ngân sách dưới 1.000.000đ có nên mua túi da tổng hợp không?",
			"answer": "Có, nếu ưu tiên sản phẩm có mô tả rõ chất liệu, ảnh thật chi tiết và đánh giá người mua ổn định."
		},
		{
			"question": "Nên thay túi đi làm sau bao lâu?",
			"answer": "Nếu dùng hằng ngày, bạn có thể thay sau 12-24 tháng tùy mức độ giữ gìn và chất lượng ban đầu."
		}
	],
	"finalCta": {
		"text": "Bạn có thể bắt đầu với 2 mẫu đầu danh sách vì cân bằng tốt giữa giá, độ bền và tính ứng dụng. Xem giá mới nhất để chọn đúng phiên bản màu bạn thích.",
		"action": "Xem sản phẩm gợi ý"
	},
	"metadata": {
		"metaTitle": "Top 7 túi xách nữ đi làm dưới 1.500.000đ đáng mua 2026",
		"metaDescription": "Danh sách túi xách nữ đi làm bền đẹp, dễ phối đồ trong tầm giá dưới 1.500.000đ, có so sánh nhanh và gợi ý theo nhu cầu.",
		"slug": "top-tui-xach-nu-di-lam-duoi-1500000",
		"internalLinkSuggestions": [
			"/phoi-do-cong-so-nu",
			"/cach-bao-quan-tui-xach-ben-lau"
		]
	}
}
```

### 18.3 Mẫu output dạng Draft Markdown
```markdown
# Top 7 túi xách nữ đi làm bền đẹp, dễ phối đồ dưới 1.500.000đ

*Danh sách được chọn theo tiêu chí độ bền, thiết kế tối giản và mức giá dễ mua trong năm 2026.*

> Bài viết có chứa liên kết tiếp thị liên kết. Khi bạn mua qua liên kết, chúng tôi có thể nhận hoa hồng mà không làm tăng giá của bạn.

## Bài viết này dành cho ai?
Bài viết phù hợp cho nữ văn phòng 22-35 tuổi, cần một chiếc túi dùng hằng ngày, gọn gàng, dễ phối đồ và có độ bền ổn định.

## Trả lời nhanh
- Ưu tiên chất liệu bền, ít bong tróc.
- Nên chọn túi có ngăn phụ để dùng tiện hơn.
- Mức giá dưới 1.500.000đ vẫn có nhiều lựa chọn tốt.

## Tiêu chí xếp hạng
Chúng tôi chấm điểm theo 4 tiêu chí: chất liệu, độ hoàn thiện, tính tiện dụng và mức giá, nhằm đảm bảo đánh giá công bằng giữa các mẫu.

## Top sản phẩm nổi bật
### 1) Túi Tote Nữ Basic Office A1
- **Vì sao có trong danh sách:** Form cứng vừa phải, ngăn chứa khoa học.
- **Ưu điểm:** Dễ phối đồ, đường may chắc, có ngăn khóa kéo.
- **Hạn chế:** Không phù hợp nếu cần đựng laptop lớn.
- **Giá tham khảo:** 890.000đ - 1.090.000đ
- **Phù hợp với:** Nữ văn phòng đi làm hằng ngày.

### 2) Túi Đeo Vai Thanh Lịch B2
- **Vì sao có trong danh sách:** Thiết kế tối giản, dùng linh hoạt đi làm và đi chơi.
- **Ưu điểm:** Nhẹ, màu trung tính dễ phối.
- **Hạn chế:** Sức chứa vừa phải.
- **Giá tham khảo:** 690.000đ - 850.000đ
- **Phù hợp với:** Người ưu tiên phong cách thanh lịch.

## Cách chọn túi theo nhu cầu
Nếu bạn cần đựng nhiều đồ, hãy ưu tiên tote cỡ vừa có đáy rộng. Nếu ưu tiên gọn nhẹ, chọn mẫu đeo vai form mềm vừa phải.

## Câu hỏi thường gặp
### Túi đi làm nên chọn màu nào dễ phối nhất?
Đen, be, nâu nhạt là những màu dễ phối đồ công sở nhất.

### Ngân sách dưới 1.000.000đ có nên mua túi da tổng hợp không?
Có, nếu sản phẩm có mô tả rõ chất liệu và đánh giá người mua tích cực.

## Kết luận
Bạn có thể bắt đầu với 2 mẫu đầu danh sách vì cân bằng tốt giữa giá, độ bền và tính ứng dụng. Hãy kiểm tra giá mới nhất trước khi chốt mua.
```

### 18.4 Checklist áp dụng cho mẫu này
1. Có đủ 8 block bat buoc.
2. Co affiliate disclosure.
3. Co it nhat 2 internal links trong metadata.
4. Product URL phai la URL hop le truoc khi cho phep approve.

## 19) Hỗ trợ đa website và đa domain nội dung

### 19.1 Kết luận
AI Content tool này hỗ trợ tốt cho nhiều website và nhiều loại content khác nhau, nếu tách cấu hình theo Site Profile thay vì hardcode theo 1 site.

Áp dụng cho:
- dochoi3s.com (đồ chơi trẻ em)
- laruki.com (thời trang, làm đẹp)
- website du lịch trong tương lai (điểm đến, lịch trình, kinh nghiệm)

### 19.2 Thiết kế theo Site Profile
Thêm thực thể SiteProfile để cấu hình khác biệt theo website:
1. siteCode
2. domain
3. niche (Fashion, KidsToy, Travel, ...)
4. brandVoice
5. defaultTone
6. contentTypesAllowed[]
7. seoRulesJson
8. policyRulesJson
9. internalLinkStrategyJson
10. isActive

Nguyên tắc:
- Mỗi content job phải gắn siteCode.
- Prompt, quality gates, output schema đọc theo SiteProfile tương ứng.

### 19.3 Content Type registry
Thêm ContentTypeRegistry để mở rộng loại bài mà không đổi core flow.

Loại bài gợi ý theo từng site:
1. dochoi3s.com:
- top-list-do-choi-theo-do-tuoi
- review-do-choi-an-toan
- huong-dan-chon-do-choi-theo-ky-nang

2. laruki.com:
- top-list-thoi-trang-theo-ngan-sach
- review-san-pham-lam-dep
- so-sanh-thuong-hieu

3. site du lịch:
- guide-diem-den
- lich-trinh-2n1d-3n2d
- top-list-khach-san-homestay
- kinh-nghiem-an-choi-theo-mua

### 19.4 Prompt Pack theo website
Không dùng 1 prompt chung cho tất cả.

Mỗi SiteProfile có Prompt Pack riêng:
1. System prompt base theo brand voice.
2. Prompt theo content type.
3. Rule từ ngữ cấm/nhạy cảm theo niche.
4. Mẫu CTA riêng theo mục tiêu chuyển đổi.

### 19.5 Quality gates theo domain
Core gates giữ nguyên, nhưng rule chi tiết thay theo niche:

1. Kids/Toy (dochoi3s):
- Nhấn mạnh độ tuổi phù hợp.
- Cảnh báo an toàn và vật liệu.
- Tránh claim giáo dục quá mức khi không có nguồn.

2. Fashion/Beauty (laruki):
- Tránh claim y khoa/điều trị.
- Ưu tiên ngữ cảnh sử dụng thực tế.
- So sánh minh bạch về mức giá và chất liệu.

3. Travel:
- Bắt buộc thời điểm cập nhật thông tin.
- Gắn lưu ý chi phí có thể thay đổi.
- Phân tách rõ trải nghiệm cá nhân và thông tin tham khảo.

### 19.6 Data adapter theo nguồn dữ liệu
Thêm lớp SiteDataAdapter theo site:
1. Product adapter (affiliate/product data).
2. Travel POI adapter (điểm đến, lịch trình, chi phí, mùa du lịch).
3. Shared normalizer để chuẩn hóa output về cùng schema generation.

### 19.7 API mở rộng đề xuất
Mở rộng request Create job:
- siteCode (bat buoc)
- contentType (bat buoc)
- locale (mac dinh vi-VN)
- sourceContext (product/campaign/poi)

Endpoint hỗ trợ khám phá cấu hình:
1. GET /api/content/site-profiles
2. GET /api/content/site-profiles/{siteCode}/content-types
3. GET /api/content/site-profiles/{siteCode}/prompt-pack

### 19.8 Lộ trình mở rộng an toàn
Khi thêm website mới (ví dụ du lịch), không sửa flow cũ, chỉ cần:
1. Thêm SiteProfile.
2. Thêm Prompt Pack.
3. Thêm rule quality gates theo niche.
4. Thêm data adapter tương ứng.
5. Thêm test dataset cho niche mới.

### 19.9 KPI theo từng website
Theo dõi KPI theo siteCode để tối ưu riêng:
1. Draft approval rate theo site.
2. Average generation time theo content type.
3. CTR outbound theo loại bài.
4. Refresh rate của bài cũ.
