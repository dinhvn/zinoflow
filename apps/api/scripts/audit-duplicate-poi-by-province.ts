/**
 * Giai đoạn 1/2 (dichoithoi-chuan-hoa-poi-theo-tinh-plan.md) — Bước 2 checklist
 * ("Trùng lặp"), đóng gói lại thành công cụ tái sử dụng theo tỉnh thay vì audit
 * tay 1 lần như hôm 15/08/2026.
 *
 * Dùng lại đúng isLikelySameDestinationName() (fuzzy-match-destination-name.ts)
 * — thuật toán đã dùng cho đợt gộp 59 cặp trùng toàn quốc. So khớp mọi cặp POI
 * CÙNG TỈNH (biên giới hành chính không chặn trùng lặp thật, nhưng quét hết
 * toàn quốc từng cặp sẽ chậm — quét theo tỉnh đủ cho mục đích checklist).
 *
 * CHỈ ĐỌC, không tự gộp — in ra danh sách để người dùng duyệt.
 * Chạy: pnpm ts-node scripts/audit-duplicate-poi-by-province.ts --province=20
 */
import "dotenv/config";
import "reflect-metadata";
import { DataSource } from "typeorm";
import { DestinationMirrorEntity } from "../src/modules/destination/infrastructure/entities/destination-mirror.entity";
import { isLikelySameDestinationName } from "../src/modules/destination/application/services/fuzzy-match-destination-name";
import { normalizeVietnamese } from "../src/modules/shared/text/vietnamese";

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

async function main(): Promise<void> {
  const provinceCode = parseArg("province");
  if (!provinceCode) throw new Error("Cần --province=<mã tỉnh>");

  const dataSource = new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL,
    entities: [DestinationMirrorEntity],
    synchronize: false,
  });
  await dataSource.initialize();

  try {
    const repo = dataSource.getRepository(DestinationMirrorEntity);
    const all = await repo.find();
    const bySlug = new Map(all.map((d) => [d.slug, d]));
    const pois = all.filter((d) => d.kind === "poi" && d.provinceCode === provinceCode);

    const clusterNameTokens = new Map<string, Set<string>>();
    for (const p of pois) {
      if (!p.parentSlug || clusterNameTokens.has(p.parentSlug)) continue;
      const parent = bySlug.get(p.parentSlug);
      if (parent) {
        clusterNameTokens.set(
          p.parentSlug,
          new Set(normalizeVietnamese(parent.name).split(" ").filter(Boolean)),
        );
      }
    }

    const pairs: Array<{ a: DestinationMirrorEntity; b: DestinationMirrorEntity }> = [];
    for (let i = 0; i < pois.length; i++) {
      for (let j = i + 1; j < pois.length; j++) {
        const a = pois[i]!;
        const b = pois[j]!;
        const ignoreTokens = new Set<string>([
          ...(clusterNameTokens.get(a.parentSlug ?? "") ?? []),
          ...(clusterNameTokens.get(b.parentSlug ?? "") ?? []),
        ]);
        if (isLikelySameDestinationName(a.name, b.name, ignoreTokens)) {
          pairs.push({ a, b });
        }
      }
    }

    console.log(`=== Trùng lặp nghi vấn trong tỉnh ${provinceCode}: ${pairs.length} cặp / ${pois.length} POI ===\n`);
    for (const { a, b } of pairs) {
      console.log(`"${a.name}" (${a.slug}, cụm ${a.parentSlug}) <-> "${b.name}" (${b.slug}, cụm ${b.parentSlug})`);
    }
    console.log("\nScript chỉ đọc, không tự gộp. Duyệt tay từng cặp trước khi dùng merge-duplicate-poi.ts.");
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error("LỖI:", err);
  process.exit(1);
});
