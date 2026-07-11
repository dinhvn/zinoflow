import { SaveArticleDestinationMapUseCase } from "./save-article-destination-map.usecase";
import type { ArticlePublicationRepository } from "../ports/article-publication.repository";
import type { ArticleSiteDb } from "../ports/article-site-db.port";

describe("SaveArticleDestinationMapUseCase (article-spec §8.1)", () => {
  it("ghi de gan ket theo siteId cua bai da publish", async () => {
    const publications = {
      findByJobId: async () => ({
        jobId: "job-1",
        siteId: 10,
        slug: "am-thuc-da-lat",
        publishedAt: new Date(),
        lastRefreshedAt: null,
      }),
    } as unknown as ArticlePublicationRepository;
    const replaceDestinationMap = jest.fn();
    const siteDb = { replaceDestinationMap } as unknown as ArticleSiteDb;

    const usecase = new SaveArticleDestinationMapUseCase(publications, siteDb);
    await usecase.execute("job-1", { items: [{ destinationSlug: "da-lat", topic: "food", order: 0 }] });

    expect(replaceDestinationMap).toHaveBeenCalledWith(10, [
      { destinationSlug: "da-lat", topic: "food", order: 0 },
    ]);
  });

  it("bao loi khi bai chua publish", async () => {
    const publications = { findByJobId: async () => null } as unknown as ArticlePublicationRepository;
    const usecase = new SaveArticleDestinationMapUseCase(publications, {} as ArticleSiteDb);

    await expect(usecase.execute("job-x", { items: [] })).rejects.toThrow("chưa publish");
  });
});
