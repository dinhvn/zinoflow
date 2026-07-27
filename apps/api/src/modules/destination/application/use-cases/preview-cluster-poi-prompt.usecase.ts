import { Inject, Injectable } from "@nestjs/common";
import type { PreviewClusterPoiPromptResponse } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import {
  CLUSTER_POI_MODEL,
  CLUSTER_POI_SYSTEM_PROMPT,
  CLUSTER_POI_TEMPERATURE,
  CLUSTER_POI_USE_GOOGLE_SEARCH,
  buildClusterPoiUserPrompt,
} from "../services/build-cluster-poi-prompt";

/**
 * Xem truoc prompt tim diem con trong cum, KHONG goi Gemini — nut "Xem trước prompt"
 * tab AI ho tro. KHAC preview job viet bai (khong dung GSG): tra THEM block config
 * (model/useGoogleSearch/temperature) vi GSG bat/tat quyet dinh dung/sai ket qua,
 * khong the chi suy doan qua noi dung prompt text.
 */
@Injectable()
export class PreviewClusterPoiPromptUseCase {
  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
  ) {}

  async execute(clusterSlug: string, extraNotes: string | null): Promise<PreviewClusterPoiPromptResponse> {
    const all = await this.mirrorRepo.findAll();
    const cluster = all.find((d) => d.slug === clusterSlug);
    if (!cluster) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${clusterSlug}"`);
    }
    if (cluster.kind !== "cluster") {
      throw new DomainRuleError(`"${clusterSlug}" không phải Cụm — chỉ dùng được cho Kind=cluster`);
    }
    const provinceName = all.find((d) => d.kind === "province" && d.provinceCode === cluster.provinceCode)?.name ?? null;

    return {
      systemPrompt: CLUSTER_POI_SYSTEM_PROMPT,
      userPrompt: buildClusterPoiUserPrompt(cluster, provinceName, extraNotes),
      config: {
        model: CLUSTER_POI_MODEL,
        useGoogleSearch: CLUSTER_POI_USE_GOOGLE_SEARCH,
        temperature: CLUSTER_POI_TEMPERATURE,
      },
    };
  }
}
