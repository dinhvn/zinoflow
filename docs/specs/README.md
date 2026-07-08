# ZinoFlow MVP Specs (cap nhat 11/06/2026)

Thu tu build: **AI Content Tool truoc**, Image Tool (Remotion) sau.

Stack da chot: Node.js monorepo (pnpm) — NestJS + TypeORM + PostgreSQL local (khong Docker)
+ pg-boss + Next.js + Tailwind + shadcn/ui. Chi tiet: docs/tech-recommendation-web-mvp.md

Danh sach tai lieu:
0. ai-content-delivery-plan.md — KE HOACH TONG (M1-M6), bat dau tu day
1. ai-content-technical-spec.md — spec chinh, build truoc
2. Toan bo tai lieu rieng cho dichoithoi.com (kien truc, database, noi dung/SEO/UX,
   audit ky thuat) da chuyen sang thu muc `docs/dichoithoi/` — xem
   `docs/dichoithoi/dichoithoi-system-overview.md` de biet thu tu doc.
3. image-tool-technical-spec.md — Phase 3
4. roadmap-and-acceptance.md
5. folder-structure.md
6. implementation-plan-week1.md

Nguyen tac chung:
- Local-first, khong Docker (Postgres cai truc tiep).
- Clean architecture (domain/application/infrastructure/presentation).
- AI multi-provider: chon duoc Claude / ChatGPT khi tao content.
- UI/UX hien dai (shadcn/ui, dark mode).
- Co human review truoc publish.
