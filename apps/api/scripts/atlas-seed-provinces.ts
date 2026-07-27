/**
 * GD4 — Seed 34 node tinh (kind=province) sau khi wipe (plan-lam-moi-du-lieu-atlas.md
 * GD4). Doc thang tu admin_provinces (nguon su that 34 tinh moi) — KHONG doi he ma
 * (dinh chinh 27/07/2026: province_code SO hien tai DA la ma tinh moi, chi ten/slug
 * node cu can lam lai).
 *
 * Quy tac slug (GD1, da chot):
 * - place_type = "Thanh pho Trung Uong" (6 thanh pho) -> thanh-pho-<ten>
 * - con lai (28 tinh) -> tinh-<ten>
 *
 * Idempotent: UPSERT theo slug (ON CONFLICT DO NOTHING) — chay lai an toan.
 * Chay: npx ts-node scripts/atlas-seed-provinces.ts
 */
import "dotenv/config";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Client } = require("pg") as {
  Client: new (config: { connectionString?: string }) => {
    connect(): Promise<void>;
    end(): Promise<void>;
    query(sql: string, params?: unknown[]): Promise<{ rows: Array<Record<string, string>>; rowCount: number | null }>;
  };
};

/** "Thanh pho Ha Noi" -> "ha noi" (bo dau + lowercase, gon khoang trang) */
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

async function main(): Promise<void> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const provinces = (
      await client.query(
        `SELECT province_code, name, place_type FROM admin_provinces ORDER BY province_code`,
      )
    ).rows;

    let inserted = 0;
    for (const p of provinces) {
      const name = p.name ?? "";
      const isCentralCity = (p.place_type ?? "").includes("Trung Ương");
      // "Thanh pho Ha Noi" -> bo tien to "Thanh pho " truoc khi slugify de tranh
      // "thanh-pho-thanh-pho-ha-noi"
      const bareName = name.replace(/^Thành phố\s+/i, "").trim();
      const slug = isCentralCity ? `thanh-pho-${slugifyVietnamese(bareName)}` : `tinh-${slugifyVietnamese(name)}`;

      const res = await client.query(
        `INSERT INTO dichoithoi_destinations
           (slug, site_id, kind, parent_slug, province_code, name, name_unaccented, priority, has_local_changes)
         VALUES ($1, NULL, 'province', NULL, $2, $3, $4, 3, true)
         ON CONFLICT (slug) DO NOTHING`,
        [slug, p.province_code, name, normalizeVietnamese(name)],
      );
      if (res.rowCount && res.rowCount > 0) inserted++;
    }

    const total = await client.query(`SELECT count(*) AS c FROM dichoithoi_destinations WHERE kind = 'province'`);
    console.log(`Da them moi ${inserted}/${provinces.length} tinh. Tong node tinh trong DB: ${total.rows[0]?.c}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Seed tinh THAT BAI:", err);
  process.exit(1);
});
