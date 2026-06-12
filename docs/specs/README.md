# ZinoFlow MVP Specs (cap nhat 11/06/2026)

Thu tu build: **AI Content Tool truoc**, Image Tool (Remotion) sau.

Stack da chot: Node.js monorepo (pnpm) — NestJS + TypeORM + PostgreSQL local (khong Docker)
+ pg-boss + Next.js + Tailwind + shadcn/ui. Chi tiet: docs/tech-recommendation-web-mvp.md

Danh sach tai lieu:
0. ai-content-delivery-plan.md — KE HOACH TONG (M1-M6), bat dau tu day
1. ai-content-technical-spec.md — spec chinh, build truoc
2. dichoithoi-system-overview.md — TAI LIEU VAO CUA cho dichoithoi: kien truc
   AI tool ↔ CMS cu ↔ website, lo trinh 3 giai doan
3. dichoithoi-destination-spec.md — bai diem den du lich trong AI tool (M4)
4. dichoithoi-database-redesign.md — dai tu database dichoithoi (schema moi, uu tien toc do)
5. image-tool-technical-spec.md — Phase 3
6. roadmap-and-acceptance.md
7. folder-structure.md
8. implementation-plan-week1.md

Nguyen tac chung:
- Local-first, khong Docker (Postgres cai truc tiep).
- Clean architecture (domain/application/infrastructure/presentation).
- AI multi-provider: chon duoc Claude / ChatGPT khi tao content.
- UI/UX hien dai (shadcn/ui, dark mode).
- Co human review truoc publish.
