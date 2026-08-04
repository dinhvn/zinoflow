import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod/v4";
import type { AiProviderKey, ClusterPoiCandidateItem } from "@zinoflow/contracts";
import type { StructuredGenerationRequest } from "../../../ai-content/application/ports/content-ai-provider.port";
import { AI_USAGE_RECORDER, type AiUsageRecorder } from "../../../ai-content/application/ports/ai-usage-recorder.port";
import {
  CLUSTER_POI_CANDIDATE_REPOSITORY,
  type ClusterPoiCandidateRepository,
} from "../ports/cluster-poi-candidate.repository";
import {
  CLUSTER_POI_BACKUP_REPOSITORY,
  type ClusterPoiBackupRepository,
} from "../ports/cluster-poi-backup.repository";
import {
  CLUSTER_POI_MODEL,
  CLUSTER_POI_SYSTEM_PROMPT,
  CLUSTER_POI_TEMPERATURE,
  CLUSTER_POI_USE_GOOGLE_SEARCH,
  buildClusterPoiUserPrompt,
} from "./build-cluster-poi-prompt";
import { isLikelySameDestinationName } from "./fuzzy-match-destination-name";
import { normalizeVietnamese } from "../../../shared/text/vietnamese";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";
import type { ClusterPoiBackupEntity } from "../../infrastructure/entities/cluster-poi-backup.entity";

/**
 * Tim diem con (POI) cho 1 cum qua Gemini + Google Search Grounding — logic
 * dung chung cho luong don le (FindClusterPoiCandidatesUseCase,
 * POST :slug/cluster-poi-candidates) va Batch AI
 * (ClusterPoiDiscoveryBatchTaskHandler). Tach lam 2 nua: buildClusterPoiRequest
 * (build request AI) va ClusterPoiResultApplier.apply (ap ket qua, phan loai
 * matchType) — dichoithoi-cluster-poi-discovery-plan.md.
 */

export const CLUSTER_POI_PROVIDER_KEY: AiProviderKey = "gemini";

const geminiLocationSchema = z.object({
  name: z.string().min(1).max(128),
  priority_level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  short_description: z.string().max(1000).nullable(),
  address: z.string().max(256).nullable(),
});
export const clusterPoiGeminiResponseSchema = z.object({
  locations: z.array(geminiLocationSchema),
});

export interface ClusterPoiUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
}

/** Build request AI cho 1 cum — dung chung sync + batch. */
export function buildClusterPoiRequest(
  cluster: Pick<DestinationMirrorEntity, "name" | "aiNotes">,
  provinceName: string | null,
  extraNotes: string | null,
  /** Batch AI cho chon model khac CLUSTER_POI_MODEL mac dinh (trang /ai-batches). */
  modelOverride?: string,
): { request: StructuredGenerationRequest; schema: typeof clusterPoiGeminiResponseSchema } {
  const userPrompt = buildClusterPoiUserPrompt(cluster, provinceName, extraNotes, cluster.aiNotes);
  const request: StructuredGenerationRequest = {
    model: modelOverride ?? CLUSTER_POI_MODEL,
    operation: "find-cluster-poi-candidates",
    system: CLUSTER_POI_SYSTEM_PROMPT,
    prompt: userPrompt,
    maxTokens: 8_000,
    vars: {},
    temperature: CLUSTER_POI_TEMPERATURE,
    useGoogleSearch: CLUSTER_POI_USE_GOOGLE_SEARCH,
  };
  return { request, schema: clusterPoiGeminiResponseSchema };
}

/**
 * Tinh matchType bang fuzzy-match LONG (quyet dinh 27/07/2026 — luon de nguoi dung
 * tu xem lai): uu tien "existing-in-cluster" (da co san trong CHINH cum nay) truoc
 * "orphan-match" (diem chua gan cum nao, cung tinh) truoc "backup-match" (co trong
 * bang backup tam, chua khoi phuc) — con lai la "new".
 */
export function classify(
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

  // Loai tu thuoc ten cum khoi so sanh — xem ghi chu ignoreTokens o
  // isLikelySameDestinationName (bug tung khop nham 2 POI khac nhau chi vi
  // cung chua ten cum, vd "Tượng Đức Mẹ Đèo Bảo Lộc" vs "Đèo Bảo Lộc").
  const clusterNameTokens = new Set(normalizeVietnamese(cluster.name).split(" ").filter(Boolean));

  const existingChild = all.find(
    (d) =>
      d.parentSlug === cluster.slug &&
      isLikelySameDestinationName(d.name, loc.name, clusterNameTokens),
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
      isLikelySameDestinationName(d.name, loc.name, clusterNameTokens),
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

  const backup = backupCandidates.find((b) =>
    isLikelySameDestinationName(b.name, loc.name, clusterNameTokens),
  );
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

@Injectable()
export class ClusterPoiResultApplier {
  constructor(
    @Inject(CLUSTER_POI_CANDIDATE_REPOSITORY)
    private readonly candidateRepo: ClusterPoiCandidateRepository,
    @Inject(CLUSTER_POI_BACKUP_REPOSITORY)
    private readonly backupRepo: ClusterPoiBackupRepository,
    @Inject(AI_USAGE_RECORDER) private readonly usage: AiUsageRecorder,
  ) {}

  /**
   * Ap ket qua AI vao bang staging + ghi usage. promptText: sync tu goi
   * buildPromptLogText() ngay tai cho, batch tu AiBatchItemEntity.requestText
   * chup luc submit (xem ClusterPoiDiscoveryBatchTaskHandler).
   */
  async apply(
    clusterSlug: string,
    cluster: DestinationMirrorEntity,
    all: DestinationMirrorEntity[],
    rawOutput: unknown,
    callUsage: ClusterPoiUsage,
    promptText?: string | null,
    /** Model thuc te da dung (batch co the ghi de CLUSTER_POI_MODEL) — ghi dung vao usage log. */
    modelUsed: string = CLUSTER_POI_MODEL,
    /** != null <=> lan goi nay den tu Batch AI — xem giai thich o GsgExtractionResultApplier.apply. */
    batchItemId?: string | null,
  ): Promise<ClusterPoiCandidateItem[]> {
    const output = clusterPoiGeminiResponseSchema.parse(rawOutput);
    // Loai backup row CUA CHINH cum nay: hau het POI trong cum co ten chua ten
    // cum ("... Bao Loc") nen rule includes() cua isLikelySameDestinationName
    // se khop nham voi backup cua cum (vd "Tuong Duc Me Deo Bao Loc" chua
    // "Bao Loc") -> matchType="backup-match" tro ve chinh cum, accept se
    // am tham khong lam gi vi backup do da duoc khoi phuc roi (bug phat hien
    // 04/08/2026, cum bao-loc: "Tượng Đức Mẹ Đèo Bảo Lộc"/"Đồi Dổi Bảo Lộc").
    const backupCandidates = (
      await this.backupRepo.findUnrestoredByProvince(cluster.provinceCode)
    ).filter((b) => b.slug !== cluster.slug);
    const candidates = output.locations.map((loc) => classify(loc, cluster, all, backupCandidates));

    const extractedAt = new Date();
    await this.candidateRepo.upsert({ clusterSlug, extractedAt, candidates });

    await this.usage.record({
      jobId: null,
      batchItemId: batchItemId ?? null,
      via: batchItemId != null ? "batch" : "sync",
      provider: CLUSTER_POI_PROVIDER_KEY,
      model: modelUsed,
      operation: "find-cluster-poi-candidates",
      ...callUsage,
      promptText: promptText ?? null,
      responseText: JSON.stringify(output),
    });

    return candidates;
  }
}
