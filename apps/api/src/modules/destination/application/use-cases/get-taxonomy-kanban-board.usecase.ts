import { Inject, Injectable } from "@nestjs/common";
import type { GetTaxonomyKanbanBoardResponse } from "@zinoflow/contracts";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import { IMAGE_CHECKER, type ImageChecker } from "../ports/image-checker.port";

/**
 * Du lieu cho ban Kanban ra soat taxonomy Type (relations-plan §6.1-6.2, Giai doan B2) —
 * chi diem den kind=poi moi duoc phan loai Type (tinh/cum khong gan Type). Nguon du lieu
 * hoan toan tu site DB (SQL Server) — Type/Tag chua mirror hoa sang Postgres.
 */
@Injectable()
export class GetTaxonomyKanbanBoardUseCase {
  constructor(
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
    @Inject(IMAGE_CHECKER) private readonly imageChecker: ImageChecker,
  ) {}

  async execute(): Promise<GetTaxonomyKanbanBoardResponse> {
    const [allDestinations, typeAssignments, taxonomy] = await Promise.all([
      this.siteDb.fetchAllDestinations(),
      this.siteDb.fetchTypeAssignments(),
      this.siteDb.fetchTaxonomyContent(),
    ]);

    const typeSlugsByDestinationSlug = new Map(
      typeAssignments.map((a) => [a.destinationSlug, a.typeSlugs]),
    );
    const groupById = new Map(taxonomy.groups.map((g) => [g.id, g]));

    const clusters = allDestinations
      .filter((d) => d.kind === "province" || d.kind === "cluster")
      .map((d) => ({ slug: d.slug, name: d.name, kind: d.kind }));

    const destinations = allDestinations
      .filter((d) => d.kind === "poi")
      .map((d) => ({
        slug: d.slug,
        name: d.name,
        parentSlug: d.parentSlug,
        imageUrl: this.imageChecker.buildUrl(d.thumbnail),
        typeSlugs: typeSlugsByDestinationSlug.get(d.slug) ?? [],
      }));

    const types = taxonomy.types.map((t) => {
      const group = groupById.get(t.groupId);
      return {
        id: t.id,
        slug: t.slug,
        name: t.name,
        groupSlug: group?.slug ?? "",
        groupName: group?.name ?? "",
      };
    });

    return {
      groups: taxonomy.groups.map((g) => ({ slug: g.slug, name: g.name })),
      types,
      clusters,
      destinations,
    };
  }
}
