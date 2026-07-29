import type { DestinationArticle } from "@zinoflow/contracts";
import { renderMarkdownToSafeHtml } from "./rich-markdown.renderer";

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
  for (const section of article.sections) {
    lines.push(`## ${section.heading}`, "");
    lines.push(section.content, "");
    // Khoi list (trai-nghiem/an-gi/qua-mang-ve): "items" la du lieu hien thi
    // that su, "content" chi la cau dan ngan — thieu doan nay thi bai publish
    // mat toan bo danh sach du gate/UI da validate/hien thi day du.
    if (section.items?.length) {
      for (const item of section.items) {
        lines.push(`- **${item.ten}:** ${item.moTa}`);
      }
      lines.push("");
    }
  }

  return renderMarkdownToSafeHtml(lines.join("\n"));
}

/** FAQ -> JSON [{q,a}] cho cot FaqJson (website render FAQ + JSON-LD FAQPage) */
export function buildFaqJson(article: DestinationArticle): string {
  return JSON.stringify(article.faq.map((f) => ({ q: f.question, a: f.answer })));
}
