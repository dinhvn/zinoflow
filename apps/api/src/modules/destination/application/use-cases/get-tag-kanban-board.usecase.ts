import { Inject, Injectable } from "@nestjs/common";
import type { GetTagKanbanBoardResponse } from "@zinoflow/contracts";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import { IMAGE_CHECKER, type ImageChecker } from "../ports/image-checker.port";

/**
 * Du lieu cho ban Kanban gan tay Tag theo cum/tinh (phan hoi nguoi dung 24/07/2026 —
 * muon gan tay Tag "giong nhu cum", cung trai nghiem voi Kanban Type
 * `get-taxonomy-kanban-board.usecase.ts`). Khac Type: KHONG co bang nhap Postgres
 * rieng cho goi y AI — Tag da co san flow AI-suggest+apply o `/dichoithoi/chu-de`
 * (destination-spec §2.4), Kanban nay chi them 1 cach gan TAY truc quan theo cum.
 */
@Injectable()
export class GetTagKanbanBoardUseCase {
  constructor(
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
    @Inject(IMAGE_CHECKER) private readonly imageChecker: ImageChecker,
  ) {}

  async execute(): Promise<GetTagKanbanBoardResponse> {
    const [allDestinations, tags, tagAssignments] = await Promise.all([
      this.siteDb.fetchAllDestinations(),
      this.siteDb.fetchTags(),
      this.siteDb.fetchTagAssignments(),
    ]);

    const tagSlugsByDestinationSlug = new Map(
      tagAssignments.map((a) => [a.destinationSlug, a.tagSlugs]),
    );

    const clusters = allDestinations
      .filter((d) => d.kind === "province" || d.kind === "cluster")
      .map((d) => ({ slug: d.slug, name: d.name, kind: d.kind as "province" | "cluster" }));

    const destinations = allDestinations
      .filter((d) => d.kind === "poi")
      .map((d) => ({
        slug: d.slug,
        name: d.name,
        parentSlug: d.parentSlug,
        imageUrl: this.imageChecker.buildUrl(d.thumbnail),
        tagSlugs: tagSlugsByDestinationSlug.get(d.slug) ?? [],
      }));

    return { tags, clusters, destinations };
  }
}
