import { UpstreamApiError } from "../../../shared/errors/app-error";
import {
  SITE_TEST_LOCK_TIMEOUT_MS,
  openSiteTestDatabase,
  type SiteTestDatabase,
  describeWithSiteDb,
  resetSiteData,
} from "../../../shared/dichoithoi-site-db/testing/site-db-test-harness";
import type { PublishHotelInput } from "../../application/ports/hotel-site-db.port";
import { PgHotelSiteDbAdapter } from "./pg-hotel-site-db.adapter";

function hotelInput(overrides: Partial<PublishHotelInput> = {}): PublishHotelInput {
  return {
    siteId: null,
    name: "Khách sạn Đồi Thông",
    address: "Phường 3, Đà Lạt",
    lat: 11.94,
    lng: 108.45,
    provinceCode: "68",
    priceFrom: 850000,
    rating: 8.6,
    reviewCount: 120,
    thumbnailUrl: null,
    imagesJson: "[]",
    provider: "agoda",
    sourceUrl: "https://example.com/khach-san-doi-thong",
    affiliateUrl: null,
    linkStatus: "no-rule",
    ...overrides,
  };
}

describeWithSiteDb("PgHotelSiteDbAdapter (PostgreSQL that)", () => {
  let site: SiteTestDatabase;
  let adapter: PgHotelSiteDbAdapter;

  beforeAll(async () => {
    site = await openSiteTestDatabase();
    adapter = new PgHotelSiteDbAdapter(site.db);
  }, SITE_TEST_LOCK_TIMEOUT_MS);

  beforeEach(async () => {
    await resetSiteData(site.db);
    await site.db.query(
      `INSERT INTO v2.destination (slug, kind, name, name_unaccented) VALUES ('da-lat', 2, 'Đà Lạt', 'Da Lat')`,
    );
  });

  afterAll(() => site.close());

  it("inserts then updates the same hotel row", async () => {
    const { siteId } = await adapter.upsertHotel(hotelInput());
    const updated = await adapter.upsertHotel(hotelInput({ siteId, name: "Khách sạn Đồi Thông Mới" }));

    expect(updated.siteId).toBe(siteId);
    const { rows } = await site.db.query<{ name: string; province_code: string; rating: string }>(
      `SELECT h.name, p.code AS province_code, h.rating FROM v2.hotel h JOIN v2.province p ON p.id = h.province_id`,
    );
    expect(rows).toEqual([{ name: "Khách sạn Đồi Thông Mới", province_code: "68", rating: "8.6" }]);
  });

  it("upserts the destination assignment and lists cards with unrated hotels last", async () => {
    const { siteId: rated } = await adapter.upsertHotel(hotelInput());
    const { siteId: unrated } = await adapter.upsertHotel(hotelInput({ name: "Nhà nghỉ chưa đánh giá", rating: null }));

    await adapter.assignToDestination(unrated, "da-lat", 900, false);
    await adapter.assignToDestination(rated, "da-lat", 500, false);
    await adapter.assignToDestination(rated, "da-lat", 450, true);

    const cards = await adapter.findCardsForDestination("da-lat", 10);
    expect(cards.map((c) => c.id)).toEqual([rated, unrated]);
    expect(cards[0]).toMatchObject({ priceFrom: 850000, rating: 8.6 });
    const { rows } = await site.db.query<{ distance_m: number; is_manual: boolean }>(
      `SELECT distance_m, is_manual FROM v2.hotel_destination_map WHERE hotel_id = @rated`,
      { rated },
    );
    expect(rows).toEqual([{ distance_m: 450, is_manual: true }]);
    expect(await adapter.findDestinationSlugsForHotel(rated)).toEqual(["da-lat"]);
  });

  it("fails loudly when assigning to a destination that is not on the website", async () => {
    const { siteId } = await adapter.upsertHotel(hotelInput());

    await expect(adapter.assignToDestination(siteId, "khong-ton-tai", null, false)).rejects.toBeInstanceOf(
      UpstreamApiError,
    );
  });

  it("unassigns by destination slug", async () => {
    const { siteId } = await adapter.upsertHotel(hotelInput());
    await adapter.assignToDestination(siteId, "da-lat", null, false);

    await adapter.unassignFromDestination(siteId, "da-lat");

    expect(await adapter.findDestinationSlugsForHotel(siteId)).toEqual([]);
  });
});
