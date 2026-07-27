/**
 * GD5 — Nap 257 cum tu snapshot Atlas (plan-lam-moi-du-lieu-atlas.md GD5).
 * Doc CSV, map ten tinh sheet -> node tinh da seed o GD4 (atlas-seed-provinces.ts)
 * qua ten trong admin_provinces, sinh slug theo quy tac GD1, UPSERT theo slug.
 *
 * - contentTier: "Cụm lớn" -> flagship, "Cụm nhỏ" -> standard (§7 cau 3).
 * - ai_notes = "Một số điểm trong cụm" + "Tiếp giáp" tu sheet (§7 cau 2) — nguoi
 *   dung se tu doc/cap nhat lai sau, KHONG luu thanh relation.
 * - Slug trung ten cum (2 cap: Phong Dien, Huong Son) -> hau to TEN TINH ca 2 ben.
 * - Cum trung ten tinh/thanh pho (vd cum "Đà Nẵng") giu slug gon — khong dung vi
 *   node tinh da mang tien to tinh-/thanh-pho- tu GD4, khong con dung slug.
 *
 * Idempotent: UPSERT theo slug (ON CONFLICT DO UPDATE).
 * Chay: npx ts-node scripts/atlas-seed-clusters.ts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Client } = require("pg") as {
  Client: new (config: { connectionString?: string }) => {
    connect(): Promise<void>;
    end(): Promise<void>;
    query(sql: string, params?: unknown[]): Promise<{ rows: Array<Record<string, string>>; rowCount: number | null }>;
  };
};

const CSV_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "docs",
  "dichoithoi",
  "chuan-hoa-du-lieu",
  "atlas-cum-snapshot-2026-07-27.csv",
);

function normalizeVietnamese(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}
function slugifyVietnamese(text: string): string {
  return normalizeVietnamese(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/** Parse CSV co the co cell nhieu dong (quoted) — dung chung voi luc phan tich. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQ = false;
      } else cell += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") {
        row.push(cell);
        cell = "";
      } else if (ch === "\n") {
        row.push(cell.replace(/\r$/, ""));
        rows.push(row);
        row = [];
        cell = "";
      } else if (ch !== "\r") cell += ch;
    }
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows;
}

/** "Khánh Hoà" (sheet) -> "Khánh Hòa" (admin_provinces) — lech vi tri dau, duy nhat 1 case. */
function normalizeSheetProvinceName(name: string): string {
  const trimmed = name.trim();
  if (trimmed === "Khánh Hoà") return "Khánh Hòa";
  return trimmed;
}

/**
 * Loi du lieu THAT trong sheet phat hien khi chay script 27/07/2026: dong "No"=18
 * ghi ten cum la "Củ Chi" nhung noi dung (Diem/Mo ta) la cum RIENG "Cần Giờ" (Rừng
 * Sác, Đảo Khỉ Cần Giờ, pha Vung Tau) — trung ten voi dong "No"=17 la Cu Chi that,
 * khien UPSERT theo slug ghi de mat du lieu Cu Chi that. Sua theo cot "No" (on
 * dinh hon match theo ten) — KHONG sua sheet, chi sua o buoc import nay.
 */
const CLUSTER_NAME_CORRECTIONS: Record<string, string> = {
  "18": "Cần Giờ",
};

interface ProvinceLookup {
  slug: string;
  provinceCode: string;
}

async function main(): Promise<void> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const provinceRows = (
      await client.query(`SELECT slug, name, province_code FROM dichoithoi_destinations WHERE kind = 'province'`)
    ).rows;
    const provinceByName = new Map<string, ProvinceLookup>(
      provinceRows.map((r) => [r.name!, { slug: r.slug!, provinceCode: r.province_code! }]),
    );

    const raw = readFileSync(CSV_PATH, "utf8");
    const data = parseCsv(raw)
      .slice(1)
      .filter((r) => r.length >= 4 && r[2]?.trim());
    console.log(`Doc ${data.length} dong cum tu sheet.`);

    // Sua loi ten cum sai (CLUSTER_NAME_CORRECTIONS) TRUOC khi tinh dedup slug
    let correctionsApplied = 0;
    for (const r of data) {
      const no = r[0]!.trim();
      const fix = CLUSTER_NAME_CORRECTIONS[no];
      if (fix && r[2]!.trim() !== fix) {
        console.log(`  [sua ten] No=${no}: "${r[2]!.trim()}" -> "${fix}"`);
        r[2] = fix;
        correctionsApplied++;
      }
    }
    if (correctionsApplied > 0) console.log(`Da sua ${correctionsApplied} ten cum sai trong sheet.`);

    // Phat hien slug trung -> hau to ten tinh CA HAI ben (GD1)
    const baseSlugCount = new Map<string, number>();
    for (const r of data) {
      const s = slugifyVietnamese(r[2]!.trim());
      baseSlugCount.set(s, (baseSlugCount.get(s) ?? 0) + 1);
    }

    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const r of data) {
      const sheetProvinceName = normalizeSheetProvinceName(r[1]!);
      const clusterName = r[2]!.trim();
      const loaiCum = r[3]!.trim();
      const moTa = (r[4] ?? "").trim() || null;
      const diemTrongCum = (r[5] ?? "").trim();
      const tiepGiap = (r[6] ?? "").trim();

      const province = provinceByName.get(sheetProvinceName);
      if (!province) {
        errors.push(`Khong khop tinh "${sheetProvinceName}" (cum "${clusterName}")`);
        continue;
      }

      const baseSlug = slugifyVietnamese(clusterName);
      const slug =
        (baseSlugCount.get(baseSlug) ?? 0) > 1 ? `${baseSlug}-${slugifyVietnamese(sheetProvinceName)}` : baseSlug;

      const contentTier = loaiCum === "Cụm lớn" ? "flagship" : loaiCum === "Cụm nhỏ" ? "standard" : null;
      if (!contentTier) errors.push(`Loai cum la "${loaiCum}" (khong phai Cụm lớn/Cụm nhỏ) — cum "${clusterName}"`);

      const aiNotesParts: string[] = [];
      if (diemTrongCum) aiNotesParts.push(`Một số điểm trong cụm:\n${diemTrongCum}`);
      if (tiepGiap) aiNotesParts.push(`Tiếp giáp:\n${tiepGiap}`);
      const aiNotes = aiNotesParts.length > 0 ? aiNotesParts.join("\n\n") : null;

      const res = await client.query(
        `INSERT INTO dichoithoi_destinations
           (slug, site_id, kind, parent_slug, province_code, name, name_unaccented,
            short_description, content_tier, ai_notes, priority, has_local_changes)
         VALUES ($1, NULL, 'cluster', $2, $3, $4, $5, $6, $7, $8, 3, true)
         ON CONFLICT (slug) DO UPDATE SET
           parent_slug = EXCLUDED.parent_slug,
           province_code = EXCLUDED.province_code,
           name = EXCLUDED.name,
           name_unaccented = EXCLUDED.name_unaccented,
           short_description = EXCLUDED.short_description,
           content_tier = EXCLUDED.content_tier,
           ai_notes = EXCLUDED.ai_notes
         RETURNING (xmax = 0) AS is_insert`,
        [
          slug,
          province.slug,
          province.provinceCode,
          clusterName,
          normalizeVietnamese(clusterName),
          moTa,
          contentTier,
          aiNotes,
        ],
      );
      if (res.rows[0]?.is_insert === "true") created++;
      else updated++;
    }

    const byTier = await client.query(
      `SELECT content_tier, count(*) AS c FROM dichoithoi_destinations WHERE kind = 'cluster' GROUP BY content_tier`,
    );
    const totalClusters = await client.query(`SELECT count(*) AS c FROM dichoithoi_destinations WHERE kind = 'cluster'`);

    console.log(`\n=== GD5 NAP CUM XONG ===`);
    console.log(`Tao moi: ${created}, cap nhat: ${updated}, loi: ${errors.length}`);
    console.log(`Tong cum trong DB: ${totalClusters.rows[0]?.c}`);
    console.log(`Theo ContentTier:`, byTier.rows);
    if (errors.length > 0) {
      console.log(`\nLoi (${errors.length}):`);
      errors.forEach((e) => console.log(` - ${e}`));
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Nap cum THAT BAI:", err);
  process.exit(1);
});
