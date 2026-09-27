import {
  SITE_TEST_LOCK_TIMEOUT_MS,
  openSiteTestDatabase,
  type SiteTestDatabase,
  describeWithSiteDb,
  resetSiteData,
} from "../../../shared/dichoithoi-site-db/testing/site-db-test-harness";
import type { PublishTourInput } from "../../application/ports/tour-site-db.port";
import { PgTourSiteDbAdapter } from "./pg-tour-site-db.adapter";

function tourInput(overrides: Partial<PublishTourInput> = {}): PublishTourInput {
  return {
    siteId: null,
    name: "Tour Đà Lạt 3 ngày 2 đêm",
    shortDescription: "Săn mây, đồi chè Cầu Đất",
    durationDays: 3,
    durationNights: 2,
    departureFrom: "TP. Hồ Chí Minh",
    provinceCode: "68",
    priceFrom: 2490000,
    rating: 4.7,
    reviewCount: 80,
    thumbnailUrl: null,
    imagesJson: "[]",
    provider: "klook",
    sourceUrl: "https://example.com/tour-da-lat",
    affiliateUrl: null,
    linkStatus: "no-rule",
    ...overrides,
  };
}

describeWithSiteDb("PgTourSiteDbAdapter (PostgreSQL that)", () => {
  let site: SiteTestDatabase;
  let adapter: PgTourSiteDbAdapter;

  beforeAll(async () => {
    site = await openSiteTestDatabase();
    adapter = new PgTourSiteDbAdapter(site.db);
  }, SITE_TEST_LOCK_TIMEOUT_MS);

  beforeEach(async () => {
    await resetSiteData(site.db);
    await site.db.query(
      `INSERT INTO v2.destination (slug, kind, name, name_unaccented) VALUES ('da-lat', 2, 'Đà Lạt', 'Da Lat')`,
    );
  });

  afterAll(() => site.close());

  it("upserts a tour, assigns it and returns cards", async () => {
    const { siteId } = await adapter.upsertTour(tourInput());
    await adapter.upsertTour(tourInput({ siteId, durationDays: 4 }));
    await adapter.assignToDestination(siteId, "da-lat", true, false);
    await adapter.assignToDestination(siteId, "da-lat", false, true);

    const cards = await adapter.findCardsForDestination("da-lat", 6);

    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ id: siteId, name: "Tour Đà Lạt 3 ngày 2 đêm", durationDays: 4, rating: 4.7 });
    const { rows } = await site.db.query<{ is_primary: boolean; is_manual: boolean }>(
      `SELECT is_primary, is_manual FROM v2.tour_destination_map`,
    );
    expect(rows).toEqual([{ is_primary: false, is_manual: true }]);
  });

  it("unassigns by destination slug", async () => {
    const { siteId } = await adapter.upsertTour(tourInput());
    await adapter.assignToDestination(siteId, "da-lat", true, false);

    await adapter.unassignFromDestination(siteId, "da-lat");

    expect(await adapter.findDestinationSlugsForTour(siteId)).toEqual([]);
  });
});
