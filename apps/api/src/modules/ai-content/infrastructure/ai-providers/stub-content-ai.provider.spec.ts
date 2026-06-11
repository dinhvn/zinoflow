import { articleSchema, articleOutlineSchema } from "@zinoflow/contracts";
import { StubContentAiProvider } from "./stub-content-ai.provider";
import { renderArticleMarkdown } from "../../application/services/article-markdown.renderer";

/**
 * Stub provider la "hop dong mau" cho moi provider that:
 * output PHAI pass schema 8-block. Test nay bao ve hop dong do.
 */
describe("StubContentAiProvider", () => {
  const provider = new StubContentAiProvider();
  const baseInput = {
    model: "stub-model",
    topic: "Top 5 vi da nu cong so",
    siteCode: "laruki",
    keywordSeed: ["vi da nu"],
    toneProfile: null,
    products: [],
  };

  it("generates outline that passes articleOutlineSchema", async () => {
    const { outline } = await provider.generateOutline(baseInput);
    expect(() => articleOutlineSchema.parse(outline)).not.toThrow();
  });

  it("generates article that passes full 8-block articleSchema", async () => {
    const { outline } = await provider.generateOutline(baseInput);
    const { article } = await provider.generateArticle({ ...baseInput, outline });
    expect(() => articleSchema.parse(article)).not.toThrow();
  });

  it("uses provided product data instead of inventing products", async () => {
    const products = [
      { name: "Vi da that A", url: "https://laruki.com/vi-da-a", price: "590.000d", description: null },
    ];
    const { outline } = await provider.generateOutline({ ...baseInput, products });
    const { article } = await provider.generateArticle({ ...baseInput, products, outline });
    expect(article.productRecommendations).toHaveLength(1);
    expect(article.productRecommendations[0]?.name).toBe("Vi da that A");
    expect(article.productRecommendations[0]?.productUrl).toBe("https://laruki.com/vi-da-a");
  });

  it("renders markdown with all required blocks", async () => {
    const { outline } = await provider.generateOutline(baseInput);
    const { article } = await provider.generateArticle({ ...baseInput, outline });
    const markdown = renderArticleMarkdown(article);

    expect(markdown).toContain(`# ${article.hero.title}`); // H1 duy nhat
    expect(markdown).toContain("## Bài viết này dành cho ai?");
    expect(markdown).toContain("## Trả lời nhanh");
    expect(markdown).toContain("## Top sản phẩm nổi bật");
    expect(markdown).toContain("## Câu hỏi thường gặp");
    expect(markdown).toContain("## Kết luận");
    expect(markdown).toContain(article.hero.affiliateDisclosure); // policy gate can disclosure
  });
});
