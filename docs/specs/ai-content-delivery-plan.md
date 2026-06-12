# AI Content Tool — Delivery Plan (tao 11/06/2026)

Muc tieu: hoan thanh AI Content Tool den muc DUNG THAT — tao bai bang Claude,
qua quality gates, review tay, publish len laruki.com / dochoi3s.com.

Gia dinh: solo dev, code voi AI agent, ~2-3h/ngay. Tong thoi luong du kien: **7 tuan**.

Thay doi 12/06/2026: them tinh nang dichoithoi destination content (spec rieng) va
UU TIEN no lam M4 — truoc WordPress publish (M5) va hardening (M6).

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

### M4 — Dichoithoi destination content (Tuan 4-5) — UU TIEN LEN TRUOC (12/06/2026)
Spec rieng: `docs/specs/dichoithoi-destination-spec.md`. Tao + cap nhat bai diem den
du lich bang AI, publish TRUC TIEP vao SQL Server cua dichoithoi.com (bo CMS import).

Ly do lam truoc WordPress: gia tri kinh doanh uu tien (dichoithoi can content),
va M1-M3 da du nen tang (pipeline generate + gates + review + export HTML) —
KHONG phu thuoc publisher WordPress hay SiteProfile day du (prompt pack dichoithoi
dung prompt_templates DB san co; SiteProfile tong quat lui ve M5).

Dieu kien tien quyet:
- [x] Ket noi duoc SQL Server site4now.net tu may local — XAC NHAN 12/06/2026.
- [ ] Backup toan bo DB dichoithoi.
- [ ] DAI TU schema theo `docs/specs/dichoithoi-database-redesign.md` (12/06/2026):
      tao bang moi + migration data (script ben repo dichoithoi) — publisher/mirror
      cua AI tool build theo schema MOI ngay tu dau.
- [ ] Chot 3 viec o redesign doc §9: map tinh cu→34 tinh moi, bo DestinationType
      chuan, quy tac tron khoi "lien quan".

Luu y pham vi: viec viet lai WEBSITE hien thi theo schema moi la cong viec ben repo
dichoithoi (nguoi dung tu lam, song song) — KHONG tinh vao timeline zinoflow.

Phase A — Doc va mirror (3-4 ngay) — ✅ CODE XONG 12/06/2026:
0. ✅ Seed 3 bang hanh chinh tu dvhcvn (34 tinh / 3.321 phuong xa / 10.039 mapping)
   — converter scripts/convert-dvhcvn.ts + seeder pnpm seed:dvhcvn (idempotent).
1. ✅ Adapter mssql (lazy connect, timeout 15s, retry 2 lan backoff, loi 208 ->
   bao "chua chay migration") sau port DICHOITHOI_SITE_DB.
2. ✅ Bang mirror dichoithoi_destinations + relations (Postgres) + use case sync
   (insert/update/edited-outside/conflict/orphan, unit tests) + POST /api/destinations/sync.
3. ✅ UI /dichoithoi: bang + loc tinh/cap/trang thai bai + tim khong dau + nut
   "Dong bo tu website" hien report.
4. ✅ Test ket noi + DOC tieng Viet co dau tu DB that OK (271 diem den, 26 bang).
   ⏳ Test GHI tieng Viet: lam khi chay xong migration v2 (buoc tiep theo).
+ Da sinh scripts/dichoithoi-sqlserver/01-create-new-schema.sql (schema [v2],
  khong dung bang cu) va 02-migrate-data.sql (generate tu dvhcvn, transaction,
  guard chay 1 lan, kem cau kiem tra sau migration).

SANDBOX LocalDB (12/06/2026) — dev KHONG dung production:
- pnpm clone:dichoithoi: copy 271 diem + detail + review tu production (CHI DOC)
  vao (localdb)\\MSSQLLocalDB / dichoithoi_dev.
- Da chay 01+02 tren sandbox: 271/271 diem, 0 dong thieu tinh, 0 tinh trung
  (map Binh Thuan->Lam Dong, Kien Giang->An Giang... tu dong; kien-giang
  tu demote thanh cluster). Sync mirror that: 271 dong trong 1.8s.
- .env dang tro sandbox; khi go-live doi DICHOITHOI_DB_* ve production
  va chay lai dung 2 script nay (sau khi backup).
- Bai hoc ky thuat: script SQL PHAI co UTF-8 BOM (sqlcmd doc sai tieng Viet
  neu thieu); mssql tedious khong noi duoc LocalDB -> adapter tu chon driver
  msnodesqlv8 khi host la (localdb).

Phase B — Generate + review (4-5 ngay) — ✅ CODE XONG PHAN LOI 12/06/2026:
1. ✅ Contracts destinationArticle (intro/quickFacts/faq/updateNotice/metadata,
   gioi han khop cot SQL) + ArticleTypeRegistry (spec §19.3) — them loai bai
   = them 1 profile, khong sua core flow.
2. ✅ Prompt pack guide-diem-den (3 prompt tieng Viet co dau) + seed migration;
   sourceContext tren content job (facts mirror + diem lien quan cung tinh
   + content cu khi mode update).
3. ✅ 4 gates travel + 9 unit tests (updateNotice thang/nam, gia kem luu y,
   cam claim tuyet doi, slug khong trung).
4. ⏳ Reference fetcher (URL gia ve/gio mo cua, haiku extract) — CHUA lam,
   tam dung userNotes trong request tao job.
5. ✅ Man review: panel quick-facts (vien cam, kiem tra tay) + label loai bai;
   nut Tao bai AI / Cap nhat bai / Xem bai dang soan tren /dichoithoi.
6. ⏳ Anh (o Thumbnail path + check ton tai) — don sang Phase C cung publish.
+ E2E sandbox pass voi stub provider: tao job -> DraftReady -> gates travel dung bo.
+ Con thieu de ket thuc Phase B: chay thu voi PROVIDER THAT (Gemini/Claude) 1 bai.

Phase C — Publish + auto-link (3-4 ngay) — ✅ CODE XONG 12/06/2026:
1. ✅ Engine auto-link (port tu CMS C#: longest-first, first-occurrence, escape regex,
   CHI text node — khong dung <a>/heading/code, idempotent theo href) + chuan hoa
   SlugRedirect + 9 unit tests. Builder RelatedJson (haversine nearby 30km/top10,
   quy tac tron con->curated->nearby->anh em->cung tinh, cat 8) + 6 unit tests.
2. ✅ Publish: nut "Dang len dichoithoi" tren man review (chi hien khi Approved —
   gate thu cong thu 2): render HTML sach (sanitize, khong H1/quick-facts/FAQ —
   do vao cot rieng) -> auto-link -> 1 transaction UPSERT Destination +
   DestinationContent + relations mentioned (KHONG wipe, ContentSource=1, UpdatedAt)
   -> mirror markPublished (hash tu SQL nen sync lai khong bao edited-outside)
   -> recompute RelatedJson cac diem BI ANH HUONG.
3. ✅ Man Cong cu tren /dichoithoi: "Re-link toan bo" co dry-run xem truoc ->
   xac nhan ghi (kem chuan hoa SlugRedirect, ghi mentioned ca 2 DB);
   "Tinh lai khoi lien quan" toan bo. E2E sandbox: publish nha-tho-da-sapa
   (1 link noi bo, 12 related, 0.7s); re-link 271 bai -> 14 link thieu, chay lai = 0
   (idempotent); recompute 271 -> 259 RelatedJson. Stub section nang len 60+ tu
   de test tron flow approve/publish khong ton tien.
   Khac thiet ke goc (ghi nhan chu dong):
   - Re-link chay DONG BO qua HTTP thay vi pg-boss (dry-run/confirm can phan hoi
     ngay; 271 bai <1s — chuyen pg-boss khi du lieu lon hon nhieu).
   - Quy tac "cung loai chinh" trong RelatedJson tam thay bang "cung tinh"
     (mirror chua co type map).
   - Quan he nearby KHONG luu bang DestinationRelation (tinh on-the-fly khi build
     RelatedJson); chi mentioned duoc luu (ca Postgres + SQL Server).
   ✅ PROVIDER THAT da chay (12/06/2026): bai "Nui Ham Rong Sapa" bang
   gemini-2.5-flash — 4/4 gates pass ngay lan dau, tieng Viet co dau chuan,
   gia ve kem luu y; cost ghi nhan 9.8k in / 12.6k out tokens (~$0.035 neu tinh phi).
   Sua trong qua trinh test:
   - Gemini adapter retry 429/5xx theo RetryInfo (free tier flash 5 req/phut,
     pipeline goi 6+ lan — truoc do fail thang). LUU Y: free tier con quota
     NGAY (20 req/ngay voi flash) — du ~2 bai/ngay; dung that nen mua paid tier.
   - Job Failed/Rejected khong con khoa diem den (cho tao job moi thay the).
   - updateNotice: model tu suy "06/2024" theo kien thuc nen -> them bien
     {{currentDate}} vao prompt frame (migration v2, pattern version cu giu nguyen).
     ⏳ Chua kiem chung lai bang provider that (het quota ngay) — bai sau se ro.
   Con lai cua M4 (lam tiep):
   - Thumbnail field + check ton tai; reference fetcher (URL gia ve -> haiku).
   - Tao diem den MOI hoan toan tu AI tool (hien chi publish diem da ton tai).
   - Review tay + publish 1 bai THAT (job Nui Ham Rong dang DraftReady cho duyet).

Song song (ben repo dichoithoi, khong chan pipeline AI): website render AddressOld /
ContactWebsite / nut "Mua ve online" / "Cap nhat thang X" / diem lien quan tu bang
DestinationRelation (fallback theo group khi bang trong).

Gate ket thuc M4:
- [ ] 1 diem den MOI: tao bang AI -> review -> publish -> hien thi dung tren dichoithoi.com,
      co link noi bo toi diem den khac.
- [ ] 1 diem den CU: bam "Cap nhat bai" -> draft moi -> approve -> publish de len ban cu
      (khong mat taxonomy/lat/lng).
- [ ] Re-link toan bo chay xong khong pha hong link/HTML co san (spot-check 5 bai).
- [ ] Ngung su dung nut import destination tren CMS cu (ghi vao runbook).

### M5 — Publish WordPress + SiteProfile (Tuan 6)
1. Publisher module (4 lop rieng): WordPress REST client adapter,
   publish dang **draft** tren WP truoc (chua publish that), luu PublishRecord
   (externalPostId, status, responseRaw), idempotency + retry.
2. SiteProfile (spec §19): bang site_profiles, content job bat buoc gan siteCode,
   prompt pack + gate rules doc theo site (laruki: fashion/beauty rules,
   dochoi3s: kids/toy rules, dichoithoi: travel rules — hop thuc hoa cau hinh M4).
3. UI: chon site khi tao job, settings page quan ly SiteProfile + prompt templates.
4. Bai dau tien len WP that: publish draft -> kiem tra tren wp-admin -> bam publish that.

Gate sang M6:
- [ ] 1 bai approve xong publish thanh cong len laruki (draft mode), giu nguyen format.
- [ ] Publish lai cung draft khong tao bai trung (idempotent).
- [ ] 3 SiteProfile hoat dong voi prompt pack rieng (laruki, dochoi3s, dichoithoi).

### M6 — Hardening + dung that (Tuan 7)
1. Error handling ra soat: moi external call co timeout + retry/backoff + error classification;
   khong co silent failure.
2. Dashboard: job status theo ngay, cost theo bai/theo model, approval rate.
3. Runbook: setup tu dau, xu ly loi thuong gap, backup DB local (pg_dump script)
   + backup 2 bang dichoithoi truoc dot publish lon.
4. **Dung that 1 tuan**: muc tieu 5-10 bai len 3 site (laruki, dochoi3s, dichoithoi), ghi nhan:
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
4. Prompt quality la viec tinh chinh lien tuc o M6+, dung cau toan o M2.

## Thu tu build trong tung task (cho AI agent)
1. Contracts (Zod) truoc -> 2. Domain + unit test -> 3. Use case -> 4. Adapter ->
5. Controller/DTO -> 6. UI. Tuan theo .github/copilot-instructions.md.
