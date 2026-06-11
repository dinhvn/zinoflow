# Roadmap and Acceptance Criteria (Web MVP)

## 1) Delivery strategy
Muc tieu la ship nhanh nhung khong vo kien truc.

Nguyen tac:
- Lam dung thu tu business value.
- Moi phase co acceptance criteria do duoc.
- Khong mo rong pham vi khi phase chua pass.

## 2) Phases

### Phase 0 - Foundation (Week 1)
Deliverables:
- Monorepo skeleton pnpm (apps/web, apps/api, packages/contracts).
- Basic auth (token don gian) + env config + logging.
- PostgreSQL cai local (khong Docker) + TypeORM migrations + pg-boss schema.

Acceptance:
1. Project run local bang 1 lenh (`pnpm dev`).
2. API health check pass; pg-boss nhan va chay duoc 1 job test.
3. Logging co traceId xuyen suot request.

### Phase 1 - AI Content MVP (Week 2-3)
Deliverables:
- Create job, generate outline, generate draft (chon duoc AI provider/model: Claude, ChatGPT).
- Quality checks + review workflow.
- Draft versioning + history.
- AI usage/cost log theo tung call.

Acceptance:
1. Tao duoc draft tu sourceRef that bai.
2. Approve bi chan khi quality gate fail.
3. Co review history va actor trace.
4. 80% test case happy path pass.

### Phase 2 - Image Tool MVP (Week 3-4)
Deliverables:
- Render preview.
- Render batch job va output manifest.
- Remotion worker + parity rules.

Acceptance:
1. Batch 20 items render thanh cong >= 95%.
2. Preview/export parity dat bo 5 dataset mau.
3. Output folders va naming dung convention.
4. Loi render co details de debug.

### Phase 3 - Integration hardening (Week 5)
Deliverables:
- CMS old API integration hardening.
- Retry/backoff, timeout, error classification.
- Basic dashboard cho job status.

Acceptance:
1. Upstream CMS loi tam thoi duoc retry dung policy.
2. Co bao cao job status theo ngay.
3. Khong co crash im lang (silent failure).

## 3) Quality gates for release
Bat buoc pass truoc khi vao su dung that:
1. Security gate:
- no hardcoded secrets
- file path traversal protected

2. Reliability gate:
- co retry cho upstream va worker failures
- co dead-letter strategy (or failed queue table)

3. Observability gate:
- metrics cho generation/render
- traceId trong moi error response

4. Maintainability gate:
- architecture rules khong bi vi pham
- docs va API examples du cap nhat

## 4) KPI de danh gia MVP
1. AI Content:
- Avg time idea -> draft <= 5 minutes
- Approval rate >= 60% vong 1

2. Image Tool:
- Avg render time/item <= 8 seconds (still image)
- Success rate >= 95%

3. Operations:
- Failed jobs duoc phan loai ro nguyen nhan >= 95%

## 5) Go/no-go checklist
Go live local usage khi:
1. 3 phase dau pass acceptance.
2. Khong co bug blocker P0/P1 mo.
3. Co runbook xu ly loi co ban.
4. Backup DB local va output folder duoc xac minh.

## 6) Risk management
1. Scope creep:
- Khong them social auto-post trong MVP.

2. Provider instability:
- Co AI provider fallback.

3. Data quality from old CMS:
- Co normalization + fallback image/title.

4. Performance drift:
- Theo doi latency va queue backlog ngay tu phase 1.
