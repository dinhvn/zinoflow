import type { ArticleCamNang } from "@zinoflow/contracts";

/**
 * Render bai cam nang (articleType "cam-nang") thanh markdown cho editor/preview.
 * Day CHINH LA "RawContent" (dichoithoi-article-spec.md §2.1) — token [[block:...]]
 * nam nguyen dong trong section.content, giu lai y het khi render, chi compile
 * thanh HTML that luc publish (apps/api/src/modules/article).
 */
export function renderCamNangMarkdown(article: ArticleCamNang): string {
  const lines: string[] = [];
  lines.push(`# ${article.title}`, "");
  lines.push(article.intro, "");
  for (const section of article.sections) {
    lines.push(`## ${section.heading}`, "");
    lines.push(section.content, "");
  }
  return lines.join("\n");
}
