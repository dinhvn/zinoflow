# ZinoFlow MVP Specs (cap nhat 11/06/2026)

Thu tu build: **AI Content Tool truoc**, Image Tool (Remotion) sau.

Stack da chot: Node.js monorepo (pnpm) — NestJS + TypeORM + PostgreSQL local (khong Docker)
+ pg-boss + Next.js + Tailwind + shadcn/ui. Chi tiet: docs/tech-recommendation-web-mvp.md

Danh sach tai lieu:
0. ai-content-delivery-plan.md — KE HOACH TONG (5 tuan, M1-M5), bat dau tu day
1. ai-content-technical-spec.md — spec chinh, build truoc
2. image-tool-technical-spec.md — Phase 3
3. roadmap-and-acceptance.md
4. folder-structure.md
5. implementation-plan-week1.md

Nguyen tac chung:
- Local-first, khong Docker (Postgres cai truc tiep).
- Clean architecture (domain/application/infrastructure/presentation).
- AI multi-provider: chon duoc Claude / ChatGPT khi tao content.
- UI/UX hien dai (shadcn/ui, dark mode).
- Co human review truoc publish.
