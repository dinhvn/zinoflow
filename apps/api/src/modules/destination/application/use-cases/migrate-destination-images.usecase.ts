import { Inject, Injectable, Logger } from "@nestjs/common";
import type {
  MigrateDestinationImagesReport,
  MigrateDestinationImagesRequest,
} from "@zinoflow/contracts";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { IMAGE_CHECKER, type ImageChecker } from "../ports/image-checker.port";
import { IMAGE_DOWNLOADER, type ImageDownloader } from "../ports/image-downloader.port";
import { IMAGE_PROCESSOR, type ImageProcessor } from "../ports/image-processor.port";
import { IMAGE_UPLOADER, type ImageUploader } from "../ports/image-uploader.port";
import { isNewImagePath } from "../../domain/destination-mirror";
import { UpdateThumbnailUseCase } from "./update-thumbnail.usecase";

/**
 * Migrate anh diem den layout CU -> solution MOI (notes refactor, spec §14.1.3):
 * tai full cu ({slug}.webp) -> 3 co WebP (sharp) -> FTP {slug}/hero|medium|thumb.webp
 * -> dien cot Thumbnail (mirror + SQL Server neu co siteId).
 *
 * An toan:
 * - Idempotent: bo qua diem Thumbnail da dang moi (co "/") — chay lai bao nhieu lan cung duoc.
 * - KHONG xoa anh cu: website con fallback path cu toi khi 100% migrate (notes §8).
 * - Loi tung diem duoc gom vao report (missingSource/failed), khong fail ca batch.
 * - limit moi lan chay de request khong qua dai (278 anh ~ chuc phut neu chay 1 phat).
 */
@Injectable()
export class MigrateDestinationImagesUseCase {
  private readonly logger = new Logger(MigrateDestinationImagesUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(IMAGE_CHECKER) private readonly imageChecker: ImageChecker,
    @Inject(IMAGE_DOWNLOADER) private readonly downloader: ImageDownloader,
    @Inject(IMAGE_PROCESSOR) private readonly processor: ImageProcessor,
    @Inject(IMAGE_UPLOADER) private readonly uploader: ImageUploader,
    private readonly updateThumbnail: UpdateThumbnailUseCase,
  ) {}

  async execute(
    request: MigrateDestinationImagesRequest,
  ): Promise<MigrateDestinationImagesReport> {
    const startedAt = Date.now();
    const all = await this.mirrorRepo.findAll();
    const candidates = all.filter((d) => !isNewImagePath(d.thumbnail));

    const report: MigrateDestinationImagesReport = {
      dryRun: request.dryRun,
      scanned: all.length,
      alreadyNew: all.length - candidates.length,
      candidates: candidates.length,
      migrated: [],
      missingSource: [],
      failed: [],
      remaining: candidates.length,
      durationMs: 0,
    };

    if (!request.dryRun) {
      for (const destination of candidates.slice(0, request.limit)) {
        const slug = destination.slug;
        try {
          // Anh full layout cu nam ngay goc thu muc diem-den: "{slug}.webp"
          const sourceUrl = this.imageChecker.buildUrl(`${slug}.webp`);
          if (!sourceUrl) {
            report.failed.push({ slug, error: "Chưa cấu hình DICHOITHOI_IMAGE_BASE_URL" });
            continue;
          }
          const source = await this.downloader.download(sourceUrl);
          if (!source) {
            report.missingSource.push(slug);
            continue;
          }

          const variants = await this.processor.toWebpVariants(source);
          await this.uploader.upload([
            { path: `${slug}/hero.webp`, body: variants.hero, contentType: "image/webp" },
            { path: `${slug}/medium.webp`, body: variants.medium, contentType: "image/webp" },
            { path: `${slug}/thumb.webp`, body: variants.thumb, contentType: "image/webp" },
          ]);
          // Ghi mirror + SQL Server (neu diem da co siteId) — tai dung logic san co
          await this.updateThumbnail.execute(slug, `${slug}/thumb.webp`);
          report.migrated.push(slug);
        } catch (err) {
          report.failed.push({ slug, error: err instanceof Error ? err.message : String(err) });
        }
      }
    }

    report.remaining = report.candidates - report.migrated.length;
    report.durationMs = Date.now() - startedAt;
    this.logger.log(
      `Migrate anh ${request.dryRun ? "(dry-run) " : ""}xong: ${report.migrated.length} ok, ` +
        `${report.missingSource.length} thieu nguon, ${report.failed.length} loi, ` +
        `con lai ${report.remaining}/${report.candidates} (${report.durationMs}ms)`,
    );
    return report;
  }
}
