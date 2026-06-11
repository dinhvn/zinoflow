# ZinoFlow — AI Coding Instructions

Shared instructions for ALL AI coding assistants (GitHub Copilot, Claude Code, ...).
Single source of truth — do not duplicate these rules elsewhere.

## 1. Project overview

ZinoFlow is a local-first AI Content Tool for affiliate marketing:
generate articles with AI (human review required) and publish to WordPress
(laruki.com, dochoi3s.com). Product data comes from an existing .NET CMS via API.
Build order: AI Content Tool first, Image Tool (Remotion) later.

Key docs (read before making design decisions):
- `docs/idea.md` — business context + final direction (11/06/2026)
- `docs/tech-recommendation-web-mvp.md` — tech decision record (frozen, do not re-litigate)
- `docs/specs/ai-content-technical-spec.md` — main spec (state machine, quality gates, 8-block article framework)
- `docs/specs/folder-structure.md` — monorepo layout
- `docs/clean-architecture-playbook.md` — architecture rules

## 2. Tech stack (frozen — do not propose alternatives)

- Monorepo: pnpm workspaces — `apps/web`, `apps/api`, `packages/contracts`
- Backend: NestJS (REST) + TypeORM + PostgreSQL (installed locally, NO Docker)
- Queue: pg-boss (runs on Postgres — NO Redis/BullMQ)
- Frontend: Next.js App Router + Tailwind CSS + shadcn/ui + TanStack Query
- Validation: Zod schemas in `packages/contracts` (single source of truth for BE + FE + AI output)
- AI: multi-provider behind `IContentAIProvider`; primary provider is the **Anthropic API**

## 3. Architecture rules (mandatory)

Each NestJS module has 4 layers. Dependency direction is one-way, inward only:

```
presentation -> application -> domain
infrastructure -> application (implements its interfaces)
```

- `domain/` — entities, value objects, state machine, business rules. NO framework imports,
  NO TypeORM decorators leaking business logic, NO HTTP/SDK code.
- `application/` — use cases (commands/queries), interfaces for external systems.
  No SQL, no framework-specific code.
- `infrastructure/` — TypeORM repositories, AI provider adapters, CMS/WordPress clients,
  pg-boss adapters. Implements application interfaces only.
- `presentation/` — controllers + DTOs. Mapping only, NO business rules.

Other hard rules:
- Every external service (AI, old CMS, WordPress) goes through an adapter interface.
- Every async job (including AI generation) goes through pg-boss + a job table.
  NEVER call AI inline in a request handler.
- `apps/web` never imports from `apps/api` — only REST + `packages/contracts`.
- All request/response/AI-output shapes are Zod schemas in `packages/contracts`;
  derive TS types with `z.infer`. Do not hand-write duplicate interfaces.

## 4. Code quality standards

**Readable first.** Optimize for the next reader, not for cleverness.

Naming:
- Intention-revealing names: `generateOutlineForJob()` not `genOl()`; `isQualityGatePassed` not `flag`.
- Files: kebab-case (`create-content-job.usecase.ts`). Classes: PascalCase. Functions/vars: camelCase.
- Suffix by role: `*.usecase.ts`, `*.controller.ts`, `*.repository.ts`, `*.provider.ts`, `*.dto.ts`.

Functions:
- Small, single-purpose. If a function needs a paragraph to explain, split it.
- Early returns over nested if/else. Max ~3 levels of nesting.
- No magic numbers/strings — extract to named constants or config.

Comments — comment the WHY, not the WHAT:
- Every public class, use case, and exported function gets a short JSDoc: what it does,
  when to use it, non-obvious params. Vietnamese or English both fine — be consistent per file.
- Inline comments only for: business rules ("Approve is blocked until all gates pass — spec §9"),
  workarounds, non-obvious constraints (e.g. "Opus 4.8 rejects temperature — do not add it").
- NEVER write noise comments that restate the code (`// increment i`, `// call the service`).
- Complex domain logic (state machine transitions, quality gates) must reference the spec section.

Reusability:
- Before writing a helper, check `packages/contracts` and the module's existing code — reuse first.
- Shared logic between modules goes to `packages/contracts` (schemas/types) or a shared module —
  never copy-paste between modules.
- Components in `apps/web`: build on shadcn/ui primitives; feature components live in
  `features/<feature>/`, truly generic ones in `shared/`.

Error handling:
- Use the standard error envelope (`errorCode`, `message`, `details[]`, `traceId`) — spec §12.
- Typed error classes per group: ValidationError, DomainRuleError, AiProviderError,
  UpstreamApiError. No silent catch — log with traceId or rethrow.
- External calls (AI, CMS, WordPress) always have timeout + retry/backoff at the adapter level.

TypeScript:
- `strict: true`. No `any` (use `unknown` + narrowing). No `@ts-ignore` without a justifying comment.
- Prefer `readonly`, prefer immutable updates, avoid mutating shared state.

Testing:
- Unit tests for domain rules (state transitions, quality gate evaluators) — these are mandatory.
- Integration tests for adapters (AI provider contract with mocks, repositories).
- Test names describe behavior: `it('blocks approve when SEO gate fails')`.

## 5. AI provider — Anthropic API (primary)

- Official SDK only: `@anthropic-ai/sdk`. Never call the REST API with raw fetch.
- Model IDs (exact strings, NEVER append date suffixes):
  - `claude-opus-4-8` — default for article generation
  - `claude-sonnet-4-6` — balanced option
  - `claude-haiku-4-5` — light tasks (title variants, meta description)
- Structured output: `client.messages.parse()` + `zodOutputFormat(schema)` from
  `@anthropic-ai/sdk/helpers/zod`, with schemas from `packages/contracts`.
- Opus 4.8 constraints (API returns 400 if violated):
  - Use `thinking: { type: "adaptive" }`. NEVER `budget_tokens`.
  - NEVER pass `temperature`, `top_p`, `top_k`.
  - No assistant-message prefills — use structured outputs instead.
- Long generations: use `client.messages.stream()` + `await stream.finalMessage()`.
- Errors: use typed classes (`Anthropic.RateLimitError`, `Anthropic.APIError`) —
  never string-match error messages. SDK already retries 429/5xx.
- Log every AI call to `ai_usage_logs`: provider, model, input/output tokens, costUsd, latencyMs, jobId.
- API keys from env vars only (`ANTHROPIC_API_KEY`). Never hardcode, never log keys.
- All provider code sits behind `IContentAIProvider` — application layer must not import
  the Anthropic SDK directly.

## 6. Database & migrations

- TypeORM with explicit migrations only. NEVER use `synchronize: true`.
- Generate migration from entity diff, review the SQL before committing.
- Drafts use optimistic locking (`@VersionColumn`).
- Index columns used in filters: `status`, `createdAt`, `sourceRef`.

## 7. Security & config

- Secrets via env vars only (`.env` is gitignored; keep `.env.example` updated).
- Sanitize AI-generated markdown/HTML before preview/render (XSS).
- Validate all external input with Zod at the boundary (NestJS pipe + contracts schema).

## 8. Workflow conventions

- Commit messages: imperative, scoped — `feat(ai-content): add quality gate evaluator`.
- Keep changes scoped: do not refactor unrelated code in a feature PR.
- When a decision conflicts with `docs/tech-recommendation-web-mvp.md`, the doc wins —
  raise the conflict instead of silently deviating.
