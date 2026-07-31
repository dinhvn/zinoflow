import "dotenv/config";
import { readFileSync } from "node:fs";
import { Client } from "pg";

/**
 * Ghi ket qua trich xuat AI (skill dichoithoi-extract-article-info) vao bang
 * staging article_ai_extractions, source='claude-skill' (article-ai-extraction-plan.md
 * GĐ2 — don gian hon ban destination: chi 1 field text tu do, khong tach
 * nhieu field co dinh, vi bai cam nang khong co field co dinh nhu dia chi/SDT).
 *
 * Usage:
 *   pnpm --filter @zinoflow/api exec ts-node -T scripts/upsert-article-ai-extraction.ts <jobId> <duong-dan-file-json>
 *
 * File JSON input dang:
 *   { "sourceUrls": string[], "summary": string }
 */

interface Input {
  sourceUrls: string[];
  summary: string;
}

async function main() {
  const [jobId, jsonPath] = process.argv.slice(2);
  if (!jobId || !jsonPath) {
    console.error(
      "Usage: ts-node scripts/upsert-article-ai-extraction.ts <jobId> <duong-dan-file-json>",
    );
    process.exit(1);
  }

  const input = JSON.parse(readFileSync(jsonPath, "utf8")) as Input;

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const jobRow = await client.query("SELECT article_type FROM content_jobs WHERE id = $1", [jobId]);
  if (jobRow.rows.length === 0) {
    console.error(`Không tìm thấy content job "${jobId}"`);
    await client.end();
    process.exit(1);
  }
  if (jobRow.rows[0].article_type !== "cam-nang") {
    console.error(`Job "${jobId}" không phải bài cẩm nang (articleType="${jobRow.rows[0].article_type}")`);
    await client.end();
    process.exit(1);
  }

  await client.query(
    `INSERT INTO article_ai_extractions (job_id, source, source_urls, extracted_summary, extracted_at)
     VALUES ($1, 'claude-skill', $2, $3, now())
     ON CONFLICT (job_id, source) DO UPDATE SET source_urls = $2, extracted_summary = $3, extracted_at = now()`,
    [jobId, JSON.stringify(input.sourceUrls), input.summary],
  );

  console.log(
    `Đã upsert trích xuất (nguồn claude-skill) cho job="${jobId}" — ${input.summary.length} ký tự.`,
  );

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
