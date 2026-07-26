import { ListDestinationTagAssignmentsUseCase } from "./list-destination-tag-assignments.usecase";
import type { DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import type { DestinationMirrorRepository } from "../ports/destination-mirror.repository";

const emptyMirrorRepo = { findAll: async () => [] } as unknown as DestinationMirrorRepository;

describe("ListDestinationTagAssignmentsUseCase", () => {
  it("gop tags + assignments tu site DB", async () => {
    const siteDb = {
      fetchTags: async () => [{ id: 1, slug: "hoang-so", name: "Hoang so", description: null, status: 0 }],
      fetchTagAssignments: async () => [
        { destinationId: 1, destinationSlug: "da-lat", destinationName: "Đà Lạt", tagSlugs: ["hoang-so"] },
      ],
    } as unknown as DichoithoiSiteDb;
    const usecase = new ListDestinationTagAssignmentsUseCase(siteDb, emptyMirrorRepo);

    const result = await usecase.execute();

    expect(result.tags).toHaveLength(1);
    expect(result.assignments).toEqual([
      { destinationSlug: "da-lat", destinationName: "Đà Lạt", tagSlugs: ["hoang-so"] },
    ]);
  });

  it("gop them POI chua publish (siteId=null) tu mirror, tag doc tu mirror.tags", async () => {
    const siteDb = {
      fetchTags: async () => [],
      fetchTagAssignments: async () => [],
    } as unknown as DichoithoiSiteDb;
    const mirrorRepo = {
      findAll: async () => [
        { slug: "da-teh-poi", name: "Điểm draft", kind: "poi", siteId: null, tags: ["thien-nhien"] },
        { slug: "da-teh", name: "Đạ Tẻh", kind: "cluster", siteId: null, tags: [] },
      ],
    } as unknown as DestinationMirrorRepository;
    const usecase = new ListDestinationTagAssignmentsUseCase(siteDb, mirrorRepo);

    const result = await usecase.execute();

    expect(result.assignments).toEqual([
      { destinationSlug: "da-teh-poi", destinationName: "Điểm draft", tagSlugs: ["thien-nhien"] },
    ]);
  });
});
