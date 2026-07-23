import { DeleteDestinationTagUseCase } from "./delete-destination-tag.usecase";
import { DomainRuleError } from "../../../shared/errors/app-error";
import type { DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";

function fakeSiteDb(usedCount: number, deleted: string[]) {
  return {
    countTagUsage: async () => usedCount,
    deleteTag: async (slug: string) => void deleted.push(slug),
  } as unknown as DichoithoiSiteDb;
}

describe("DeleteDestinationTagUseCase (destination-spec §2.4)", () => {
  it("xoa tag khi khong con diem den nao gan (ke ca diem chua published)", async () => {
    const deleted: string[] = [];
    const usecase = new DeleteDestinationTagUseCase(fakeSiteDb(0, deleted));

    const result = await usecase.execute("bien-dao");

    expect(result).toEqual({ ok: true });
    expect(deleted).toEqual(["bien-dao"]);
  });

  it("chan xoa khi tag dang duoc gan — khong goi deleteTag", async () => {
    const deleted: string[] = [];
    const usecase = new DeleteDestinationTagUseCase(fakeSiteDb(2, deleted));

    await expect(usecase.execute("hoang-so")).rejects.toThrow(DomainRuleError);
    expect(deleted).toEqual([]);
  });
});
