import { Inject, Injectable } from "@nestjs/common";
import type { ContentImage, UpdateContentImageRequest } from "@zinoflow/contracts";
import { ValidationError } from "../../../shared/errors/app-error";
import {
  CONTENT_IMAGE_REPOSITORY,
  type ContentImageRepository,
} from "../ports/content-image.repository";
import { toContentImage } from "./to-content-image";

/** Sua alt/caption 1 anh trong thu vien noi dung (plan §3.3) */
@Injectable()
export class UpdateContentImageUseCase {
  constructor(
    @Inject(CONTENT_IMAGE_REPOSITORY) private readonly repo: ContentImageRepository,
  ) {}

  async execute(id: string, request: UpdateContentImageRequest): Promise<ContentImage> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new ValidationError(`Khong tim thay anh id=${id}`);

    const updated = await this.repo.update(id, {
      altText: request.altText,
      caption: request.caption,
    });
    return toContentImage(updated);
  }
}
