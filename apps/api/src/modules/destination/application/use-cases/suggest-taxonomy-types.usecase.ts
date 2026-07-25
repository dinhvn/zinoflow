import { Inject, Injectable } from "@nestjs/common";
import {
  aiProviderKeySchema,
  aiTaxonomyTypeSuggestionBatchSchema,
  type SuggestTaxonomyTypesRequest,
  type SuggestTaxonomyTypesResponse,
} from "@zinoflow/contracts";
import {
  AI_PROVIDER_REGISTRY,
  type AiProviderRegistry,
} from "../../../ai-content/application/ports/content-ai-provider.port";
import { AI_USAGE_RECORDER, type AiUsageRecorder } from "../../../ai-content/application/ports/ai-usage-recorder.port";
import {
  TAXONOMY_TYPE_SUGGEST_SYSTEM,
  buildTaxonomyTypeSuggestPrompt,
} from "../../domain/taxonomy-type-suggest-prompt";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import {
  TAXONOMY_SUGGESTION_REPOSITORY,
  type TaxonomySuggestionRepository,
} from "../ports/taxonomy-suggestion.repository";

const DEFAULT_PROVIDER = "anthropic";
const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-haiku-4-5", // tac vu phan loai hang loat -> Haiku
  gemini: "gemini-3.1-flash-lite",
  openai: "gpt-4o-mini",
};

/**
 * Buoc 2 (relations-plan §6.3, Giai doan B3) — AI danh gia lai Type cho TOAN BO
 * diem den trong 1 cum/tinh (ca diem DA co Type cu, khong chi diem chua phan loai
 * — du lieu cu co the sai, vd Vinh Ha Long tung bi gan "Di tich lich su").
 * CHI luu vao bang nhap dichoithoi_taxonomy_suggestions, KHONG ghi thang
 * v2.DestinationTypeMap. Diem da status=accepted (nguoi dung da xu ly) duoc bo qua,
 * tranh de xuat lai vo ich.
 */
@Injectable()
export class SuggestTaxonomyTypesUseCase {
  constructor(
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
    @Inject(TAXONOMY_SUGGESTION_REPOSITORY)
    private readonly suggestionRepo: TaxonomySuggestionRepository,
    @Inject(AI_PROVIDER_REGISTRY) private readonly registry: AiProviderRegistry,
    @Inject(AI_USAGE_RECORDER) private readonly usage: AiUsageRecorder,
  ) {}

  async execute(request: SuggestTaxonomyTypesRequest): Promise<SuggestTaxonomyTypesResponse> {
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
      (d) => d.kind === "poi" && d.parentSlug === request.clusterSlug && !acceptedSlugs.has(d.slug),
    );
    if (candidates.length === 0) {
      return { suggestions: [] };
    }

    const contentBySlug = new Map(contentRows.map((c) => [c.slug, c.contentHtml]));
    // Sau B1, v2.DestinationType chi con dung 16 loai-hinh-place (2 tag trai nghiem
    // da chuyen sang DestinationTag) — dung thang, khong can loc gi them.
    const prompt = buildTaxonomyTypeSuggestPrompt(taxonomy.types, candidates, contentBySlug);

    const providerKey = aiProviderKeySchema.parse(request.aiProvider ?? DEFAULT_PROVIDER);
    const model = request.aiModel ?? DEFAULT_MODELS[providerKey] ?? DEFAULT_MODELS[DEFAULT_PROVIDER]!;
    const provider = this.registry.resolve(providerKey);

    const { output, usage } = await provider.generateStructured(
      {
        model,
        operation: "suggest-taxonomy-types",
        system: TAXONOMY_TYPE_SUGGEST_SYSTEM,
        prompt,
        maxTokens: 4_000,
        vars: { topic: "taxonomy-type-suggestion", articleType: "guide-diem-den-suggest" },
      },
      aiTaxonomyTypeSuggestionBatchSchema,
    );

    await this.usage.record({
      jobId: null,
      provider: provider.key,
      model,
      operation: "suggest-taxonomy-types",
      ...usage,
      promptText: `${TAXONOMY_TYPE_SUGGEST_SYSTEM}\n\n${prompt}`,
      responseText: JSON.stringify(output),
    });

    const validTypeSlugs = new Set(taxonomy.types.map((t) => t.slug));
    const validDestinationSlugs = new Set(candidates.map((c) => c.slug));
    const suggestions = output.suggestions
      .filter((s) => validDestinationSlugs.has(s.destinationSlug))
      .map((s) => ({
        ...s,
        suggestedTypeSlugs: s.suggestedTypeSlugs.filter((slug) => validTypeSlugs.has(slug)),
      }));

    await this.suggestionRepo.upsertMany(
      suggestions.map((s) => ({
        destinationSlug: s.destinationSlug,
        suggestedTypes: s.suggestedTypeSlugs,
        reason: s.reason,
      })),
    );

    return { suggestions };
  }
}
