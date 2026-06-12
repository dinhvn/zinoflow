import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import type { DestinationArticle } from "@zinoflow/contracts";

/**
 * Render THAN BAI publish cho v2.DestinationContent.ContentHtml (Phase C).
 * Khac ban review (destination-markdown.renderer):
 * - KHONG co H1 (website render Name lam H1) va KHONG co khoi quick facts/FAQ —
 *   cac phan do do vao COT rieng (OpeningTime, FaqJson...) theo redesign §4.3.
 * - Sanitize bat buoc (noi dung AI sinh — chong XSS truoc khi len website).
 * Auto-link chay SAU buoc nay (chen <a> noi bo vao HTML da sach).
 */
export async function renderDestinationBodyHtml(article: DestinationArticle): Promise<string> {
  const lines: string[] = [];
  lines.push(article.intro, "");
  // Luu y cap nhat hien ngay dau bai — gate policy yeu cau co thang/nam (spec §6)
  lines.push(`> ${article.updateNotice}`, "");
  for (const section of article.sections) {
    lines.push(`## ${section.heading}`, "");
    lines.push(section.content, "");
  }

  const rawHtml = await marked.parse(lines.join("\n"), { async: true });
  return sanitizeHtml(rawHtml, {
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
      // Link ngoai do AI sinh: nofollow + tab moi. Link noi bo /diem-den/ duoc
      // engine auto-link chen SAU sanitize nen khong bi gan nofollow.
      a: sanitizeHtml.simpleTransform("a", { rel: "nofollow noopener", target: "_blank" }),
    },
  });
}

/** FAQ -> JSON [{q,a}] cho cot FaqJson (website render FAQ + JSON-LD FAQPage) */
export function buildFaqJson(article: DestinationArticle): string {
  return JSON.stringify(article.faq.map((f) => ({ q: f.question, a: f.answer })));
}
