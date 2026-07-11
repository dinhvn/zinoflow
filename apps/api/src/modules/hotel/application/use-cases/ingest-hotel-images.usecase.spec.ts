import { IngestHotelImagesUseCase } from "./ingest-hotel-images.usecase";
import { RecomputeHotelCardsUseCase } from "./recompute-hotel-cards.usecase";
import { IngestExternalImageUseCase } from "../../../shared/media/application/ingest-external-image.usecase";
import type { HotelRecord, HotelRepository, UpsertHotelInput } from "../ports/hotel.repository";
import type { HotelSiteDb } from "../ports/hotel-site-db.port";

function fakeRecord(overrides: Partial<HotelRecord> = {}): HotelRecord {
  return {
    id: "hotel-1",
    name: "Khách sạn A",
    address: null,
    lat: null,
    lng: null,
    provinceCode: null,
    priceFrom: null,
    rating: null,
    reviewCount: null,
    thumbnailUrl: null,
    thumbnailSourceUrl: null,
    images: [],
    imageSourceUrls: [],
    provider: null,
    sourceUrl: "https://booking.com/x",
    affiliateUrl: null,
    linkStatus: "no-rule",
    source: 0,
    siteId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("IngestHotelImagesUseCase (Phase 21.3, audit 07/2026 — job nen ingest anh khach san)", () => {
  function setup(options: {
    ingestImage?: IngestExternalImageUseCase;
    record?: HotelRecord;
  } = {}) {
    const stored = { current: options.record ?? fakeRecord() };
    const hotels: HotelRepository = {
      findAll: async () => [stored.current],
      findById: async () => stored.current,
      create: async () => stored.current,
      update: async (_id, input: UpsertHotelInput) => {
        stored.current = fakeRecord({ ...stored.current, ...input });
        return stored.current;
      },
      setSiteId: async () => {},
      countDestinationsByHotel: async () => new Map(),
      assignToDestination: async () => {},
      unassignFromDestination: async () => {},
      listForDestination: async () => [],
      listAssignmentsForHotel: async () => [],
      autoAssignToDestination: async () => {},
      removeAutoAssignment: async () => {},
    };
    const published: object[] = [];
    const siteDb: HotelSiteDb = {
      upsertHotel: async (input: object) => {
        published.push(input);
        return { siteId: 1 };
      },
    } as unknown as HotelSiteDb;
    const recomputeCards = { forHotel: async () => {} } as unknown as RecomputeHotelCardsUseCase;
    const ingested: string[] = [];
    const ingestImage =
      options.ingestImage ??
      ({
        execute: async (url: string) => {
          ingested.push(url);
          return { hero: "h.webp", medium: "m.webp", thumb: "t.webp" };
        },
      } as unknown as IngestExternalImageUseCase);

    const usecase = new IngestHotelImagesUseCase(hotels, siteDb, ingestImage, recomputeCards);
    return { usecase, stored, ingested, published };
  }

  it("ingest thumbnailUrl la URL ngoai va thay bang path noi bo, giu lai source", async () => {
    const { usecase, stored, ingested, published } = setup({
      record: fakeRecord({ thumbnailUrl: "https://cdn.booking.com/photo.jpg" }),
    });

    await usecase.execute("hotel-1");

    expect(ingested).toEqual(["https://cdn.booking.com/photo.jpg"]);
    expect(stored.current.thumbnailUrl).toBe("t.webp");
    expect(stored.current.thumbnailSourceUrl).toBe("https://cdn.booking.com/photo.jpg");
    expect(published).toHaveLength(1); // publish lai sau khi ingest xong
  });

  it("khong ingest lai neu thumbnailUrl da la path noi bo (khong co scheme http)", async () => {
    const { usecase, ingested, published } = setup({
      record: fakeRecord({ thumbnailUrl: "hotel-1/hotel-1-thumb.webp" }),
    });

    await usecase.execute("hotel-1");

    expect(ingested).toEqual([]);
    expect(published).toHaveLength(0); // khong co gi thay doi -> khong publish lai
  });

  it("ingest loi thi giu tam URL ngoai, khong nem loi", async () => {
    const failingIngest = {
      execute: async () => {
        throw new Error("Tải ảnh thất bại");
      },
    } as unknown as IngestExternalImageUseCase;
    const { usecase, stored } = setup({
      record: fakeRecord({ thumbnailUrl: "https://cdn.booking.com/photo.jpg" }),
      ingestImage: failingIngest,
    });

    await expect(usecase.execute("hotel-1")).resolves.not.toThrow();
    expect(stored.current.thumbnailUrl).toBe("https://cdn.booking.com/photo.jpg");
  });

  it("hotelId khong ton tai -> bo qua, khong nem loi", async () => {
    const hotels: HotelRepository = {
      findAll: async () => [],
      findById: async () => null,
      create: async () => {
        throw new Error("unused");
      },
      update: async () => {
        throw new Error("unused");
      },
      setSiteId: async () => {},
      countDestinationsByHotel: async () => new Map(),
      assignToDestination: async () => {},
      unassignFromDestination: async () => {},
      listForDestination: async () => [],
      listAssignmentsForHotel: async () => [],
      autoAssignToDestination: async () => {},
      removeAutoAssignment: async () => {},
    };
    const siteDb = { upsertHotel: async () => ({ siteId: 1 }) } as unknown as HotelSiteDb;
    const recomputeCards = { forHotel: async () => {} } as unknown as RecomputeHotelCardsUseCase;
    const ingestImage = {
      execute: async () => ({ hero: "", medium: "", thumb: "" }),
    } as unknown as IngestExternalImageUseCase;
    const missingUsecase = new IngestHotelImagesUseCase(hotels, siteDb, ingestImage, recomputeCards);

    await expect(missingUsecase.execute("khong-ton-tai")).resolves.not.toThrow();
  });
});
