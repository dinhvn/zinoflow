import { Inject, Injectable } from "@nestjs/common";
import { DomainRuleError, ValidationError } from "../../../shared/errors/app-error";
import {
  CONTENT_IMAGE_REPOSITORY,
  type ContentImageRepository,
} from "../ports/content-image.repository";

/** Xoa 1 anh khoi thu vien noi dung — chan neu con bai dang tham chieu (plan §3.3) */
@Injectable()
export class DeleteContentImageUseCase {
  constructor(
    @Inject(CONTENT_IMAGE_REPOSITORY) private readonly repo: ContentImageRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new ValidationError(`Khong tim thay anh id=${id}`);

    const usageCount = await this.repo.countReferencesInDrafts(id);
    if (usageCount > 0) {
      throw new DomainRuleError(
        `Anh dang duoc dung trong ${usageCount} bai viet — go token khoi bai truoc khi xoa`,
      );
    }

    await this.repo.delete(id);
  }
}
