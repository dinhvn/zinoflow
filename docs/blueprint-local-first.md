# ZinoFlow Local-First Blueprint (v1)

> **[SUPERSEDED - 11/06/2026]** Tai lieu nay theo huong .NET + SQL Server va da LOI THOI.
> Quyet dinh moi: Node.js (NestJS + Next.js + TypeORM + PostgreSQL local, khong Docker, khong Redis).
> Xem: docs/idea.md (dinh huong chot) va docs/tech-recommendation-web-mvp.md.
> Phan van con gia tri tham khao: workflow (muc 4), quality gates (muc 6), risks (muc 10).

## 1) Product Vision
Xay dung mot ung dung ca nhan kieu "open claw" de dieu khien toan bo he thong affiliate va content:
- Viet bai va tao content bang AI (co duyet tay truoc publish).
- Cao data san pham tu nhieu nguon.
- Tao image content tu du lieu san pham.

Muc tieu van hanh truoc mat:
- Chay local la chinh de toi uu chi phi server.
- Trigger thu cong theo nut bam (on-demand).
- Kien truc san sang cho scheduler tu dong trong tuong lai.

Muc tieu ky thuat:
- Clean architecture, de maintain, de mo rong, de test.
- Co the nang cap tu local app sang cloud ma khong can viet lai he thong.

---

## 2) Tech Direction
Khuyen nghi: giu .NET la stack chinh cho backend.

Ly do:
- Da co he thong cu tren .NET + SQL Server, toi uu toc do ra ket qua.
- AI integration khong bat buoc Node.js; .NET goi model API rat tot.
- Giam rui ro migration va tranh vo no ky thuat do doi stack som.

Node.js/NestJS/NextJS chi nen bo sung khi:
- Can mot web UI moi phuc tap (khi do them NextJS cho frontend).
- Team JS manh hon va co nhu cau tach rieng frontend/backend.

Ket luan cho giai doan nay:
- Backend va orchestration: .NET 9.
- DB: SQL Server (giu nguyen).
- Queue nhe local: Hangfire (SQLite/SQLServer storage) hoac Quartz.
- UI admin: Web app trong cung solution (ASP.NET Core MVC/Razor hoac Blazor Server).

---

## 3) Architecture (Modular Monolith)
Su dung Modular Monolith thay vi microservices de don gian van hanh local.

### 3.1 Core modules
1. Content Studio
- Tao outline/draft bang AI theo template.
- Quan ly prompt template va version.
- Workflow duyet tay truoc publish.

2. Crawl Hub
- Quan ly nguon crawl, crawl rule, crawler jobs.
- Nhan data tu Chrome extension cho cac site kho crawl.
- Chuan hoa schema product.

3. Image Lab
- Tao anh social tu template (banner, card, collage).
- Input: du lieu product + style preset.
- Output: static files + metadata.

4. Publisher
- Publish bai len WordPress qua REST API.
- Sync trang thai publish, retry, idempotency.

5. Job Runner
- Chay job theo kieu on-demand (nut bam).
- Ho tro scheduler tuong lai (cron) ma khong doi business logic.

6. Observability
- Logging, job history, AI token cost, error traces.
- Audit trail cho hanh dong duyet/publish.

### 3.2 Cross-cutting layers
- Domain: entities, business rules.
- Application: use cases, commands/queries.
- Infrastructure: DB, external API, file storage, AI provider.
- Presentation: admin UI + internal API.

---

## 4) Workflow quan trong (MVP)

### 4.1 Tao bai viet co duyet tay
1. Chon campaign/topic + bo loc san pham.
2. Bam "Generate Outline".
3. Bam "Generate Draft".
4. Chay "Quality Checks" (SEO + policy + structure).
5. Human review: sua noi dung, sua CTA, sua internal links.
6. Bam "Approve".
7. Bam "Publish to WordPress".

### 4.2 Cao data on-demand
1. Chon supplier + rule.
2. Bam crawl.
3. Validate + upsert product.
4. Xem log va metric crawl.

### 4.3 Tao image content
1. Chon template anh.
2. Chon danh sach product.
3. Bam generate.
4. Duyet anh va tai xuong hoac day sang kenh khac.

---

## 5) Data model de xai ngay (goi y)

### 5.1 Content
- ArticleJob(Id, Site, Topic, Status, CreatedAt, TriggerType)
- ArticleDraft(Id, ArticleJobId, OutlineJson, DraftMarkdown, HtmlPreview, QualityScore)
- PromptTemplate(Id, Module, Name, Version, TemplateText, IsActive)
- ReviewAction(Id, ArticleDraftId, Action, UserNote, CreatedAt)
- PublishRecord(Id, ArticleDraftId, Target, ExternalPostId, Status, ResponseRaw)

### 5.2 Crawl
- CrawlSource(Id, SupplierCode, SourceType, ConfigJson, IsActive)
- CrawlJob(Id, CrawlSourceId, Status, StartedAt, FinishedAt, Error)
- Product(Id, SupplierCode, ExternalId, Name, Price, SalePrice, Url, ImageUrl, UpdatedAt)

### 5.3 Image
- ImageTemplate(Id, Name, CanvasConfigJson, IsActive)
- ImageRenderJob(Id, TemplateId, InputJson, OutputPath, Status)

---

## 6) Quality gates (de he thong chuyen nghiep)
Truoc khi cho publish, bat buoc pass cac gate:
1. Structure gate: title, headings, do dai toi thieu.
2. SEO gate: keyword coverage, meta title/description, internal links.
3. Compliance gate: affiliate disclosure, khong claim qua da.
4. Data gate: gia/san pham con hop le, khong broken link.
5. Manual gate: trang thai Approved boi ban.

Neu fail gate nao thi khong cho publish.

---

## 7) Local-first deployment

### 7.1 Runtime local
- 1 app backend chay tren may ca nhan.
- SQL Server local (hoac SQL Server Express).
- Thu muc local de luu file generated (images/html snapshots).

### 7.2 Moi truong
- local: full development + manual trigger.
- future cloud: giu nguyen module, thay config connection + scheduler + storage.

### 7.3 Secret management
- Dung user secrets/env vars cho API key AI va WordPress token.
- Khong hardcode trong source code.

---

## 8) Folder structure de maintain

```
src/
  ZinoFlow.Web/                  # Admin UI + internal API
  ZinoFlow.Application/          # Use cases
  ZinoFlow.Domain/               # Entities + business rules
  ZinoFlow.Infrastructure/       # EF Core, AI providers, WP client, crawler adapters
  ZinoFlow.Jobs/                 # Job registration and orchestration
tests/
  ZinoFlow.UnitTests/
  ZinoFlow.IntegrationTests/
docs/
  blueprint-local-first.md
```

Quy tac:
- Moi module co interface ro rang.
- Khong de business rules nam trong controller.
- Moi external service deu qua adapter interface.

---

## 9) Roadmap 6 tuan

### Phase 1 (Tuan 1-2): Foundation
- Dung skeleton solution theo clean architecture.
- Tao schema DB co ban (content/crawl/image/jobs).
- Dung job runner manual trigger + job history.

### Phase 2 (Tuan 3-4): Content Studio MVP
- Prompt templates + generate outline/draft.
- Review workflow + quality gates.
- Preview HTML va publish WordPress.

### Phase 3 (Tuan 5): Crawl Hub MVP
- Trigger crawl thu cong theo source.
- Upsert product + dashboard log loi.

### Phase 4 (Tuan 6): Image Lab MVP
- 2-3 template anh co ban.
- Generate image batch tu danh sach product.

KPI ket thuc MVP:
- Tu idea den bai published < 20 phut/bai.
- 80% draft qua duoc quality gate lan 1.
- Crawl success rate > 90% (tru nguon bi chan bat thuong).

---

## 10) Risks and controls
1. AI hallucinates
- Bat buoc gate check + human approval.

2. Crawl bi chan
- Duy tri extension manual mode + queue ingest API.

3. Tang no ky thuat
- Ap coding standard + unit test cho core rule + integration test cho publish.

4. Lock-in 1 AI vendor
- Tao abstraction IAIProvider ngay tu dau.

---

## 11) Next implementation document
Tai lieu tiep theo nen viet ngay:
1. Technical Spec cho Content Studio (API + DB + state machine).
2. Prompt catalog v1 cho 3 loai bai (review/list/comparison).
3. Definition of Done va checklist test cho tung phase.

## 12) Image Tool execution docs (added)
Tai lieu ap dung truc tiep cho image tool trong repo nay:
1. docs/thumbnail-studio-checklist.md
2. docs/copilot-image-guardrails.md
3. docs/cms-integration-contract.md
