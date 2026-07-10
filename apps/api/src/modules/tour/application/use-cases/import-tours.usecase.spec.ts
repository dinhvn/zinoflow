import { ImportToursUseCase } from "./import-tours.usecase";
import { UpsertTourUseCase } from "./upsert-tour.usecase";
import type { TourRecord, TourRepository, UpsertTourInput } from "../ports/tour.repository";
import type { ImportToursRequest } from "@zinoflow/contracts";

function fakeRecord(overrides: Partial<TourRecord> = {}): TourRecord {
  return {
    id: "t1",
    name: "Tour Đà Lạt 3N2Đ",
    shortDescription: null,
    durationDays: 3,
    durationNights: 2,
    departureFrom: null,
    provinceCode: "68",
    priceFrom: null,
    rating: null,
    reviewCount: null,
    thumbnailUrl: null,
    thumbnailSourceUrl: null,
    images: [],
    imageSourceUrls: [],
    provider: null,
    sourceUrl: "https://klook.com/a",
    affiliateUrl: null,
    linkStatus: "no-rule",
    source: 0,
    siteId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("ImportToursUseCase (tour-spec §5, product-spec §5.1)", () => {
  function setup(existing: TourRecord[]) {
    const created: string[] = [];
    const updated: string[] = [];
    const tours: TourRepository = {
      findAll: async () => existing,
      findById: async (id) => existing.find((e) => e.id === id) ?? null,
      create: async (input: UpsertTourInput) => {
        created.push(input.sourceUrl);
        return fakeRecord({ ...input, id: "new-id" });
      },
      update: async (id, input: UpsertTourInput) => {
        updated.push(id);
        return fakeRecord({ ...input, id });
      },
      setSiteId: async () => {},
      countDestinationsByTour: async () => new Map(),
      assignToDestination: async () => {},
      unassignFromDestination: async () => {},
      listForDestination: async () => [],
    };
    const upsertTour = {
      create: async (r: { sourceUrl: string }) => {
        created.push(r.sourceUrl);
        return {} as never;
      },
      update: async (id: string) => {
        updated.push(id);
        return {} as never;
      },
    } as unknown as UpsertTourUseCase;

    return { usecase: new ImportToursUseCase(tours, upsertTour), created, updated };
  }

  function baseRequest(overrides: Partial<ImportToursRequest> = {}): ImportToursRequest {
    return { items: [], dryRun: true, ...overrides };
  }

  it("khop sourceUrl -> update, khong khop -> create", async () => {
    const { usecase, created, updated } = setup([fakeRecord()]);

    const result = await usecase.execute(
      baseRequest({
        dryRun: false,
        items: [
          { name: "Tour Đà Lạt 3N2Đ", sourceUrl: "https://klook.com/a" } as never,
          { name: "Tour Phú Quốc", sourceUrl: "https://klook.com/new" } as never,
        ],
      }),
    );

    expect(updated).toEqual(["t1"]);
    expect(created).toEqual(["https://klook.com/new"]);
    expect(result.updated).toBe(1);
    expect(result.created).toBe(1);
  });

  it("needsConfirm khong tu dong ghi de", async () => {
    const { usecase, updated } = setup([fakeRecord()]);

    const result = await usecase.execute(
      baseRequest({
        dryRun: false,
        items: [
          { name: "tour da lat 3n2d", sourceUrl: "https://viator.com/b", provinceCode: "68" } as never,
        ],
      }),
    );

    expect(updated).toHaveLength(0);
    expect(result.needsConfirm).toBe(1);
  });
});
