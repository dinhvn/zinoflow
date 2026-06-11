# ZinoFlow

AI Content Tool local-first cho website affiliate (laruki.com, dochoi3s.com):
tao bai viet bang AI (Claude / Gemini / ChatGPT) theo 8-block framework,
human review truoc khi publish len WordPress.

## Quickstart

```powershell
pnpm install
copy apps\api\.env.example apps\api\.env   # dien DATABASE_URL + API key AI
pnpm --filter @zinoflow/contracts build
pnpm migration:run
pnpm dev    # web: http://localhost:3000 | api: http://localhost:3001 (Swagger: /docs)
```

Chi tiet setup + xu ly loi: **[docs/runbook.md](docs/runbook.md)**

## Cau truc

```
apps/web         Next.js admin UI (App Router + Tailwind)
apps/api         NestJS + TypeORM + pg-boss (clean architecture 4 lop/module)
packages/contracts   Zod schemas dung chung (BE + FE + AI structured output)
```

## Tai lieu

- Ke hoach tong: [docs/specs/ai-content-delivery-plan.md](docs/specs/ai-content-delivery-plan.md)
- Spec ky thuat: [docs/specs/ai-content-technical-spec.md](docs/specs/ai-content-technical-spec.md)
- Quyet dinh cong nghe: [docs/tech-recommendation-web-mvp.md](docs/tech-recommendation-web-mvp.md)
- Rule cho AI coding agents: [.github/copilot-instructions.md](.github/copilot-instructions.md)
