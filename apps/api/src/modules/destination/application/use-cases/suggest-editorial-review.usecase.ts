import { Inject, Injectable } from "@nestjs/common";
import { suggestEditorialReviewResponseSchema, type SuggestEditorialReviewResponse } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import {
  AI_PROVIDER_REGISTRY,
  type AiProviderRegistry,
} from "../../../ai-content/application/ports/content-ai-provider.port";
import { AI_USAGE_RECORDER, type AiUsageRecorder } from "../../../ai-content/application/ports/ai-usage-recorder.port";

const DEFAULT_PROVIDER = "anthropic";
const DEFAULT_MODEL = "claude-haiku-4-5"; // tac vu nhe -> Haiku (spec §5)

const SYSTEM = [
  "Bạn là biên tập viên du lịch Việt Nam.",
  "Luôn trả lời bằng tiếng Việt có dấu đầy đủ.",
  "Đây là NHẬN ĐỊNH/Ý KIẾN của đội biên tập, KHÔNG phải chấm điểm khách hàng.",
  "TUYỆT ĐỐI KHÔNG bịa số liệu/sự kiện cụ thể ngoài nội dung đã cho.",
].join(" ");

/**
 * AI goi y ban nhap "Đánh giá biên tập" (content-seo-ux-plan §10.6.2, Phase
 * 28.0) — 1 doan ngan the hien nhan dinh cua doi bien tap ve diem den (khac
 * han AggregateRating). CHI goi y, KHONG luu — nguoi dung xem/sua truoc khi
 * goi UpdateEditorialReviewUseCase.
 */
@Injectable()
export class SuggestEditorialReviewUseCase {
  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
    @Inject(AI_PROVIDER_REGISTRY) private readonly registry: AiProviderRegistry,
    @Inject(AI_USAGE_RECORDER) private readonly usage: AiUsageRecorder,
  ) {}

  async execute(slug: string): Promise<SuggestEditorialReviewResponse> {
    const destination = await this.mirrorRepo.findBySlug(slug);
    if (!destination) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${slug}" trong mirror`);
    }

    const content =
      destination.siteId !== null
        ? await this.siteDb.fetchDestinationContent(destination.siteId)
        : null;

    const context = [
      `Tên: ${destination.name}`,
      destination.shortDescription ? `Mô tả ngắn: ${destination.shortDescription}` : null,
      content?.food ? `Ăn uống: ${stripHtml(content.food)}` : null,
      content?.transport ? `Di chuyển: ${stripHtml(content.transport)}` : null,
      content?.tip ? `Mẹo: ${stripHtml(content.tip)}` : null,
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n");

    const prompt = [
      `Dựa trên thông tin sau về điểm đến "${destination.name}":`,
      context,
      "",
      "Viết 1 đoạn nhận định ngắn (2-4 câu, ~200-400 ký tự) thể hiện góc nhìn của đội biên tập",
      "về điểm đến này — điều gì đáng chú ý, ai nên/không nên đến. Không lặp lại y nguyên mô tả",
      "ngắn đã có, không bịa chi tiết ngoài thông tin trên.",
    ].join("\n");

    const provider = this.registry.resolve(DEFAULT_PROVIDER);
    const { output, usage } = await provider.generateStructured(
      {
        model: DEFAULT_MODEL,
        operation: "suggest-editorial-review",
        system: SYSTEM,
        prompt,
        maxTokens: 500,
        vars: { topic: destination.name, articleType: "guide-diem-den-suggest" },
      },
      suggestEditorialReviewResponseSchema,
    );

    await this.usage.record({
      jobId: null,
      provider: provider.key,
      model: DEFAULT_MODEL,
      operation: "suggest-editorial-review",
      ...usage,
      promptText: `${SYSTEM}\n\n${prompt}`,
      responseText: JSON.stringify(output),
    });
    return output;
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
