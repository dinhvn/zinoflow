import { Inject, Injectable } from "@nestjs/common";
import type { GetTagKanbanBoardResponse } from "@zinoflow/contracts";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import { IMAGE_CHECKER, type ImageChecker } from "../ports/image-checker.port";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";

/**
 * Du lieu cho ban Kanban gan tay Tag theo cum/tinh (phan hoi nguoi dung 24/07/2026 —
 * muon gan tay Tag "giong nhu cum", cung trai nghiem voi Kanban Type
 * `get-taxonomy-kanban-board.usecase.ts`). Khac Type: KHONG co bang nhap Postgres
 * rieng cho goi y AI — Tag da co san flow AI-suggest+apply o `/dichoithoi/chu-de`
 * (destination-spec §2.4), Kanban nay chi them 1 cach gan TAY truc quan theo cum.
 *
 * Gom them cum/diem CHUA publish (mirror.siteId=null, vd cum moi tao trong AI
 * tool) tu Postgres — phan hoi nguoi dung 26/07/2026: muon gan tag ngay ca khi
 * chua publish. Tag cua nhom nay doc/ghi qua mirror.tags (xem
 * ApplyTagAssignmentsUseCase), khong the ghi SQL Server vi chua co DestinationId.
 */
@Injectable()
export class GetTagKanbanBoardUseCase {
  constructor(
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
    @Inject(IMAGE_CHECKER) private readonly imageChecker: ImageChecker,
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
  ) {}

  async execute(): Promise<GetTagKanbanBoardResponse> {
    const [allDestinations, tags, tagAssignments, mirrors] = await Promise.all([
      this.siteDb.fetchAllDestinations(),
      this.siteDb.fetchTags(),
      this.siteDb.fetchTagAssignments(),
      this.mirrorRepo.findAll(),
    ]);

    const tagSlugsByDestinationSlug = new Map(
      tagAssignments.map((a) => [a.destinationSlug, a.tagSlugs]),
    );
    const draftMirrors = mirrors.filter((m) => m.siteId === null);

    const clusters = [
      ...allDestinations
        .filter((d) => d.kind === "province" || d.kind === "cluster")
        .map((d) => ({ slug: d.slug, name: d.name, kind: d.kind as "province" | "cluster" })),
      ...draftMirrors
        .filter((m) => m.kind === "province" || m.kind === "cluster")
        .map((m) => ({ slug: m.slug, name: m.name, kind: m.kind as "province" | "cluster" })),
    ];

    const destinations = [
      ...allDestinations
        .filter((d) => d.kind === "poi")
        .map((d) => ({
          slug: d.slug,
          name: d.name,
          parentSlug: d.parentSlug,
          imageUrl: this.imageChecker.buildUrl(d.thumbnail),
          tagSlugs: tagSlugsByDestinationSlug.get(d.slug) ?? [],
        })),
      ...draftMirrors
        .filter((m) => m.kind === "poi")
        .map((m) => ({
          slug: m.slug,
          name: m.name,
          parentSlug: m.parentSlug,
          imageUrl: this.imageChecker.buildUrl(m.thumbnail),
          tagSlugs: m.tags,
        })),
    ];

    return { tags, clusters, destinations };
  }
}
