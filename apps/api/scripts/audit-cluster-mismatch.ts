/**
 * Giai doan 0 (dichoithoi-chuan-hoa-poi-theo-tinh-plan.md) — CHI DOC, khong
 * ghi gi. Phat hien POI co toa do cach xa cum cha bat thuong (mac dinh
 * >50km) — dau hieu sai cum/tach cum thieu, hoac toa do sai. Voi moi POI bi
 * gan co, goi y toi da 3 cum KHAC cung tinh gan hon de nguoi dung tu quyet
 * dinh doi parentSlug (khong tu sua).
 *
 * Chay:
 *   pnpm ts-node scripts/audit-cluster-mismatch.ts                  # toan quoc
 *   pnpm ts-node scripts/audit-cluster-mismatch.ts --province=11    # 1 tinh
 *   pnpm ts-node scripts/audit-cluster-mismatch.ts --threshold=30   # doi nguong km
 */
import "dotenv/config";
import "reflect-metadata";
import { DataSource } from "typeorm";
import { DestinationMirrorEntity } from "../src/modules/destination/infrastructure/entities/destination-mirror.entity";

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

async function main(): Promise<void> {
  const provinceCode = parseArg("province");
  const thresholdKm = Number(parseArg("threshold") ?? "50");
  const thresholdMeters = thresholdKm * 1000;

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
    const provinces = all.filter((d) => d.kind === "province");
    const provinceName = new Map(provinces.map((p) => [p.provinceCode, p.name]));

    const clusters = all.filter((d) => d.kind === "cluster" && d.lat !== null && d.lng !== null);
    const clustersByProvince = new Map<string, DestinationMirrorEntity[]>();
    for (const c of clusters) {
      const key = c.provinceCode ?? "(none)";
      if (!clustersByProvince.has(key)) clustersByProvince.set(key, []);
      clustersByProvince.get(key)!.push(c);
    }

    let pois = all.filter(
      (d) => d.kind === "poi" && d.lat !== null && d.lng !== null && d.parentSlug !== null,
    );
    if (provinceCode) {
      pois = pois.filter((p) => p.provinceCode === provinceCode);
    }

    type Flagged = {
      poi: DestinationMirrorEntity;
      parent: DestinationMirrorEntity;
      distKm: number;
      suggestions: Array<{ cluster: DestinationMirrorEntity; distKm: number }>;
    };
    const flagged: Flagged[] = [];

    for (const poi of pois) {
      const parent = bySlug.get(poi.parentSlug!);
      if (!parent || parent.lat === null || parent.lng === null) continue;
      const distMeters = haversineMeters(
        Number(poi.lat),
        Number(poi.lng),
        Number(parent.lat),
        Number(parent.lng),
      );
      if (distMeters <= thresholdMeters) continue;

      const sameProvinceClusters = clustersByProvince.get(poi.provinceCode ?? "(none)") ?? [];
      const suggestions = sameProvinceClusters
        .filter((c) => c.slug !== parent.slug)
        .map((c) => ({
          cluster: c,
          distKm: haversineMeters(Number(poi.lat), Number(poi.lng), Number(c.lat), Number(c.lng)) / 1000,
        }))
        .sort((a, b) => a.distKm - b.distKm)
        .slice(0, 3);

      flagged.push({ poi, parent, distKm: distMeters / 1000, suggestions });
    }

    flagged.sort((a, b) => b.distKm - a.distKm);

    const scopeLabel = provinceCode
      ? `tỉnh ${provinceName.get(provinceCode) ?? provinceCode} (${provinceCode})`
      : "toàn quốc";
    console.log(
      `=== POI cách cụm cha > ${thresholdKm}km (${scopeLabel}): ${flagged.length}/${pois.length} POI có toạ độ ===\n`,
    );

    for (const f of flagged) {
      console.log(
        `"${f.poi.name}" (${f.poi.slug}) — cụm hiện tại "${f.parent.name}" (${f.parent.slug}), cách ${f.distKm.toFixed(1)}km`,
      );
      if (f.suggestions.length > 0) {
        for (const s of f.suggestions) {
          console.log(`    -> gợi ý cụm "${s.cluster.name}" (${s.cluster.slug}), cách ${s.distKm.toFixed(1)}km`);
        }
      } else {
        console.log("    -> không có cụm nào khác cùng tỉnh có toạ độ để so sánh");
      }
    }

    console.log(`\nTổng: ${flagged.length} POI cần xem lại. Script chỉ đọc, không tự sửa parentSlug.`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error("LỖI:", err);
  process.exit(1);
});
