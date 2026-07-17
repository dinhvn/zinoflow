import { Inject, Injectable } from "@nestjs/common";
import type { ContentImage } from "@zinoflow/contracts";
import {
  CONTENT_IMAGE_REPOSITORY,
  type ContentImageRepository,
} from "../ports/content-image.repository";
import { toContentImage } from "./to-content-image";

/** Danh sach anh trong thu vien noi dung — mac dinh hien ca active lan pending
 * (UI thu vien tach tab, plan §2.3), use-case nay chi tra thang du lieu */
@Injectable()
export class ListContentImagesUseCase {
  constructor(
    @Inject(CONTENT_IMAGE_REPOSITORY) private readonly repo: ContentImageRepository,
  ) {}

  async execute(): Promise<ContentImage[]> {
    const records = await this.repo.findAll();
    const jobIds = [...new Set(records.map((r) => r.relatedJobId).filter((id): id is string => id !== null))];
    const titleByJobId = await this.repo.findArticleTitlesByJobIds(jobIds);
    return records.map((r) => toContentImage(r, titleByJobId));
  }
}
