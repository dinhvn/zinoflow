import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import type { CmsArticle } from "@zinoflow/contracts";

/**
 * Render than bai CMS (km-*) -> 1 HTML ghi vao WordpressPost.FixedContent.
 * - Title KHONG nam trong body (WordpressPost.Title la cot rieng).
 * - Sanitize (noi dung AI sinh — chong XSS).
 * - GO <p> bao quanh dong chi chua tag: <p>[tag]</p> -> [tag] (CMS yeu cau — spec §1.1,
 *   giong InitAutoPost ben CMS) de engine replace tag hoat dong dung.
 */
export async function renderCmsBodyHtml(article: CmsArticle): Promise<string> {
  const md = article.sections.map((s) => `## ${s.heading}\n\n${s.content}`).join("\n\n");
  const rawHtml = await marked.parse(md, { async: true });
  const clean = sanitizeHtml(rawHtml, {
    allowedTags: [
      "h2", "h3", "h4", "p", "br", "hr",
      "strong", "em", "b", "i", "u", "s", "blockquote",
      "ul", "ol", "li", "a", "img",
      "table", "thead", "tbody", "tr", "th", "td",
    ],
    allowedAttributes: {
      a: ["href", "title", "rel", "target"],
      img: ["src", "alt", "title"],
    },
    allowedSchemes: ["http", "https"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "nofollow noopener", target: "_blank" }),
    },
  });
  return unwrapTagParagraphs(clean);
}

/** <p>[tag]</p> (hoac kem khoang trang) -> [tag] — tag khong duoc boc trong <p>. */
export function unwrapTagParagraphs(html: string): string {
  return html.replace(/<p>\s*(\[[^\]]+\])\s*<\/p>/g, "$1");
}
