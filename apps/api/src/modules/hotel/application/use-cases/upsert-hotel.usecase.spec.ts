import { UpsertHotelUseCase } from "./upsert-hotel.usecase";
import { RecomputeHotelCardsUseCase } from "./recompute-hotel-cards.usecase";
import { ResolveAffiliateLinkUseCase } from "../../../affiliate/application/use-cases/resolve-affiliate-link.usecase";
import type { HotelRecord, HotelRepository, UpsertHotelInput } from "../ports/hotel.repository";
import type { HotelSiteDb } from "../ports/hotel-site-db.port";
import { QUEUE_NAMES, type JobQueue } from "../../../shared/jobs/job-queue.port";

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

describe("UpsertHotelUseCase (Phase 21.3, audit 07/2026 — ingest anh chuyen sang job nen)", () => {
  function setup() {
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
    const sentJobs: Array<{ queueName: string; data: object }> = [];
    const jobQueue: JobQueue = {
      send: async (queueName, data) => {
        sentJobs.push({ queueName, data });
        return "job-1";
      },
    };

    const usecase = new UpsertHotelUseCase(hotels, siteDb, resolveLink, recomputeCards, jobQueue);
    return { usecase, stored, sentJobs };
  }

  it("thumbnailUrl la URL ngoai -> publish NGAY voi URL goc, enqueue job image-ingest", async () => {
    const { usecase, stored, sentJobs } = setup();

    const result = await usecase.create({
      name: "Khách sạn A",
      sourceUrl: "https://booking.com/x",
      thumbnailUrl: "https://cdn.booking.com/photo.jpg",
    });

    // Khong ingest dong bo nua -> URL van la URL ngoai ngay sau khi tao
    expect(result.thumbnailUrl).toBe("https://cdn.booking.com/photo.jpg");
    expect(stored.current.thumbnailUrl).toBe("https://cdn.booking.com/photo.jpg");
    expect(sentJobs).toHaveLength(1);
    expect(sentJobs[0]).toEqual({
      queueName: QUEUE_NAMES.hotelImageIngest,
      data: { hotelId: "hotel-1" },
    });
  });

  it("khong enqueue job neu thumbnailUrl da la path noi bo (khong co scheme http)", async () => {
    const { usecase, sentJobs } = setup();

    await usecase.create({
      name: "Khách sạn A",
      sourceUrl: "https://booking.com/x",
      thumbnailUrl: "hotel-1/hotel-1-thumb.webp",
    });

    expect(sentJobs).toHaveLength(0);
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
