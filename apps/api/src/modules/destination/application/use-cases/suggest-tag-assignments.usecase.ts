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
import { buildPromptLogText } from "../../../ai-content/application/services/prompt-log-text";
import { DomainRuleError } from "../../../shared/errors/app-error";
import { TAG_SUGGEST_SYSTEM, buildTagSuggestPrompt } from "../../domain/tag-suggest-prompt";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import { buildTagSuggestCandidates } from "./tag-suggest-candidates";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";

const DEFAULT_PROVIDER = "anthropic";
const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-haiku-4-5", // tac vu phan loai hang loat -> Haiku
  gemini: "gemini-3.1-flash-lite",
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
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
  ) {}

  async execute(request: SuggestTagAssignmentsRequest): Promise<SuggestTagAssignmentsResponse> {
    const [tags, assignments, mirrors] = await Promise.all([
      this.siteDb.fetchTags(),
      this.siteDb.fetchTagAssignments(),
      this.mirrorRepo.findAll(),
    ]);
    if (tags.length === 0) {
      throw new DomainRuleError(
        "Chưa có tag nào trong hệ thống — chạy phase-b-01-seed-tags.sql trước",
      );
    }

    const candidates = buildTagSuggestCandidates(assignments, mirrors, request.destinationSlugs);
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
      promptText: buildPromptLogText(TAG_SUGGEST_SYSTEM, prompt, aiTagSuggestionBatchSchema),
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
