import { Inject, Injectable } from "@nestjs/common";
import type { ImageJobDetail } from "@zinoflow/contracts";
import { ValidationError } from "../../../shared/errors/app-error";
import { IMAGE_JOB_REPOSITORY, type ImageJobRepository } from "../ports/image-job.repository";

/** Lay trang thai + outputs cua job render (spec §11). */
@Injectable()
export class GetImageJobUseCase {
  constructor(@Inject(IMAGE_JOB_REPOSITORY) private readonly repo: ImageJobRepository) {}

  async execute(jobId: string): Promise<ImageJobDetail> {
    const detail = await this.repo.getDetail(jobId);
    if (!detail) throw new ValidationError(`Khong tim thay job ${jobId}`);
    return detail;
  }
}
