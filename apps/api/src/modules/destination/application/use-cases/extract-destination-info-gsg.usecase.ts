import { Inject, Injectable, Logger } from "@nestjs/common";
import type { DestinationAiExtraction } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import {
  AI_PROVIDER_REGISTRY,
  type AiProviderRegistry,
} from "../../../ai-content/application/ports/content-ai-provider.port";
import { buildPromptLogText } from "../../../ai-content/application/services/prompt-log-text";
import {
  buildGsgExtractionRequest,
  GsgExtractionResultApplier,
  GSG_PROVIDER_KEY,
} from "../services/gsg-extraction-result-applier";

/**
 * Trich xuat thong tin diem den TU DONG qua Gemini + Google Search Grounding —
 * chay NGAY TRONG APP (khong can Claude Code nhu skill thu cong), ghi vao CUNG
 * bang staging voi source="gsg" (song song source="skill", khong ghi de nhau).
 * dichoithoi-destination-ai-extraction-plan.md §6 B2.
 *
 * Build request + ap ket qua dung chung voi Batch AI
 * (DestinationGsgExtractionBatchTaskHandler) qua gsg-extraction-result-applier.ts —
 * usecase nay chi lo phan RIENG cua luong don le: goi AI dong bo trong request.
 */
@Injectable()
export class ExtractDestinationInfoGsgUseCase {
  private readonly logger = new Logger(ExtractDestinationInfoGsgUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(AI_PROVIDER_REGISTRY) private readonly registry: AiProviderRegistry,
    private readonly applier: GsgExtractionResultApplier,
  ) {}

  async execute(slug: string): Promise<DestinationAiExtraction> {
    const all = await this.mirrorRepo.findAll();
    const destination = all.find((d) => d.slug === slug);
    if (!destination) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${slug}" trong mirror`);
    }

    const provinceName =
      all.find((d) => d.kind === "province" && d.provinceCode === destination.provinceCode)?.name ??
      null;
    const { request, schema } = buildGsgExtractionRequest(destination, provinceName);

    const provider = this.registry.resolve(GSG_PROVIDER_KEY);
    const { output, usage } = await provider.generateStructured(request, schema);

    const result = await this.applier.apply(
      slug,
      destination,
      output,
      usage,
      buildPromptLogText(request.system, request.prompt, schema),
    );

    const found = result.fields.filter((f) => f.found).length;
    this.logger.log(`Trích xuất GSG cho ${slug} — tìm được ${found}/${result.fields.length} field`);

    return result;
  }
}
