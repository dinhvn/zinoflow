import { Inject, Injectable } from "@nestjs/common";
import type { SetArticleCoverImageRequest } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  CONTENT_JOB_REPOSITORY,
  type ContentJobRepository,
} from "../../../ai-content/application/ports/content-job.repository";
import {
  CONTENT_IMAGE_REPOSITORY,
  type ContentImageRepository,
} from "../../../content-image/application/ports/content-image.repository";

/**
 * Chon/doi anh dai dien cho bai cam-nang tu Thu vien anh noi dung — sua lo
 * hong SEO "Thumbnail luon null luc publish" (audit 07/2026). Anh duoc dung
 * lam og:image/JSON-LD image luc PublishArticleUseCase chay, khong publish
 * lai ngay (nguoi dung tu bam "Đăng bài" lai neu muon cap nhat luon ban da
 * publish — giong cach "Làm mới khối động" hoat dong doc lap voi sua field).
 */
@Injectable()
export class SetArticleCoverImageUseCase {
  constructor(
    @Inject(CONTENT_JOB_REPOSITORY) private readonly jobs: ContentJobRepository,
    @Inject(CONTENT_IMAGE_REPOSITORY) private readonly images: ContentImageRepository,
  ) {}

  async execute(jobId: string, request: SetArticleCoverImageRequest): Promise<void> {
    const job = await this.jobs.findById(jobId);
    if (!job) throw new DomainRuleError(`Không tìm thấy job ${jobId}`);

    if (request.contentImageId) {
      const image = await this.images.findById(request.contentImageId);
      if (!image) throw new DomainRuleError(`Không tìm thấy ảnh ${request.contentImageId}`);
    }

    job.setCoverImage(request.contentImageId);
    await this.jobs.save(job);
  }
}
