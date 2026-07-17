import { Inject, Injectable } from "@nestjs/common";
import { ValidationError } from "../../../shared/errors/app-error";
import {
  CONTENT_IMAGE_REPOSITORY,
  type ContentImageRepository,
} from "../ports/content-image.repository";

/** Tu choi 1 anh pending — xoa + ghi nho tu khoa da dung de KHONG goi y lai
 * o lan quet sau cho cung bai viet do (plan §2.3). */
@Injectable()
export class RejectContentImageUseCase {
  constructor(
    @Inject(CONTENT_IMAGE_REPOSITORY) private readonly repo: ContentImageRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new ValidationError(`Không tìm thấy ảnh id=${id}`);

    if (existing.relatedJobId && existing.searchKeyword) {
      await this.repo.addRejectedKeyword(existing.relatedJobId, existing.searchKeyword);
    }
    await this.repo.delete(id);
  }
}
