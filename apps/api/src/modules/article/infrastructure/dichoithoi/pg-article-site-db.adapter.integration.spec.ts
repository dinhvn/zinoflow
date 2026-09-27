import {
  SITE_TEST_LOCK_TIMEOUT_MS,
  openSiteTestDatabase,
  type SiteTestDatabase,
  describeWithSiteDb,
  resetSiteData,
} from "../../../shared/dichoithoi-site-db/testing/site-db-test-harness";
import type { UpsertArticleInput } from "../../application/ports/article-site-db.port";
import { PgArticleSiteDbAdapter } from "./pg-article-site-db.adapter";

function articleInput(overrides: Partial<UpsertArticleInput> = {}): UpsertArticleInput {
  return {
    siteId: null,
    slug: "an-gi-o-da-lat",
    title: "Ăn gì ở Đà Lạt",
    shortDescription: "Bánh căn, lẩu gà lá é",
    thumbnail: null,
    contentHtml: "<p>Bánh căn Nhà Chung</p>",
    metaTitle: null,
    metaDescription: null,
    category: "am-thuc",
    ...overrides,
  };
}

describeWithSiteDb("PgArticleSiteDbAdapter (PostgreSQL that)", () => {
  let site: SiteTestDatabase;
  let adapter: PgArticleSiteDbAdapter;

  beforeAll(async () => {
    site = await openSiteTestDatabase();
    adapter = new PgArticleSiteDbAdapter(site.db);
  }, SITE_TEST_LOCK_TIMEOUT_MS);

  beforeEach(async () => {
    await resetSiteData(site.db);
    await site.db.query(
      `INSERT INTO v2.destination (slug, kind, name, name_unaccented) VALUES ('da-lat', 2, 'Đà Lạt', 'Da Lat')`,
    );
  });

  afterAll(() => site.close());

  it("publishes on insert and keeps the first published_at on update", async () => {
    const { siteId } = await adapter.upsertArticle(articleInput());
    await site.db.query(`UPDATE v2.article SET published_at = '2026-08-01T00:00:00Z' WHERE id = @siteId`, { siteId });

    await adapter.upsertArticle(articleInput({ siteId, title: "Ăn gì ở Đà Lạt 2026" }));
    await adapter.updateContentHtml(siteId, "<p>Lẩu gà lá é</p>");

    const { rows } = await site.db.query<{ title: string; status: number; published_at: Date; content_html: string }>(
      `SELECT title, status, published_at, content_html FROM v2.article WHERE id = @siteId`,
      { siteId },
    );
    expect(rows[0]).toMatchObject({ title: "Ăn gì ở Đà Lạt 2026", status: 1, content_html: "<p>Lẩu gà lá é</p>" });
    expect(rows[0]!.published_at.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });

  it("replaces the destination map and skips slugs missing on the website", async () => {
    const { siteId } = await adapter.upsertArticle(articleInput());
    await adapter.replaceDestinationMap(siteId, [{ destinationSlug: "da-lat", topic: "an-gi", order: 5 }]);

    await adapter.replaceDestinationMap(siteId, [
      { destinationSlug: "da-lat", topic: "an-gi", order: 1 },
      { destinationSlug: "khong-ton-tai", topic: "an-gi", order: 2 },
    ]);

    expect(await adapter.fetchDestinationMap(siteId)).toEqual([{ destinationSlug: "da-lat", topic: "an-gi", order: 1 }]);
    await adapter.replaceDestinationMap(siteId, []);
    expect(await adapter.fetchDestinationMap(siteId)).toEqual([]);
  });
});
