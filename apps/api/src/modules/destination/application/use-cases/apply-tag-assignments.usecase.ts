import { Inject, Injectable } from "@nestjs/common";
import type { ApplyTagAssignmentsRequest, ApplyTagAssignmentsResponse } from "@zinoflow/contracts";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";

/**
 * Ghi ket qua da duyet (tich approve/reject) tag cho tung diem den (destination-spec
 * §2.4 buoc 1) — ghi de TOAN BO tag hien co.
 * Diem CHUA publish (siteId=null, vd cum moi tao trong AI tool) khong co
 * DestinationId ben SQL Server de tro FK v2.DestinationTagMap, nen ghi tam vao
 * cot mirror `tags` (Postgres) — PublishDestinationUseCase se day sang SQL
 * Server khi publish lan dau (phan hoi nguoi dung 26/07/2026).
 */
@Injectable()
export class ApplyTagAssignmentsUseCase {
  constructor(
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
  ) {}

  async execute(request: ApplyTagAssignmentsRequest): Promise<ApplyTagAssignmentsResponse> {
    // Doc lap tung diem den — chay song song (pool SQL Server tu xep hang), khong can tuan tu.
    await Promise.all(
      request.assignments.map(async (a) => {
        const mirror = await this.mirrorRepo.findBySlug(a.destinationSlug);
        if (mirror && mirror.siteId === null) {
          await this.mirrorRepo.setTags(a.destinationSlug, a.tagSlugs);
          return;
        }
        await this.siteDb.replaceTagAssignments(a.destinationSlug, a.tagSlugs);
      }),
    );
    return { appliedCount: request.assignments.length };
  }
}
