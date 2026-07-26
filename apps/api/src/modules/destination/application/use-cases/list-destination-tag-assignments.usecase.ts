import { Inject, Injectable } from "@nestjs/common";
import type { ListDestinationTagAssignmentsResponse } from "@zinoflow/contracts";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";

/**
 * Man quan ly chu de — danh sach 7 tag + tag dang gan cho tung diem (destination-spec §2.4).
 * Gom them POI CHUA publish (mirror.siteId=null) — tag cua nhom nay o mirror.tags
 * (xem ApplyTagAssignmentsUseCase), khong nam trong fetchTagAssignments() (SQL Server
 * WHERE Status=1) nen se bi mat tich khoi list neu khong merge (phan hoi nguoi dung 26/07/2026).
 */
@Injectable()
export class ListDestinationTagAssignmentsUseCase {
  constructor(
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
  ) {}

  async execute(): Promise<ListDestinationTagAssignmentsResponse> {
    const [tags, assignments, mirrors] = await Promise.all([
      this.siteDb.fetchTags(),
      this.siteDb.fetchTagAssignments(),
      this.mirrorRepo.findAll(),
    ]);
    const draftAssignments = mirrors
      .filter((m) => m.kind === "poi" && m.siteId === null)
      .map((m) => ({ destinationSlug: m.slug, destinationName: m.name, tagSlugs: m.tags }));
    return {
      tags,
      assignments: [
        ...assignments.map((a) => ({
          destinationSlug: a.destinationSlug,
          destinationName: a.destinationName,
          tagSlugs: a.tagSlugs,
        })),
        ...draftAssignments,
      ],
    };
  }
}
