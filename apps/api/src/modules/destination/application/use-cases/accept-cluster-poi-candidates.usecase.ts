import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ClusterPoiCandidateItem } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import {
  CLUSTER_POI_CANDIDATE_REPOSITORY,
  type ClusterPoiCandidateRepository,
} from "../ports/cluster-poi-candidate.repository";
import { RestoreClusterPoiBackupService } from "../services/restore-cluster-poi-backup.service";
import { UpsertDestinationUseCase } from "./upsert-destination.usecase";
import { slugifyVietnamese } from "../../../shared/text/vietnamese";

/**
 * Chap nhan cac ung vien da tick trong bang duyet tim diem con trong cum
 * (dichoithoi-cluster-poi-discovery-plan.md, giai doan 5) — theo matchType:
 * - "new": tao draft Postgres-only (siteId=null), Y HET luong tao tay "Thêm điểm
 *   đến mới" — KHONG dung MssqlSiteDbAdapter.createDestination() (publish thang,
 *   sai ngu canh cho diem chua qua content/quality gate).
 * - "orphan-match": gan lai parentSlug cua diem orphan da co sang cum nay.
 * - "existing-in-cluster": bo qua (khong co gi de ap dung).
 * - "backup-match" (GD6 plan-lam-moi-du-lieu-atlas.md): KHOI PHUC nguyen dong tu
 *   bang tam dichoithoi_destinations_backup — tao diem moi mang toan bo bai viet/
 *   gallery/Type-Tag/toa do... cua dong backup, copy anh tu thu muc backup ve web
 *   root, danh dau backup da khoi phuc. Mac dinh GIU ten/mo ta/priority CUA BACKUP
 *   (da duyet tay truoc do) — chi dung ban AI moi khi index nam trong
 *   preferAiMetadataIndexes.
 */
@Injectable()
export class AcceptClusterPoiCandidatesUseCase {
  private readonly logger = new Logger(AcceptClusterPoiCandidatesUseCase.name);

  constructor(
    @Inject(CLUSTER_POI_CANDIDATE_REPOSITORY)
    private readonly candidateRepo: ClusterPoiCandidateRepository,
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    private readonly restoreBackup: RestoreClusterPoiBackupService,
    private readonly upsertDestination: UpsertDestinationUseCase,
  ) {}

  async execute(
    clusterSlug: string,
    acceptedIndexes: number[],
    preferAiMetadataIndexes: number[] = [],
  ): Promise<ClusterPoiCandidateItem[]> {
    const record = await this.candidateRepo.findByClusterSlug(clusterSlug);
    if (!record) {
      throw new DomainRuleError(`Chưa có dữ liệu ứng viên nào cho cụm "${clusterSlug}"`);
    }
    const cluster = await this.mirrorRepo.findBySlug(clusterSlug);
    if (!cluster) {
      throw new DomainRuleError(`Không tìm thấy cụm "${clusterSlug}"`);
    }
    const preferAiSet = new Set(preferAiMetadataIndexes);

    const candidates = record.candidates.map((c) => ({ ...c }));
    const appliedIndexes: number[] = [];

    for (const index of acceptedIndexes) {
      const candidate = candidates[index];
      if (!candidate || candidate.status !== "pending") continue;

      if (candidate.matchType === "new") {
        const slug = await this.generateUniqueSlug(candidate.name);
        await this.upsertDestination.create({
          slug,
          name: candidate.name,
          kind: "poi",
          parentSlug: clusterSlug,
          provinceCode: cluster.provinceCode,
          shortDescription: candidate.shortDescription,
          addressNew: candidate.address,
          priority: candidate.priorityLevel,
        });
        appliedIndexes.push(index);
      } else if (candidate.matchType === "orphan-match" && candidate.matchedSlug) {
        const orphan = await this.mirrorRepo.findBySlug(candidate.matchedSlug);
        if (!orphan) continue;
        await this.upsertDestination.update(orphan.slug, {
          slug: orphan.slug,
          name: orphan.name,
          kind: orphan.kind as "province" | "cluster" | "poi",
          parentSlug: clusterSlug,
          provinceCode: orphan.provinceCode,
          shortDescription: orphan.shortDescription,
          thumbnail: orphan.thumbnail,
          googleMapsUrl: orphan.googleMapsUrl,
          addressNew: orphan.addressNew,
          addressOld: orphan.addressOld,
          contactPhone: orphan.contactPhone,
          contactWebsite: orphan.contactWebsite,
          hotelGroupId: orphan.hotelGroupId,
          priority: orphan.priority,
          contentTier: orphan.contentTier,
        });
        appliedIndexes.push(index);
      } else if (candidate.matchType === "backup-match" && candidate.matchedSlug) {
        const useAi = preferAiSet.has(index);
        const newSlug = await this.restoreBackup.execute(candidate.matchedSlug, clusterSlug, {
          name: useAi ? candidate.name : undefined,
          shortDescription: useAi ? candidate.shortDescription : undefined,
          priority: useAi ? candidate.priorityLevel : undefined,
        });
        if (newSlug) appliedIndexes.push(index);
      }
      // "existing-in-cluster" — khong co gi de ap dung, bo qua.
    }

    const updated: ClusterPoiCandidateItem[] = candidates.map((c, i) =>
      appliedIndexes.includes(i) ? { ...c, status: "accepted" } : c,
    );
    await this.candidateRepo.updateCandidates(clusterSlug, updated);

    this.logger.log(`Chấp nhận ${appliedIndexes.length} điểm ứng viên cho cụm ${clusterSlug}`);
    return updated;
  }

  /** slugifyVietnamese + hau to so neu trung (giu duoi 64 ky tu) */
  private async generateUniqueSlug(name: string): Promise<string> {
    const base = slugifyVietnamese(name);
    let slug = base;
    let attempt = 2;
    while (await this.mirrorRepo.findBySlug(slug)) {
      const suffix = `-${attempt}`;
      slug = `${base.slice(0, 64 - suffix.length)}${suffix}`;
      attempt++;
    }
    return slug;
  }
}
