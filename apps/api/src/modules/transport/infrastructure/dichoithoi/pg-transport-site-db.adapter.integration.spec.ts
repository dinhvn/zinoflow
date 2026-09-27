import { UpstreamApiError } from "../../../shared/errors/app-error";
import {
  SITE_TEST_LOCK_TIMEOUT_MS,
  openSiteTestDatabase,
  type SiteTestDatabase,
  describeWithSiteDb,
  resetSiteData,
} from "../../../shared/dichoithoi-site-db/testing/site-db-test-harness";
import type { PublishTransportInput } from "../../application/ports/transport-site-db.port";
import { PgTransportSiteDbAdapter } from "./pg-transport-site-db.adapter";

const BUS_MODE = 2;

function transportInput(overrides: Partial<PublishTransportInput> = {}): PublishTransportInput {
  return {
    siteId: null,
    mode: BUS_MODE,
    operatorName: "Nhà xe Phương Trang",
    phone: "19006067",
    vehicleType: "Giường nằm",
    priceFrom: 300000,
    thumbnailUrl: null,
    provider: null,
    sourceUrl: null,
    affiliateUrl: null,
    linkStatus: "no-rule",
    ...overrides,
  };
}

describeWithSiteDb("PgTransportSiteDbAdapter (PostgreSQL that)", () => {
  let site: SiteTestDatabase;
  let adapter: PgTransportSiteDbAdapter;
  let clusterId: number;
  let poiId: number;

  beforeAll(async () => {
    site = await openSiteTestDatabase();
    adapter = new PgTransportSiteDbAdapter(site.db);
  }, SITE_TEST_LOCK_TIMEOUT_MS);

  beforeEach(async () => {
    await resetSiteData(site.db);
    const { rows } = await site.db.query<{ id: number }>(
      `INSERT INTO v2.destination (slug, kind, name, name_unaccented)
       VALUES ('sai-gon', 2, 'Sài Gòn', 'Sai Gon'), ('da-lat', 2, 'Đà Lạt', 'Da Lat')
       RETURNING id`,
    );
    clusterId = rows[1]!.id;
    const poi = await site.db.query<{ id: number }>(
      `INSERT INTO v2.destination (slug, kind, parent_id, name, name_unaccented)
       VALUES ('thac-trieu-hai', 3, @clusterId, 'Thác Triệu Hải', 'Thac Trieu Hai') RETURNING id`,
      { clusterId },
    );
    poiId = poi.rows[0]!.id;
  });

  afterAll(() => site.close());

  it("replaces stops and resolves a POI to its parent cluster when listing cards", async () => {
    const { siteId } = await adapter.upsertTransport(transportInput());
    await adapter.replaceStops(siteId, [
      { destinationSlug: "sai-gon", role: "origin", seqOrder: 0 },
      { destinationSlug: "da-lat", role: "destination", seqOrder: 1 },
    ]);

    const fromPoi = await adapter.findCardsForDestination(poiId, BUS_MODE);

    expect(fromPoi.map((c) => c.id)).toEqual([siteId]);
    expect(fromPoi[0]).toMatchObject({ operatorName: "Nhà xe Phương Trang", priceFrom: 300000 });
    expect(await adapter.findPoiChildSlugs(clusterId)).toEqual(["thac-trieu-hai"]);
  });

  it("rolls back all stops when one slug does not exist", async () => {
    const { siteId } = await adapter.upsertTransport(transportInput());
    await adapter.replaceStops(siteId, [{ destinationSlug: "da-lat", role: "destination", seqOrder: 1 }]);

    await expect(
      adapter.replaceStops(siteId, [
        { destinationSlug: "sai-gon", role: "origin", seqOrder: 0 },
        { destinationSlug: "khong-ton-tai", role: "destination", seqOrder: 1 },
      ]),
    ).rejects.toBeInstanceOf(UpstreamApiError);

    const { rows } = await site.db.query<{ destination_id: number }>(`SELECT destination_id FROM v2.transport_stop`);
    expect(rows).toEqual([{ destination_id: clusterId }]);
  });

  it("deletes a transport with its stops", async () => {
    const { siteId } = await adapter.upsertTransport(transportInput());
    await adapter.upsertTransport(transportInput({ siteId, operatorName: "Nhà xe Thành Bưởi" }));
    await adapter.replaceStops(siteId, [{ destinationSlug: "da-lat", role: "destination", seqOrder: 1 }]);

    await adapter.deleteTransport(siteId);

    const { rows } = await site.db.query(`SELECT 1 FROM v2.transport UNION ALL SELECT 1 FROM v2.transport_stop`);
    expect(rows).toEqual([]);
  });
});
