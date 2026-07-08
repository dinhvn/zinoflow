import { Inject, Injectable } from "@nestjs/common";
import type { SuggestPracticalNotesResponse } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { suggestPracticalNotes } from "../../domain/practical-notes-suggester";

/**
 * Goi y ban nhap "Luu y thuc te" cho 1 diem den (content-seo-ux-plan §5.7) —
 * CHI tra ve goi y, KHONG luu. Nguoi dung xem/sua/xoa tung dong roi goi
 * UpdatePracticalNotesUseCase de luu ban da duyet.
 */
@Injectable()
export class SuggestPracticalNotesUseCase {
  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
  ) {}

  async execute(slug: string): Promise<SuggestPracticalNotesResponse> {
    const destination = await this.mirrorRepo.findBySlug(slug);
    if (!destination) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${slug}" trong mirror`);
    }
    return {
      suggestions: suggestPracticalNotes({
        name: destination.name,
        shortDescription: destination.shortDescription,
      }),
    };
  }
}
