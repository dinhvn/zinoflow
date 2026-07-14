import { Inject, Injectable } from "@nestjs/common";
import type { PreviewDestinationPublishHtmlResponse } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { autoLinkContent, type LinkTarget } from "../../../shared/text/auto-link";
import { renderDestinationBodyHtml } from "../services/destination-publish-html.renderer";
import { parseDraftArticleOrThrow } from "../services/parse-draft-article";

/**
 * Xem truoc HTML se ghi vao v2.DestinationContent luc bam "Dang" — dry-run, KHONG
 * ghi SQL Server/quan he. Chay DUNG renderDestinationBodyHtml + autoLinkContent
 * (giong het buoc 4b/4c cua PublishDestinationUseCase) de nguoi dung thay dung
 * link noi bo se duoc chen truoc khi publish that (redesign luong viet bai lan 2).
 */
@Injectable()
export class PreviewDestinationPublishHtmlUseCase {
  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
  ) {}

  async execute(slug: string): Promise<PreviewDestinationPublishHtmlResponse> {
    const all = await this.mirrorRepo.findAll();
    const destination = all.find((d) => d.slug === slug);
    if (!destination) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${slug}" trong mirror`);
    }
    const article = parseDraftArticleOrThrow(destination.draftArticle, destination.name);

    const bodyHtml = await renderDestinationBodyHtml(article);
    const targets: LinkTarget[] = all
      .filter((d) => d.siteStatus === 1 && d.siteId !== null && d.slug !== slug)
      .map((d) => ({ slug: d.slug, name: d.name }));
    const { html, addedLinks } = autoLinkContent(bodyHtml, targets, slug);

    return { html, addedLinks };
  }
}
