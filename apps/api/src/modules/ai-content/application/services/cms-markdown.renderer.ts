import type { CmsArticle } from "@zinoflow/contracts";

/**
 * Render bai CMS khuyenmai (km-*) thanh markdown cho editor/preview.
 * 1 content duy nhat: title (H1) + cac section (H2 + noi dung). Tag [..] giu nguyen inline.
 * Pure function — test duoc, dung lai khi render HTML ghi xuong CMS.
 */
export function renderCmsMarkdown(article: CmsArticle): string {
  const lines: string[] = [];
  lines.push(`# ${article.title}`, "");
  for (const section of article.sections) {
    lines.push(`## ${section.heading}`, "");
    lines.push(section.content, "");
  }
  return lines.join("\n");
}
