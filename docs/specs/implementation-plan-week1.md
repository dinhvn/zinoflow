# Implementation Plan - First 7 Days (cap nhat 11/06/2026)

Pham vi tuan 1: chi AI Content Tool. Image Tool de Phase 3 (khong lam trong tuan nay).

## 1) Goal of week 1
Dung duoc khung he thong theo clean architecture, chay local:
- apps/web (Next.js)
- apps/api (NestJS + TypeORM + pg-boss, cung process)

Mo duoc luong MVP dau tien: tao content job -> generate draft (stub provider) -> xem tren web.

## 2) Preconditions
1. PostgreSQL da cai truc tiep tren may (installer Windows), tao database `zinoflow`.
2. Chap nhan stack trong [tech recommendation](../tech-recommendation-web-mvp.md).
3. Chap nhan structure trong [folder structure](folder-structure.md).
4. Co ANTHROPIC_API_KEY / OPENAI_API_KEY test (co the mock ngay 1-4).

## 3) Day-by-day execution

### Day 1 - Monorepo bootstrap
Tasks:
1. Khoi tao pnpm workspaces: apps/web, apps/api, packages/contracts.
2. Setup tooling: TypeScript base config (strict), lint + format, workspace scripts.
3. Env templates (.env.example) — DATABASE_URL tro toi Postgres local, KHONG docker.

Definition of Done:
1. `pnpm dev` chay duoc web (3000) + api (3001).
2. API co health endpoint, ket noi duoc Postgres local.
3. Lint + typecheck pass.

### Day 2 - API skeleton theo clean architecture
Tasks:
1. Module skeleton `ai-content` trong apps/api voi 4 lop: domain / application / infrastructure / presentation.
2. Error envelope middleware + traceId.
3. Logging base (request lifecycle).
4. Setup pg-boss (schema rieng trong cung database) + 1 job test.

Definition of Done:
1. Endpoint test cho module ai-content.
2. Import direction dung dependency rule.
3. pg-boss nhan va xu ly duoc job test.

### Day 3 - Contracts + DB schema v1
Tasks:
1. Zod schemas trong packages/contracts: content job, draft, article 8-block framework.
2. TypeORM entities + migration v1: content_jobs (co ai_provider, ai_model), content_drafts,
   content_review_records, prompt_templates, content_quality_results, ai_usage_logs.
3. Seed prompt templates co ban.
4. Swagger/OpenAPI skeleton.

Definition of Done:
1. Contracts share duoc giua web/api.
2. `pnpm migration:run` thanh cong tren Postgres local.
3. Swagger hien endpoints.

### Day 4 - AI Content vertical slice (stub provider)
Tasks:
1. CreateContentJob use case (job chay qua pg-boss, khong goi inline).
2. IContentAIProvider interface + AIProviderRegistry + StubProvider (mock).
3. GenerateOutline / GenerateDraft voi stub, luu draft version 1.

Definition of Done:
1. Goi API tao duoc job + draft markdown mau.
2. Unit tests cho state transition co ban pass.

### Day 5 - AI provider that (Claude truoc)
Tasks:
1. AnthropicProvider voi @anthropic-ai/sdk: messages.parse() + zodOutputFormat,
   model mac dinh claude-opus-4-8 (co option sonnet/haiku).
2. Log token usage + cost vao ai_usage_logs.
3. (Neu kip) OpenAIProvider skeleton.

Definition of Done:
1. Tao duoc 1 draft that tu Claude theo 8-block schema, validate Zod pass.
2. ai_usage_logs co record dung (tokens, cost, latency).

### Day 6 - Web UI MVP screens
Tasks:
1. Layout admin (sidebar, dark mode) bang shadcn/ui.
2. Trang AI Content: form tao job (co dropdown chon AI provider/model), danh sach job + status
   (TanStack Query polling), trang xem draft (markdown preview).
3. API client typed tu packages/contracts.

Definition of Done:
1. Luong tao job -> xem draft chay end-to-end tu web.
2. Co loading/error state ro rang, khong co `any` o layer integration.

### Day 7 - Hardening + docs
Tasks:
1. Retry/backoff cho AI provider, fallback provider khi loi.
2. Basic auth gate (token local).
3. Docs request/response examples + runbook setup.
4. Smoke flow full: tao job voi Claude -> draft -> xem tren web.

Definition of Done:
1. Smoke flow pass 100% local.
2. Docs du de setup lai tu dau trong 30 phut.

## 4) Backlog after week 1
1. Quality gates day du + review workflow (approve/reject).
2. OpenAIProvider hoan chinh, chon provider tren UI hoat dong that.
3. Publish WordPress (draft mode truoc).
4. CMS old API integration (product/campaign context).
5. SiteProfile cho laruki/dochoi3s.

## 5) Risks and mitigations
1. Scope creep -> giu vertical slice, Image Tool tuyet doi khong dung toi.
2. Phan van stack -> decision record da dong bang trong tech-recommendation-web-mvp.md.
3. Contracts doi lien tuc -> contracts package la source of truth.

## 6) Week 1 acceptance gate
1. Demo duoc tu web: tao content job (chon model) -> draft that tu Claude -> xem preview.
2. DB records + ai_usage_logs + job history day du.
3. Docs runbook + cau truc repo ro rang.
