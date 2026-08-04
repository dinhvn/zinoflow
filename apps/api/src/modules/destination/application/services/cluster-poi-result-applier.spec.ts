import { ClusterPoiResultApplier } from "./cluster-poi-result-applier";
import type { ClusterPoiBackupRepository } from "../ports/cluster-poi-backup.repository";
import type { ClusterPoiCandidateRepository } from "../ports/cluster-poi-candidate.repository";
import type { AiUsageRecorder } from "../../../ai-content/application/ports/ai-usage-recorder.port";
import type { ClusterPoiBackupEntity } from "../../infrastructure/entities/cluster-poi-backup.entity";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";

/**
 * Bug 04/08/2026 (cum bao-loc): backup row cua CHINH cum ("Bảo Lộc") bi
 * isLikelySameDestinationName() khop nham voi bat ky ung vien nao co ten
 * chua ten cum (vd "Tượng Đức Mẹ Đèo Bảo Lộc") -> matchType="backup-match"
 * tro ve chinh cum -> Chấp nhận am tham khong lam gi vi backup do da khoi
 * phuc roi. Fix: loai backup row trung slug voi cum truoc khi so khop.
 */
describe("ClusterPoiResultApplier.apply", () => {
  const cluster = {
    slug: "bao-loc",
    name: "Bảo Lộc",
    aiNotes: null,
    provinceCode: "68",
  } as unknown as DestinationMirrorEntity;

  const clusterOwnBackup: ClusterPoiBackupEntity = {
    slug: "bao-loc",
    name: "Bảo Lộc",
    provinceCode: "68",
    restoredToSlug: "bao-loc",
    restoreNote: null,
    draftArticle: null,
    thumbnail: null,
    gallery: [],
    priority: 1,
  } as unknown as ClusterPoiBackupEntity;

  function buildApplier(backupCandidates: ClusterPoiBackupEntity[]) {
    const candidateRepo: Pick<ClusterPoiCandidateRepository, "upsert"> = {
      upsert: jest.fn().mockResolvedValue(undefined),
    };
    const backupRepo: Pick<ClusterPoiBackupRepository, "findUnrestoredByProvince"> = {
      findUnrestoredByProvince: jest.fn().mockResolvedValue(backupCandidates),
    };
    const usage: Pick<AiUsageRecorder, "record"> = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    const applier = new ClusterPoiResultApplier(
      candidateRepo as ClusterPoiCandidateRepository,
      backupRepo as ClusterPoiBackupRepository,
      usage as AiUsageRecorder,
    );
    return applier;
  }

  it("does not match a candidate to the cluster's own backup row just because the name contains the cluster name", async () => {
    const applier = buildApplier([clusterOwnBackup]);
    const [result] = await applier.apply(
      "bao-loc",
      cluster,
      [],
      { locations: [{ name: "Tượng Đức Mẹ Đèo Bảo Lộc", priority_level: 3, short_description: null, address: null }] },
      { inputTokens: 0, outputTokens: 0, costUsd: 0, latencyMs: 0 },
    );

    expect(result!.matchType).toBe("new");
    expect(result!.matchedSlug).toBeNull();
  });

  it("does not match a candidate to an existing child just because both names contain the cluster name", async () => {
    const deoBaoLoc = {
      slug: "deo-bao-loc",
      name: "Đèo Bảo Lộc",
      parentSlug: "bao-loc",
    } as unknown as DestinationMirrorEntity;
    const applier = buildApplier([]);
    const [statue, hill] = await applier.apply(
      "bao-loc",
      cluster,
      [deoBaoLoc],
      {
        locations: [
          { name: "Tượng Đức Mẹ Đèo Bảo Lộc", priority_level: 3, short_description: null, address: null },
          { name: "Đồi Dổi Bảo Lộc", priority_level: 5, short_description: null, address: null },
        ],
      },
      { inputTokens: 0, outputTokens: 0, costUsd: 0, latencyMs: 0 },
    );

    expect(statue!.matchType).toBe("new");
    expect(hill!.matchType).toBe("new");
  });

  it("does not match a candidate to an existing child just because both names contain the province name", async () => {
    // Bug 04/08/2026 (cum dat-mui, tinh Cà Mau): 1 backup duoc khoi phuc giu
    // nguyen ten backup qua ngan "Cà Mau" (trung ten tinh) — MOI ung vien
    // khac trong cum co ten chua "Cà Mau" (gan nhu tat ca, vi cum nam trong
    // tinh Cà Mau) deu bi khop nham vao dung 1 diem do.
    const datMuiCluster = {
      slug: "dat-mui",
      name: "Đất Mũi",
      aiNotes: null,
      provinceCode: "96",
    } as unknown as DestinationMirrorEntity;
    const caMauProvince = {
      slug: "ca-mau",
      name: "Cà Mau",
      kind: "province",
      provinceCode: "96",
    } as unknown as DestinationMirrorEntity;
    const caMauStub = {
      slug: "ca-mau-2",
      name: "Cà Mau",
      parentSlug: "dat-mui",
    } as unknown as DestinationMirrorEntity;
    const applier = buildApplier([]);
    const [result] = await applier.apply(
      "dat-mui",
      datMuiCluster,
      [caMauProvince, caMauStub],
      {
        locations: [
          { name: "Vườn quốc gia Mũi Cà Mau", priority_level: 1, short_description: null, address: null },
        ],
      },
      { inputTokens: 0, outputTokens: 0, costUsd: 0, latencyMs: 0 },
    );

    expect(result!.matchType).toBe("new");
    expect(result!.matchedSlug).toBeNull();
  });

  it("still matches a candidate to a real, different backup row in the same province", async () => {
    const realBackup: ClusterPoiBackupEntity = {
      ...clusterOwnBackup,
      slug: "chua-linh-quy-phap-an",
      name: "Chùa Linh Quy Pháp Ấn",
      restoredToSlug: null,
    };
    const applier = buildApplier([clusterOwnBackup, realBackup]);
    const [result] = await applier.apply(
      "bao-loc",
      cluster,
      [],
      { locations: [{ name: "Linh Quy Pháp Ấn", priority_level: 1, short_description: null, address: null }] },
      { inputTokens: 0, outputTokens: 0, costUsd: 0, latencyMs: 0 },
    );

    expect(result!.matchType).toBe("backup-match");
    expect(result!.matchedSlug).toBe("chua-linh-quy-phap-an");
  });
});
