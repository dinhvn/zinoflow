import { PROMPT_CATALOG, findCatalogEntry, findUnknownPlaceholders } from "./prompt-catalog";
import { DEFAULT_PROMPTS } from "./default-prompts";

describe("PROMPT_CATALOG", () => {
  it("phu dung moi key trong DEFAULT_PROMPTS, khong thua khong thieu", () => {
    const catalogKeys = [...PROMPT_CATALOG.map((e) => e.key)].sort();
    const defaultKeys = Object.keys(DEFAULT_PROMPTS).sort();
    expect(catalogKeys).toEqual(defaultKeys);
  });

  it("system prompt khong gan articleType, cac key con lai co", () => {
    const system = findCatalogEntry("article.system.vi");
    expect(system?.articleType).toBeNull();
    expect(findCatalogEntry("guide-diem-den.frame.vi")?.articleType).toBe("guide-diem-den");
  });

  it("section/frame co them bien rieng so voi outline", () => {
    expect(findCatalogEntry("toplist.section.vi")?.variables).toContain("sectionHeading");
    expect(findCatalogEntry("toplist.frame.vi")?.variables).toContain("sectionsSummary");
    expect(findCatalogEntry("toplist.outline.vi")?.variables).not.toContain("sectionHeading");
  });
});

describe("findUnknownPlaceholders", () => {
  it("tra ve placeholder khong nam trong danh sach hop le, khong trung lap", () => {
    const content = "Chu de {{topic}}, bien la {{xyz}} va {{xyz}} lan nua, {{abc}}";
    expect(findUnknownPlaceholders(content, ["topic", "keywords"])).toEqual(["xyz", "abc"]);
  });

  it("rong khi moi placeholder deu hop le", () => {
    expect(findUnknownPlaceholders("{{topic}} {{keywords}}", ["topic", "keywords"])).toEqual([]);
  });
});
