// marked la ESM -> mock bang fake "giong that" (boc block thanh <p>/<h2>) de
// test logic go <p> quanh tag ma khong can transform ESM trong jest.
jest.mock("marked", () => ({
  marked: {
    parse: (md: string) =>
      Promise.resolve(
        md
          .split(/\n\n+/)
          .map((block) =>
            block.startsWith("## ")
              ? `<h2>${block.slice(3)}</h2>`
              : `<p>${block.replace(/\n/g, "<br>")}</p>`,
          )
          .join("\n"),
      ),
  },
}));

import { renderCmsBodyHtml, unwrapTagParagraphs } from "./cms-html.renderer";
import type { CmsArticle } from "@zinoflow/contracts";

describe("unwrapTagParagraphs", () => {
  it("go <p> quanh dong chi chua tag", () => {
    expect(unwrapTagParagraphs("<p>[ProductList_SupplierCode:juno]</p>")).toBe(
      "[ProductList_SupplierCode:juno]",
    );
    expect(unwrapTagParagraphs("<p>  [Year]  </p>")).toBe("[Year]");
  });
  it("giu nguyen <p> co chu xen lan tag", () => {
    const s = "<p>Xem ngay [Year] nhe</p>";
    expect(unwrapTagParagraphs(s)).toBe(s);
  });
});

describe("renderCmsBodyHtml", () => {
  const article: CmsArticle = {
    title: "Top đồ chơi",
    excerpt: "Mô tả ngắn về đồ chơi cho bé.",
    sections: [
      { heading: "Giới thiệu", content: "Đoạn văn giới thiệu sản phẩm cho bé." },
      { heading: "Danh sách", content: "[ProductList_SupplierCode:juno]" },
    ],
  };

  it("render section thanh HTML, tag tren dong rieng khong bi boc <p>", async () => {
    const html = await renderCmsBodyHtml(article);
    expect(html).toContain("<h2>Giới thiệu</h2>");
    expect(html).toContain("[ProductList_SupplierCode:juno]");
    expect(html).not.toContain("<p>[ProductList_SupplierCode:juno]</p>");
    // Title KHONG nam trong body
    expect(html).not.toContain("Top đồ chơi");
  });
});
