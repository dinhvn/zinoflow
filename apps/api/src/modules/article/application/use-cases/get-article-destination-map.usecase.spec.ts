import { GetArticleDestinationMapUseCase } from "./get-article-destination-map.usecase";
import type { ArticlePublicationRepository } from "../ports/article-publication.repository";
import type { ArticleSiteDb } from "../ports/article-site-db.port";
import type { DestinationMirrorRepository } from "../../../destination/application/ports/destination-mirror.repository";

describe("GetArticleDestinationMapUseCase (article-spec §8.1)", () => {
  it("tra ve item kem ten diem den resolve tu mirror", async () => {
    const publications = {
      findByJobId: async () => ({
        jobId: "job-1",
        siteId: 10,
        slug: "am-thuc-da-lat",
        publishedAt: new Date(),
        lastRefreshedAt: null,
      }),
    } as unknown as ArticlePublicationRepository;
    const siteDb = {
      fetchDestinationMap: async () => [{ destinationSlug: "da-lat", topic: "food", order: 0 }],
    } as unknown as ArticleSiteDb;
    const mirrorRepo = {
      findAll: async () => [{ slug: "da-lat", name: "Đà Lạt" }],
    } as unknown as DestinationMirrorRepository;

    const usecase = new GetArticleDestinationMapUseCase(publications, siteDb, mirrorRepo);
    const result = await usecase.execute("job-1");

    expect(result.items).toEqual([
      { destinationSlug: "da-lat", destinationName: "Đà Lạt", topic: "food", order: 0 },
    ]);
  });

  it("bao loi khi bai chua publish", async () => {
    const publications = {
      findByJobId: async () => null,
    } as unknown as ArticlePublicationRepository;
    const usecase = new GetArticleDestinationMapUseCase(
      publications,
      {} as ArticleSiteDb,
      {} as DestinationMirrorRepository,
    );

    await expect(usecase.execute("job-x")).rejects.toThrow("chưa publish");
  });
});
