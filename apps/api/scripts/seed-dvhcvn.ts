/**
 * Seed 3 bang hanh chinh tu seed-data/dvhcvn/*.json vao Postgres (spec §13.1).
 * IDEMPOTENT: provinces/wards upsert theo PK; ward_mappings xoa-het-insert-lai
 * (bang nay khong co khoa tu nhien on dinh, dataset la nguon su that).
 *
 * Chay: pnpm seed:dvhcvn  (sau khi migration:run)
 */
import "reflect-metadata";
import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { DataSource } from "typeorm";

const DATA_DIR = path.join(__dirname, "..", "seed-data", "dvhcvn");

interface ProvinceRow {
  provinceCode: string;
  name: string;
  shortName: string;
  code: string;
  placeType: string;
}
interface WardRow {
  wardCode: string;
  name: string;
  provinceCode: string;
}
interface MappingRow {
  oldWardCode: string | null;
  oldWardName: string | null;
  oldDistrictName: string | null;
  oldProvinceName: string | null;
  newWardCode: string | null;
  newWardName: string | null;
  newProvinceName: string | null;
}

function loadJson<T>(file: string): T[] {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8")) as T[];
}

async function main(): Promise<void> {
  const ds = new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL,
  });
  await ds.initialize();

  try {
    const provinces = loadJson<ProvinceRow>("provinces.json");
    const wards = loadJson<WardRow>("wards.json");
    const mappings = loadJson<MappingRow>("ward-mappings.json");

    await ds.transaction(async (em) => {
      for (const p of provinces) {
        await em.query(
          `INSERT INTO admin_provinces (province_code, name, short_name, code, place_type)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (province_code) DO UPDATE
           SET name = EXCLUDED.name, short_name = EXCLUDED.short_name,
               code = EXCLUDED.code, place_type = EXCLUDED.place_type`,
          [p.provinceCode, p.name, p.shortName, p.code, p.placeType],
        );
      }

      // wards: insert theo lo 500 dong cho nhanh
      const batchSize = 500;
      for (let i = 0; i < wards.length; i += batchSize) {
        const batch = wards.slice(i, i + batchSize);
        const values = batch
          .map((_, j) => `($${j * 3 + 1}, $${j * 3 + 2}, $${j * 3 + 3})`)
          .join(",");
        const params = batch.flatMap((w) => [w.wardCode, w.name, w.provinceCode]);
        await em.query(
          `INSERT INTO admin_wards (ward_code, name, province_code) VALUES ${values}
           ON CONFLICT (ward_code) DO UPDATE
           SET name = EXCLUDED.name, province_code = EXCLUDED.province_code`,
          params,
        );
      }

      await em.query(`DELETE FROM admin_ward_mappings`);
      for (let i = 0; i < mappings.length; i += batchSize) {
        const batch = mappings.slice(i, i + batchSize);
        const values = batch
          .map((_, j) => {
            const base = j * 7;
            return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
          })
          .join(",");
        const params = batch.flatMap((m) => [
          m.oldWardCode,
          m.oldWardName,
          m.oldDistrictName,
          m.oldProvinceName,
          m.newWardCode,
          m.newWardName,
          m.newProvinceName,
        ]);
        await em.query(
          `INSERT INTO admin_ward_mappings
           (old_ward_code, old_ward_name, old_district_name, old_province_name,
            new_ward_code, new_ward_name, new_province_name)
           VALUES ${values}`,
          params,
        );
      }
    });

    const counts = await ds.query(`
      SELECT
        (SELECT COUNT(*) FROM admin_provinces) AS provinces,
        (SELECT COUNT(*) FROM admin_wards) AS wards,
        (SELECT COUNT(*) FROM admin_ward_mappings) AS mappings
    `);
    console.log("Seed xong:", counts[0]);
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error("Seed that bai:", err.message);
  process.exit(1);
});
