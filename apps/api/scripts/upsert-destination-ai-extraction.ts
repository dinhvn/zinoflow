import "dotenv/config";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { dedupeExtractionFields } from "../src/modules/destination/application/services/dedupe-extraction-fields";

/**
 * Ghi ket qua trich xuat AI (skill dichoithoi-extract-destination-info) vao bang
 * staging dichoithoi_destination_ai_extractions, source="skill" (dichoithoi-
 * destination-ai-extraction-plan §2.4, §6 A1 — PK composite destination_slug+source
 * tu 25/07/2026, song song voi dong source="gsg" cua nhanh Google Search Grounding).
 *
 * Logic dedupe "giu accepted neu gia tri khong doi" dung CHUNG voi use case backend
 * GSG qua `dedupeExtractionFields` (§6 A4) — khong viet lai 2 lan.
 *
 * Usage:
 *   pnpm --filter @zinoflow/api exec ts-node -T scripts/upsert-destination-ai-extraction.ts <slug> <duong-dan-file-json>
 *
 * File JSON input dang:
 *   {
 *     "sourceUrls": string[],
 *     "fields": Array<{ key, newValue, currentValue, found, note }>
 *   }
 * (khong can dien "status" — script tu tinh)
 */

interface InputField {
  key: string;
  newValue: unknown;
  currentValue: unknown;
  found: boolean;
  note: string | null;
}

interface Input {
  sourceUrls: string[];
  fields: InputField[];
}

interface StoredField extends InputField {
  status: "pending" | "accepted" | "rejected";
}

async function main() {
  const [slug, jsonPath] = process.argv.slice(2);
  if (!slug || !jsonPath) {
    console.error(
      "Usage: ts-node scripts/upsert-destination-ai-extraction.ts <slug> <duong-dan-file-json>",
    );
    process.exit(1);
  }

  const input = JSON.parse(readFileSync(jsonPath, "utf8")) as Input;

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const existingRow = await client.query<{ fields: StoredField[] }>(
    "SELECT fields FROM dichoithoi_destination_ai_extractions WHERE destination_slug = $1 AND source = 'skill'",
    [slug],
  );
  const prevFields = existingRow.rows[0]?.fields ?? [];

  const fields = dedupeExtractionFields(prevFields, input.fields);

  await client.query(
    `INSERT INTO dichoithoi_destination_ai_extractions (destination_slug, source, source_urls, extracted_at, fields)
     VALUES ($1, 'skill', $2, now(), $3)
     ON CONFLICT (destination_slug, source) DO UPDATE SET source_urls = $2, extracted_at = now(), fields = $3`,
    [slug, JSON.stringify(input.sourceUrls), JSON.stringify(fields)],
  );

  const accepted = fields.filter((f) => f.status === "accepted").length;
  const found = fields.filter((f) => f.found).length;
  console.log(
    `Đã upsert ${fields.length} field (nguồn skill) cho slug="${slug}" — tìm được ${found}, giữ nguyên "accepted" ${accepted} (đã duyệt trước, giá trị không đổi).`,
  );

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
