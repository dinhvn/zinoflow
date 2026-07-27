import { Inject, Injectable } from "@nestjs/common";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  CLUSTER_POI_BACKUP_REPOSITORY,
  type ClusterPoiBackupRepository,
} from "../ports/cluster-poi-backup.repository";

/**
 * Bo han 1 dong backup (man "Backup còn lại", GD7 plan-lam-moi-du-lieu-atlas.md) —
 * nguoi dung xac nhan KHONG can khoi phuc diem nay (vd trung lap that/khong con
 * gia tri), ghi ly do de sau nay tra cuu lai neu can.
 */
@Injectable()
export class SkipClusterPoiBackupUseCase {
  constructor(
    @Inject(CLUSTER_POI_BACKUP_REPOSITORY)
    private readonly backupRepo: ClusterPoiBackupRepository,
  ) {}

  async execute(backupSlug: string, note: string): Promise<{ ok: true }> {
    const backup = await this.backupRepo.findBySlug(backupSlug);
    if (!backup) {
      throw new DomainRuleError(`Không tìm thấy dòng backup "${backupSlug}"`);
    }
    await this.backupRepo.markSkipped(backupSlug, note);
    return { ok: true };
  }
}
