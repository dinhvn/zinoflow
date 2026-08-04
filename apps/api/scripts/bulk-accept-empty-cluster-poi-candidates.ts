/**
 * Tu dong "Chấp nhận TẤT CẢ" ung vien Tim-diem-con (cluster-poi-discovery) cho
 * moi CUM CHUA TUNG CHAP NHAN diem nao (khong dong den cum da tung chap nhan
 * it nhat 1 diem — coi la nguoi dung da tu duyet mot phan, khong dong toi de
 * tranh chap nhan chong len quyet dinh tay cua ho). Yeu cau nguoi dung
 * 04/08/2026: da chay "Tim diem con" cho toan bo cum qua Batch AI, khong
 * muon tu mo tung cum bam Chap nhan.
 *
 * Goi DUNG lai endpoint that (POST /destinations/:slug/cluster-poi-candidates/accept)
 * qua HTTP toi API dang chay local — tai su dung 100% logic that (tao draft,
 * gan lai orphan, khoi phuc backup, copy anh...) giong het bam tay tren UI,
 * KHONG tu viet lai logic. "new"/"orphan-match"/"backup-match" deu duoc chap
 * nhan; "backup-match" mac dinh dung ban AI (preferAiMetadataIndexes) theo
 * yeu cau nguoi dung 04/08/2026 ("mặc định luôn check"). "existing-in-cluster"
 * luon bi loai (khong co gi de ap dung).
 *
 * Ket qua la DRAFT (siteId=null) — CHUA publish len site that, an toan hoan
 * tac (xoa duoc) neu co sai sot, KHONG anh huong SEO/nguoi dung that.
 *
 * Mac dinh chi IN BAO CAO (dry-run). Them --apply de goi that. Them
 * --only=slug1,slug2 de chi chay thu vai cum truoc khi chay het (yeu cau
 * nguoi dung 04/08/2026 — muon xem thu ket qua vai cum nho truoc).
 * Chay: pnpm ts-node scripts/bulk-accept-empty-cluster-poi-candidates.ts [--apply] [--only=slug1,slug2]
 */
import "dotenv/config";
import "reflect-metadata";
import { DataSource } from "typeorm";
import { ClusterPoiCandidateEntity } from "../src/modules/destination/infrastructure/entities/cluster-poi-candidate.entity";

const API_BASE = process.env.SCRIPT_API_BASE_URL ?? "http://localhost:3001/api";

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const onlySlugs = onlyArg ? new Set(onlyArg.slice("--only=".length).split(",").filter(Boolean)) : null;

  const dataSource = new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL,
    entities: [ClusterPoiCandidateEntity],
    synchronize: false,
  });
  await dataSource.initialize();

  try {
    const candidateRepo = dataSource.getRepository(ClusterPoiCandidateEntity);
    const records = await candidateRepo.find();

    let totalClusters = 0;
    let totalAccepted = 0;
    let totalErrors = 0;

    for (const record of records) {
      if (onlySlugs && !onlySlugs.has(record.clusterSlug)) continue;
      const hasAnyAccepted = record.candidates.some((c) => c.status === "accepted");
      if (hasAnyAccepted) continue;

      const actionable = record.candidates
        .map((c, i) => ({ c, i }))
        .filter(({ c }) => c.matchType !== "existing-in-cluster" && c.status === "pending");
      if (actionable.length === 0) continue;

      const acceptedIndexes = actionable.map(({ i }) => i);
      const preferAiMetadataIndexes = actionable
        .filter(({ c }) => c.matchType === "backup-match")
        .map(({ i }) => i);

      totalClusters++;
      totalAccepted += acceptedIndexes.length;
      console.log(`[${record.clusterSlug}] ${acceptedIndexes.length} ứng viên sẽ được chấp nhận`);

      if (!apply) continue;

      try {
        const res = await fetch(
          `${API_BASE}/destinations/${record.clusterSlug}/cluster-poi-candidates/accept`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ acceptedIndexes, preferAiMetadataIndexes }),
          },
        );
        if (!res.ok) {
          totalErrors++;
          console.error(`  ❌ LỖI ${res.status}: ${await res.text()}`);
        }
      } catch (err) {
        totalErrors++;
        console.error(`  ❌ LỖI gọi API: ${err instanceof Error ? err.message : err}`);
      }
    }

    console.log(
      `\n${apply ? "Đã chấp nhận" : "[Dry-run] Sẽ chấp nhận"}: ${totalAccepted} ứng viên ở ${totalClusters} cụm chưa từng chấp nhận điểm nào.` +
        (apply ? (totalErrors > 0 ? ` (${totalErrors} cụm lỗi — xem log trên)` : "") : " Chạy lại với --apply để chấp nhận thật."),
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error("LỖI:", err);
  process.exit(1);
});
