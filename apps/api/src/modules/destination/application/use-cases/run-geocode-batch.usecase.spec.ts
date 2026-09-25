import { runGeocodeBatchRequestSchema } from "@zinoflow/contracts";
import { RunGeocodeBatchUseCase } from "./run-geocode-batch.usecase";
import type { DestinationMirrorRepository } from "../ports/destination-mirror.repository";
import type { PlacesApiUsageRepository } from "../ports/places-api-usage.repository";
import type { JobQueue } from "../../../shared/jobs/job-queue.port";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";
import type { DestinationGeocodeCandidateRepository } from "../ports/destination-geocode-candidate.repository";

function makeCandidateRepo(attemptedSlugs: string[] = []): DestinationGeocodeCandidateRepository {
  return {
    findAllAttemptedSlugs: jest.fn().mockResolvedValue(attemptedSlugs),
  } as unknown as DestinationGeocodeCandidateRepository;
}

function makeDestination(overrides: Partial<DestinationMirrorEntity>): DestinationMirrorEntity {
  return {
    slug: "test",
    kind: "poi",
    parentSlug: null,
    provinceCode: null,
    lat: null,
    lng: null,
    name: "Test",
    ...overrides,
  } as DestinationMirrorEntity;
}

/**
 * Bug thuc te 06/08/2026: enqueue gui `null` cho cac field CHI .optional()
 * (kind/provinceCode/missingCoords/slugs — khong .nullable() nhu parentSlug)
 * lam GeocodeBatchWorker crash ngay khi parse lai payload. Test nay round-trip
 * QUA DUNG SCHEMA THAT (khong mock) de bat lai loi nay neu tai pham.
 */
describe("RunGeocodeBatchUseCase", () => {
  it("enqueues a payload that parses cleanly through runGeocodeBatchRequestSchema when only missingCoords is set", async () => {
    const mirrorRepo: DestinationMirrorRepository = {
      findAll: jest.fn().mockResolvedValue([makeDestination({ lat: null, lng: null })]),
    } as unknown as DestinationMirrorRepository;
    const usageRepo: PlacesApiUsageRepository = {
      countThisMonth: jest.fn().mockResolvedValue(0),
    } as unknown as PlacesApiUsageRepository;
    let captured: unknown;
    const jobQueue: JobQueue = {
      send: jest.fn(async (_name: string, data: object) => {
        captured = data;
        return "job-1";
      }),
    };

    const usecase = new RunGeocodeBatchUseCase(mirrorRepo, usageRepo, makeCandidateRepo(), jobQueue);
    await usecase.execute({ missingCoords: true, acceptCostBeyondFreeTier: false });

    expect(() => runGeocodeBatchRequestSchema.parse(captured)).not.toThrow();
  });

  it("forwards picked slugs into the enqueued payload (checkbox multi-select)", async () => {
    const mirrorRepo: DestinationMirrorRepository = {
      findAll: jest.fn().mockResolvedValue([makeDestination({ slug: "da-lat" })]),
    } as unknown as DestinationMirrorRepository;
    const usageRepo: PlacesApiUsageRepository = {
      countThisMonth: jest.fn().mockResolvedValue(0),
    } as unknown as PlacesApiUsageRepository;
    let captured: unknown;
    const jobQueue: JobQueue = {
      send: jest.fn(async (_name: string, data: object) => {
        captured = data;
        return "job-1";
      }),
    };

    const usecase = new RunGeocodeBatchUseCase(mirrorRepo, usageRepo, makeCandidateRepo(), jobQueue);
    await usecase.execute({ slugs: ["da-lat"], acceptCostBeyondFreeTier: false });

    const parsed = runGeocodeBatchRequestSchema.parse(captured);
    expect(parsed.slugs).toEqual(["da-lat"]);
  });

  it("excludes destinations already attempted before (filter mode) — does not re-scrape", async () => {
    const mirrorRepo: DestinationMirrorRepository = {
      findAll: jest.fn().mockResolvedValue([makeDestination({ slug: "da-lat", lat: null, lng: null })]),
    } as unknown as DestinationMirrorRepository;
    const usageRepo: PlacesApiUsageRepository = {
      countThisMonth: jest.fn().mockResolvedValue(0),
    } as unknown as PlacesApiUsageRepository;
    const jobQueue: JobQueue = { send: jest.fn().mockResolvedValue("job-1") };

    const usecase = new RunGeocodeBatchUseCase(
      mirrorRepo,
      usageRepo,
      makeCandidateRepo(["da-lat"]),
      jobQueue,
    );
    await expect(usecase.execute({ missingCoords: true, acceptCostBeyondFreeTier: false })).rejects.toThrow();
    expect(jobQueue.send).not.toHaveBeenCalled();
  });

  it("does NOT exclude already-attempted destinations when explicitly ticked via slugs", async () => {
    const mirrorRepo: DestinationMirrorRepository = {
      findAll: jest.fn().mockResolvedValue([makeDestination({ slug: "da-lat" })]),
    } as unknown as DestinationMirrorRepository;
    const usageRepo: PlacesApiUsageRepository = {
      countThisMonth: jest.fn().mockResolvedValue(0),
    } as unknown as PlacesApiUsageRepository;
    const jobQueue: JobQueue = { send: jest.fn().mockResolvedValue("job-1") };

    const usecase = new RunGeocodeBatchUseCase(
      mirrorRepo,
      usageRepo,
      makeCandidateRepo(["da-lat"]),
      jobQueue,
    );
    const res = await usecase.execute({ slugs: ["da-lat"], acceptCostBeyondFreeTier: false });
    expect(res.targetCount).toBe(1);
  });
});
