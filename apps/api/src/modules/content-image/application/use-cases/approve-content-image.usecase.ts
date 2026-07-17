import { Inject, Injectable } from "@nestjs/common";
import type { ContentImage } from "@zinoflow/contracts";
import { ValidationError } from "../../../shared/errors/app-error";
import {
  CONTENT_IMAGE_REPOSITORY,
  type ContentImageRepository,
} from "../ports/content-image.repository";
import { toContentImage } from "./to-content-image";

/** Duyet 1 anh pending (tu dong tim) -> active, dung binh thuong trong editor (plan §2.3) */
@Injectable()
export class ApproveContentImageUseCase {
  constructor(
    @Inject(CONTENT_IMAGE_REPOSITORY) private readonly repo: ContentImageRepository,
  ) {}

  async execute(id: string): Promise<ContentImage> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new ValidationError(`Không tìm thấy ảnh id=${id}`);
    const approved = await this.repo.approve(id);
    return toContentImage(approved);
  }
}
