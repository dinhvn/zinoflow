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
  buildClusterPoiRequest,
  ClusterPoiResultApplier,
  CLUSTER_POI_PROVIDER_KEY,
} from "../../application/services/cluster-poi-result-applier";
import type { DestinationMirrorEntity } from "../entities/destination-mirror.entity";

/**
 * Handler taskType "cluster-poi-discovery" — chay qua Batch AI thay vi goi
 * dong bo trong HTTP request. entityId = cluster slug, params.extraNotes
 * (tuy chon) la ghi chu nguoi dung go them cho tung cum khi gui batch. Dung
 * chung buildClusterPoiRequest/ClusterPoiResultApplier voi luong don le
 * (FindClusterPoiCandidatesUseCase). Xem docs/specs/ai-batch-mode.md.
 */
@Injectable()
export class ClusterPoiDiscoveryBatchTaskHandler implements BatchTaskHandler, OnModuleInit {
  readonly taskType = "cluster-poi-discovery";
  private readonly logger = new Logger(ClusterPoiDiscoveryBatchTaskHandler.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    private readonly applier: ClusterPoiResultApplier,
    @Inject(BATCH_TASK_HANDLER_REGISTRY) private readonly registry: BatchTaskHandlerRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async buildRequest(
    entityId: string,
    params?: Record<string, unknown>,
    override?: { provider: AiProviderKey; model: string },
  ): Promise<{ request: StructuredGenerationRequest; schema: ZodType; providerKey: AiProviderKey }> {
    const { cluster, provinceName } = await this.loadCluster(entityId);
    const extraNotes = typeof params?.extraNotes === "string" ? params.extraNotes : null;
    // Chi ap dung override.model — provider LUON Gemini vi can useGoogleSearch.
    const { request, schema } = buildClusterPoiRequest(cluster, provinceName, extraNotes, override?.model);
    return { request, schema, providerKey: CLUSTER_POI_PROVIDER_KEY };
  }

  async applyResult(
    entityId: string,
    rawOutput: unknown,
    usage: AiCallUsage,
    batchContext: { provider: AiProviderKey; model: string },
  ): Promise<void> {
    const all = await this.mirrorRepo.findAll();
    const cluster = this.findCluster(all, entityId);
    const candidates = await this.applier.apply(
      entityId,
      cluster,
      all,
      rawOutput,
      usage,
      null,
      batchContext.model,
    );
    this.logger.log(`Batch cluster POI discovery cho ${entityId} — tìm được ${candidates.length} điểm ứng viên`);
  }

  async applyError(entityId: string, errorMessage: string): Promise<void> {
    this.logger.error(`Batch cluster POI discovery cho ${entityId} thất bại: ${errorMessage}`);
  }

  private async loadCluster(
    clusterSlug: string,
  ): Promise<{ cluster: DestinationMirrorEntity; provinceName: string | null }> {
    const all = await this.mirrorRepo.findAll();
    const cluster = this.findCluster(all, clusterSlug);
    const provinceName =
      all.find((d) => d.kind === "province" && d.provinceCode === cluster.provinceCode)?.name ?? null;
    return { cluster, provinceName };
  }

  private findCluster(all: DestinationMirrorEntity[], clusterSlug: string): DestinationMirrorEntity {
    const cluster = all.find((d) => d.slug === clusterSlug);
    if (!cluster) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${clusterSlug}"`);
    }
    if (cluster.kind !== "cluster") {
      throw new DomainRuleError(`"${clusterSlug}" không phải Cụm — chỉ dùng được cho Kind=cluster`);
    }
    return cluster;
  }
}
