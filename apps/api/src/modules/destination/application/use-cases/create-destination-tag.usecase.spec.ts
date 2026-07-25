import { CreateDestinationTagUseCase } from "./create-destination-tag.usecase";
import { DomainRuleError } from "../../../shared/errors/app-error";
import type { DichoithoiSiteDb, SiteTagRow } from "../ports/dichoithoi-site-db.port";

const TAGS: SiteTagRow[] = [
  { id: 1, slug: "hoang-so", name: "Hoang so", description: null, metaDescription: null, status: 0 },
];

function fakeSiteDb(created: Array<{ slug: string; name: string; description: string | null }>) {
  return {
    fetchTags: async () => TAGS,
    createTag: async (input: { slug: string; name: string; description: string | null }) =>
      void created.push(input),
  } as unknown as DichoithoiSiteDb;
}

describe("CreateDestinationTagUseCase (destination-spec §2.4)", () => {
  it("tao tag moi khi slug chua ton tai", async () => {
    const created: Array<{ slug: string; name: string; description: string | null }> = [];
    const usecase = new CreateDestinationTagUseCase(fakeSiteDb(created));

    const result = await usecase.execute({ slug: "bien-dao", name: "Biển đảo" });

    expect(result).toEqual({ ok: true });
    expect(created).toEqual([{ slug: "bien-dao", name: "Biển đảo", description: null }]);
  });

  it("chan tao khi slug da ton tai — bao loi tieng Viet ro rang", async () => {
    const created: Array<{ slug: string; name: string; description: string | null }> = [];
    const usecase = new CreateDestinationTagUseCase(fakeSiteDb(created));

    await expect(usecase.execute({ slug: "hoang-so", name: "Trùng slug" })).rejects.toThrow(
      DomainRuleError,
    );
    expect(created).toEqual([]);
  });
});
