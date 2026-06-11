# Tech Decision Record — ZinoFlow Web MVP (cap nhat 11/06/2026)

## 1) Context

Build theo thu tu: **AI Content Tool truoc**, sau do mo rong Image Tool va cac tinh nang nang cao.

Rang buoc:
- Local-first, may ca nhan cau hinh trung binh (KHONG dung Docker).
- CMS cu (.NET, Azure) giu nguyen, tich hop qua API (docs/cms-integration-contract.md).
- Clean architecture, de mo rong, de maintain.
- Solo dev, code voi AI agent (Copilot/Claude Code).

## 2) Quyet dinh da chot

| Hang muc | Quyet dinh | Ly do |
|---|---|---|
| Ngon ngu | TypeScript (Node.js) | Da co kinh nghiem Node; Remotion (Image Tool tuong lai) la Node ecosystem |
| Monorepo | pnpm workspaces | Chuan bi san cho remotion-worker, share contracts |
| Backend | NestJS (REST) | Module/DI khop clean architecture; tich hop TypeORM first-class; Swagger tu dong |
| ORM | TypeORM | Da thao; bat `strict: true`, KHONG dung `synchronize: true`, migration co review |
| Frontend | Next.js (App Router) | UI thuan, khong chua business logic |
| UI kit | Tailwind CSS + shadcn/ui + TanStack Query | UI/UX hien dai, admin tool components co san |
| Database | PostgreSQL **cai truc tiep local** (installer Windows) | Khong Docker vi may yeu; connection string qua .env |
| Queue | pg-boss (chay tren Postgres) | Khong can Redis o quy mo nay; van co retry/backoff/job history |
| Validation | Zod trong `packages/contracts` | Nguon su that duy nhat cho ca BE/FE, validate ca output AI |
| AI | Multi-provider (Claude, ChatGPT, ...) chon duoc per-request | Xem muc 4 |
| Auth | Token don gian (local) | Chua can NextAuth o phase 1 |

## 3) Kien truc tong quan (Phase 1)

```
apps/
  web/        Next.js — UI admin (tao job, review draft, publish)
  api/        NestJS — REST API + TypeORM + pg-boss worker (cung process)
packages/
  contracts/  Zod schemas + TS types dung chung
```

Phase 2 (Image Tool) chi can them: `apps/remotion-worker` + `packages/remotion-compositions`.
Worker consume job tu pg-boss da co san — khong dung vao code content.

Nguyen tac quan trong:
- Moi job (ke ca content generation) di qua bang job + pg-boss, KHONG goi AI inline trong request handler.
- Clean architecture trong tung NestJS module: domain / application / infrastructure / presentation.
- Tuan theo docs/clean-architecture-playbook.md.

## 4) AI Provider — multi-provider, chon khi tao content

### 4.1 Thiet ke
- Interface `IContentAIProvider` o application layer; moi provider la 1 adapter o infrastructure layer.
- `AIProviderRegistry` resolve provider theo key. Them provider moi = them 1 adapter, khong sua core flow.
- Request tao content job nhan `aiProvider` + `aiModel` (optional, co default theo SiteProfile).
- UI: dropdown chon provider/model ngay tren man hinh tao content.

```ts
interface IContentAIProvider {
  readonly key: string; // 'anthropic' | 'openai' | ...
  listModels(): ModelInfo[];
  generateOutline(input: OutlineInput): Promise<OutlineResult>;
  generateSection(input: SectionInput): Promise<SectionResult>;
  suggestTitles(input: TitleInput): Promise<string[]>;
}
```

### 4.2 Provider: Anthropic (Claude)
- SDK chinh thuc: `@anthropic-ai/sdk`.
- Model IDs (chinh xac, khong them suffix ngay thang):
  - `claude-opus-4-8` — manh nhat, default cho bai dai/kho ($5/$25 per 1M tokens)
  - `claude-sonnet-4-6` — can bang toc do/chi phi ($3/$15)
  - `claude-haiku-4-5` — re/nhanh cho task don gian (title variants, meta) ($1/$5)
- Structured output: dung `client.messages.parse()` voi `zodOutputFormat(schema)` tu
  `@anthropic-ai/sdk/helpers/zod` — output AI validate truc tiep bang Zod schema trong contracts.
- Voi Opus 4.8: dung `thinking: {type: "adaptive"}`; KHONG truyen `temperature/top_p/top_k`
  (se bi 400). Bai dai dung streaming (`messages.stream()` + `finalMessage()`).

### 4.3 Provider: OpenAI (ChatGPT)
- SDK chinh thuc: `openai`.
- Structured output qua response_format JSON schema (tuong duong).
- Model cu the chon khi implement (tra cuu docs OpenAI tai thoi diem do).

### 4.4 Quy tac chung
- API key qua env vars (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`), khong hardcode.
- Log token usage + cost + latency cho MOI request AI (bang `ai_usage_logs`).
- Output AI luon validate bang Zod truoc khi luu — fail thi retry block do, khong retry ca bai.
- Generate theo 3 buoc: outline -> expand tung section -> assemble. Retry duoc tung block.

## 5) UI/UX hien dai — nguyen tac

- shadcn/ui lam nen: data table (danh sach job/draft), dialog, form, toast, skeleton loading.
- Layout admin: sidebar navigation, dark mode support.
- Man hinh review draft: preview 2 cot (markdown editor | HTML preview), quality gate
  hien thi dang checklist pass/fail, diff giua cac version.
- Trang thai job real-time: TanStack Query polling (3-5s) khi job dang chay.
- Tranh "AI slop" UI: chon palette/typography co chu dich, khong dung mau tim gradient mac dinh.

## 6) Local setup (khong Docker)

1. Cai PostgreSQL bang installer Windows (postgresql.org), tao database `zinoflow`.
2. `pnpm install` o root monorepo.
3. `.env` cho api (DATABASE_URL, ANTHROPIC_API_KEY, OPENAI_API_KEY, WP_*),
   `.env.local` cho web. Tuyet doi khong commit secrets.
4. `pnpm migration:run` (TypeORM migrations).
5. `pnpm dev` — chay dong thoi web (3000) + api (3001).

## 7) Roadmap

1. Phase 1: AI Content Tool (generate -> quality gates -> review -> publish WordPress).
2. Phase 2: dung that 2-3 tuan, do approval rate va thoi gian/bai.
3. Phase 3: Image Tool (Remotion worker).
4. Phase 4: scheduler tu dong, analytics, cloud deploy khi can.

## 8) Decision record

- **11/06/2026**: Chot Node-first; NestJS + Next.js tach rieng; TypeORM (thay Prisma);
  pg-boss (bo Redis/BullMQ); Postgres local khong Docker; AI multi-provider chon per-request.
- Revisit: them Redis/BullMQ neu throughput render > vai nghin job/ngay;
  them NextAuth neu deploy cloud multi-user.

## 9) Architecture standards

Tat ca implementation tuan theo: docs/clean-architecture-playbook.md

## 10) Detailed technical specs

- docs/specs/README.md
- docs/specs/ai-content-technical-spec.md
- docs/specs/image-tool-technical-spec.md (Phase 3)
- docs/specs/roadmap-and-acceptance.md
- docs/specs/folder-structure.md
