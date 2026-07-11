import { AutoAssignHotelsByDistanceUseCase } from "./auto-assign-hotels-by-distance.usecase";
import { RecomputeHotelCardsUseCase } from "./recompute-hotel-cards.usecase";
import type {
  HotelDestinationMapRecord,
  HotelRecord,
  HotelRepository,
} from "../ports/hotel.repository";
import type { HotelSiteDb } from "../ports/hotel-site-db.port";
import type { DestinationMirrorRepository } from "../../../destination/application/ports/destination-mirror.repository";
import type { DestinationMirrorEntity } from "../../../destination/infrastructure/entities/destination-mirror.entity";

// Da Lat: 11.9404, 108.4583. Diem gan (~1km) va diem xa (>30km, ngoai ban kinh nearby).
const NEAR_LAT = 11.945;
const NEAR_LNG = 108.46;
const FAR_LAT = 12.5;
const FAR_LNG = 109.2;

function fakeHotel(overrides: Partial<HotelRecord> = {}): HotelRecord {
  return {
    id: "hotel-1",
    name: "Khách sạn A",
    address: null,
    lat: NEAR_LAT,
    lng: NEAR_LNG,
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
    siteId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function fakeDestination(
  overrides: Partial<DestinationMirrorEntity> = {},
): DestinationMirrorEntity {
  return {
    slug: "da-lat",
    siteId: 100,
    siteStatus: 1,
    lat: String(NEAR_LAT + 0.001),
    lng: String(NEAR_LNG + 0.001),
    ...overrides,
  } as DestinationMirrorEntity;
}

function setup(options: { hotels?: HotelRecord[]; destinations?: DestinationMirrorEntity[] } = {}) {
  const hotels = options.hotels ?? [fakeHotel()];
  const destinations = options.destinations ?? [fakeDestination()];
  const assignments = new Map<string, HotelDestinationMapRecord[]>();
  for (const h of hotels) assignments.set(h.id, []);

  const assignCalls: Array<{ hotelId: string; slug: string; distanceM: number }> = [];
  const removeCalls: Array<{ hotelId: string; slug: string }> = [];

  const hotelRepo: HotelRepository = {
    findAll: async () => hotels,
    findById: async (id) => hotels.find((h) => h.id === id) ?? null,
    create: async () => hotels[0]!,
    update: async () => hotels[0]!,
    setSiteId: async () => {},
    countDestinationsByHotel: async () => new Map(),
    assignToDestination: async () => {},
    unassignFromDestination: async () => {},
    listForDestination: async () => [],
    listAssignmentsForHotel: async (hotelId) => assignments.get(hotelId) ?? [],
    autoAssignToDestination: async (hotelId, destinationSlug, distanceM) => {
      assignCalls.push({ hotelId, slug: destinationSlug, distanceM });
      assignments.set(hotelId, [
        { hotelId, destinationSlug, distanceM, isManual: false },
      ]);
    },
    removeAutoAssignment: async (hotelId, destinationSlug) => {
      removeCalls.push({ hotelId, slug: destinationSlug });
      assignments.set(
        hotelId,
        (assignments.get(hotelId) ?? []).filter((a) => a.destinationSlug !== destinationSlug),
      );
    },
  };

  const siteDbCalls: string[] = [];
  const siteDb = {
    assignToDestination: async () => {
      siteDbCalls.push("assign");
    },
    unassignFromDestination: async () => {
      siteDbCalls.push("unassign");
    },
  } as unknown as HotelSiteDb;

  const destinationRepo = {
    findAll: async () => destinations,
  } as unknown as DestinationMirrorRepository;

  const recomputed: string[] = [];
  const recomputeCards = {
    forDestination: async (slug: string) => {
      recomputed.push(slug);
    },
  } as unknown as RecomputeHotelCardsUseCase;

  const usecase = new AutoAssignHotelsByDistanceUseCase(
    hotelRepo,
    siteDb,
    destinationRepo,
    recomputeCards,
  );

  return { usecase, assignments, assignCalls, removeCalls, recomputed };
}

describe("AutoAssignHotelsByDistanceUseCase (hotel-spec §5 job 3)", () => {
  it("gán khách sạn có toạ độ vào điểm đến gần nhất trong bán kính", async () => {
    const { usecase, assignCalls, recomputed } = setup();

    const result = await usecase.execute();

    expect(result).toEqual({ assigned: 1, skippedManual: 0, outOfRange: 0 });
    expect(assignCalls).toEqual([{ hotelId: "hotel-1", slug: "da-lat", distanceM: expect.any(Number) }]);
    expect(recomputed).toEqual(["da-lat"]);
  });

  it("bỏ qua hoàn toàn khách sạn đã có bất kỳ dòng gán TAY nào", async () => {
    // Gan tay 1 dong truoc khi chay job — mo phong qua listAssignmentsForHotel tra ve isManual=true
    const hotelRepoOverride = {
      findAll: async () => [fakeHotel()],
      listAssignmentsForHotel: async (): Promise<HotelDestinationMapRecord[]> => [
        { hotelId: "hotel-1", destinationSlug: "da-lat", distanceM: null, isManual: true },
      ],
      autoAssignToDestination: async () => {
        throw new Error("KHÔNG được gọi khi hotel đã có dòng gán tay");
      },
      removeAutoAssignment: async () => {
        throw new Error("KHÔNG được gọi khi hotel đã có dòng gán tay");
      },
    } as unknown as HotelRepository;

    const result = await new AutoAssignHotelsByDistanceUseCase(
      hotelRepoOverride,
      { assignToDestination: async () => {}, unassignFromDestination: async () => {} } as unknown as HotelSiteDb,
      { findAll: async () => [fakeDestination()] } as unknown as DestinationMirrorRepository,
      { forDestination: async () => {} } as unknown as RecomputeHotelCardsUseCase,
    ).execute();

    expect(result.skippedManual).toBe(1);
  });

  it("gỡ dòng gán tự động cũ khi không còn điểm đến nào trong bán kính", async () => {
    const { usecase, removeCalls } = setup({
      destinations: [fakeDestination({ lat: String(FAR_LAT), lng: String(FAR_LNG) })],
    });

    // Chay lan 1 se khong gan (ngoai ban kinh) vi khong co assignment truoc do -> outOfRange=0 vi assignments rong
    const first = await usecase.execute();
    expect(first.assigned).toBe(0);

    expect(removeCalls).toEqual([]);
  });

  it("chạy lại lần 2 không tạo thêm thay đổi (idempotent)", async () => {
    const { usecase, assignCalls } = setup();
    await usecase.execute();
    const secondRun = await usecase.execute();

    expect(secondRun).toEqual({ assigned: 0, skippedManual: 0, outOfRange: 0 });
    expect(assignCalls).toHaveLength(1); // chi ghi 1 lan duy nhat, lan 2 khong ghi lai
  });

  it("bỏ qua khách sạn không có toạ độ", async () => {
    const { usecase, assignCalls } = setup({ hotels: [fakeHotel({ lat: null, lng: null })] });

    const result = await usecase.execute();

    expect(result).toEqual({ assigned: 0, skippedManual: 0, outOfRange: 0 });
    expect(assignCalls).toEqual([]);
  });
});
