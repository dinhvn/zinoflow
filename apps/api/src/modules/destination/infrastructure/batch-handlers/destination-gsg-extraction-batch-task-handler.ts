import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import type { AiProviderKey } from "@zinoflow/contracts";
import type { ZodType } from "zod/v4";
import type {
  BatchTaskHandler,
  BatchTaskHandlerRegistry,
} from "../../../ai-content/application/ports/batch-task-handler.port";
import { BATCH_TASK_HANDLER_REGISTRY } from "../../../ai-content/application/ports/batch-task-handler.port";
import type {
  AiCallUsage,
  StructuredGenerationRequest,
} from "../../../ai-content/application/ports/content-ai-provider.port";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../../application/ports/destination-mirror.repository";
import {
  buildGsgExtractionRequest,
  GsgExtractionResultApplier,
  GSG_PROVIDER_KEY,
} from "../../application/services/gsg-extraction-result-applier";

/**
 * Handler taskType "destination-gsg-extraction" — chay qua Batch AI thay vi
 * goi dong bo trong HTTP request. entityId = destination slug. Dung chung
 * buildGsgExtractionRequest/GsgExtractionResultApplier voi luong don le
 * (ExtractDestinationInfoGsgUseCase). Xem docs/specs/ai-batch-mode.md.
 */
@Injectable()
export class DestinationGsgExtractionBatchTaskHandler implements BatchTaskHandler, OnModuleInit {
  readonly taskType = "destination-gsg-extraction";
  private readonly logger = new Logger(DestinationGsgExtractionBatchTaskHandler.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    private readonly applier: GsgExtractionResultApplier,
    @Inject(BATCH_TASK_HANDLER_REGISTRY) private readonly registry: BatchTaskHandlerRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async buildRequest(
    entityId: string,
    _params?: Record<string, unknown>,
    override?: { provider: AiProviderKey; model: string },
  ): Promise<{ request: StructuredGenerationRequest; schema: ZodType; providerKey: AiProviderKey }> {
    const all = await this.mirrorRepo.findAll();
    const destination = all.find((d) => d.slug === entityId);
    if (!destination) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${entityId}" trong mirror`);
    }
    const provinceName =
      all.find((d) => d.kind === "province" && d.provinceCode === destination.provinceCode)?.name ??
      null;
    // Chi ap dung override.model — provider LUON Gemini vi can useGoogleSearch (§6 B2).
    const { request, schema } = buildGsgExtractionRequest(destination, provinceName, override?.model);
    return { request, schema, providerKey: GSG_PROVIDER_KEY };
  }

  async applyResult(
    entityId: string,
    rawOutput: unknown,
    usage: AiCallUsage,
    batchContext: { provider: AiProviderKey; model: string },
  ): Promise<void> {
    const all = await this.mirrorRepo.findAll();
    const destination = all.find((d) => d.slug === entityId);
    if (!destination) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${entityId}" trong mirror`);
    }
    const result = await this.applier.apply(entityId, destination, rawOutput, usage, null, batchContext.model);
    this.logger.log(
      `Batch GSG extraction cho ${entityId} — tìm được ${result.fields.filter((f) => f.found).length}/${result.fields.length} field`,
    );
  }

  async applyError(entityId: string, errorMessage: string): Promise<void> {
    this.logger.error(`Batch GSG extraction cho ${entityId} thất bại: ${errorMessage}`);
  }
}
