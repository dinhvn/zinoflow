import { ImportHotelsUseCase } from "./import-hotels.usecase";
import { UpsertHotelUseCase } from "./upsert-hotel.usecase";
import type { HotelRecord, HotelRepository, UpsertHotelInput } from "../ports/hotel.repository";
import type { ImportHotelsRequest } from "@zinoflow/contracts";

function fakeRecord(overrides: Partial<HotelRecord> = {}): HotelRecord {
  return {
    id: "h1",
    name: "Khách sạn Biển Xanh",
    address: null,
    lat: null,
    lng: null,
    provinceCode: "40",
    priceFrom: null,
    rating: null,
    reviewCount: null,
    thumbnailUrl: null,
    thumbnailSourceUrl: null,
    images: [],
    imageSourceUrls: [],
    provider: null,
    sourceUrl: "https://booking.com/a",
    affiliateUrl: null,
    linkStatus: "no-rule",
    source: 0,
    siteId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("ImportHotelsUseCase (hotel-spec §5, product-spec §5.1)", () => {
  function setup(existing: HotelRecord[]) {
    const created: string[] = [];
    const updated: string[] = [];
    const hotels: HotelRepository = {
      findAll: async () => existing,
      findById: async (id) => existing.find((e) => e.id === id) ?? null,
      create: async (input: UpsertHotelInput) => {
        created.push(input.sourceUrl);
        return fakeRecord({ ...input, id: "new-id" });
      },
      update: async (id, input: UpsertHotelInput) => {
        updated.push(id);
        return fakeRecord({ ...input, id });
      },
      setSiteId: async () => {},
      countDestinationsByHotel: async () => new Map(),
      assignToDestination: async () => {},
      unassignFromDestination: async () => {},
      listForDestination: async () => [],
    };
    const upsertHotel = {
      create: async (r: { sourceUrl: string }) => {
        created.push(r.sourceUrl);
        return {} as never;
      },
      update: async (id: string) => {
        updated.push(id);
        return {} as never;
      },
    } as unknown as UpsertHotelUseCase;

    const usecase = new ImportHotelsUseCase(hotels, upsertHotel);
    return { usecase, created, updated };
  }

  function baseRequest(overrides: Partial<ImportHotelsRequest> = {}): ImportHotelsRequest {
    return { items: [], dryRun: true, ...overrides };
  }

  it("dry-run khong ghi DB, chi phan loai", async () => {
    const { usecase, created, updated } = setup([fakeRecord()]);

    const result = await usecase.execute(
      baseRequest({
        items: [
          {
            name: "Khách sạn Biển Xanh",
            sourceUrl: "https://booking.com/a",
          } as never,
          {
            name: "Khách sạn Mới",
            sourceUrl: "https://booking.com/new",
          } as never,
        ],
      }),
    );

    expect(created).toHaveLength(0);
    expect(updated).toHaveLength(0);
    expect(result.updated).toBe(1);
    expect(result.created).toBe(1);
    expect(result.rows.every((r) => !r.applied)).toBe(true);
  });

  it("apply thuc su ghi create/update", async () => {
    const { usecase, created, updated } = setup([fakeRecord()]);

    const result = await usecase.execute(
      baseRequest({
        dryRun: false,
        items: [
          { name: "Khách sạn Biển Xanh", sourceUrl: "https://booking.com/a" } as never,
          { name: "Khách sạn Mới", sourceUrl: "https://booking.com/new" } as never,
        ],
      }),
    );

    expect(updated).toEqual(["h1"]);
    expect(created).toEqual(["https://booking.com/new"]);
    expect(result.rows.every((r) => r.applied)).toBe(true);
  });

  it("needsConfirm khong tu dong ghi de neu thieu confirmMergeIds", async () => {
    const { usecase, updated } = setup([fakeRecord()]);

    const result = await usecase.execute(
      baseRequest({
        dryRun: false,
        items: [
          { name: "khach san bien xanh", sourceUrl: "https://agoda.com/b", provinceCode: "40" } as never,
        ],
      }),
    );

    expect(updated).toHaveLength(0);
    expect(result.needsConfirm).toBe(1);
    expect(result.rows[0]!.applied).toBe(false);
  });

  it("needsConfirm ghi de khi co confirmMergeIds dung matchedId", async () => {
    const { usecase, updated } = setup([fakeRecord()]);

    const result = await usecase.execute(
      baseRequest({
        dryRun: false,
        confirmMergeIds: { "https://agoda.com/b": "h1" },
        items: [
          { name: "khach san bien xanh", sourceUrl: "https://agoda.com/b", provinceCode: "40" } as never,
        ],
      }),
    );

    expect(updated).toEqual(["h1"]);
    expect(result.rows[0]!.applied).toBe(true);
  });
});
