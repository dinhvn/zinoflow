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

### M2 — Generation pipeline hoan chinh (Tuan 2) ✅ code xong 11/06/2026
1. ✅ Generate 3 buoc: outline -> expand TUNG section -> frame -> assemble
   (section fail chi retry section do, 3 lan, roi moi de pg-boss retry ca job).
2. ✅ Prompt templates luu DB + version: seed tieng Viet co dau cho toplist + review
   (v1 khong dau bi tat is_active, khong sua — truy nguoc duoc). Fallback ve
   default-prompts.ts neu DB thieu row.
3. ✅ Product catalog adapter: MockProductCatalog (du lieu mau theo site) khi chua co
   CMS_BASE_URL; CmsHttpProductCatalog (timeout + retry/backoff) khi co.
   ⚠️ Endpoint CMS that (GET /api/products) la GIA DINH — can xac nhan contract voi CMS cu.
4. ✅ State machine: unit test FULL matrix 7x7 transition (49 cases).
5. ✅ OpenAI adapter skeleton (compile, isConfigured=false -> fallback stub).
6. ✅ Them ngoai plan: nut "Thu lai" tren UI (POST /jobs/:id/retry), chon loai bai
   tren form tao job, draft version tang dan khi generate lai.

Gate sang M3:
- [x] Tao bai top-list voi 5+ san pham (tu mock catalog — CMS that cho contract), du 8 block.
- [x] Generate fail 1 section -> chi retry section do, job khong chet (unit test + thay live voi Gemini 503).
- [x] Unit tests state machine pass 100% (79/79 tests).

### M3 — Quality gates + Review workflow (Tuan 3) ✅ code xong 12/06/2026
1. ✅ 4 gates bang code thuan (domain/quality-gates/, khong goi AI, co unit tests):
   - Structure: 1 H1 duy nhat, >=2 section, moi section >=60 tu, title 10-100 ky tu.
   - SEO: primary keyword trong H1 + mo bai (so khop KHONG phan biet dau),
     metaTitle/metaDescription, >=2 internal links.
   - Policy: affiliate disclosure >=10 ky tu, scan 9 cum claim cam (khong phan biet dau).
   - Data: product URL hop le + chan placeholder example.com, FAQ >=3 co cau tra loi, co CTA.
   (URL validate qua CMS API: doi contract CMS that — hien chi check format + placeholder)
2. ✅ Review workflow: submit-review (DraftReady->InReview), Approve CHAY LAI gates ngay
   luc duyet (fail -> 422 kem chi tiet), Reject bat buoc ly do, RequestChange -> DraftReady.
   ReviewRecord luu du actor/note/version. Sua draft (PUT) -> version moi;
   sua bai Approved -> tu dong ve InReview.
3. ✅ UI review: editor markdown | preview HTML 2 cot, checklist 4 gates + chi tiet loi,
   nut Gui duyet / Duyet / Yeu cau sua / Tu choi, lich su review, danh sach version.
   (diff text giua version: don gian hoa thanh danh sach version — diff chi tiet de M5 neu can)
4. ✅ Export HTML sach: marked + sanitize-html (whitelist tag, chi http/https,
   link tu dong nofollow + target _blank).

Gate sang M4:
- [x] Approve bi block khi gate fail (verify: bai stub bi 422 kem ly do tung section).
- [x] Sua draft da approve -> tu dong tao version moi + quay ve InReview (verify E2E).
- [x] Review history hien day du actor + note + thoi gian (verify E2E).

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
