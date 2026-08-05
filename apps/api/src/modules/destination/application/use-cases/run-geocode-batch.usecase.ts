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
  PLACES_API_FREE_TIER_LIMIT,
  PLACES_API_USAGE_REPOSITORY,
  type PlacesApiUsageRepository,
} from "../ports/places-api-usage.repository";
import { matchesGeocodeFilter } from "../services/geocode-target-filter";

/**
 * Giai doan 1b (che do hang loat) — dichoithoi-destination-geocode-audit-plan.md.
 * CHI enqueue qua pg-boss (fire-and-forget, cung pattern RelinkAllWorker/
 * hotel.auto-assign) — vong lap goi Google Places THAT chay trong
 * ProcessGeocodeBatchUseCase o worker, khong chay dong bo trong request vi
 * co the toi hang nghin diem.
 */
@Injectable()
export class RunGeocodeBatchUseCase {
  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(PLACES_API_USAGE_REPOSITORY)
    private readonly usageRepo: PlacesApiUsageRepository,
    @Inject(JOB_QUEUE) private readonly jobQueue: JobQueue,
  ) {}

  async execute(request: RunGeocodeBatchRequest): Promise<RunGeocodeBatchResponse> {
    const all = await this.mirrorRepo.findAll();
    const targetCount = all.filter((d) => matchesGeocodeFilter(d, request)).length;
    const usageThisMonth = await this.usageRepo.countThisMonth();

    if (targetCount === 0) {
      throw new DomainRuleError("Không có điểm đến nào khớp bộ lọc đã chọn");
    }
    if (usageThisMonth >= PLACES_API_FREE_TIER_LIMIT && !request.acceptCostBeyondFreeTier) {
      throw new DomainRuleError(
        `Đã dùng ${usageThisMonth}/${PLACES_API_FREE_TIER_LIMIT} lượt gọi Google Places miễn phí tháng này — ` +
          `bật "Chấp nhận phát sinh phí ngoài free-tier" để tiếp tục chạy.`,
      );
    }

    const jobId = await this.jobQueue.send(QUEUE_NAMES.destinationGeocodeBatch, {
      parentSlug: request.parentSlug ?? null,
      kind: request.kind ?? null,
      provinceCode: request.provinceCode ?? null,
      missingCoords: request.missingCoords ?? null,
      acceptCostBeyondFreeTier: request.acceptCostBeyondFreeTier,
    });

    return { jobId, targetCount, usageThisMonth };
  }
}
