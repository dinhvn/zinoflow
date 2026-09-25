/**
 * CHI DOC — liet ke cac dong "pending" trong bang staging
 * dichoithoi_destination_geocode_candidates (Giai doan 1b, xem
 * dichoithoi-destination-geocode-audit-plan.md) ma ket qua top-1 KHONG du tin
 * cay (confidenceScore thap, hoac top-1/top-2 sat diem nhau) — day la tap
 * dung cho skill dichoithoi-geocode-review tu mo lai bang Playwright MCP de
 * xac nhan tay, khac voi cac dong con lai (top-1 vuot troi) nguoi dung co the
 * bulk-accept thang trong GeocodeCandidatesPanel khong can xem lai.
 *
 * Khong ghi gi vao DB — chi doc va in ra terminal.
 * Chay: pnpm --filter @zinoflow/api exec ts-node -T scripts/list-ambiguous-geocode-candidates.ts [--min-confidence=0.7] [--min-gap=0.1]
 */
import "dotenv/config";
import "reflect-metadata";
import { DataSource } from "typeorm";
import { DestinationGeocodeCandidateEntity } from "../src/modules/destination/infrastructure/entities/destination-geocode-candidate.entity";

function argNumber(flag: string, fallback: number): number {
  const arg = process.argv.find((a) => a.startsWith(`--${flag}=`));
  return arg ? Number(arg.slice(flag.length + 3)) : fallback;
}

async function main(): Promise<void> {
  const minConfidence = argNumber("min-confidence", 0.7);
  const minGap = argNumber("min-gap", 0.1);

  const dataSource = new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL,
    entities: [DestinationGeocodeCandidateEntity],
    synchronize: false,
  });
  await dataSource.initialize();

  try {
    const repo = dataSource.getRepository(DestinationGeocodeCandidateEntity);
    const pending = await repo.find({ where: { status: "pending" } });

    const ambiguous = pending.filter((row) => {
      const [top, second] = [...row.candidates].sort((a, b) => b.confidenceScore - a.confidenceScore);
      if (!top) return false;
      if (top.confidenceScore < minConfidence) return true;
      if (second && top.confidenceScore - second.confidenceScore < minGap) return true;
      return false;
    });

    console.log(`${pending.length} dòng đang "pending", ${ambiguous.length} dòng cần xem lại:\n`);
    for (const row of ambiguous) {
      console.log(`--- ${row.destinationSlug} ---`);
      for (const c of [...row.candidates].sort((a, b) => b.confidenceScore - a.confidenceScore)) {
        console.log(`  [${c.confidenceScore.toFixed(2)}] ${c.displayNameAtDiscovery} — ${c.placeId}`);
      }
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error("LỖI:", err);
  process.exit(1);
});
