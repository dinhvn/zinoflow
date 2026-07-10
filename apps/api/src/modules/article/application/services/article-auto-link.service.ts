import { Inject, Injectable } from "@nestjs/common";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../../../destination/application/ports/destination-mirror.repository";
import { autoLinkContent, type LinkTarget } from "../../../shared/text/auto-link";

/**
 * Chen link noi bo toi diem den vao bai cam nang, dung lai engine auto-link
 * chung voi destination (dichoithoi-backlog.md §B Phase C muc 5 — "1 engine
 * auto-link DUNG CHUNG"). Bai cam nang khong co slug diem den nen selfSlug
 * luon rong — khong diem nao bi loai vi trung "chinh no".
 */
@Injectable()
export class ArticleAutoLinkService {
  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
  ) {}

  async linkHtml(html: string): Promise<string> {
    const all = await this.mirrorRepo.findAll();
    const targets: LinkTarget[] = all
      .filter((d) => d.siteStatus === 1 && d.siteId !== null)
      .map((d) => ({ slug: d.slug, name: d.name }));

    const { html: linkedHtml } = autoLinkContent(html, targets, "");
    return linkedHtml;
  }
}
