import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { AutoSearchArticleResult } from "@zinoflow/contracts";
import { IMAGE_PROCESSOR, type ImageProcessor } from "../../../shared/media/ports/image-processor.port";
import { IMAGE_UPLOADER, type ImageUploader } from "../../../shared/media/ports/image-uploader.port";
import { downloadImageBuffer } from "../../../shared/media/application/download-image";
import {
  CONTENT_JOB_REPOSITORY,
  type ContentJobRepository,
} from "../../../ai-content/application/ports/content-job.repository";
import { STOCK_IMAGE_SEARCH, type StockImageSearchPort } from "../ports/stock-image-search.port";
import {
  CONTENT_IMAGE_REPOSITORY,
  type ContentImageRepository,
} from "../ports/content-image.repository";
import { generateSearchKeyword } from "../../domain/generate-search-keyword";

const CANDIDATES_PER_ARTICLE = 4;
const CONTENT_IMAGE_WIDTH = 1200;
const CONTENT_IMAGE_BASE_DIR_ENV = "DICHOITHOI_FTP_CONTENT_IMAGE_BASE_DIR";

/**
 * Tim + tai + upload anh minh hoa (status=pending) cho danh sach bai cam nang
 * da chon o man quet (auto-image-search-plan.md §2.2). Luon o trang thai CHO
 * DUYET — khong tu publish/gan token vao bai.
 */
@Injectable()
export class AutoSearchContentImagesUseCase {
  private readonly logger = new Logger(AutoSearchContentImagesUseCase.name);

  constructor(
    @Inject(CONTENT_JOB_REPOSITORY) private readonly jobs: ContentJobRepository,
    @Inject(STOCK_IMAGE_SEARCH) private readonly stockSearch: StockImageSearchPort,
    @Inject(CONTENT_IMAGE_REPOSITORY) private readonly repo: ContentImageRepository,
    @Inject(IMAGE_PROCESSOR) private readonly processor: ImageProcessor,
    @Inject(IMAGE_UPLOADER) private readonly uploader: ImageUploader,
  ) {}

  async execute(jobIds: string[]): Promise<AutoSearchArticleResult[]> {
    const results: AutoSearchArticleResult[] = [];
    for (const jobId of jobIds) {
      results.push(await this.processOne(jobId));
    }
    return results;
  }

  private async processOne(jobId: string): Promise<AutoSearchArticleResult> {
    const job = await this.jobs.findById(jobId);
    if (!job) {
      return { jobId, title: jobId, keyword: "", stagedCount: 0, note: "Không tìm thấy bài viết" };
    }
    const snapshot = job.toSnapshot();
    const keyword = generateSearchKeyword(snapshot.topic);

    if (await this.repo.isKeywordRejected(jobId, keyword)) {
      return {
        jobId,
        title: snapshot.topic,
        keyword,
        stagedCount: 0,
        note: "Từ khoá này đã bị từ chối trước đó cho bài viết này — bỏ qua",
      };
    }

    const candidates = await this.stockSearch.search(keyword, CANDIDATES_PER_ARTICLE);
    if (candidates.length === 0) {
      return {
        jobId,
        title: snapshot.topic,
        keyword,
        stagedCount: 0,
        note: "Không tìm thấy ảnh phù hợp (hoặc PEXELS_API_KEY chưa cấu hình)",
      };
    }

    let stagedCount = 0;
    for (const candidate of candidates) {
      try {
        await this.stageOne(candidate, keyword, jobId, snapshot.topic);
        stagedCount++;
      } catch (err) {
        this.logger.warn(
          `Bỏ qua 1 ảnh ứng viên cho job ${jobId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return { jobId, title: snapshot.topic, keyword, stagedCount, note: null };
  }

  private async stageOne(
    candidate: { imageUrl: string; source: string; sourceUrl: string; photographer: string | null },
    keyword: string,
    jobId: string,
    topic: string,
  ): Promise<void> {
    const source = await downloadImageBuffer(candidate.imageUrl);
    const resized = await this.processor.toWebp(source, CONTENT_IMAGE_WIDTH);
    const { width, height } = await this.processor.getDimensions(resized);
    const path = `${randomUUID()}.webp`;
    await this.uploader.upload(
      [{ path, body: resized, contentType: "image/webp" }],
      CONTENT_IMAGE_BASE_DIR_ENV,
    );
    await this.repo.create({
      path,
      altText: `Ảnh minh hoạ cho bài "${topic}"`,
      width,
      height,
      status: "pending",
      source: candidate.source,
      sourceUrl: candidate.sourceUrl,
      photographer: candidate.photographer,
      relatedJobId: jobId,
      searchKeyword: keyword,
    });
  }
}
