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
import { stripHtml } from "../../../shared/text/strip-html";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import {
  TAXONOMY_SUGGESTION_REPOSITORY,
  type TaxonomySuggestionRepository,
} from "../ports/taxonomy-suggestion.repository";

const DEFAULT_PROVIDER = "anthropic";
const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-haiku-4-5", // tac vu phan loai hang loat -> Haiku
  gemini: "gemini-2.5-flash-lite",
  openai: "gpt-4o-mini",
};

// Du de AI hieu ngu canh, khong can toan bo bai (tranh vuot ngan sach token khi 1 cum co ~40 diem)
const MAX_CONTENT_CHARS = 500;

const SYSTEM = [
  "Bạn là biên tập viên du lịch Việt Nam, đang rà soát lại loại hình (Type) của điểm đến.",
  "Luôn trả lời bằng tiếng Việt có dấu đầy đủ.",
  "CHỈ dựa vào tên và nội dung mô tả đã cho — KHÔNG bịa thông tin không có trong đó.",
  "Một điểm đến có thể thuộc nhiều loại hình cùng lúc — chỉ chọn loại thực sự đúng bản chất nơi chốn.",
  "reason phải ngắn gọn (1 câu), nêu rõ vì sao chọn (hoặc đổi) loại đó.",
].join(" ");

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
    const typeList = taxonomy.types
      .map((t) => `- ${t.slug}: "${t.name}"`)
      .join("\n");
    const destinationList = candidates
      .map((c) => {
        const raw = contentBySlug.get(c.slug);
        const content = raw ? stripHtml(raw).slice(0, MAX_CONTENT_CHARS) : "";
        return `- ${c.slug}: "${c.name}"${content ? ` — ${content}` : " — (chưa có nội dung)"}`;
      })
      .join("\n");

    const providerKey = aiProviderKeySchema.parse(request.aiProvider ?? DEFAULT_PROVIDER);
    const model = request.aiModel ?? DEFAULT_MODELS[providerKey] ?? DEFAULT_MODELS[DEFAULT_PROVIDER]!;
    const provider = this.registry.resolve(providerKey);

    const prompt = [
      "Danh sách loại hình chuẩn (slug: tên):",
      typeList,
      "",
      "Danh sách điểm đến cần đánh giá lại (slug: tên — nội dung):",
      destinationList,
      "",
      "Với MỖI điểm đến, đề xuất 1 hoặc nhiều suggestedTypeSlugs phù hợp nhất",
      "(chỉ dùng slug có trong danh sách loại hình trên) kèm reason ngắn.",
    ].join("\n");

    const { output, usage } = await provider.generateStructured(
      {
        model,
        operation: "suggest-taxonomy-types",
        system: SYSTEM,
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
      promptText: `${SYSTEM}\n\n${prompt}`,
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
