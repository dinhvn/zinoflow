import { RecomputeClusterDistancesUseCase } from "./recompute-cluster-distances.usecase";
import type { DestinationMirrorRepository } from "../ports/destination-mirror.repository";
import type { ClusterDistanceRepository } from "../ports/cluster-distance.repository";
import type { DistanceMatrixProvider, LatLng } from "../ports/distance-matrix-provider.port";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";

/** Fake ORS: tra ve khoang cach co dinh 999 cho moi cap (khac Haversine that de
 * phan biet ro trong test — chi can xac nhan usecase DUNG ket qua tu provider). */
function fakeDistanceMatrix(configured = true): DistanceMatrixProvider {
  return {
    isConfigured: () => configured,
    computeMatrix: async (locations: readonly LatLng[]) =>
      locations.map((_, i) => locations.map((_, j) => (i === j ? 0 : 999))),
  };
}

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
  it("chi tinh cap cho node kind=cluster co lat/lng, bo qua province/poi va node thieu toa do", async () => {
    const mirrors = [
      fakeMirror({ slug: "da-lat", kind: "cluster", lat: "11.94", lng: "108.44" }),
      fakeMirror({ slug: "nha-trang", kind: "cluster", lat: "12.25", lng: "109.19" }),
      fakeMirror({ slug: "bao-loc", kind: "cluster", lat: "11.55", lng: "107.81" }),
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

    const usecase = new RecomputeClusterDistancesUseCase(
      mirrorRepo,
      clusterDistanceRepo,
      fakeDistanceMatrix(),
    );
    const report = await usecase.execute();

    expect(report.nodes).toBe(3); // chi 3 cum hop le, "an-giang" (tinh) bi loai
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

    const usecase = new RecomputeClusterDistancesUseCase(
      mirrorRepo,
      clusterDistanceRepo,
      fakeDistanceMatrix(),
    );
    const report = await usecase.execute();

    expect(report.nodes).toBe(0);
    expect(report.pairs).toBe(0);
    expect(savedPairs).toEqual([]);
  });

  it("dung khoang cach tu DistanceMatrixProvider (ORS), KHONG con tinh Haversine", async () => {
    const mirrors = [
      // Toa do rat gan nhau — Haversine se ra vai chuc met, khac han fake ORS (999m)
      fakeMirror({ slug: "da-lat", kind: "cluster", lat: "11.94", lng: "108.44" }),
      fakeMirror({ slug: "nha-trang", kind: "cluster", lat: "11.9401", lng: "108.4401" }),
    ];
    const mirrorRepo = { findAll: async () => mirrors } as unknown as DestinationMirrorRepository;
    let savedPairs: { distanceMeters: number }[] = [];
    const clusterDistanceRepo = {
      replaceAll: async (pairs: unknown) => {
        savedPairs = pairs as { distanceMeters: number }[];
      },
      findAll: async () => [],
    } as unknown as ClusterDistanceRepository;

    const usecase = new RecomputeClusterDistancesUseCase(
      mirrorRepo,
      clusterDistanceRepo,
      fakeDistanceMatrix(),
    );
    await usecase.execute();

    expect(savedPairs).toHaveLength(1);
    expect(savedPairs[0]!.distanceMeters).toBe(999);
  });

  it("chua cau hinh OPENROUTESERVICE_API_KEY -> bao loi ro, khong am tham dung Haversine", async () => {
    const mirrorRepo = {
      findAll: async () => [
        fakeMirror({ slug: "da-lat", kind: "cluster", lat: "11.94", lng: "108.44" }),
        fakeMirror({ slug: "nha-trang", kind: "cluster", lat: "12.25", lng: "109.19" }),
      ],
    } as unknown as DestinationMirrorRepository;
    const clusterDistanceRepo = {
      replaceAll: async () => {},
      findAll: async () => [],
    } as unknown as ClusterDistanceRepository;

    const usecase = new RecomputeClusterDistancesUseCase(
      mirrorRepo,
      clusterDistanceRepo,
      fakeDistanceMatrix(false),
    );

    await expect(usecase.execute()).rejects.toThrow(/OPENROUTESERVICE_API_KEY/);
  });

  it("ORS tra null cho 1 node (khong tim duoc tuyen) -> bo qua cap do, KHONG ghi 0, bao failedPairs", async () => {
    const mirrors = [
      fakeMirror({ slug: "da-lat", kind: "cluster", lat: "11.94", lng: "108.44" }),
      fakeMirror({ slug: "nha-trang", kind: "cluster", lat: "12.25", lng: "109.19" }),
      // "toa-do-loi" mo phong node ORS khong tim duoc duong (vd Lam Dong/Quang
      // Binh thuc te 23/07/2026) — moi cap lien quan tra null tu adapter.
      fakeMirror({ slug: "toa-do-loi", kind: "cluster", lat: "10.0", lng: "104.0" }),
    ];
    const mirrorRepo = { findAll: async () => mirrors } as unknown as DestinationMirrorRepository;
    let savedPairs: { clusterASlug: string; clusterBSlug: string }[] = [];
    const clusterDistanceRepo = {
      replaceAll: async (pairs: unknown) => {
        savedPairs = pairs as { clusterASlug: string; clusterBSlug: string }[];
      },
      findAll: async () => [],
    } as unknown as ClusterDistanceRepository;

    // nodes sort theo slug: da-lat(0), nha-trang(1), toa-do-loi(2) — hang/cot
    // cua "toa-do-loi" tra null cho moi cap khac no.
    const distanceMatrix: DistanceMatrixProvider = {
      isConfigured: () => true,
      computeMatrix: async () => [
        [0, 999, null as unknown as number],
        [999, 0, null as unknown as number],
        [null as unknown as number, null as unknown as number, 0],
      ],
    };

    const usecase = new RecomputeClusterDistancesUseCase(mirrorRepo, clusterDistanceRepo, distanceMatrix);
    const report = await usecase.execute();

    expect(report.nodes).toBe(3);
    expect(report.pairs).toBe(1); // chi da-lat<->nha-trang hop le
    expect(report.failedPairs).toBe(2); // da-lat<->toa-do-loi, nha-trang<->toa-do-loi
    expect(savedPairs).toEqual([
      { clusterASlug: "da-lat", clusterBSlug: "nha-trang", distanceMeters: 999 },
    ]);
  });
});
