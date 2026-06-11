# AI Content Tool — Delivery Plan (tao 11/06/2026)

Muc tieu: hoan thanh AI Content Tool den muc DUNG THAT — tao bai bang Claude,
qua quality gates, review tay, publish len laruki.com / dochoi3s.com.

Gia dinh: solo dev, code voi AI agent, ~2-3h/ngay. Tong thoi luong du kien: **5 tuan**.

## Pham vi

TRONG pham vi:
- Flow end-to-end: create job -> outline -> draft (Claude) -> quality gates -> review -> publish WordPress.
- Multi-provider abstraction (Anthropic implement day du; OpenAI adapter skeleton).
- SiteProfile cho laruki + dochoi3s (prompt pack, gate rules theo niche).
- Lay product/campaign context tu CMS cu qua API (read-only).
- Cost tracking (ai_usage_logs) + job history.

NGOAI pham vi (khong dung toi):
- Image Tool / Remotion.
- Crawl Hub, scheduler tu dong, auto-publish hang loat.
- Cloud deploy, multi-user auth.

## Milestones

### M1 — Foundation (Tuan 1)
Theo dung docs/specs/implementation-plan-week1.md (Day 1-7).

Ket qua: monorepo chay local, DB + migrations + pg-boss, vertical slice voi
Claude that (1 draft theo 8-block schema), UI co ban tao job -> xem draft.

Gate sang M2:
- [ ] `pnpm dev` chay web + api, smoke flow pass.
- [ ] 1 draft that tu claude-opus-4-8, validate Zod pass, co record ai_usage_logs.

### M2 — Generation pipeline hoan chinh (Tuan 2)
1. Generate 3 buoc: outline -> expand TUNG section -> assemble (retry duoc tung block).
2. Prompt templates luu DB + version (bang prompt_templates), seed prompt cho 2 loai bai
   dau tien: top-list va review don (spec §17.2).
3. PromptTemplate lay du lieu product that: CMS client adapter (read-only)
   theo docs/cms-integration-contract.md — co the bat dau bang mock + 1 endpoint that.
4. State machine day du (spec §5): Created -> GeneratingOutline -> DraftReady -> InReview
   -> Approved/Rejected, Failed co retry policy. Unit tests cho moi transition.
5. OpenAI adapter skeleton (interface compile, chua can hoan chinh).

Gate sang M3:
- [ ] Tao bai top-list voi 5+ san pham that tu CMS cu, du 8 block.
- [ ] Generate fail 1 section -> chi retry section do, job khong chet.
- [ ] Unit tests state machine pass 100%.

### M3 — Quality gates + Review workflow (Tuan 3)
1. 4 gates bang code thuan (spec §9, §17.5):
   - Structure gate: du 8 block, 1 H1, do dai intro/section theo rule §17.3.
   - SEO gate: primary keyword trong H1+intro, metaTitle/metaDescription, >=2 internal links.
   - Policy gate: co affiliate disclosure, scan tu cam theo niche.
   - Data gate: product URL hop le (validate qua CMS API), khong empty block.
2. Review workflow: SubmitForReview, Approve (chan khi gate fail), Reject (bat buoc reason),
   RequestChange; luu ReviewRecord day du; sua draft sau approve -> version moi -> ve InReview.
3. UI review: preview 2 cot (editor | HTML render), checklist gates pass/fail,
   review history, diff giua versions.
4. Export HTML sach (sanitize) tu draft markdown.

Gate sang M4:
- [ ] Approve bi block khi bat ky gate nao fail (test tu UI).
- [ ] Sua draft da approve -> tu dong tao version moi + quay ve InReview.
- [ ] Review history hien day du actor + note + thoi gian.

### M4 — Publish WordPress + SiteProfile (Tuan 4)
1. Publisher module (4 lop rieng): WordPress REST client adapter,
   publish dang **draft** tren WP truoc (chua publish that), luu PublishRecord
   (externalPostId, status, responseRaw), idempotency + retry.
2. SiteProfile (spec §19): bang site_profiles, content job bat buoc gan siteCode,
   prompt pack + gate rules doc theo site (laruki: fashion/beauty rules,
   dochoi3s: kids/toy rules).
3. UI: chon site khi tao job, settings page quan ly SiteProfile + prompt templates.
4. Bai dau tien len WP that: publish draft -> kiem tra tren wp-admin -> bam publish that.

Gate sang M5:
- [ ] 1 bai approve xong publish thanh cong len laruki (draft mode), giu nguyen format.
- [ ] Publish lai cung draft khong tao bai trung (idempotent).
- [ ] 2 SiteProfile hoat dong voi prompt pack rieng.

### M5 — Hardening + dung that (Tuan 5)
1. Error handling ra soat: moi external call co timeout + retry/backoff + error classification;
   khong co silent failure.
2. Dashboard: job status theo ngay, cost theo bai/theo model, approval rate.
3. Runbook: setup tu dau, xu ly loi thuong gap, backup DB local (pg_dump script).
4. **Dung that 1 tuan**: muc tieu 5-10 bai len 2 site, ghi nhan:
   - thoi gian idea -> published / bai
   - approval rate vong 1
   - cost / bai
5. Tinh chinh prompt theo ket qua thuc te (day la viec lap lai, khong phai 1 lan).

## KPI ket thuc (tu roadmap-and-acceptance.md, dieu chinh)
- Idea -> published < 20 phut/bai (bao gom review tay).
- Approval rate vong 1 >= 60%.
- 100% bai published qua du 4 gates + human approve.
- Cost/bai duoc ghi nhan va biet chinh xac.

## Nguyen tac thuc thi
1. Lam theo vertical slice: moi tuan ket thuc bang demo chay duoc tu UI, khong de
   "xong backend roi moi lam UI".
2. Khong sang scope ngoai (Image Tool, crawl, scheduler) du tien tay.
3. Moi milestone fail gate -> sua truoc khi sang milestone sau, khong no don.
4. Prompt quality la viec tinh chinh lien tuc o M5+, dung cau toan o M2.

## Thu tu build trong tung task (cho AI agent)
1. Contracts (Zod) truoc -> 2. Domain + unit test -> 3. Use case -> 4. Adapter ->
5. Controller/DTO -> 6. UI. Tuan theo .github/copilot-instructions.md.
