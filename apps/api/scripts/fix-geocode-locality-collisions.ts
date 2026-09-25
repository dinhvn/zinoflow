/**
 * Don du lieu 95 POI (44 nhom) bi gan NHAM toa do cua 1 dia danh hanh chinh
 * chung (locality) thay vi dung diem cua rieng no — phat hien qua audit
 * 14/08/2026 (xem memory dichoithoi-destination-geocode-audit-plan-open.md).
 * Nguyen nhan goc da CHAN o accept-geocode-candidates.usecase.ts (khong cho
 * chap nhan toa do trung POI khac trong cung cum nua) — script nay chi don
 * DU LIEU CU da bi ghi sai TRUOC KHI co guard do.
 *
 * Dau hieu: >=2 POI CUNG parent_slug co lat/lng giong het nhau (lam tron 6
 * so thap phan) — khong the nao 2 dia diem THAT trung toa do chinh xac den
 * muc do, tru khi ca 2 cung tro ve 1 trang Google Maps.
 *
 * Hanh dong: null hoa lat/lng/google_maps_url cho TOAN BO POI trong 1 nhom
 * bi trung (khong doan diem nao "dung hon" — ca nhom deu la ket qua cua 1
 * lan search ra dung 1 dia danh chung, khong co can cu chon 1 trong so do la
 * dung), dua chung ve lai hang doi "thieu toa do" de geocode/ra soat lai tay
 * — VA xoa dong staging da "accepted" tuong ung (neu co) de khong bi
 * excludeAlreadyAttempted() loai khoi lan batch geocode sau.
 *
 * Mac dinh chi IN BAO CAO (dry-run). Them --apply de ghi that vao DB.
 * Chay: pnpm ts-node scripts/fix-geocode-locality-collisions.ts [--apply]
 */
import "dotenv/config";
import "reflect-metadata";
import { DataSource, In } from "typeorm";
import { DestinationMirrorEntity } from "../src/modules/destination/infrastructure/entities/destination-mirror.entity";
import { DestinationGeocodeCandidateEntity } from "../src/modules/destination/infrastructure/entities/destination-geocode-candidate.entity";

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");

  const dataSource = new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL,
    entities: [DestinationMirrorEntity, DestinationGeocodeCandidateEntity],
    synchronize: false,
  });
  await dataSource.initialize();

  try {
    const mirrorRepo = dataSource.getRepository(DestinationMirrorEntity);
    const candidateRepo = dataSource.getRepository(DestinationGeocodeCandidateEntity);

    const all = await mirrorRepo.find();
    const bySlug = new Map(all.map((d) => [d.slug, d]));
    const pois = all.filter((d) => d.kind === "poi" && d.lat !== null && d.lng !== null);

    const key = (d: DestinationMirrorEntity) =>
      `${d.parentSlug ?? ""}|${Number(d.lat).toFixed(6)}|${Number(d.lng).toFixed(6)}`;
    const groups = new Map<string, DestinationMirrorEntity[]>();
    for (const p of pois) {
      const k = key(p);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(p);
    }
    const collided = [...groups.values()].filter((g) => g.length > 1);

    let totalPois = 0;
    const publishedTouched: string[] = [];
    for (const group of collided) {
      totalPois += group.length;
      const parent = group[0]!.parentSlug ? bySlug.get(group[0]!.parentSlug!) : null;
      console.log(
        `\n[Cụm "${parent?.name ?? group[0]!.parentSlug}"] ${group.length} POI trùng toạ độ ` +
          `(${group[0]!.lat}, ${group[0]!.lng}):`,
      );
      for (const p of group) {
        console.log(`  - ${p.name} (${p.slug})${p.siteId !== null ? " ⚠️ ĐÃ PUBLISH (siteId=" + p.siteId + ")" : ""}`);
        if (p.siteId !== null) publishedTouched.push(p.slug);
      }
    }

    console.log(
      `\n=== Tổng: ${collided.length} nhóm, ${totalPois} POI sẽ bị xoá lat/lng/google_maps_url ===`,
    );
    if (publishedTouched.length > 0) {
      console.log(
        `\n⚠️⚠️ CẢNH BÁO: ${publishedTouched.length} POI trong số này ĐÃ PUBLISH lên site thật ` +
          `(${publishedTouched.join(", ")}) — script này KHÔNG đụng tới SQL Server, chỉ sửa mirror Postgres. ` +
          `Cần xử lý tay riêng cho các POI này (đồng bộ lại sau khi sửa mirror).`,
      );
    }

    if (!apply) {
      console.log('\n[Dry-run] Chưa ghi gì. Chạy lại với --apply để ghi thật.');
      return;
    }

    const allSlugs = collided.flatMap((g) => g.map((p) => p.slug));
    await mirrorRepo.update(
      { slug: In(allSlugs) },
      { lat: null, lng: null, googleMapsUrl: null },
    );
    const deleteResult = await candidateRepo.delete({ destinationSlug: In(allSlugs) });
    console.log(
      `\nĐã ghi: xoá lat/lng/googleMapsUrl của ${allSlugs.length} POI, xoá ${deleteResult.affected ?? 0} ` +
        `dòng staging geocode candidate liên quan (để chạy batch geocode lại được).`,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error("LỖI:", err);
  process.exit(1);
});
