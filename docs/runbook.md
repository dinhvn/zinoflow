# ZinoFlow Runbook

Muc tieu: setup tu dau va chay duoc trong 30 phut. Cap nhat 12/06/2026 (M3); chuyen sang macOS 27/09/2026.

## 1) Yeu cau may

- macOS (tu 27/09/2026; truoc do Windows 11), Node >= 20, pnpm >= 8
- PostgreSQL cai truc tiep (KHONG can Docker): Homebrew `postgresql@18`, port 5432 — da test voi PG 17/18
- API key cua it nhat 1 AI provider (Gemini hoac Anthropic)

## 2) Setup tu dau

```bash
# 1. Clone (repo nay la submodule cua mmo-workspace) + cai dependencies
git clone --recursive https://github.com/dinhvn/mmo-workspace.git && cd mmo-workspace/repos/zinoflow
pnpm install

# 2. Tao database
brew services start postgresql@18
createdb -U postgres zinoflow

# 3. Cau hinh env
cp apps/api/.env.example apps/api/.env
#    Sua DATABASE_URL (port Postgres mac dinh 5432)
#    Dien GEMINI_API_KEY va/hoac ANTHROPIC_API_KEY

# 4. Build contracts + chay migrations
pnpm --filter @zinoflow/contracts build
pnpm migration:run

# 5. Chay dev (web :3000 + api :3001)
pnpm dev
```

Kiem tra: mo http://localhost:3000 — Dashboard phai hien `database: connected`.

## 3) Bien env quan trong (apps/api/.env)

| Bien | Bat buoc | Ghi chu |
|---|---|---|
| DATABASE_URL | ✅ | API fail-fast neu thieu. Chu y port Postgres |
| GEMINI_API_KEY | 1 trong 2 | aistudio.google.com -> Get API key |
| ANTHROPIC_API_KEY | 1 trong 2 | console.anthropic.com |
| API_TOKEN | ❌ | De trong = auth TAT (dev local). Dien gia tri = moi request can header `x-api-token` (tru /health). Web can NEXT_PUBLIC_API_TOKEN giong het trong apps/web/.env.local |
| PORT / WEB_ORIGIN | ❌ | Mac dinh 3001 / http://localhost:3000 |

**Quan trong:** doi .env xong PHAI restart api (`pnpm dev` lai) — watch mode khong tu doc lai env.

## 4) Lenh thuong dung

```bash
pnpm dev                  # chay web + api
pnpm -r typecheck         # typecheck 3 packages
pnpm --filter @zinoflow/api test          # unit tests
pnpm migration:run        # chay migrations moi
pnpm migration:generate src/migrations/TenMigration   # sinh migration tu entity diff (review SQL truoc khi chay!)
node scripts/smoke.mjs                    # smoke flow (stub - mien phi)
node scripts/smoke.mjs gemini gemini-3.1-flash-lite   # smoke voi AI that (~$0.003)
```

## 5) Loi thuong gap

### Port 3001/3000 bi chiem ("EADDRINUSE")
Dung dev server bang Ctrl+C doi khi de lai process node mo coi giu port:
```bash
kill $(lsof -ti tcp:3001)      # tuong tu cho 3000; them -9 neu khong dung
```

### API bao "DATABASE_URL is required"
Chua co apps/api/.env hoac thieu dong DATABASE_URL — xem muc 2 buoc 3.

### Health bao database: disconnected
- Sai password/port trong DATABASE_URL (kiem tra service: `brew services list | grep postgres`, `pg_isready`)
- Chua tao database `zinoflow`

### Job mai o trang thai Failed
- Xem log api: loi AiProviderError thuong do API key sai/het quota.
- Tung section fail duoc retry rieng 3 lan; sau do pg-boss retry ca job 3 lan (backoff tu 30s).
- Van Failed: sua nguyen nhan roi bam nut **Thu lai** tren trang /content
  (hoac POST /api/content/jobs/{id}/retry).

### Gemini free tier hay fail 429 (RESOURCE_EXHAUSTED)
Free tier gioi han ~10 request/phut/model. Pipeline M2 goi 1 job = outline + tung section
+ frame (~5-8 request), nen 2 job lien tiep hoac retry don dap se cham limit.
Cho ~1 phut roi bam Thu lai, hoac nang len paid tier / dung model khac.

### Doi prompt khong thay tac dung
Prompt doc tu bang prompt_templates (version active moi nhat). Doi prompt = INSERT version
moi + UPDATE is_active (false cho version cu) — KHONG sua content version cu.
Neu bang khong co row cho key do, he thong fallback ve prompt mac dinh trong code
(apps/api/src/modules/ai-content/application/services/default-prompts.ts).

### Doi API key ma khong co tac dung
Restart api — env chi doc luc khoi dong.

### Tieng Viet bi mojibake (â€"...) khi sua file bang script
Chi gap tren Windows PowerShell 5.1 (doc UTF-8 khong BOM sai). Tren macOS dung
sed/perl/python binh thuong; neu phai dung PowerShell, dung
[System.IO.File]::ReadAllText/WriteAllText voi UTF8Encoding($false).

### Approve bi 422 "con quality gate chua dat"
Day la hanh vi dung: bai chi duyet duoc khi ca 4 gate pass. Chi tiet loi hien
trong response/UI (vd section qua ngan, URL placeholder, thieu disclosure).
Sua noi dung trong editor -> Luu -> Chay kiem tra lai -> Duyet.
Luu y: bai tu stub provider luon fail structure gate (section qua ngan) — by design,
chi bai AI that moi du dieu kien duyet.

## 6) Backup database local

```bash
# Backup (chay dinh ky truoc khi nang cap schema)
pg_dump -U postgres -d zinoflow -F c -f "zinoflow-$(date +%Y%m%d).backup"

# Restore
pg_restore -U postgres -d zinoflow --clean "zinoflow-YYYYMMDD.backup"
```

## 7) Smoke flow thu cong (khi nghi ngo he thong)

1. `GET http://localhost:3001/api/health` -> `database: connected`
2. Vao /content tao bai voi Gemini Flash Lite
3. Status chuyen Created -> GeneratingOutline -> DraftReady trong ~30-60s
4. Click vao bai -> draft markdown tieng Viet co dau, du cac block
5. Kiem tra cost: bang `ai_usage_logs` co 2 record (outline + article)

Hoac chay tu dong: `node scripts/smoke.mjs gemini gemini-3.1-flash-lite`

## 8) DB website dichoithoi (PostgreSQL) + test tich hop

Tu 27/09/2026 website dichoithoi dung PostgreSQL (plan: `mmo-workspace/docs/dichoithoi/dichoithoi-postgres-migration-plan.md`).
Schema do repo dichoithoi so huu (EF Core Migrations) — repo nay chi doc/ghi du lieu.

```bash
# Tao DB dev (1 lan) — chay trong repo dichoithoi
createdb -U postgres dichoithoi_dev
dotnet ef database update --context DiChoiThoiDbContext --project DiChoiThoi.Common --startup-project DiChoiThoi.Common

# apps/api/.env
DICHOITHOI_DATABASE_URL=postgresql://postgres@localhost:5432/dichoithoi_dev
pnpm --filter @zinoflow/api check:dichoithoi      # kiem tra ket noi + schema + tieng Viet
```

Test tich hop 5 adapter site DB (`*.integration.spec.ts`) can DB RIENG (ten phai co "test" — test TRUNCATE du lieu):

```bash
createdb -U postgres dichoithoi_test
ConnectionStrings__DiChoiThoiDb="Host=localhost;Database=dichoithoi_test;Username=postgres" \
  dotnet ef database update --context DiChoiThoiDbContext --project DiChoiThoi.Common --startup-project DiChoiThoi.Common
# apps/api/.env: DICHOITHOI_TEST_DATABASE_URL=postgresql://postgres@localhost:5432/dichoithoi_test
pnpm --filter @zinoflow/api test                   # khong dat bien -> 23 test tich hop tu skip
```

Sau khi repo dichoithoi them migration moi: chay lai `dotnet ef database update` cho CA 2 DB.
