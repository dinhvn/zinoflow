import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  aiProviderKeySchema,
  contentSectionSchema,
  DESTINATION_BLOCK_LABELS,
  DESTINATION_SECTION_ORDER,
  type ContentSection,
  type DestinationArticle,
  type DestinationBlockKey,
  type GenerateDestinationBlockRequest,
} from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { PromptBuilder } from "../../../ai-content/application/services/prompt-builder";
import {
  AI_PROVIDER_REGISTRY,
  type AiProviderRegistry,
} from "../../../ai-content/application/ports/content-ai-provider.port";
import { AI_USAGE_RECORDER, type AiUsageRecorder } from "../../../ai-content/application/ports/ai-usage-recorder.port";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";
import { POI_DISTANCE_REPOSITORY, type PoiDistanceRepository } from "../ports/poi-distance.repository";
import { clusterDistanceKey, formatDistanceBadge } from "../../domain/related-builder";
import { KIND_LABELS } from "../../domain/destination-mirror";

const SITE_CODE = "dichoithoi";
const DEFAULT_PROVIDER = "anthropic";
/** Cung tam voi job AI toan bai — sinh 1 block van can chat luong Opus, khong ha xuong Haiku. */
const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-opus-4-8",
  gemini: "gemini-2.5-pro",
  openai: "gpt-default",
};
const MAX_RELATED_IN_PROMPT = 15;

/**
 * AI tao goi y cho DUNG 1 block (khong tao ContentJob/ContentDraft) — pivot gop
 * editor vao trang detail, phan "AI ho tro tung block" thay vi luon generate ca
 * bai. Tra thang goi y JSON cho FE giu o state cuc bo; FE tu merge vao draftArticle
 * roi goi PATCH luu tay khi nguoi dung bam Duyet (khong tu dong ghi de).
 */
@Injectable()
export class GenerateDestinationBlockUseCase {
  private readonly logger = new Logger(GenerateDestinationBlockUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    private readonly promptBuilder: PromptBuilder,
    @Inject(AI_PROVIDER_REGISTRY) private readonly registry: AiProviderRegistry,
    @Inject(AI_USAGE_RECORDER) private readonly usage: AiUsageRecorder,
    @Inject(POI_DISTANCE_REPOSITORY) private readonly poiDistanceRepo: PoiDistanceRepository,
  ) {}

  async execute(
    slug: string,
    blockKey: DestinationBlockKey,
    request: GenerateDestinationBlockRequest,
  ): Promise<ContentSection> {
    const all = await this.mirrorRepo.findAll();
    const destination = all.find((d) => d.slug === slug);
    if (!destination) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${slug}" trong mirror`);
    }
    if (!DESTINATION_SECTION_ORDER.includes(blockKey as (typeof DESTINATION_SECTION_ORDER)[number])) {
      throw new DomainRuleError(`Khối "${blockKey}" không phải 1 trong 7 khối nội dung cố định`);
    }

    const providerKey = aiProviderKeySchema.parse(request.aiProvider ?? DEFAULT_PROVIDER);
    const model = request.aiModel ?? DEFAULT_MODELS[providerKey] ?? DEFAULT_MODELS[DEFAULT_PROVIDER]!;
    const provider = this.registry.resolve(providerKey);

    const draft = destination.draftArticle as Partial<DestinationArticle> | null;
    const title = (draft?.title?.trim() || destination.name) as string;
    const sectionHeading =
      draft?.sections?.find((s) => s.blockKey === blockKey)?.heading ?? DESTINATION_BLOCK_LABELS[blockKey];

    const outline = {
      title,
      sectionHeadings: DESTINATION_SECTION_ORDER.map((k) => DESTINATION_BLOCK_LABELS[k]),
    };

    const promptRequest = await this.promptBuilder.buildSection(
      {
        model,
        articleType: "guide-diem-den",
        topic: destination.name,
        siteCode: SITE_CODE,
        keywordSeed: [destination.name],
        toneProfile: null,
        sourceContext: await this.buildSourceContext(destination, all),
        products: [],
        contentTier: destination.contentTier,
      },
      outline,
      sectionHeading,
    );

    const { output, usage } = await provider.generateStructured(promptRequest, contentSectionSchema);
    // Bat buoc dung dung blockKey nguoi dung yeu cau, khong tin AI tu gan lai
    // (tranh lech vi tri khi ghep vao draftArticle).
    const section: ContentSection = { ...output, blockKey };

    await this.usage.record({
      jobId: null,
      provider: provider.key,
      model,
      operation: `generate-block-${blockKey}`,
      ...usage,
      promptText: `${promptRequest.system}\n\n${promptRequest.prompt}`,
      responseText: JSON.stringify(output),
    });
    this.logger.log(`Tao goi y AI cho block "${blockKey}" cua ${slug}`);
    return section;
  }

  /**
   * Ngu canh rut gon (khong fetch lai referenceUrls) — du de sinh 1 block mach lac.
   * Truoc 25/07/2026 THIEU aiReferenceSummary/khoang cach that/gio mo cua/gia ve —
   * lech han so voi CreateDestinationJobUseCase.buildSourceContext (sinh ca bai),
   * khien AI ho tro tung block khong thay duoc du lieu da trich xuat qua skill
   * dichoithoi-extract-destination-info (vd dalat-fairytale-land) khi nguoi dung
   * chi bam "AI goi y" cho rieng 1 khoi — bo sung cho khop.
   */
  private async buildSourceContext(
    destination: DestinationMirrorEntity,
    all: DestinationMirrorEntity[],
  ): Promise<string> {
    const parts: string[] = ["## Dữ liệu điểm đến (nguồn sự thật)"];
    parts.push(`- Tên: ${destination.name}`);
    parts.push(`- Loại điểm đến: ${KIND_LABELS[destination.kind] ?? destination.kind}`);
    if (destination.addressNew) parts.push(`- Địa chỉ mới (sau sáp nhập): ${destination.addressNew}`);
    if (destination.addressOld) parts.push(`- Địa chỉ cũ (trước sáp nhập): ${destination.addressOld}`);
    if (destination.openingHours?.note) parts.push(`- Giờ mở cửa: ${destination.openingHours.note}`);
    if (destination.priceBreakdown?.length) {
      parts.push(
        `- Giá vé: ${destination.priceBreakdown
          .map((p) => `${p.audience} ${p.price.toLocaleString("vi-VN")}đ${p.note ? ` (${p.note})` : ""}`)
          .join("; ")}`,
      );
    }

    const related = all
      .filter(
        (d) =>
          d.slug !== destination.slug &&
          d.provinceCode !== null &&
          d.provinceCode === destination.provinceCode &&
          d.siteStatus === 1,
      )
      .slice(0, MAX_RELATED_IN_PROMPT);
    if (related.length > 0) {
      // Cung logic voi CreateDestinationJobUseCase — nhac so km THAT (dichoithoi_poi_distances)
      // khi da co, khong bia so cho diem chua tinh khoang cach.
      const poiDistancePairs = await this.poiDistanceRepo.findAll();
      const poiDistances = new Map(
        poiDistancePairs.map((p) => [clusterDistanceKey(p.poiASlug, p.poiBSlug), p.distanceMeters]),
      );
      parts.push("", "## Điểm đến liên quan cùng khu vực (dùng đúng TÊN CHUẨN khi nhắc tới)");
      parts.push(
        related
          .map((d) => {
            const meters = poiDistances.get(clusterDistanceKey(destination.slug, d.slug));
            return meters === undefined ? `- ${d.name}` : `- ${d.name} (${formatDistanceBadge(meters)})`;
          })
          .join("\n"),
      );
    }

    const draft = destination.draftArticle as Partial<DestinationArticle> | null;
    const otherSections = draft?.sections?.filter((s) => s.content?.trim());
    if (otherSections && otherSections.length > 0) {
      parts.push("", "## Các block khác đã có (giữ mạch bài, KHÔNG lặp nội dung)");
      for (const s of otherSections) {
        parts.push(`### ${s.heading}`, s.content);
      }
    }

    if (destination.aiReferenceSummary) {
      // Da co tom tat tu skill trich xuat AI (dichoithoi-destination-ai-extraction-plan
      // §2.2) — dung truc tiep, cung nguon voi CreateDestinationJobUseCase.
      parts.push("", "## Tóm tắt nguồn tham khảo (đã trích xuất, đã duyệt)");
      parts.push(destination.aiReferenceSummary);
    }

    if (destination.editorialReview?.trim()) {
      parts.push("", "## Đánh giá biên tập (giọng văn tham khảo, không copy nguyên văn)");
      parts.push(destination.editorialReview.trim());
    }

    if (destination.aiNotes?.trim()) {
      parts.push("", "## Ghi chú từ người quản trị (ưu tiên cao nhất)");
      parts.push(destination.aiNotes.trim());
    }

    return parts.join("\n");
  }
}
