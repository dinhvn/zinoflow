import { CreatePromptVersionUseCase } from "./create-prompt-version.usecase";
import { ActivatePromptVersionUseCase } from "./activate-prompt-version.usecase";
import { DomainRuleError } from "../../../shared/errors/app-error";
import type {
  PromptTemplateRepository,
  PromptTemplateVersionRecord,
} from "../ports/prompt-template.repository";

/** Fake repo trong bo nho — giu dung bat bien "1 active / key" + tang version. */
function createFakeRepo(): PromptTemplateRepository {
  const rows: PromptTemplateVersionRecord[] = [];
  return {
    findActive: async (key) => rows.find((r) => r.templateKey === key && r.isActive) ?? null,
    findActiveMany: async (keys) =>
      rows.filter((r) => r.isActive && keys.includes(r.templateKey)),
    findVersions: async (key) =>
      rows.filter((r) => r.templateKey === key).sort((a, b) => b.version - a.version),
    createVersion: async (key, content) => {
      const max = Math.max(0, ...rows.filter((r) => r.templateKey === key).map((r) => r.version));
      rows.forEach((r) => {
        if (r.templateKey === key) r.isActive = false;
      });
      const rec: PromptTemplateVersionRecord = {
        id: `${key}-${max + 1}`,
        templateKey: key,
        version: max + 1,
        content,
        isActive: true,
        createdAt: new Date(),
      };
      rows.push(rec);
      return rec;
    },
    activateVersion: async (key, version) => {
      rows.forEach((r) => {
        if (r.templateKey === key) r.isActive = r.version === version;
      });
    },
  };
}

const KEY = "guide-diem-den.frame.vi";

describe("CreatePromptVersionUseCase", () => {
  it("tao version tang dan, chi 1 active", async () => {
    const repo = createFakeRepo();
    const uc = new CreatePromptVersionUseCase(repo);

    const v1 = await uc.execute(KEY, "Prompt v1 {{topic}}");
    expect(v1.version).toBe(1);
    const v2 = await uc.execute(KEY, "Prompt v2 {{topic}}");
    expect(v2.version).toBe(2);

    const versions = await repo.findVersions(KEY);
    expect(versions.filter((v) => v.isActive)).toHaveLength(1);
    expect((await repo.findActive(KEY))?.version).toBe(2);
  });

  it("canh bao placeholder la nhung van luu", async () => {
    const uc = new CreatePromptVersionUseCase(createFakeRepo());
    const res = await uc.execute(KEY, "Co {{topic}} va {{khong_ton_tai}}");
    expect(res.version).toBe(1);
    expect(res.unknownPlaceholders).toEqual(["khong_ton_tai"]);
  });

  it("tu choi key la", async () => {
    const uc = new CreatePromptVersionUseCase(createFakeRepo());
    await expect(uc.execute("khong.ton.tai", "x")).rejects.toBeInstanceOf(DomainRuleError);
  });

  it("tu choi noi dung rong", async () => {
    const uc = new CreatePromptVersionUseCase(createFakeRepo());
    await expect(uc.execute(KEY, "   ")).rejects.toBeInstanceOf(DomainRuleError);
  });
});

describe("ActivatePromptVersionUseCase", () => {
  it("rollback ve version cu", async () => {
    const repo = createFakeRepo();
    await new CreatePromptVersionUseCase(repo).execute(KEY, "v1");
    await new CreatePromptVersionUseCase(repo).execute(KEY, "v2");

    await new ActivatePromptVersionUseCase(repo).execute(KEY, 1);
    expect((await repo.findActive(KEY))?.version).toBe(1);
  });

  it("tu choi version khong ton tai", async () => {
    const repo = createFakeRepo();
    await new CreatePromptVersionUseCase(repo).execute(KEY, "v1");
    await expect(new ActivatePromptVersionUseCase(repo).execute(KEY, 99)).rejects.toBeInstanceOf(
      DomainRuleError,
    );
  });
});
