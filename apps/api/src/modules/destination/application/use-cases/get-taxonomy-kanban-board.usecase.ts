import { Inject, Injectable } from "@nestjs/common";
import type { GetTaxonomyKanbanBoardResponse } from "@zinoflow/contracts";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import { IMAGE_CHECKER, type ImageChecker } from "../ports/image-checker.port";
import {
  TAXONOMY_SUGGESTION_REPOSITORY,
  type TaxonomySuggestionRepository,
} from "../ports/taxonomy-suggestion.repository";

/**
 * Du lieu cho ban Kanban ra soat taxonomy Type (relations-plan §6.1-6.2, Giai doan B2) —
 * chi diem den kind=poi moi duoc phan loai Type (tinh/cum khong gan Type). Nguon du lieu
 * Type/Tag hoan toan tu site DB (SQL Server, chua mirror hoa sang Postgres) — rieng de
 * xuat AI (Giai doan B3) doc tu bang nhap Postgres `dichoithoi_taxonomy_suggestions`.
 */
@Injectable()
export class GetTaxonomyKanbanBoardUseCase {
  constructor(
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
    @Inject(IMAGE_CHECKER) private readonly imageChecker: ImageChecker,
    @Inject(TAXONOMY_SUGGESTION_REPOSITORY)
    private readonly suggestionRepo: TaxonomySuggestionRepository,
  ) {}

  async execute(): Promise<GetTaxonomyKanbanBoardResponse> {
    const [allDestinations, typeAssignments, taxonomy, suggestions] = await Promise.all([
      this.siteDb.fetchAllDestinations(),
      this.siteDb.fetchTypeAssignments(),
      this.siteDb.fetchTaxonomyContent(),
      this.suggestionRepo.findAll(),
    ]);

    const typeSlugsByDestinationSlug = new Map(
      typeAssignments.map((a) => [a.destinationSlug, a.typeSlugs]),
    );
    const suggestionBySlug = new Map(suggestions.map((s) => [s.destinationSlug, s]));
    const groupById = new Map(taxonomy.groups.map((g) => [g.id, g]));

    const clusters = allDestinations
      .filter((d) => d.kind === "province" || d.kind === "cluster")
      .map((d) => ({ slug: d.slug, name: d.name, kind: d.kind }));

    const destinations = allDestinations
      .filter((d) => d.kind === "poi")
      .map((d) => {
        const suggestion = suggestionBySlug.get(d.slug);
        return {
          slug: d.slug,
          name: d.name,
          parentSlug: d.parentSlug,
          imageUrl: this.imageChecker.buildUrl(d.thumbnail),
          typeSlugs: typeSlugsByDestinationSlug.get(d.slug) ?? [],
          suggestedTypeSlugs: suggestion?.suggestedTypes ?? null,
          suggestionReason: suggestion?.reason ?? null,
          suggestionStatus: suggestion?.status ?? null,
        };
      });

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
