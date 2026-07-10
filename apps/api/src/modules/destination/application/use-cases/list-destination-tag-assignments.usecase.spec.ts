import { ListDestinationTagAssignmentsUseCase } from "./list-destination-tag-assignments.usecase";
import type { DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";

describe("ListDestinationTagAssignmentsUseCase", () => {
  it("gop tags + assignments tu site DB", async () => {
    const siteDb = {
      fetchTags: async () => [{ id: 1, slug: "hoang-so", name: "Hoang so", description: null, status: 0 }],
      fetchTagAssignments: async () => [
        { destinationId: 1, destinationSlug: "da-lat", destinationName: "Đà Lạt", tagSlugs: ["hoang-so"] },
      ],
    } as unknown as DichoithoiSiteDb;
    const usecase = new ListDestinationTagAssignmentsUseCase(siteDb);

    const result = await usecase.execute();

    expect(result.tags).toHaveLength(1);
    expect(result.assignments).toEqual([
      { destinationSlug: "da-lat", destinationName: "Đà Lạt", tagSlugs: ["hoang-so"] },
    ]);
  });
});
