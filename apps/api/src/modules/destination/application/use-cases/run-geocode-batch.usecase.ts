import { Inject, Injectable } from "@nestjs/common";
import type { RunGeocodeBatchRequest, RunGeocodeBatchResponse } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import { JOB_QUEUE, type JobQueue } from "../../../shared/jobs/job-queue.port";
import { QUEUE_NAMES } from "../../../shared/jobs/job-queue.port";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import {
  PLACES_API_USAGE_REPOSITORY,
  type PlacesApiUsageRepository,
} from "../ports/places-api-usage.repository";
import {
  DESTINATION_GEOCODE_CANDIDATE_REPOSITORY,
  type DestinationGeocodeCandidateRepository,
} from "../ports/destination-geocode-candidate.repository";
import { excludeAlreadyAttempted, matchesGeocodeFilter } from "../services/geocode-target-filter";

/**
 * Giai doan 1b (che do hang loat) — dichoithoi-destination-geocode-audit-plan.md.
 * CHI enqueue qua pg-boss (fire-and-forget, cung pattern RelinkAllWorker/
 * hotel.auto-assign) — vong lap scrape Google Maps THAT chay trong
 * ProcessGeocodeBatchUseCase o worker, khong chay dong bo trong request vi
 * co the toi hang nghin diem. Khong con gioi han free-tier (chuyen tu Google
 * Places API sang scrape qua Playwright, khong ton phi) — `usageThisMonth`
 * chi con la thong ke tham khao, khong chan chay nua.
 */
@Injectable()
export class RunGeocodeBatchUseCase {
  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(PLACES_API_USAGE_REPOSITORY)
    private readonly usageRepo: PlacesApiUsageRepository,
    @Inject(DESTINATION_GEOCODE_CANDIDATE_REPOSITORY)
    private readonly candidateRepo: DestinationGeocodeCandidateRepository,
    @Inject(JOB_QUEUE) private readonly jobQueue: JobQueue,
  ) {}

  async execute(request: RunGeocodeBatchRequest): Promise<RunGeocodeBatchResponse> {
    const all = await this.mirrorRepo.findAll();
    const attemptedSlugs = new Set(await this.candidateRepo.findAllAttemptedSlugs());
    const hasExplicitSlugs = Boolean(request.slugs && request.slugs.length > 0);
    const targetCount = excludeAlreadyAttempted(
      all.filter((d) => matchesGeocodeFilter(d, request)),
      attemptedSlugs,
      hasExplicitSlugs,
    ).length;
    const usageThisMonth = await this.usageRepo.countThisMonth();

    if (targetCount === 0) {
      throw new DomainRuleError(
        hasExplicitSlugs
          ? "Không có điểm đến nào khớp bộ lọc đã chọn"
          : "Không có điểm đến nào khớp bộ lọc đã chọn (hoặc tất cả đã từng tìm rồi — xem \"Kết quả tìm toạ độ chờ duyệt\")",
      );
    }

    const jobId = await this.jobQueue.send(QUEUE_NAMES.destinationGeocodeBatch, {
      // CHI parentSlug thuc su nullable trong schema (destinationKindSchema/provinceCode/
      // missingCoords/slugs CHI la .optional(), KHONG .nullable() — gui null cho may field
      // do se lam runGeocodeBatchRequestSchema.parse() o worker nem loi, bug thuc te phat
      // hien 06/08/2026 khi rieng parentSlug duoc coi null nhung cac field khac lai khong).
      slugs: request.slugs,
      parentSlug: request.parentSlug ?? null,
      kind: request.kind,
      provinceCode: request.provinceCode,
      missingCoords: request.missingCoords,
      quickOnly: request.quickOnly,
      acceptCostBeyondFreeTier: request.acceptCostBeyondFreeTier,
    });

    return { jobId, targetCount, usageThisMonth };
  }
}
