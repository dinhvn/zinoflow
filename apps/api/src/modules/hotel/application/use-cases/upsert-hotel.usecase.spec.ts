import { UpsertHotelUseCase } from "./upsert-hotel.usecase";
import { RecomputeHotelCardsUseCase } from "./recompute-hotel-cards.usecase";
import { ResolveAffiliateLinkUseCase } from "../../../affiliate/application/use-cases/resolve-affiliate-link.usecase";
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

describe("UpsertHotelUseCase — ingest anh ngoai (destination-spec §14.5)", () => {
  function setup(options: { ingestImage?: IngestExternalImageUseCase } = {}) {
    const stored = { current: fakeRecord() };
    const hotels: HotelRepository = {
      findAll: async () => [stored.current],
      findById: async () => stored.current,
      create: async (input: UpsertHotelInput) => {
        stored.current = fakeRecord({ ...input });
        return stored.current;
      },
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
    const siteDb: HotelSiteDb = {
      upsertHotel: async () => ({ siteId: 1 }),
    } as unknown as HotelSiteDb;
    const resolveLink = {
      execute: async () => ({ provider: null, affiliateUrl: null, linkStatus: "no-rule" as const }),
    } as unknown as ResolveAffiliateLinkUseCase;
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

    const jobQueue = { send: async () => null } as unknown as import("../../../shared/jobs/job-queue.port").JobQueue;
    const usecase = new UpsertHotelUseCase(
      hotels,
      siteDb,
      resolveLink,
      recomputeCards,
      ingestImage,
      jobQueue,
    );
    return { usecase, stored, ingested };
  }

  it("ingest thumbnailUrl la URL ngoai va thay bang path noi bo, giu lai source", async () => {
    const { usecase, stored, ingested } = setup();

    const result = await usecase.create({
      name: "Khách sạn A",
      sourceUrl: "https://booking.com/x",
      thumbnailUrl: "https://cdn.booking.com/photo.jpg",
    });

    expect(ingested).toEqual(["https://cdn.booking.com/photo.jpg"]);
    expect(result.thumbnailUrl).toBe("t.webp");
    expect(stored.current.thumbnailSourceUrl).toBe("https://cdn.booking.com/photo.jpg");
  });

  it("khong ingest lai neu thumbnailUrl da la path noi bo (khong co scheme http)", async () => {
    const { usecase, ingested } = setup();

    await usecase.create({
      name: "Khách sạn A",
      sourceUrl: "https://booking.com/x",
      thumbnailUrl: "hotel-1/hotel-1-thumb.webp",
    });

    expect(ingested).toEqual([]);
  });

  it("ingest loi thi giu tam URL ngoai, khong chan viec luu", async () => {
    const failingIngest = {
      execute: async () => {
        throw new Error("Tải ảnh thất bại");
      },
    } as unknown as IngestExternalImageUseCase;
    const { usecase } = setup({ ingestImage: failingIngest });

    const result = await usecase.create({
      name: "Khách sạn A",
      sourceUrl: "https://booking.com/x",
      thumbnailUrl: "https://cdn.booking.com/photo.jpg",
    });

    expect(result.thumbnailUrl).toBe("https://cdn.booking.com/photo.jpg");
  });

  it("sua truong khong lien quan anh (vd doi gia) khong duoc xoa mat thumbnailSourceUrl da ingest truoc do", async () => {
    const { usecase, stored } = setup();
    stored.current = fakeRecord({
      thumbnailUrl: "hotel-1/hotel-1-thumb.webp",
      thumbnailSourceUrl: "https://cdn.booking.com/photo.jpg",
      images: ["hotel-1/hotel-1-anh-1.webp"],
      imageSourceUrls: ["https://cdn.booking.com/anh-1.jpg"],
    });

    const result = await usecase.update("hotel-1", {
      name: "Khách sạn A",
      sourceUrl: "https://booking.com/x",
      thumbnailUrl: "hotel-1/hotel-1-thumb.webp",
      images: ["hotel-1/hotel-1-anh-1.webp"],
      priceFrom: 500_000,
    });

    expect(result.priceFrom).toBe(500_000);
    expect(stored.current.thumbnailSourceUrl).toBe("https://cdn.booking.com/photo.jpg");
    expect(stored.current.imageSourceUrls).toEqual(["https://cdn.booking.com/anh-1.jpg"]);
  });
});
