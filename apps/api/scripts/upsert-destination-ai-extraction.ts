import "dotenv/config";
import { readFileSync } from "node:fs";
import { Client } from "pg";

/**
 * Ghi ket qua trich xuat AI (skill dichoithoi-extract-destination-info) vao bang
 * staging dichoithoi_destination_ai_extractions — thay the cho viec Claude tu viet
 * lai script pg moi lan chay skill (dichoithoi-destination-ai-extraction-plan §2.4).
 *
 * Tu dong ke thua status="accepted" tu lan truoc neu field cung key (cung label voi
 * externalReviewUrl) co newValue GIONG HET lan truoc VA da duoc accepted — dung §3
 * quy tac skill: khong de xuat lai cai da duyet, chi dat lai "pending" khi gia tri
 * MOI thuc su khac.
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

function labelOf(v: unknown): string | null {
  if (v && typeof v === "object" && "label" in v) {
    const label = (v as { label?: unknown }).label;
    return typeof label === "string" ? label.trim().toLowerCase() : null;
  }
  return null;
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
    "SELECT fields FROM dichoithoi_destination_ai_extractions WHERE destination_slug = $1",
    [slug],
  );
  const prevFields = existingRow.rows[0]?.fields ?? [];
  const usedPrevIndexes = new Set<number>();

  const fields: StoredField[] = input.fields.map((f) => {
    let prevIndex = -1;
    if (f.key === "externalReviewUrl") {
      const label = labelOf(f.newValue);
      prevIndex = prevFields.findIndex(
        (p, i) => p.key === f.key && !usedPrevIndexes.has(i) && labelOf(p.newValue) === label,
      );
    } else {
      prevIndex = prevFields.findIndex((p, i) => p.key === f.key && !usedPrevIndexes.has(i));
    }
    let status: StoredField["status"] = "pending";
    if (prevIndex >= 0) {
      usedPrevIndexes.add(prevIndex);
      const prev = prevFields[prevIndex]!;
      const sameValue = JSON.stringify(prev.newValue) === JSON.stringify(f.newValue);
      if (prev.status === "accepted" && sameValue) status = "accepted";
    }
    return { ...f, status };
  });

  await client.query(
    `INSERT INTO dichoithoi_destination_ai_extractions (destination_slug, source_urls, extracted_at, fields)
     VALUES ($1, $2, now(), $3)
     ON CONFLICT (destination_slug) DO UPDATE SET source_urls = $2, extracted_at = now(), fields = $3`,
    [slug, JSON.stringify(input.sourceUrls), JSON.stringify(fields)],
  );

  const accepted = fields.filter((f) => f.status === "accepted").length;
  const found = fields.filter((f) => f.found).length;
  console.log(
    `Đã upsert ${fields.length} field cho slug="${slug}" — tìm được ${found}, giữ nguyên "accepted" ${accepted} (đã duyệt trước, giá trị không đổi).`,
  );

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
