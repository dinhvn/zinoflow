import { ApplyTagAssignmentsUseCase } from "./apply-tag-assignments.usecase";
import type { DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";

describe("ApplyTagAssignmentsUseCase", () => {
  it("ghi de tag cho tung diem den duoc duyet", async () => {
    const calls: Array<{ slug: string; tagSlugs: readonly string[] }> = [];
    const siteDb = {
      replaceTagAssignments: async (slug: string, tagSlugs: readonly string[]) => {
        calls.push({ slug, tagSlugs });
      },
    } as unknown as DichoithoiSiteDb;
    const usecase = new ApplyTagAssignmentsUseCase(siteDb);

    const result = await usecase.execute({
      assignments: [
        { destinationSlug: "da-lat", tagSlugs: ["lang-man"] },
        { destinationSlug: "sapa", tagSlugs: [] },
      ],
    });

    expect(calls).toEqual([
      { slug: "da-lat", tagSlugs: ["lang-man"] },
      { slug: "sapa", tagSlugs: [] },
    ]);
    expect(result.appliedCount).toBe(2);
  });
});
