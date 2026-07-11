import { ArticleAutoLinkService } from "./article-auto-link.service";
import type { DestinationMirrorRepository } from "../../../destination/application/ports/destination-mirror.repository";
import type { DestinationMirrorEntity } from "../../../destination/infrastructure/entities/destination-mirror.entity";

function fakeDestination(
  overrides: Partial<DestinationMirrorEntity>,
): DestinationMirrorEntity {
  return {
    slug: "vinh-ha-long",
    name: "Vịnh Hạ Long",
    siteId: 1,
    siteStatus: 1,
    ...overrides,
  } as DestinationMirrorEntity;
}

describe("ArticleAutoLinkService (backlog §B Phase C muc 5 — auto-link dung chung)", () => {
  it("chen link toi diem den da publish duoc nhac trong bai", async () => {
    const mirrorRepo = {
      findAll: async () => [fakeDestination({})],
    } as unknown as DestinationMirrorRepository;
    const service = new ArticleAutoLinkService(mirrorRepo);

    const result = await service.linkHtml("<p>Ghé Vịnh Hạ Long dịp cuối tuần.</p>");

    expect(result.html).toContain('href="/diem-den/vinh-ha-long"');
    expect(result.addedLinks).toEqual([{ targetSlug: "vinh-ha-long", targetName: "Vịnh Hạ Long" }]);
  });

  it("bo qua diem den chua publish (siteId null hoac siteStatus khac 1)", async () => {
    const mirrorRepo = {
      findAll: async () => [fakeDestination({ siteId: null, siteStatus: null })],
    } as unknown as DestinationMirrorRepository;
    const service = new ArticleAutoLinkService(mirrorRepo);

    const result = await service.linkHtml("<p>Ghé Vịnh Hạ Long dịp cuối tuần.</p>");

    expect(result.html).not.toContain("href=");
  });
});
