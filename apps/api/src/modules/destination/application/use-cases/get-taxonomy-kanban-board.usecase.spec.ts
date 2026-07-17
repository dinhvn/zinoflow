import { GetTaxonomyKanbanBoardUseCase } from "./get-taxonomy-kanban-board.usecase";
import type { DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import type { ImageChecker } from "../ports/image-checker.port";
import type { TaxonomySuggestionRepository } from "../ports/taxonomy-suggestion.repository";

function fakeImageChecker(): ImageChecker {
  return {
    buildUrl: (path: string | null) => (path ? `https://site/${path}` : null),
  } as unknown as ImageChecker;
}

function fakeSuggestionRepo(
  rows: Awaited<ReturnType<TaxonomySuggestionRepository["findAll"]>> = [],
): TaxonomySuggestionRepository {
  return { findAll: async () => rows } as unknown as TaxonomySuggestionRepository;
}

describe("GetTaxonomyKanbanBoardUseCase (relations-plan §6.1-6.2, Giai doan B2)", () => {
  it("chi lay diem kind=poi lam the Kanban, tinh/cum chi lam dropdown, gop dung typeSlugs", async () => {
    const siteDb = {
      fetchAllDestinations: async () => [
        { siteId: 1, slug: "da-lat", kind: "cluster", parentSlug: null, name: "Đà Lạt", thumbnail: null },
        {
          siteId: 2,
          slug: "ho-xuan-huong",
          kind: "poi",
          parentSlug: "da-lat",
          name: "Hồ Xuân Hương",
          thumbnail: "ho-xuan-huong.webp",
        },
        {
          siteId: 3,
          slug: "chua-phan-loai",
          kind: "poi",
          parentSlug: "da-lat",
          name: "Chưa phân loại",
          thumbnail: null,
        },
      ],
      fetchTypeAssignments: async () => [
        { destinationId: 2, destinationSlug: "ho-xuan-huong", destinationName: "Hồ Xuân Hương", typeSlugs: ["thac-ho-suoi"] },
      ],
      fetchTaxonomyContent: async () => ({
        groups: [{ id: 1, slug: "thien-nhien", name: "Thiên nhiên", description: null }],
        types: [{ id: 3, groupId: 1, slug: "thac-ho-suoi", name: "Sông - Suối - Hồ - Thác", description: null }],
        provinces: [],
      }),
    } as unknown as DichoithoiSiteDb;

    const useCase = new GetTaxonomyKanbanBoardUseCase(
      siteDb,
      fakeImageChecker(),
      fakeSuggestionRepo(),
    );
    const result = await useCase.execute();

    expect(result.clusters).toEqual([{ slug: "da-lat", name: "Đà Lạt", kind: "cluster" }]);
    expect(result.destinations).toHaveLength(2);
    expect(result.destinations.find((d) => d.slug === "ho-xuan-huong")).toEqual({
      slug: "ho-xuan-huong",
      name: "Hồ Xuân Hương",
      parentSlug: "da-lat",
      imageUrl: "https://site/ho-xuan-huong.webp",
      typeSlugs: ["thac-ho-suoi"],
      suggestedTypeSlugs: null,
      suggestionReason: null,
      suggestionStatus: null,
    });
    expect(result.destinations.find((d) => d.slug === "chua-phan-loai")?.typeSlugs).toEqual([]);
    expect(result.types).toEqual([
      { id: 3, slug: "thac-ho-suoi", name: "Sông - Suối - Hồ - Thác", groupSlug: "thien-nhien", groupName: "Thiên nhiên" },
    ]);
  });

  it("gop dung de xuat AI tu bang nhap (Giai doan B3)", async () => {
    const siteDb = {
      fetchAllDestinations: async () => [
        {
          siteId: 3,
          slug: "chua-phan-loai",
          kind: "poi",
          parentSlug: "da-lat",
          name: "Chưa phân loại",
          thumbnail: null,
        },
      ],
      fetchTypeAssignments: async () => [],
      fetchTaxonomyContent: async () => ({ groups: [], types: [], provinces: [] }),
    } as unknown as DichoithoiSiteDb;

    const useCase = new GetTaxonomyKanbanBoardUseCase(
      siteDb,
      fakeImageChecker(),
      fakeSuggestionRepo([
        {
          destinationSlug: "chua-phan-loai",
          suggestedTypes: ["khu-vui-choi"],
          reason: "Có nhiều trò chơi trải nghiệm",
          status: "pending",
        },
      ]),
    );
    const result = await useCase.execute();

    expect(result.destinations[0]).toMatchObject({
      suggestedTypeSlugs: ["khu-vui-choi"],
      suggestionReason: "Có nhiều trò chơi trải nghiệm",
      suggestionStatus: "pending",
    });
  });
});
