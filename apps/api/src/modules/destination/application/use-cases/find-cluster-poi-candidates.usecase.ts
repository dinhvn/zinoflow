import { Inject, Injectable, Logger } from "@nestjs/common";
import { z } from "zod/v4";
import type { ClusterPoiCandidateItem } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import {
  CLUSTER_POI_CANDIDATE_REPOSITORY,
  type ClusterPoiCandidateRepository,
} from "../ports/cluster-poi-candidate.repository";
import {
  CLUSTER_POI_BACKUP_REPOSITORY,
  type ClusterPoiBackupRepository,
} from "../ports/cluster-poi-backup.repository";
import {
  AI_PROVIDER_REGISTRY,
  type AiProviderRegistry,
} from "../../../ai-content/application/ports/content-ai-provider.port";
import { AI_USAGE_RECORDER, type AiUsageRecorder } from "../../../ai-content/application/ports/ai-usage-recorder.port";
import { buildPromptLogText } from "../../../ai-content/application/services/prompt-log-text";
import {
  CLUSTER_POI_MODEL,
  CLUSTER_POI_SYSTEM_PROMPT,
  CLUSTER_POI_TEMPERATURE,
  CLUSTER_POI_USE_GOOGLE_SEARCH,
  buildClusterPoiUserPrompt,
} from "../services/build-cluster-poi-prompt";
import { isLikelySameDestinationName } from "../services/fuzzy-match-destination-name";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";
import type { ClusterPoiBackupEntity } from "../../infrastructure/entities/cluster-poi-backup.entity";

const geminiLocationSchema = z.object({
  name: z.string().min(1).max(128),
  priority_level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  short_description: z.string().max(1000).nullable(),
  address: z.string().max(256).nullable(),
});
const geminiResponseSchema = z.object({
  locations: z.array(geminiLocationSchema),
});

/**
 * Tim diem con (POI) trong 1 cum DA CO SAN bang Gemini + Google Search Grounding
 * (dichoithoi-cluster-poi-discovery-plan.md) — ghi vao bang staging, KHONG tao/sua
 * gi tren DB that cho toi khi nguoi dung Chap nhan (AcceptClusterPoiCandidatesUseCase).
 *
 * GD6 (plan-lam-moi-du-lieu-atlas.md): them nguon doi chieu thu 3 — bang tam
 * dichoithoi_destinations_backup (dot lam moi du lieu theo Atlas) — de nguoi dung
 * KHOI PHUC nguyen bai viet/anh/toa do cu thay vi tao diem trong rong. Uu tien phan
 * loai: existing-in-cluster -> orphan-match -> backup-match -> new.
 */
@Injectable()
export class FindClusterPoiCandidatesUseCase {
  private readonly logger = new Logger(FindClusterPoiCandidatesUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(CLUSTER_POI_CANDIDATE_REPOSITORY)
    private readonly candidateRepo: ClusterPoiCandidateRepository,
    @Inject(CLUSTER_POI_BACKUP_REPOSITORY)
    private readonly backupRepo: ClusterPoiBackupRepository,
    @Inject(AI_PROVIDER_REGISTRY) private readonly registry: AiProviderRegistry,
    @Inject(AI_USAGE_RECORDER) private readonly usage: AiUsageRecorder,
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
    const provinceName = all.find((d) => d.kind === "province" && d.provinceCode === cluster.provinceCode)?.name ?? null;
    const backupCandidates = await this.backupRepo.findUnrestoredByProvince(cluster.provinceCode);

    const provider = this.registry.resolve("gemini");
    const userPrompt = buildClusterPoiUserPrompt(cluster, provinceName, extraNotes, cluster.aiNotes);
    const promptRequest = {
      model: CLUSTER_POI_MODEL,
      operation: "find-cluster-poi-candidates",
      system: CLUSTER_POI_SYSTEM_PROMPT,
      prompt: userPrompt,
      maxTokens: 8_000,
      vars: {},
      temperature: CLUSTER_POI_TEMPERATURE,
      useGoogleSearch: CLUSTER_POI_USE_GOOGLE_SEARCH,
    };

    const { output, usage } = await provider.generateStructured(promptRequest, geminiResponseSchema);

    const candidates = output.locations.map((loc) => this.classify(loc, cluster, all, backupCandidates));

    const extractedAt = new Date();
    await this.candidateRepo.upsert({ clusterSlug, extractedAt, candidates });

    await this.usage.record({
      jobId: null,
      provider: provider.key,
      model: CLUSTER_POI_MODEL,
      operation: "find-cluster-poi-candidates",
      ...usage,
      promptText: buildPromptLogText(CLUSTER_POI_SYSTEM_PROMPT, userPrompt, geminiResponseSchema),
      responseText: JSON.stringify(output),
    });

    this.logger.log(`Tìm được ${candidates.length} điểm ứng viên cho cụm ${clusterSlug}`);
    return candidates;
  }

  /**
   * Tinh matchType bang fuzzy-match LONG (quyet dinh 27/07/2026 — luon de nguoi dung
   * tu xem lai): uu tien "existing-in-cluster" (da co san trong CHINH cum nay) truoc
   * "orphan-match" (diem chua gan cum nao, cung tinh) truoc "backup-match" (co trong
   * bang backup tam, chua khoi phuc) — con lai la "new".
   */
  private classify(
    loc: z.infer<typeof geminiLocationSchema>,
    cluster: DestinationMirrorEntity,
    all: DestinationMirrorEntity[],
    backupCandidates: ClusterPoiBackupEntity[],
  ): ClusterPoiCandidateItem {
    const base = {
      name: loc.name,
      priorityLevel: loc.priority_level,
      shortDescription: loc.short_description,
      address: loc.address,
      status: "pending" as const,
    };

    const existingChild = all.find(
      (d) => d.parentSlug === cluster.slug && isLikelySameDestinationName(d.name, loc.name),
    );
    if (existingChild) {
      return {
        ...base,
        matchType: "existing-in-cluster",
        matchedSlug: existingChild.slug,
        matchedName: existingChild.name,
        backupHasArticle: null,
        backupHasImages: null,
      };
    }

    const orphan = all.find(
      (d) =>
        d.kind === "poi" &&
        d.parentSlug === null &&
        d.provinceCode === cluster.provinceCode &&
        isLikelySameDestinationName(d.name, loc.name),
    );
    if (orphan) {
      return {
        ...base,
        matchType: "orphan-match",
        matchedSlug: orphan.slug,
        matchedName: orphan.name,
        backupHasArticle: null,
        backupHasImages: null,
      };
    }

    const backup = backupCandidates.find((b) => isLikelySameDestinationName(b.name, loc.name));
    if (backup) {
      return {
        ...base,
        matchType: "backup-match",
        matchedSlug: backup.slug,
        matchedName: backup.name,
        backupHasArticle: backup.draftArticle !== null,
        backupHasImages: Boolean(backup.thumbnail) || backup.gallery.length > 0,
      };
    }

    return {
      ...base,
      matchType: "new",
      matchedSlug: null,
      matchedName: null,
      backupHasArticle: null,
      backupHasImages: null,
    };
  }
}
