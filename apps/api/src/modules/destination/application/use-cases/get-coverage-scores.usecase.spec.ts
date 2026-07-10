import { GetCoverageScoresUseCase } from "./get-coverage-scores.usecase";
import type { DestinationMirrorRepository } from "../ports/destination-mirror.repository";
import type { DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
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
    hotelGroupId: null,
    isFeatured: false,
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

describe("GetCoverageScoresUseCase (destination-spec §2.2.2)", () => {
  it("chi tinh diem da published, sap xep diem thap truoc", async () => {
    const mirrors = [
      fakeMirror({ slug: "day-du", siteId: 1, name: "Đầy đủ", addressNew: "X", lat: "1", lng: "1", thumbnail: "a.webp" }),
      fakeMirror({ slug: "trong-rong", siteId: 2, name: "Trống", addressNew: null }),
      fakeMirror({ slug: "chua-publish", siteId: null, siteStatus: null, name: "Chưa publish" }),
    ];
    const mirrorRepo = { findAll: async () => mirrors } as unknown as DestinationMirrorRepository;
    const siteDb = {
      fetchContentCoverageRows: async () => [
        {
          destinationId: 1,
          hasOpeningTime: true,
          hasTicketPrice: true,
          hasFaq: true,
          hasPracticalNotes: true,
          hasTicketLinks: true,
          hasMainContent: true,
        },
      ],
      fetchTagAssignments: async () => [
        { destinationId: 1, destinationSlug: "day-du", destinationName: "Đầy đủ", tagSlugs: ["hoang-so"] },
      ],
    } as unknown as DichoithoiSiteDb;
    const usecase = new GetCoverageScoresUseCase(mirrorRepo, siteDb);

    const result = await usecase.execute();

    expect(result.items.map((i) => i.destinationSlug)).toEqual(["trong-rong", "day-du"]);
    expect(result.items.find((i) => i.destinationSlug === "day-du")?.scorePercent).toBe(100);
    expect(result.items.find((i) => i.destinationSlug === "trong-rong")?.scorePercent).toBe(0);
  });

  it("cluster co con IsFeatured -> tinh hasFeaturedChild true", async () => {
    const mirrors = [
      fakeMirror({ slug: "vung", siteId: 1, kind: "cluster", name: "Vùng" }),
      fakeMirror({ slug: "con-noi-bat", siteId: 2, parentSlug: "vung", isFeatured: true, name: "Con" }),
    ];
    const mirrorRepo = { findAll: async () => mirrors } as unknown as DestinationMirrorRepository;
    const siteDb = {
      fetchContentCoverageRows: async () => [],
      fetchTagAssignments: async () => [],
    } as unknown as DichoithoiSiteDb;
    const usecase = new GetCoverageScoresUseCase(mirrorRepo, siteDb);

    const result = await usecase.execute();

    const vung = result.items.find((i) => i.destinationSlug === "vung");
    expect(vung?.tier).toBe("flagship");
    expect(vung?.items.find((it) => it.key === "featured-child")?.done).toBe(true);
  });
});
