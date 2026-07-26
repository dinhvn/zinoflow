import { ApplyTagAssignmentsUseCase } from "./apply-tag-assignments.usecase";
import type { DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import type { DestinationMirrorRepository } from "../ports/destination-mirror.repository";

describe("ApplyTagAssignmentsUseCase", () => {
  it("ghi de tag cho tung diem den da publish xuong SQL Server", async () => {
    const calls: Array<{ slug: string; tagSlugs: readonly string[] }> = [];
    const siteDb = {
      replaceTagAssignments: async (slug: string, tagSlugs: readonly string[]) => {
        calls.push({ slug, tagSlugs });
      },
    } as unknown as DichoithoiSiteDb;
    const mirrorRepo = {
      findBySlug: async (slug: string) => ({ slug, siteId: 1 }),
    } as unknown as DestinationMirrorRepository;
    const usecase = new ApplyTagAssignmentsUseCase(siteDb, mirrorRepo);

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

  it("ghi tag NHAP vao mirror cho diem chua publish (siteId=null)", async () => {
    const siteDbCalls: Array<{ slug: string; tagSlugs: readonly string[] }> = [];
    const mirrorCalls: Array<{ slug: string; tagSlugs: readonly string[] }> = [];
    const siteDb = {
      replaceTagAssignments: async (slug: string, tagSlugs: readonly string[]) => {
        siteDbCalls.push({ slug, tagSlugs });
      },
    } as unknown as DichoithoiSiteDb;
    const mirrorRepo = {
      findBySlug: async (slug: string) => ({ slug, siteId: null }),
      setTags: async (slug: string, tagSlugs: readonly string[]) => {
        mirrorCalls.push({ slug, tagSlugs });
      },
    } as unknown as DestinationMirrorRepository;
    const usecase = new ApplyTagAssignmentsUseCase(siteDb, mirrorRepo);

    const result = await usecase.execute({
      assignments: [{ destinationSlug: "da-teh", tagSlugs: ["thien-nhien"] }],
    });

    expect(siteDbCalls).toEqual([]);
    expect(mirrorCalls).toEqual([{ slug: "da-teh", tagSlugs: ["thien-nhien"] }]);
    expect(result.appliedCount).toBe(1);
  });
});
