import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

/**
 * Cau hinh Markdown -> HTML sach DUNG CHUNG cho moi noi dung Markdown cua module
 * destination (than bai diem den VA doan gioi thieu Type/Tag) — dong bo 1 pipeline
 * duy nhat thay vi 2 ban rieng, theo yeu cau nguoi dung 25/07/2026 ("apply cho ca
 * Type/Tag, hay va dong bo hon"). Sanitize bat buoc (noi dung AI/nguoi dung go —
 * chong XSS truoc khi len website, CLAUDE.md §7).
 */
export const RICH_CONTENT_ALLOWED_TAGS = [
  "h2", "h3", "h4", "p", "br", "hr",
  "strong", "em", "b", "i", "u", "s", "blockquote",
  "ul", "ol", "li", "a", "img",
  "table", "thead", "tbody", "tr", "th", "td",
];

export interface RenderMarkdownOptions {
  /** true: 1 lan Enter don trong CMS textarea da xuong dong (<br>) — hop voi doan
   * gioi thieu ngan Type/Tag. false (mac dinh, chuan CommonMark): can dong trong
   * that su moi tach doan — hop voi bai viet dai co cau truc section ro rang. */
  breaks?: boolean;
}

/**
 * Parse Markdown -> sanitize theo allowlist RICH_CONTENT_ALLOWED_TAGS. Link ngoai
 * do AI/nguoi dung tu go trong Markdown: gan nofollow + tab moi (nhu bai diem den).
 * Link noi bo /diem-den/ do engine auto-link chen SAU buoc nay nen khong bi anh
 * huong (khong qua transformTags).
 */
export function renderMarkdownToSafeHtml(markdown: string, options: RenderMarkdownOptions = {}): string {
  const rawHtml = marked.parse(markdown, {
    async: false,
    gfm: true,
    breaks: options.breaks ?? false,
  }) as string;

  return sanitizeHtml(rawHtml, {
    allowedTags: RICH_CONTENT_ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "title", "rel", "target"],
      img: ["src", "alt", "title"],
    },
    allowedSchemes: ["http", "https"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "nofollow noopener", target: "_blank" }),
    },
  }).trim();
}
