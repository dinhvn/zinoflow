# Rollout prompt bài điểm đến

## Phạm vi

Rollout theo batch nhỏ, review người 100%, không publish tự động. Corpus nguồn nằm tại
`apps/api/seed-data/destination-prompt-quality-corpus.json`.

## Baseline

Chạy `pnpm --filter @zinoflow/api prompt:baseline` trước và sau activation. Lưu output vào hồ sơ
vận hành ngoài source control nếu có dữ liệu nội bộ. Không đưa DB URL hoặc API key vào báo cáo.

Trạng thái 29/07/2026: candidate Standard outline/content là v4/v3, Flagship outline/content là
v2/v3 và đều inactive. Active vẫn là v3/v2/v1/v2. Không activate cho tới khi corpus provider thật
đã được blind review theo rubric dưới đây.

## Rubric bắt buộc

Chấm 1-5 cho usefulness, grounding, redundancy, scanability, voice và edit effort. Ghi thêm factual
corrections, warning false positives, token cost và latency theo prompt version/model/source hash.

## Quy tắc quyết định

- Keep khi không tăng factual corrections, không tăng edit effort và redundancy giảm trên corpus.
- Rollback ngay khi có unsupported hard fact hoặc active version không khớp baseline đã duyệt.
- Mỗi version tiếp theo chỉ thay một nhóm giả thuyết; luôn tạo candidate inactive và xem diff.
- Chỉ cân nhắc behavior metrics sau khi có event definition, privacy review, sample size và thời gian đo.
