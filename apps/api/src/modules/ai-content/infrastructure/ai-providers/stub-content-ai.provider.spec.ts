import {
  articleFrameSchema,
  articleOutlineSchema,
  articleSchema,
  contentSectionSchema,
  destinationArticleSchema,
  destinationOutlineSchema,
} from "@zinoflow/contracts";
import { StubContentAiProvider } from "./stub-content-ai.provider";
import { renderArticleMarkdown } from "../../application/services/article-markdown.renderer";
import type { StructuredGenerationRequest } from "../../application/ports/content-ai-provider.port";

/**
 * Stub provider la "hop dong mau" cho moi provider that:
 * output PHAI pass dung schema duoc truyen vao. Test nay bao ve hop dong do.
 */
describe("StubContentAiProvider", () => {
  const provider = new StubContentAiProvider();

  const request = (operation: string, vars: Record<string, unknown>): StructuredGenerationRequest => ({
    model: "stub-model",
    operation,
    system: "system",
    prompt: "prompt",
    maxTokens: 1000,
    vars: { topic: "Top 5 ví da nữ công sở", products: [], ...vars },
  });

  it("generates outline that passes articleOutlineSchema", async () => {
    const { output } = await provider.generateStructured(request("outline", {}), articleOutlineSchema);
    expect(() => articleOutlineSchema.parse(output)).not.toThrow();
  });

  it("generates section that passes contentSectionSchema and keeps heading", async () => {
    const { output } = await provider.generateStructured(
      request("section", { sectionHeading: "Tiêu chí xếp hạng" }),
      contentSectionSchema,
    );
    expect(output.heading).toBe("Tiêu chí xếp hạng");
    expect(() => contentSectionSchema.parse(output)).not.toThrow();
  });

  it("generates frame that passes articleFrameSchema", async () => {
    const { output } = await provider.generateStructured(request("frame", {}), articleFrameSchema);
    expect(() => articleFrameSchema.parse(output)).not.toThrow();
  });

  it("uses provided product data instead of inventing products", async () => {
    const products = [
      { name: "Ví da thật A", url: "https://laruki.com/vi-da-a", price: "590.000đ", description: null },
    ];
    const { output } = await provider.generateStructured(
      request("frame", { products }),
      articleFrameSchema,
    );
    expect(output.productRecommendations).toHaveLength(1);
    expect(output.productRecommendations[0]?.name).toBe("Ví da thật A");
    expect(output.productRecommendations[0]?.productUrl).toBe("https://laruki.com/vi-da-a");
  });

  it("frame + sections assemble into a valid 8-block article and render markdown", async () => {
    const { output: outline } = await provider.generateStructured(
      request("outline", {}),
      articleOutlineSchema,
    );
    const sections = [];
    for (const heading of outline.sectionHeadings) {
      const { output } = await provider.generateStructured(
        request("section", { sectionHeading: heading }),
        contentSectionSchema,
      );
      sections.push(output);
    }
    const { output: frame } = await provider.generateStructured(
      request("frame", { title: outline.title }),
      articleFrameSchema,
    );

    const article = articleSchema.parse({ ...frame, sections });
    const markdown = renderArticleMarkdown(article);

    expect(markdown).toContain(`# ${article.hero.title}`); // H1 duy nhat
    expect(markdown).toContain("## Bài viết này dành cho ai?");
    expect(markdown).toContain("## Trả lời nhanh");
    expect(markdown).toContain("## Top sản phẩm nổi bật");
    expect(markdown).toContain("## Câu hỏi thường gặp");
    expect(markdown).toContain("## Kết luận");
    expect(markdown).toContain(article.hero.affiliateDisclosure); // policy gate can disclosure
  });

  describe('"content" operation (Option 3, 09/2026 — gop section+frame lam 1 request)', () => {
    it("sinh bai top-list hop le qua articleSchema, sections khop outline.sectionHeadings", async () => {
      const { output: outline } = await provider.generateStructured(
        request("outline", { articleType: "toplist" }),
        articleOutlineSchema,
      );
      const { output } = await provider.generateStructured(
        request("content", { articleType: "toplist", title: outline.title, outline }),
        articleSchema,
      );
      expect(() => articleSchema.parse(output)).not.toThrow();
      expect(output.sections.map((s) => s.heading)).toEqual(outline.sectionHeadings);
    });

    it("sinh bai diem den hop le qua destinationArticleSchema, dung 7 section co blockKey", async () => {
      const { output: outline } = await provider.generateStructured(
        request("outline", { articleType: "guide-diem-den" }),
        destinationOutlineSchema,
      );
      const { output } = await provider.generateStructured(
        request("content", { articleType: "guide-diem-den", title: outline.title, outline }),
        destinationArticleSchema,
      );
      expect(() => destinationArticleSchema.parse(output)).not.toThrow();
      expect(output.sections).toHaveLength(7);
      expect(output.sections.every((s) => s.blockKey)).toBe(true);
    });
  });
});
