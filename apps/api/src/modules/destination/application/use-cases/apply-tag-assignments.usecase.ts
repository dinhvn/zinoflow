import { Inject, Injectable } from "@nestjs/common";
import type { ApplyTagAssignmentsRequest, ApplyTagAssignmentsResponse } from "@zinoflow/contracts";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";

/**
 * Ghi ket qua da duyet (tich approve/reject) xuong v2.DestinationTagMap —
 * ghi de TOAN BO tag cua tung diem den (destination-spec §2.4 buoc 1).
 */
@Injectable()
export class ApplyTagAssignmentsUseCase {
  constructor(@Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb) {}

  async execute(request: ApplyTagAssignmentsRequest): Promise<ApplyTagAssignmentsResponse> {
    // Doc lap tung diem den — chay song song (pool SQL Server tu xep hang), khong can tuan tu.
    await Promise.all(
      request.assignments.map((a) => this.siteDb.replaceTagAssignments(a.destinationSlug, a.tagSlugs)),
    );
    return { appliedCount: request.assignments.length };
  }
}
