/**
 * Sua lai (KHONG goi lai AI) cac ung vien "Tim diem con hang loat" bi KET CUNG —
 * khong the nao Chap nhan duoc du bam bao nhieu lan (04/08/2026). Dau hieu CHAC
 * CHAN (khong doan mo): matchType="backup-match" nhung dong backup ma no tro toi
 * (matchedSlug) DA duoc khoi phuc roi (restoredToSlug != null) hoac khong con ton
 * tai — AcceptClusterPoiCandidatesUseCase -> RestoreClusterPoiBackupService.execute()
 * luon tra ve null trong 2 truong hop nay, am tham khong lam gi, item cu the la
 * "pending" mai mai. Nguyen nhan pho bien nhat: bug fuzzy-match ten cum (xem
 * cluster-poi-result-applier.ts + fuzzy-match-destination-name.ts) khien nhieu ung
 * vien o NHIEU cum khac nhau cung tro ve 1 backup — ai/cum nao Chap nhan truoc se
 * "chiem" backup do, cac cum con lai vinh vien ket cung voi backup da mat (vd
 * "Chùa Linh An" o cum Đức Trọng tro ve backup "chua-linh-quy-phap-an" nhung
 * backup do da duoc 1 ung vien khac o cum Bảo Lộc chiem mat).
 *
 * CHI xu ly dung dau hieu nay (backup-match toi 1 backup da mat/da khoi phuc) —
 * KHONG dong cham toi cac thay doi phan loai khac (vd existing-in-cluster/orphan-
 * match) vi nhung dang do co the la match dung hoac sai tuy tung truong hop cu
 * the, can nguoi xem lai tay (vd bug rieng "Dinh Bảo Đại 1/2/3" bi conflate do
 * trung nhieu tu, phat hien 04/08/2026, CHUA sua o day).
 *
 * Mac dinh chi IN BAO CAO (dry-run). Them --apply de ghi that vao DB.
 * Chay: pnpm ts-node scripts/fix-cluster-poi-self-match.ts [--apply]
 */
import "dotenv/config";
import "reflect-metadata";
import { DataSource, IsNull } from "typeorm";
import type { ClusterPoiCandidateItem } from "@zinoflow/contracts";
import { ClusterPoiCandidateEntity } from "../src/modules/destination/infrastructure/entities/cluster-poi-candidate.entity";
import { ClusterPoiBackupEntity } from "../src/modules/destination/infrastructure/entities/cluster-poi-backup.entity";
import { DestinationMirrorEntity } from "../src/modules/destination/infrastructure/entities/destination-mirror.entity";
import { classify } from "../src/modules/destination/application/services/cluster-poi-result-applier";

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");

  const dataSource = new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL,
    entities: [ClusterPoiCandidateEntity, ClusterPoiBackupEntity, DestinationMirrorEntity],
    synchronize: false,
  });
  await dataSource.initialize();

  try {
    const candidateRepo = dataSource.getRepository(ClusterPoiCandidateEntity);
    const backupRepo = dataSource.getRepository(ClusterPoiBackupEntity);
    const mirrorRepo = dataSource.getRepository(DestinationMirrorEntity);

    const allMirrors = await mirrorRepo.find();
    const mirrorBySlug = new Map(allMirrors.map((m) => [m.slug, m]));
    const allBackups = await backupRepo.find();
    const backupBySlug = new Map(allBackups.map((b) => [b.slug, b]));
    const records = await candidateRepo.find();

    function isStuckBackupMatch(c: ClusterPoiCandidateItem): boolean {
      if (c.status !== "pending" || c.matchType !== "backup-match" || !c.matchedSlug) return false;
      const target = backupBySlug.get(c.matchedSlug);
      return !target || target.restoredToSlug !== null;
    }

    let totalFixed = 0;
    let totalClustersTouched = 0;

    for (const record of records) {
      const cluster = mirrorBySlug.get(record.clusterSlug);
      if (!cluster) {
        console.log(`⚠️  Bỏ qua "${record.clusterSlug}" — không tìm thấy cụm trong destination_mirror.`);
        continue;
      }

      const suspects = record.candidates.filter(isStuckBackupMatch);
      if (suspects.length === 0) continue;

      const backupCandidates = (
        await backupRepo.find({
          where: { provinceCode: cluster.provinceCode ?? IsNull(), restoredToSlug: IsNull(), restoreNote: IsNull() },
        })
      ).filter((b) => b.slug !== cluster.slug);

      let changedInThisCluster = 0;
      const updated: ClusterPoiCandidateItem[] = record.candidates.map((c) => {
        if (!isStuckBackupMatch(c)) return c;
        const reclassified = classify(
          {
            name: c.name,
            priority_level: c.priorityLevel,
            short_description: c.shortDescription,
            address: c.address,
          },
          cluster,
          allMirrors,
          backupCandidates,
        );
        const changed =
          reclassified.matchType !== c.matchType || reclassified.matchedSlug !== c.matchedSlug;
        if (!changed) return c;

        // "new" la KET QUA AN TOAN TUYET DOI (item tro thanh 1 dong binh thuong
        // co the tick/xem/bo qua) — tu ghi. Bat ky ket qua nao KHAC (existing-
        // in-cluster/backup-match toi 1 cho khac) co the LAI la 1 match sai khac
        // (vd bug rieng "Dinh Bảo Đại 1/2/3" bi conflate) — KHOA CUNG lai, con
        // kho sua hon tinh trang "pending" hien tai, nen chi in ra de nguoi xem
        // tay, KHONG tu ghi du co --apply.
        if (reclassified.matchType === "new") {
          changedInThisCluster++;
          console.log(
            `  ✅ [${record.clusterSlug}] "${c.name}": ${c.matchType} (→ ${c.matchedSlug}) => new`,
          );
          return { ...reclassified, status: c.status };
        }
        console.log(
          `  ⚠️  [${record.clusterSlug}] "${c.name}": ${c.matchType} (→ ${c.matchedSlug}) => ${reclassified.matchType} (→ ${reclassified.matchedSlug ?? "—"}) — CẦN XEM TAY, không tự ghi.`,
        );
        return c;
      });

      if (changedInThisCluster > 0) {
        totalClustersTouched++;
        totalFixed += changedInThisCluster;
        if (apply) {
          await candidateRepo.update({ clusterSlug: record.clusterSlug }, { candidates: updated as never });
        }
      }
    }

    console.log(
      `\n${apply ? "Đã ghi" : "[Dry-run] Sẽ ghi"}: ${totalFixed} ứng viên (chỉ loại reclassify => "new") ở ${totalClustersTouched} cụm.` +
        (apply ? "" : " Chạy lại với --apply để ghi thật vào DB.") +
        ` Mục có dòng ⚠️ ở trên KHÔNG được tự ghi — cần bạn tự xem lại trên UI.`,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error("LỖI:", err);
  process.exit(1);
});
