import { Inject, Injectable, Logger } from "@nestjs/common";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";

/**
 * Luu tay ban nhap bai viet (tieu de/intro/7 block/FAQ/quickFacts/metadata) —
 * pivot gop editor vao trang detail. Ghi thang draft_article, giong cach cac
 * panel khac (practical-notes, gallery...) luu truc tiep, KHONG qua job/duyet.
 * Nhan RAW object tu FE (DestinationArticle client dang giu) — validate chat
 * chi chay o gate-check/preview/publish, cho phep luu dang soan dat do.
 */
@Injectable()
export class UpdateDestinationDraftArticleUseCase {
  private readonly logger = new Logger(UpdateDestinationDraftArticleUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
  ) {}

  async execute(
    slug: string,
    draftArticle: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const destination = await this.mirrorRepo.findBySlug(slug);
    if (!destination) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${slug}" trong mirror`);
    }
    await this.mirrorRepo.setDraftArticle(slug, draftArticle);
    this.logger.log(`Luu ban nhap bai viet cho ${slug}`);
    return draftArticle;
  }
}
