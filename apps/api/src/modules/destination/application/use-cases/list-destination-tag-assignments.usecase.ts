import { Inject, Injectable } from "@nestjs/common";
import type { ListDestinationTagAssignmentsResponse } from "@zinoflow/contracts";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";

/** Man quan ly chu de — danh sach 7 tag + tag dang gan cho tung diem (destination-spec §2.4) */
@Injectable()
export class ListDestinationTagAssignmentsUseCase {
  constructor(@Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb) {}

  async execute(): Promise<ListDestinationTagAssignmentsResponse> {
    const [tags, assignments] = await Promise.all([
      this.siteDb.fetchTags(),
      this.siteDb.fetchTagAssignments(),
    ]);
    return {
      tags,
      assignments: assignments.map((a) => ({
        destinationSlug: a.destinationSlug,
        destinationName: a.destinationName,
        tagSlugs: a.tagSlugs,
      })),
    };
  }
}
