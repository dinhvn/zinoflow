import { Inject, Injectable, Logger } from "@nestjs/common";
import type { PracticalNoteItem, UpdatePracticalNotesRequest } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";

/**
 * Cap nhat khoi "Luu y thuc te" cho 1 diem den (content-seo-ux-plan §5.7).
 * AI chi goi y draft (SuggestPracticalNotesUseCase) — endpoint nay CHI ghi ban
 * nguoi dung DA xem/sua/xoa tung dong, khong bao gio nhan thang tu AI. Ghi
 * mirror + DestinationContent.PracticalNotesJson neu diem da co bai.
 */
@Injectable()
export class UpdatePracticalNotesUseCase {
  private readonly logger = new Logger(UpdatePracticalNotesUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
  ) {}

  async execute(
    slug: string,
    request: UpdatePracticalNotesRequest,
  ): Promise<PracticalNoteItem[]> {
    const destination = await this.mirrorRepo.findBySlug(slug);
    if (!destination) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${slug}" trong mirror`);
    }

    const practicalNotes = request.practicalNotes;
    await this.mirrorRepo.setPracticalNotes(slug, practicalNotes);
    if (destination.siteId !== null) {
      await this.siteDb.updatePracticalNotes(destination.siteId, JSON.stringify(practicalNotes));
    }
    this.logger.log(`Cap nhat ${practicalNotes.length} luu y thuc te cho ${slug}`);
    return practicalNotes;
  }
}
