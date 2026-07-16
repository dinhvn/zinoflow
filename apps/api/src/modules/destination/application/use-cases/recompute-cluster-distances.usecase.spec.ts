import { RecomputeClusterDistancesUseCase } from "./recompute-cluster-distances.usecase";
import type { DestinationMirrorRepository } from "../ports/destination-mirror.repository";
import type { ClusterDistanceRepository } from "../ports/cluster-distance.repository";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";

function fakeMirror(overrides: Partial<DestinationMirrorEntity> = {}): DestinationMirrorEntity {
  return {
    slug: "da-lat",
    siteId: 1,
    kind: "poi",
    parentSlug: null,
    provinceCode: "68",
    name: "Đà Lạt",
    nameUnaccented: "Da Lat",
    shortDescription: null,
    thumbnail: null,
    lat: null,
    lng: null,
    addressNew: null,
    addressOld: null,
    contactPhone: null,
    contactWebsite: null,
    ticketLinks: [],
    priceBreakdown: [],
    practicalNotes: [],
    editorialReview: null,
    externalReviewUrls: [],
    hotelGroupId: null,
    priority: 3,
    contentTier: null,
    siteStatus: 1,
    contentSource: 1,
    contentHash: null,
    activeContentJobId: null,
    aiNotes: null,
    aiReferenceUrls: [],
    syncFlags: [],
    hasLocalChanges: false,
    siteUpdatedAt: null,
    syncedAt: null,
    ...overrides,
  } as DestinationMirrorEntity;
}

describe("RecomputeClusterDistancesUseCase (relations-plan §1.2, Giai doan A2)", () => {
  it("chi tinh cap cho node kind province/cluster co lat/lng, bo qua poi va node thieu toa do", async () => {
    const mirrors = [
      fakeMirror({ slug: "da-lat", kind: "cluster", lat: "11.94", lng: "108.44" }),
      fakeMirror({ slug: "nha-trang", kind: "cluster", lat: "12.25", lng: "109.19" }),
      fakeMirror({ slug: "an-giang", kind: "province", lat: "10.52", lng: "105.13" }),
      fakeMirror({ slug: "cum-thieu-toa-do", kind: "cluster", lat: null, lng: null }),
      fakeMirror({ slug: "ho-xuan-huong", kind: "poi", lat: "11.94", lng: "108.44" }),
    ];
    const mirrorRepo = { findAll: async () => mirrors } as unknown as DestinationMirrorRepository;

    let savedPairs: unknown;
    const clusterDistanceRepo = {
      replaceAll: async (pairs: unknown) => {
        savedPairs = pairs;
      },
      findAll: async () => [],
    } as unknown as ClusterDistanceRepository;

    const usecase = new RecomputeClusterDistancesUseCase(mirrorRepo, clusterDistanceRepo);
    const report = await usecase.execute();

    expect(report.nodes).toBe(3);
    expect(report.pairs).toBe(3); // C(3,2)
    expect(savedPairs).toHaveLength(3);
    for (const pair of savedPairs as { clusterASlug: string; clusterBSlug: string }[]) {
      expect(pair.clusterASlug < pair.clusterBSlug).toBe(true);
    }
  });

  it("khong node hop le -> ghi mang rong, khong loi", async () => {
    const mirrorRepo = {
      findAll: async () => [fakeMirror({ slug: "poi-only", kind: "poi", lat: "1", lng: "1" })],
    } as unknown as DestinationMirrorRepository;
    let savedPairs: unknown;
    const clusterDistanceRepo = {
      replaceAll: async (pairs: unknown) => {
        savedPairs = pairs;
      },
      findAll: async () => [],
    } as unknown as ClusterDistanceRepository;

    const usecase = new RecomputeClusterDistancesUseCase(mirrorRepo, clusterDistanceRepo);
    const report = await usecase.execute();

    expect(report.nodes).toBe(0);
    expect(report.pairs).toBe(0);
    expect(savedPairs).toEqual([]);
  });
});
