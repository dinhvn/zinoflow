import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ClusterPoiCandidateItem } from "@zinoflow/contracts";
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
  buildClusterPoiRequest,
  ClusterPoiResultApplier,
  CLUSTER_POI_PROVIDER_KEY,
} from "../services/cluster-poi-result-applier";

/**
 * Tim diem con (POI) trong 1 cum DA CO SAN bang Gemini + Google Search Grounding
 * (dichoithoi-cluster-poi-discovery-plan.md) — ghi vao bang staging, KHONG tao/sua
 * gi tren DB that cho toi khi nguoi dung Chap nhan (AcceptClusterPoiCandidatesUseCase).
 *
 * Build request + ap ket qua dung chung voi Batch AI
 * (ClusterPoiDiscoveryBatchTaskHandler) qua cluster-poi-result-applier.ts —
 * usecase nay chi lo phan RIENG cua luong don le: goi AI dong bo trong request.
 */
@Injectable()
export class FindClusterPoiCandidatesUseCase {
  private readonly logger = new Logger(FindClusterPoiCandidatesUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(AI_PROVIDER_REGISTRY) private readonly registry: AiProviderRegistry,
    private readonly applier: ClusterPoiResultApplier,
  ) {}

  async execute(clusterSlug: string, extraNotes: string | null): Promise<ClusterPoiCandidateItem[]> {
    const all = await this.mirrorRepo.findAll();
    const cluster = all.find((d) => d.slug === clusterSlug);
    if (!cluster) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${clusterSlug}"`);
    }
    if (cluster.kind !== "cluster") {
      throw new DomainRuleError(`"${clusterSlug}" không phải Cụm — chỉ dùng được cho Kind=cluster`);
    }
    const provinceName =
      all.find((d) => d.kind === "province" && d.provinceCode === cluster.provinceCode)?.name ?? null;
    const { request, schema } = buildClusterPoiRequest(cluster, provinceName, extraNotes);

    const provider = this.registry.resolve(CLUSTER_POI_PROVIDER_KEY);
    const { output, usage } = await provider.generateStructured(request, schema);

    const candidates = await this.applier.apply(
      clusterSlug,
      cluster,
      all,
      output,
      usage,
      buildPromptLogText(request.system, request.prompt, schema),
    );

    this.logger.log(`Tìm được ${candidates.length} điểm ứng viên cho cụm ${clusterSlug}`);
    return candidates;
  }
}
