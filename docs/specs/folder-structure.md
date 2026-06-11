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
        app/                      # routes: /content, /content/[id]/review, /settings
        features/
          ai-content/             # components + hooks theo feature
        shared/                   # ui primitives (shadcn), api client, utils
      .env.local

    api/                          # NestJS
      src/
        modules/
          ai-content/
            domain/               # entities, value objects, state machine, gate rules
            application/          # use cases (CreateContentJob, GenerateDraft, ...)
            infrastructure/       # TypeORM repos, AI provider adapters, CMS client
              ai-providers/
                anthropic.provider.ts
                openai.provider.ts
                provider.registry.ts
            presentation/         # controllers, DTOs
          publisher/              # WordPress publish (cung cau truc 4 lop)
          shared/
            jobs/                 # pg-boss setup + handlers
            observability/        # logging, traceId, ai usage/cost log
            auth/
        migrations/               # TypeORM migrations
        main.ts
      .env

  packages/
    contracts/
      src/
        ai-content/               # Zod: job, draft, article blocks (8-block framework)
        publisher/
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
