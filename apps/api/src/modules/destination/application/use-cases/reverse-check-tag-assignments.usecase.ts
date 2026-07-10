import { Inject, Injectable } from "@nestjs/common";
import {
  aiTagReverseCheckBatchSchema,
  type ReverseCheckTagAssignmentsResponse,
  type TagReverseCheckFinding,
} from "@zinoflow/contracts";
import {
  AI_PROVIDER_REGISTRY,
  type AiProviderRegistry,
} from "../../../ai-content/application/ports/content-ai-provider.port";
import { AI_USAGE_RECORDER, type AiUsageRecorder } from "../../../ai-content/application/ports/ai-usage-recorder.port";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";

/** So diem den toi thieu 1 tag can co de khong bi coi la "duoi nguong" (destination-spec §2.4 buoc 2) */
const MIN_DESTINATIONS_PER_TAG = 3;
const MODEL = "claude-haiku-4-5";

const SYSTEM = [
  "Bạn là biên tập viên du lịch Việt Nam, đang rà soát lại các tag đã gán cho điểm đến.",
  "Luôn trả lời bằng tiếng Việt có dấu đầy đủ.",
  "CHỈ báo cáo những cặp điểm đến-tag mà bạn thực sự nghi ngờ là gán SAI/gượng ép.",
  "Nếu tất cả đều hợp lý thì trả về danh sách findings rỗng — không bịa ra vấn đề.",
].join(" ");

/**
 * Buoc 2 (destination-spec §2.4) — ra soat nguoc:
 * (a) Tag co qua it diem den (nguong tinh toan, khong can AI).
 * (b) AI doc lai toan bo gan-tag hien tai, gan co cap nao sai/gan guong ep.
 */
@Injectable()
export class ReverseCheckTagAssignmentsUseCase {
  constructor(
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
    @Inject(AI_PROVIDER_REGISTRY) private readonly registry: AiProviderRegistry,
    @Inject(AI_USAGE_RECORDER) private readonly usage: AiUsageRecorder,
  ) {}

  async execute(): Promise<ReverseCheckTagAssignmentsResponse> {
    const [tags, assignments] = await Promise.all([
      this.siteDb.fetchTags(),
      this.siteDb.fetchTagAssignments(),
    ]);

    const findings: TagReverseCheckFinding[] = [...this.findUnderThresholdTags(tags, assignments)];

    const tagged = assignments.filter((a) => a.tagSlugs.length > 0);
    if (tagged.length > 0) {
      findings.push(...(await this.runAiReverseCheck(tags, tagged)));
    }

    return { findings };
  }

  private findUnderThresholdTags(
    tags: Awaited<ReturnType<DichoithoiSiteDb["fetchTags"]>>,
    assignments: Awaited<ReturnType<DichoithoiSiteDb["fetchTagAssignments"]>>,
  ): TagReverseCheckFinding[] {
    const countByTag = new Map<string, number>();
    for (const a of assignments) {
      for (const slug of a.tagSlugs) countByTag.set(slug, (countByTag.get(slug) ?? 0) + 1);
    }
    return tags
      .filter((t) => (countByTag.get(t.slug) ?? 0) < MIN_DESTINATIONS_PER_TAG)
      .map((t) => ({
        destinationSlug: null,
        tagSlug: t.slug,
        issue: "under-threshold" as const,
        reasoning: `Chỉ có ${countByTag.get(t.slug) ?? 0} điểm đến được gán tag này (ngưỡng tối thiểu ${MIN_DESTINATIONS_PER_TAG})`,
      }));
  }

  private async runAiReverseCheck(
    tags: Awaited<ReturnType<DichoithoiSiteDb["fetchTags"]>>,
    tagged: Awaited<ReturnType<DichoithoiSiteDb["fetchTagAssignments"]>>,
  ): Promise<TagReverseCheckFinding[]> {
    const provider = this.registry.resolve("anthropic");
    const tagList = tags.map((t) => `- ${t.slug}: "${t.name}"`).join("\n");
    const assignmentList = tagged
      .map((a) => `- ${a.destinationSlug} ("${a.destinationName}"): [${a.tagSlugs.join(", ")}]`)
      .join("\n");
    const prompt = [
      "Danh sách tag (slug: tên):",
      tagList,
      "",
      "Các điểm đến đang được gán tag (slug destination (tên): [tagSlugs]):",
      assignmentList,
      "",
      "Chỉ ra những cặp điểm đến-tag mà bạn nghi ngờ là gán SAI (không khớp thực tế).",
    ].join("\n");

    const { output, usage } = await provider.generateStructured(
      {
        model: MODEL,
        operation: "reverse-check-destination-tags",
        system: SYSTEM,
        prompt,
        maxTokens: 4_000,
        vars: { topic: "destination-tag-reverse-check", articleType: "guide-diem-den-suggest" },
      },
      aiTagReverseCheckBatchSchema,
    );

    await this.usage.record({
      jobId: null,
      provider: provider.key,
      model: MODEL,
      operation: "reverse-check-destination-tags",
      ...usage,
    });

    const validPairs = new Set(
      tagged.flatMap((a) => a.tagSlugs.map((tag) => `${a.destinationSlug}::${tag}`)),
    );
    return output.findings
      .filter((f) => validPairs.has(`${f.destinationSlug}::${f.tagSlug}`))
      .map((f) => ({ ...f, issue: "likely-wrong" as const }));
  }
}
