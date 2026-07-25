import { Inject, Injectable } from "@nestjs/common";
import type { PreviewPromptResponse } from "@zinoflow/contracts";
import {
  TAXONOMY_TYPE_SUGGEST_SYSTEM,
  buildTaxonomyTypeSuggestPrompt,
} from "../../domain/taxonomy-type-suggest-prompt";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import {
  TAXONOMY_SUGGESTION_REPOSITORY,
  type TaxonomySuggestionRepository,
} from "../ports/taxonomy-suggestion.repository";

/**
 * Dung prompt se gui AI cho `SuggestTaxonomyTypesUseCase` (cung 1 cum/tinh) —
 * KHONG goi AI that, chi de nguoi dung xem truoc noi dung/kiem tra du lieu nguon
 * (phan hoi nguoi dung 24/07/2026: "cho nao cung co the... xem truoc prompt").
 * Dung LAI dung 1 logic loc candidate voi ban that de xem dung "prompt neu bam
 * Goi y AI ngay bay gio" — khong phai ban rut gon.
 */
@Injectable()
export class PreviewTaxonomyTypeSuggestPromptUseCase {
  constructor(
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
    @Inject(TAXONOMY_SUGGESTION_REPOSITORY)
    private readonly suggestionRepo: TaxonomySuggestionRepository,
  ) {}

  async execute(clusterSlug: string): Promise<PreviewPromptResponse> {
    const [allDestinations, contentRows, taxonomy, existingSuggestions] = await Promise.all([
      this.siteDb.fetchAllDestinations(),
      this.siteDb.fetchAllContentRows(),
      this.siteDb.fetchTaxonomyContent(),
      this.suggestionRepo.findAll(),
    ]);

    const acceptedSlugs = new Set(
      existingSuggestions.filter((s) => s.status === "accepted").map((s) => s.destinationSlug),
    );
    const candidates = allDestinations.filter(
      (d) => d.kind === "poi" && d.parentSlug === clusterSlug && !acceptedSlugs.has(d.slug),
    );
    const contentBySlug = new Map(contentRows.map((c) => [c.slug, c.contentHtml]));
    const prompt = buildTaxonomyTypeSuggestPrompt(taxonomy.types, candidates, contentBySlug);

    return {
      sections: [
        { title: "System prompt", text: TAXONOMY_TYPE_SUGGEST_SYSTEM },
        {
          title: `Prompt (${candidates.length} điểm đến trong cụm)`,
          text: prompt,
        },
      ],
    };
  }
}
