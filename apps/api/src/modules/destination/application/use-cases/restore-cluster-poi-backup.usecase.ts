import { Inject, Injectable } from "@nestjs/common";
import type { RestoreClusterPoiBackupResponse } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { RestoreClusterPoiBackupService } from "../services/restore-cluster-poi-backup.service";

/**
 * Khoi phuc TAY 1 dong backup tu man "Backup còn lại" (GD7 plan-lam-moi-du-lieu-atlas.md)
 * — khac AcceptClusterPoiCandidatesUseCase (khoi phuc QUA bang duyet AI, GD6): o day
 * nguoi dung tu chon dich (khong can AI tim ra truoc), giu nguyen ten/mo ta/priority
 * cua backup (khong co "ban AI" nao de so sanh).
 */
@Injectable()
export class RestoreClusterPoiBackupUseCase {
  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    private readonly restoreBackup: RestoreClusterPoiBackupService,
  ) {}

  async execute(backupSlug: string, targetClusterSlug: string): Promise<RestoreClusterPoiBackupResponse> {
    const target = await this.mirrorRepo.findBySlug(targetClusterSlug);
    if (!target) {
      throw new DomainRuleError(`Không tìm thấy cụm đích "${targetClusterSlug}"`);
    }
    if (target.kind !== "cluster") {
      throw new DomainRuleError(`"${targetClusterSlug}" không phải Cụm`);
    }

    const newSlug = await this.restoreBackup.execute(backupSlug, targetClusterSlug);
    if (!newSlug) {
      throw new DomainRuleError(
        `Không tìm thấy dòng backup "${backupSlug}" hoặc đã được khôi phục trước đó`,
      );
    }
    return { newSlug };
  }
}
