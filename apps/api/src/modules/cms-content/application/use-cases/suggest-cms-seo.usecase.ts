import { Inject, Injectable } from "@nestjs/common";
import {
  aiProviderKeySchema,
  cmsSeoSuggestionSchema,
  khuyenmaiPostTypeLabel,
  khuyenmaiSiteFromId,
  type CmsSeoSuggestion,
  type SuggestCmsSeoRequest,
} from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import { stripHtml } from "../../../shared/text/strip-html";
import {
  AI_PROVIDER_REGISTRY,
  type AiProviderRegistry,
} from "../../../ai-content/application/ports/content-ai-provider.port";
import {
  AI_USAGE_RECORDER,
  type AiUsageRecorder,
} from "../../../ai-content/application/ports/ai-usage-recorder.port";
import {
  CMS_POST_MIRROR_REPOSITORY,
  type CmsPostMirrorRepository,
} from "../ports/cms-post-mirror.repository";
import { KHUYENMAI_CMS_DB, type KhuyenMaiCmsDb } from "../ports/khuyenmai-cms-db.port";

/** Provider/model mac dinh — Anthropic primary; tac vu nhe -> Haiku (spec §5). */
const DEFAULT_PROVIDER = "anthropic";
const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-haiku-4-5",
  gemini: "gemini-2.5-flash-lite",
  openai: "gpt-4o-mini",
};

const MAX_CONTENT_CHARS = 6_000;

const SYSTEM = [
  "Bạn là chuyên gia SEO content tiếng Việt.",
  "Luôn trả lời bằng tiếng Việt có dấu đầy đủ.",
  "Viết mô tả meta hấp dẫn, tự nhiên, KHÔNG nhồi nhét từ khoá, KHÔNG bịa số liệu/giá.",
].join(" ");

/**
 * AI goi y mo ta SEO (meta description) cho 1 bai CMS khuyenmai — dua tren tieu de + noi dung.
 * Tac vu nhe (Haiku); di qua IContentAIProvider; ghi ai_usage_logs (jobId=null).
 */
@Injectable()
export class SuggestCmsSeoUseCase {
  constructor(
    @Inject(CMS_POST_MIRROR_REPOSITORY) private readonly mirror: CmsPostMirrorRepository,
    @Inject(KHUYENMAI_CMS_DB) private readonly cmsDb: KhuyenMaiCmsDb,
    @Inject(AI_PROVIDER_REGISTRY) private readonly registry: AiProviderRegistry,
    @Inject(AI_USAGE_RECORDER) private readonly usage: AiUsageRecorder,
  ) {}

  async execute(cmsId: number, request: SuggestCmsSeoRequest): Promise<CmsSeoSuggestion> {
    const post = await this.mirror.findByCmsId(cmsId);
    if (!post) {
      throw new DomainRuleError(`Không tìm thấy bài CMS #${cmsId}`, ["Bấm Đồng bộ từ CMS rồi thử lại"]);
    }

    const body = await this.cmsDb.fetchPostContent(cmsId).catch(() => null);
    // Bo tag CMS [..] khoi ngu canh de AI khong dua tag vao mo ta SEO.
    const plain = stripHtml(body?.fixedContent ?? "")
      .replace(/\[[^\]]+\]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_CONTENT_CHARS);

    const site = khuyenmaiSiteFromId(post.siteId) ?? "laruki";
    const niche =
      site === "dochoi3s"
        ? "website đồ chơi trẻ em (nhấn độ tuổi, an toàn, lợi ích phát triển)"
        : "website thời trang/mỹ phẩm (nhấn phong cách, ưu đãi, xu hướng)";

    const prompt = [
      `Website: ${site} — ${niche}.`,
      `Loại bài: ${khuyenmaiPostTypeLabel(post.postType)}.`,
      `Tiêu đề: "${post.title}".`,
      plain ? `Nội dung bài (rút gọn):\n${plain}` : "(Bài chưa có nội dung — viết dựa trên tiêu đề.)",
      "",
      "Hãy viết description: 1 câu mô tả meta chuẩn SEO, ~120-160 ký tự, hấp dẫn,",
      "chứa từ khoá chính tự nhiên, kêu gọi đọc/khám phá, không nêu giá cụ thể.",
    ].join("\n");

    const providerKey = aiProviderKeySchema.parse(request.aiProvider ?? DEFAULT_PROVIDER);
    const model = request.aiModel ?? DEFAULT_MODELS[providerKey] ?? DEFAULT_MODELS[DEFAULT_PROVIDER]!;
    const provider = this.registry.resolve(providerKey);

    const { output, usage } = await provider.generateStructured(
      {
        model,
        operation: "cms-seo-description",
        system: SYSTEM,
        prompt,
        maxTokens: 600,
        vars: { topic: post.title, articleType: "km-seo-description" },
      },
      cmsSeoSuggestionSchema,
    );

    await this.usage.record({
      jobId: null,
      provider: provider.key,
      model,
      operation: "cms-seo-description",
      ...usage,
      promptText: `${SYSTEM}\n\n${prompt}`,
      responseText: JSON.stringify(output),
    });
    return output;
  }
}
