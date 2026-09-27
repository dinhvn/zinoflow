import {
  SITE_TEST_LOCK_TIMEOUT_MS,
  TEST_TAG_SLUG_PREFIX,
  openSiteTestDatabase,
  type SiteTestDatabase,
  describeWithSiteDb,
  resetSiteData,
} from "../../../shared/dichoithoi-site-db/testing/site-db-test-harness";
import type {
  PublishDestinationInput,
  SiteDestinationMeta,
} from "../../application/ports/dichoithoi-site-db.port";
import { PgSiteDbAdapter } from "./pg-site-db.adapter";

const LAM_DONG_CODE = "68";

function meta(overrides: Partial<SiteDestinationMeta>): SiteDestinationMeta {
  return {
    slug: "da-lat",
    kind: "cluster",
    parentSlug: null,
    provinceCode: LAM_DONG_CODE,
    name: "Đà Lạt",
    nameUnaccented: "Da Lat",
    shortDescription: null,
    thumbnail: null,
    lat: 11.940419,
    lng: 108.458313,
    googleMapsUrl: null,
    addressNew: null,
    addressOld: null,
    contactPhone: null,
    contactWebsite: null,
    hotelGroupId: null,
    priority: 3,
    contentTier: null,
    ...overrides,
  };
}

function publishInput(siteId: number, overrides: Partial<PublishDestinationInput> = {}): PublishDestinationInput {
  return {
    siteId,
    title: "Thác Triệu Hải — hướng dẫn đi chơi",
    thumbnail: "thac-trieu-hai/thumb.webp",
    shortDescription: "Thác nước hùng vĩ giữa rừng thông",
    searchKeyword: "thac trieu hai",
    contentHtml: "<p>Nội dung tiếng Việt có dấu đầy đủ</p>",
    openingTime: "7:00 - 17:00",
    ticketPrice: "50.000đ",
    transport: null,
    food: null,
    hotel: "",
    tip: "",
    faqJson: "[]",
    ticketLinksJson: "[]",
    priceBreakdownJson: "[]",
    practicalNotesJson: "[]",
    galleryJson: "[]",
    metaTitle: "Thác Triệu Hải",
    metaDescription: "Mô tả",
    mentionedTargetSiteIds: [],
    contentChanged: true,
    ...overrides,
  };
}

describeWithSiteDb("PgSiteDbAdapter (PostgreSQL that)", () => {
  let site: SiteTestDatabase;
  let adapter: PgSiteDbAdapter;

  beforeAll(async () => {
    site = await openSiteTestDatabase();
    adapter = new PgSiteDbAdapter(site.db);
  }, SITE_TEST_LOCK_TIMEOUT_MS);

  beforeEach(() => resetSiteData(site.db));

  afterAll(() => site.close());

  async function createClusterWithPoi(): Promise<{ clusterId: number; poiId: number }> {
    const { siteId: clusterId } = await adapter.createDestination(meta({}));
    const { siteId: poiId } = await adapter.createDestination(
      meta({ slug: "thac-trieu-hai", kind: "poi", parentSlug: "da-lat", name: "Thác Triệu Hải", nameUnaccented: "Thac Trieu Hai" }),
    );
    return { clusterId, poiId };
  }

  it("creates destinations resolving parent slug and province code, and reads them back", async () => {
    const { clusterId, poiId } = await createClusterWithPoi();

    const rows = await adapter.fetchAllDestinations();
    const poi = rows.find((r) => r.siteId === poiId);
    expect(poi).toMatchObject({
      slug: "thac-trieu-hai",
      kind: "poi",
      parentSlug: "da-lat",
      provinceCode: LAM_DONG_CODE,
      name: "Thác Triệu Hải",
      shortDescription: "",
      priority: 3,
      siteStatus: 1,
      contentHash: null,
      types: [],
    });
    expect(poi?.lat).toBeCloseTo(11.940419, 6);
    expect(poi?.siteUpdatedAt).toBeInstanceOf(Date);
    expect(rows.find((r) => r.siteId === clusterId)?.parentSlug).toBeNull();
  });

  it("publishes content in one transaction and returns the same hash that sync reads", async () => {
    const { clusterId, poiId } = await createClusterWithPoi();

    const { contentHash } = await adapter.publishDestination(
      publishInput(poiId, { mentionedTargetSiteIds: [clusterId, poiId, 999_999] }),
    );

    expect(contentHash).toMatch(/^[0-9A-F]{64}$/);
    const synced = (await adapter.fetchAllDestinations()).find((r) => r.siteId === poiId);
    expect(synced?.contentHash).toBe(contentHash);
    expect(synced?.contentSource).toBe(1);
    const content = await adapter.fetchDestinationContent(poiId);
    expect(content?.contentHtml).toBe("<p>Nội dung tiếng Việt có dấu đầy đủ</p>");
    expect(content?.contentUpdatedAt).toBeInstanceOf(Date);
    // Tu tham chieu va id khong ton tai bi bo qua, chi con quan he toi cum
    const { rows: relations } = await site.db.query<{ target_id: number }>(
      `SELECT target_id FROM v2.destination_relation WHERE source_id = @poiId`,
      { poiId },
    );
    expect(relations.map((r) => r.target_id)).toEqual([clusterId]);
  });

  it("keeps content_updated_at when republishing without a real content change", async () => {
    const { poiId } = await createClusterWithPoi();
    await adapter.publishDestination(publishInput(poiId));
    await site.db.query(
      `UPDATE v2.destination_content SET content_updated_at = '2026-01-01T00:00:00Z' WHERE destination_id = @poiId`,
      { poiId },
    );

    await adapter.publishDestination(publishInput(poiId, { contentChanged: false, tip: "Mẹo mới" }));

    const content = await adapter.fetchDestinationContent(poiId);
    expect(content?.tip).toBe("Mẹo mới");
    expect(content?.contentUpdatedAt?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("renames a slug, records the redirect and repoints article maps", async () => {
    const { poiId } = await createClusterWithPoi();
    const { rows } = await site.db.query<{ id: number }>(
      `INSERT INTO v2.article (slug, title, content_html) VALUES ('an-gi-da-lat', 'Ăn gì', '') RETURNING id`,
    );
    await site.db.query(
      `INSERT INTO v2.article_destination_map (article_id, destination_slug, topic) VALUES (@articleId, 'thac-trieu-hai', 'an-gi')`,
      { articleId: rows[0]!.id },
    );

    await adapter.renameSlug(poiId, "thac-trieu-hai", "thac-trieu-hai-da-lat");
    // Doi lan 2 cung old slug -> upsert redirect, khong nem loi PK
    await adapter.renameSlug(poiId, "thac-trieu-hai", "thac-trieu-hai-da-lat");

    expect(await adapter.fetchSlugRedirects()).toEqual(new Map([["thac-trieu-hai", "thac-trieu-hai-da-lat"]]));
    const { rows: maps } = await site.db.query<{ destination_slug: string }>(`SELECT destination_slug FROM v2.article_destination_map`);
    expect(maps).toEqual([{ destination_slug: "thac-trieu-hai-da-lat" }]);
  });

  it("replaces type assignments and keeps primary_type_id on the first slug", async () => {
    const { poiId } = await createClusterWithPoi();

    await adapter.replaceTypeAssignments("thac-trieu-hai", ["thac-ho-suoi", "nui-cao-nguyen"]);
    let assignment = (await adapter.fetchTypeAssignments()).find((a) => a.destinationId === poiId);
    expect(assignment?.typeSlugs.sort()).toEqual(["nui-cao-nguyen", "thac-ho-suoi"]);
    const { rows } = await site.db.query<{ slug: string }>(
      `SELECT t.slug FROM v2.destination d JOIN v2.destination_type t ON t.id = d.primary_type_id WHERE d.id = @poiId`,
      { poiId },
    );
    expect(rows[0]?.slug).toBe("thac-ho-suoi");

    await adapter.replaceTypeAssignments("thac-trieu-hai", []);
    assignment = (await adapter.fetchTypeAssignments()).find((a) => a.destinationId === poiId);
    expect(assignment?.typeSlugs).toEqual([]);
  });

  it("replaces tag assignments and counts tag usage", async () => {
    await createClusterWithPoi();
    await adapter.createTag({ slug: `${TEST_TAG_SLUG_PREFIX}san-may`, name: "Săn mây", description: null });

    await adapter.replaceTagAssignments("thac-trieu-hai", [
      "phu-hop-gia-dinh",
      `${TEST_TAG_SLUG_PREFIX}san-may`,
      "phu-hop-gia-dinh",
    ]);

    expect(await adapter.countTagUsage("phu-hop-gia-dinh")).toBe(1);
    expect(await adapter.countTagUsage(`${TEST_TAG_SLUG_PREFIX}san-may`)).toBe(1);
    expect((await adapter.fetchDestinationsForTag("phu-hop-gia-dinh")).map((t) => t.slug)).toEqual(["thac-trieu-hai"]);
  });

  it("writes precomputed JSON only when the value changes", async () => {
    const { poiId } = await createClusterWithPoi();
    await adapter.publishDestination(publishInput(poiId));

    expect(await adapter.updateRelatedJson(poiId, `[{"slug":"da-lat"}]`)).toBe(true);
    expect(await adapter.updateRelatedJson(poiId, `[{"slug":"da-lat"}]`)).toBe(false);
    expect(await adapter.fetchRelatedJson("thac-trieu-hai")).toEqual([{ slug: "da-lat" }]);
    expect(await adapter.updateAncestorsChildren(poiId, "[]", "[]")).toBe(true);
    expect(await adapter.updateAncestorsChildren(poiId, "[]", "[]")).toBe(false);
  });

  it("creates an empty content row when setting meta title before any publish", async () => {
    const { clusterId } = await createClusterWithPoi();

    await adapter.updateMetaTitle(clusterId, "Du lịch Đà Lạt");
    await adapter.updateMetaTitle(clusterId, "Du lịch Đà Lạt 2026");

    const { rows } = await site.db.query<{ meta_title: string; content_html: string }>(
      `SELECT meta_title, content_html FROM v2.destination_content WHERE destination_id = @clusterId`,
      { clusterId },
    );
    expect(rows).toEqual([{ meta_title: "Du lịch Đà Lạt 2026", content_html: "" }]);
  });

  it("filters destination cards by parent and sorts featured by priority", async () => {
    await createClusterWithPoi();
    await adapter.createDestination(
      meta({ slug: "ho-xuan-huong", kind: "poi", parentSlug: "da-lat", name: "Hồ Xuân Hương", nameUnaccented: "Ho Xuan Huong", priority: 1 }),
    );

    const cards = await adapter.findDestinationCards({ parentSlug: "da-lat", sort: "featured", limit: 10 });

    expect(cards.map((c) => c.slug)).toEqual(["ho-xuan-huong", "thac-trieu-hai"]);
    expect(await adapter.findDestinationCardBySlug("da-lat")).toMatchObject({ kind: "cluster", name: "Đà Lạt" });
  });

  it("computes coverage flags from content lengths", async () => {
    const { poiId } = await createClusterWithPoi();
    await adapter.publishDestination(publishInput(poiId, { contentHtml: "x".repeat(301), faqJson: `[{"q":"a"}]` }));

    const coverage = (await adapter.fetchContentCoverageRows()).find((r) => r.destinationId === poiId);

    expect(coverage).toMatchObject({
      hasOpeningTime: true,
      hasTicketPrice: true,
      hasFaq: true,
      hasPracticalNotes: false,
      hasMainContent: true,
      hasGallery: false,
    });
  });

  it("deletes a destination together with its content, maps and relations", async () => {
    const { clusterId, poiId } = await createClusterWithPoi();
    await adapter.publishDestination(publishInput(poiId, { mentionedTargetSiteIds: [clusterId] }));
    await adapter.replaceTypeAssignments("thac-trieu-hai", ["thac-ho-suoi"]);

    await adapter.deleteDestination(poiId, "thac-trieu-hai");

    expect((await adapter.fetchAllDestinations()).map((r) => r.slug)).toEqual(["da-lat"]);
    expect(await adapter.fetchDestinationContent(poiId)).toBeNull();
  });

  it("updates taxonomy descriptions with Vietnamese text intact", async () => {
    // Danh muc seed khong bi resetSiteData xoa — luu lai de tra ve nguyen trang sau test
    const { rows } = await site.db.query<{ id: number; description: string | null; meta_description: string | null; description_html: string | null }>(
      `SELECT id, description, meta_description, description_html FROM v2.province WHERE code = @code`,
      { code: LAM_DONG_CODE },
    );
    const original = rows[0]!;
    expect((await adapter.fetchTaxonomyContent()).provinces).toHaveLength(34);

    try {
      await adapter.updateTaxonomyDescription("province", original.id, "Cao nguyên Lâm Viên", null, "<p>Cao nguyên Lâm Viên</p>");

      const after = await adapter.fetchTaxonomyContent();
      expect(after.provinces.find((p) => p.id === original.id)?.description).toBe("Cao nguyên Lâm Viên");
    } finally {
      await adapter.updateTaxonomyDescription(
        "province",
        original.id,
        original.description,
        original.meta_description,
        original.description_html,
      );
    }
  });
});
