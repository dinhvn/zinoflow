import { Inject, Injectable } from "@nestjs/common";
import {
  aiProviderKeySchema,
  aiTagSuggestionBatchSchema,
  type SuggestTagAssignmentsRequest,
  type SuggestTagAssignmentsResponse,
} from "@zinoflow/contracts";
import {
  AI_PROVIDER_REGISTRY,
  type AiProviderRegistry,
} from "../../../ai-content/application/ports/content-ai-provider.port";
import { AI_USAGE_RECORDER, type AiUsageRecorder } from "../../../ai-content/application/ports/ai-usage-recorder.port";
import { DomainRuleError } from "../../../shared/errors/app-error";
import { TAG_SUGGEST_SYSTEM, buildTagSuggestPrompt } from "../../domain/tag-suggest-prompt";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";

const DEFAULT_PROVIDER = "anthropic";
const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-haiku-4-5", // tac vu phan loai hang loat -> Haiku
  gemini: "gemini-2.5-flash-lite",
  openai: "gpt-4o-mini",
};

/**
 * Buoc 1 (destination-spec §2.4) — AI goi y gan tag hang loat cho cac diem den
 * CHUA co tag nao (hoac danh sach chi dinh). CHI tra ve goi y kem ly do,
 * KHONG ghi DB — nguoi dung duyet tung dong roi goi ApplyTagAssignmentsUseCase.
 */
@Injectable()
export class SuggestTagAssignmentsUseCase {
  constructor(
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
    @Inject(AI_PROVIDER_REGISTRY) private readonly registry: AiProviderRegistry,
    @Inject(AI_USAGE_RECORDER) private readonly usage: AiUsageRecorder,
  ) {}

  async execute(request: SuggestTagAssignmentsRequest): Promise<SuggestTagAssignmentsResponse> {
    const [tags, assignments] = await Promise.all([
      this.siteDb.fetchTags(),
      this.siteDb.fetchTagAssignments(),
    ]);
    if (tags.length === 0) {
      throw new DomainRuleError(
        "Chưa có tag nào trong hệ thống — chạy phase-b-01-seed-tags.sql trước",
      );
    }

    const requestedSlugs = request.destinationSlugs?.length ? new Set(request.destinationSlugs) : null;
    const candidates = assignments.filter((a) =>
      requestedSlugs ? requestedSlugs.has(a.destinationSlug) : a.tagSlugs.length === 0,
    );
    if (candidates.length === 0) {
      return { suggestions: [] };
    }

    const providerKey = aiProviderKeySchema.parse(request.aiProvider ?? DEFAULT_PROVIDER);
    const model = request.aiModel ?? DEFAULT_MODELS[providerKey] ?? DEFAULT_MODELS[DEFAULT_PROVIDER]!;
    const provider = this.registry.resolve(providerKey);

    const prompt = buildTagSuggestPrompt(tags, candidates);

    const { output, usage } = await provider.generateStructured(
      {
        model,
        operation: "suggest-destination-tags",
        system: TAG_SUGGEST_SYSTEM,
        prompt,
        maxTokens: 4_000,
        vars: { topic: "destination-tag-suggestion", articleType: "guide-diem-den-suggest" },
      },
      aiTagSuggestionBatchSchema,
    );

    await this.usage.record({
      jobId: null,
      provider: provider.key,
      model,
      operation: "suggest-destination-tags",
      ...usage,
      promptText: `${TAG_SUGGEST_SYSTEM}\n\n${prompt}`,
      responseText: JSON.stringify(output),
    });

    const validSlugs = new Set(tags.map((t) => t.slug));
    const validDestinations = new Set(candidates.map((c) => c.destinationSlug));
    return {
      suggestions: output.suggestions
        .filter((s) => validDestinations.has(s.destinationSlug))
        .map((s) => ({
          ...s,
          tagSlugs: s.tagSlugs.filter((slug) => validSlugs.has(slug)),
        })),
    };
  }
}
