import { PromptBuilder, type PromptJobContext } from "./prompt-builder";
import type { PromptTemplateRepository } from "../ports/prompt-template.repository";

/** Fake repo: tra content cho dung 1 key cu the (de kiem tra phan giai key). */
function repoWithKey(
  key: string | null,
  content = "SPECIFIC",
): PromptTemplateRepository {
  return {
    findActive: async (k) =>
      k === key ? { id: "x", templateKey: k, version: 1, content } : null,
    findActiveMany: async () => [],
    findLatestMany: async () => [],
    findVersions: async () => [],
    createVersion: async () => {
      throw new Error("nope");
    },
    createInactiveVersion: async () => {
      throw new Error("nope");
    },
    activateVersion: async () => true,
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
    const b = new PromptBuilder(
      repoWithKey("dochoi3s.km-top-product.outline.vi"),
    );
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
    const req = await b.buildOutline({
      ...kmCtx,
      articleType: "toplist",
      products: [],
    });
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

describe("PromptBuilder phan giai key theo Kind (nodeKind chon khung, contentTier chi chinh do sau)", () => {
  it("nodeKind=cluster -> uu tien key guide-diem-den-cum (khong co DB -> dung DEFAULT)", async () => {
    const b = new PromptBuilder(repoWithKey(null));
    const req = await b.buildOutline({
      ...destinationCtx,
      nodeKind: "cluster",
      contentTier: "flagship",
    });
    expect(req.prompt).toContain("mùa");
    expect(req.prompt).toContain("5-7 mục H2 THEO THỨ TỰ CỐ ĐỊNH");
  });

  it("nodeKind=poi (hoac khong co) -> dung khung guide-diem-den, khong phu thuoc contentTier", async () => {
    const b = new PromptBuilder(repoWithKey(null));
    const req = await b.buildOutline({
      ...destinationCtx,
      nodeKind: "poi",
      contentTier: "standard",
    });
    expect(req.prompt).toContain("5-7 mục H2 THEO THỨ TỰ CỐ ĐỊNH");
    expect(req.prompt).toContain("Quà mang về");
  });

  it("nodeKind=cluster uu tien override DB rieng cho site truoc default chung", async () => {
    const b = new PromptBuilder(
      repoWithKey("dichoithoi.guide-diem-den-cum.outline.vi"),
    );
    const req = await b.buildOutline({
      ...destinationCtx,
      nodeKind: "cluster",
      contentTier: "flagship",
    });
    expect(req.prompt).toBe("SPECIFIC");
  });
});
