import { PromptBuilder, type PromptJobContext } from "./prompt-builder";
import type { PromptTemplateRepository } from "../ports/prompt-template.repository";

/** Fake repo: tra content cho dung 1 key cu the (de kiem tra phan giai key). */
function repoWithKey(key: string | null, content = "SPECIFIC"): PromptTemplateRepository {
  return {
    findActive: async (k) => (k === key ? { id: "x", templateKey: k, version: 1, content } : null),
    findActiveMany: async () => [],
    findVersions: async () => [],
    createVersion: async () => {
      throw new Error("nope");
    },
    activateVersion: async () => {},
  };
}

const kmCtx: PromptJobContext = {
  model: "m",
  articleType: "km-top-product",
  topic: "Top đồ chơi",
  siteCode: "dochoi3s",
  keywordSeed: [],
  toneProfile: null,
  sourceContext: "ngu canh",
  products: [],
};

describe("PromptBuilder phan giai key (km site x postType)", () => {
  it("uu tien key cu the nhat <site>.<articleType>.<step>", async () => {
    const b = new PromptBuilder(repoWithKey("dochoi3s.km-top-product.outline.vi"));
    const req = await b.buildOutline(kmCtx);
    expect(req.prompt).toBe("SPECIFIC");
  });

  it("fallback ve <articleType>.<step> khi khong co key site", async () => {
    const b = new PromptBuilder(repoWithKey("km-top-product.outline.vi"));
    const req = await b.buildOutline(kmCtx);
    expect(req.prompt).toBe("SPECIFIC");
  });

  it("khong co DB -> dung DEFAULT km-bai-viet (chua siteCode)", async () => {
    const b = new PromptBuilder(repoWithKey(null));
    const req = await b.buildOutline(kmCtx);
    // DEFAULT km-bai-viet.outline.vi co {{siteCode}} -> render thanh "dochoi3s"
    expect(req.prompt).toContain("dochoi3s");
    expect(req.prompt).toContain("OUTLINE");
  });

  it("bai thuong (toplist) van dung default <articleType>.<step>", async () => {
    const b = new PromptBuilder(repoWithKey(null));
    const req = await b.buildOutline({ ...kmCtx, articleType: "toplist", products: [] });
    expect(req.prompt).toContain("TOP-LIST");
  });
});

const destinationCtx: PromptJobContext = {
  model: "m",
  articleType: "guide-diem-den",
  topic: "Đà Lạt",
  siteCode: "dichoithoi",
  keywordSeed: [],
  toneProfile: null,
  sourceContext: "ngu canh",
  products: [],
};

describe("PromptBuilder phan giai key theo ContentTier (Phase 28.3)", () => {
  it("contentTier=flagship -> uu tien key guide-diem-den-flagship (khong co DB -> dung DEFAULT)", async () => {
    const b = new PromptBuilder(repoWithKey(null));
    const req = await b.buildOutline({ ...destinationCtx, contentTier: "flagship" });
    expect(req.prompt).toContain("mùa");
    expect(req.prompt).toContain("ĐÚNG 7 mục H2 theo THỨ TỰ CỐ ĐỊNH");
  });

  it("contentTier=standard/null -> dung khung 7 khoi co dinh (redesign luong viet bai)", async () => {
    const b = new PromptBuilder(repoWithKey(null));
    const req = await b.buildOutline({ ...destinationCtx, contentTier: "standard" });
    expect(req.prompt).toContain("ĐÚNG 7 mục H2 theo THỨ TỰ CỐ ĐỊNH");
    expect(req.prompt).toContain("Quà mang về");
  });

  it("contentTier=flagship uu tien override DB rieng cho site truoc default chung", async () => {
    const b = new PromptBuilder(repoWithKey("dichoithoi.guide-diem-den-flagship.outline.vi"));
    const req = await b.buildOutline({ ...destinationCtx, contentTier: "flagship" });
    expect(req.prompt).toBe("SPECIFIC");
  });
});
