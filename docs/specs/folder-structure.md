# Folder Structure (cap nhat 11/06/2026)

## 1) Principles
- Monorepo pnpm workspaces, 2 apps + 1 package o Phase 1.
- Clean architecture trong tung NestJS module: domain khong phu thuoc framework.
- Contracts (Zod) la nguon su that cho request/response va AI output schema.
- Khong Docker: Postgres cai local, output files luu folder local.

## 2) Monorepo layout (Phase 1)

```
root/
  apps/
    web/                          # Next.js App Router
      src/
        app/                      # routes: / (dashboard), /content, /content/[id],
                                  #   /prompts, /usage (chi phi AI), /settings,
                                  #   /dichoithoi (+ /dia-chi, /[slug]),
                                  #   /laruki, /dochoi3s (+ /new, /[cmsId])
        features/                 # components theo feature: dashboard/, usage/,
                                  #   cms-content/, ... (page chi compose, khong inline UI)
        shared/
          ui/                     # primitives thuan Tailwind (Button, Select, Input,
                                  #   Badge, DataTable, Pagination, ErrorBox) — KHONG shadcn
          api-client.ts, ...      # fetch wrapper, utils
      .env.local

    api/                          # NestJS
      src/
        modules/
          ai-content/             # loi: job/draft/state machine, quality gates,
            domain/               #   AI providers, prompt templates, ai_usage_logs
            application/          # use cases (CreateContentJob, GenerateContent,
                                  #   GetAiUsageSummary, ...)
            infrastructure/       # TypeORM repos, AI provider adapters (anthropic/
              ai-providers/       #   gemini/openai/stub), provider.registry
            presentation/         # controllers, DTOs
          destination/            # dichoithoi.com — ghi thang SQL Server (4 lop)
          cms-content/            # laruki/dochoi3s — ghi CMS khuyenmai (4 lop)
          dashboard/              # chi doc, gom tu 3 module tren cho trang chu
          shared/
            jobs/                 # pg-boss setup + handlers
            observability/        # logging, traceId
            auth/, errors/, text/, validation/
        migrations/               # TypeORM migrations
        main.ts
      .env

  packages/
    contracts/
      src/
        ai-content/               # Zod: job, draft, article (8-block), quality,
                                  #   prompt-template, usage (chi phi)
        dichoithoi/               # destination (diem den)
        khuyenmai/                # cms-site, cms-post, cms-article (laruki/dochoi3s)
        dashboard/                # summary trang chu
        common/                   # error envelope, pagination

  outputs/                        # generated files (html snapshots, images sau nay)
  docs/
```

## 3) Phase 2+ (Image Tool) — chi them, khong sua

```
  apps/remotion-worker/           # consume job image.render tu pg-boss
  packages/remotion-compositions/
```

## 4) Rules
- Business rules chi nam trong domain/application, khong nam trong controller hay UI.
- Moi external service (AI, CMS cu, WordPress) di qua adapter interface.
- apps/web KHONG import truc tiep tu apps/api — chi qua REST + packages/contracts.
- Moi job async dang ky qua pg-boss, co bang job history.
