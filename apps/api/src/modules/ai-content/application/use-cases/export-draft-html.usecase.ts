import { Inject, Injectable } from "@nestjs/common";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import {
  CONTENT_DRAFT_REPOSITORY,
  type ContentDraftRepository,
} from "../ports/content-draft.repository";
import { DomainRuleError } from "../../../shared/errors/app-error";

/**
 * Use case: export HTML SACH tu draft markdown — spec §7 (ExportDraftHtml).
 * Sanitize bat buoc (spec §14): noi dung do AI sinh, phai chong XSS truoc khi
 * render preview hoac publish len WordPress (M4).
 */
@Injectable()
export class ExportDraftHtmlUseCase {
  constructor(
    @Inject(CONTENT_DRAFT_REPOSITORY) private readonly drafts: ContentDraftRepository,
  ) {}

  async execute(draftId: string): Promise<{ draftId: string; html: string }> {
    const draft = await this.drafts.findById(draftId);
    if (!draft) throw new DomainRuleError(`Draft ${draftId} not found`);
    if (!draft.draftMarkdown) {
      throw new DomainRuleError("Draft chưa có nội dung markdown");
    }

    const rawHtml = await marked.parse(draft.draftMarkdown, { async: true });
    const html = sanitizeHtml(rawHtml, {
      // Whitelist du cho bai viet: heading, doan van, list, link, bang, anh
      allowedTags: [
        "h1", "h2", "h3", "h4", "p", "br", "hr",
        "strong", "em", "b", "i", "u", "s", "blockquote", "code", "pre",
        "ul", "ol", "li", "a", "img",
        "table", "thead", "tbody", "tr", "th", "td",
      ],
      allowedAttributes: {
        a: ["href", "title", "rel", "target"],
        img: ["src", "alt", "title"],
      },
      // Chi cho phep link http(s) — chan javascript:/data:
      allowedSchemes: ["http", "https"],
      transformTags: {
        // Link affiliate luon mo tab moi + nofollow (chuan affiliate SEO)
        a: sanitizeHtml.simpleTransform("a", { rel: "nofollow noopener", target: "_blank" }),
      },
    });

    return { draftId: draft.id, html };
  }
}
