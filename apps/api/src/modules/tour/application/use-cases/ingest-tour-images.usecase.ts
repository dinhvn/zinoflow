import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  TOUR_REPOSITORY,
  type TourRepository,
  type UpsertTourInput,
} from "../ports/tour.repository";
import { TOUR_SITE_DB, type TourSiteDb } from "../ports/tour-site-db.port";
import { IngestExternalImageUseCase } from "../../../shared/media/application/ingest-external-image.usecase";
import { RecomputeTourCardsUseCase } from "./recompute-tour-cards.usecase";

const TOUR_FTP_BASE_DIR_ENV = "DICHOITHOI_FTP_TOUR_BASE_DIR";

/**
 * Chay NEN (worker pg-boss `tour.image-ingest`) — tach khoi UpsertTourUseCase
 * (Phase 21.3, audit 07/2026), cung nguyen tac voi IngestHotelImagesUseCase:
 * UpsertTourUseCase publish NGAY voi URL anh hien co, enqueue job nay ngay
 * sau — job tai ve/resize/FTP roi ghi de + publish lai. Ingest loi -> giu URL
 * ngoai tam thoi (never-block).
 */
@Injectable()
export class IngestTourImagesUseCase {
  private readonly logger = new Logger(IngestTourImagesUseCase.name);

  constructor(
    @Inject(TOUR_REPOSITORY) private readonly tours: TourRepository,
    @Inject(TOUR_SITE_DB) private readonly siteDb: TourSiteDb,
    private readonly ingestImage: IngestExternalImageUseCase,
    private readonly recomputeCards: RecomputeTourCardsUseCase,
  ) {}

  async execute(tourId: string): Promise<void> {
    const tour = await this.tours.findById(tourId);
    if (!tour) {
      this.logger.warn(`Ingest ảnh: không tìm thấy tour id=${tourId} (có thể đã bị xoá)`);
      return;
    }
    const input: UpsertTourInput = { ...tour, affiliateUrl: tour.affiliateUrl ?? tour.sourceUrl };

    const withImages = await this.ingestImagesIfNeeded(tourId, input);
    if (!withImages) return;

    await this.tours.update(tourId, withImages);
    await this.siteDb.upsertTour({
      siteId: tour.siteId,
      name: withImages.name,
      shortDescription: withImages.shortDescription,
      durationDays: withImages.durationDays,
      durationNights: withImages.durationNights,
      departureFrom: withImages.departureFrom,
      provinceCode: withImages.provinceCode,
      priceFrom: withImages.priceFrom,
      rating: withImages.rating,
      reviewCount: withImages.reviewCount,
      thumbnailUrl: withImages.thumbnailUrl,
      imagesJson: JSON.stringify(withImages.images),
      provider: withImages.provider,
      sourceUrl: withImages.sourceUrl,
      affiliateUrl: withImages.affiliateUrl,
      linkStatus: withImages.linkStatus,
    });
    if (tour.siteId !== null) {
      await this.recomputeCards.forTour(tour.siteId);
    }
  }

  private async ingestImagesIfNeeded(
    tourId: string,
    input: UpsertTourInput,
  ): Promise<UpsertTourInput | null> {
    let changed = false;
    let thumbnailUrl = input.thumbnailUrl;
    let thumbnailSourceUrl = input.thumbnailSourceUrl;
    if (isExternalUrl(input.thumbnailUrl)) {
      changed = true;
      thumbnailSourceUrl = input.thumbnailUrl;
      try {
        const paths = await this.ingestImage.execute(
          input.thumbnailUrl!,
          `${tourId}/${tourId}-thumbnail`,
          TOUR_FTP_BASE_DIR_ENV,
        );
        thumbnailUrl = paths.thumb;
      } catch (err) {
        this.logger.warn(
          `Ingest ảnh đại diện tour ${tourId} thất bại, giữ tạm URL ngoài: ` +
            (err instanceof Error ? err.message : String(err)),
        );
      }
    }

    const images: string[] = [];
    const imageSourceUrls: string[] = [];
    for (let i = 0; i < input.images.length; i += 1) {
      const url = input.images[i]!;
      if (!isExternalUrl(url)) {
        images.push(url);
        imageSourceUrls.push(input.imageSourceUrls[i] ?? "");
        continue;
      }
      changed = true;
      imageSourceUrls.push(url);
      try {
        const paths = await this.ingestImage.execute(
          url,
          `${tourId}/${tourId}-anh-${i + 1}`,
          TOUR_FTP_BASE_DIR_ENV,
        );
        images.push(paths.medium);
      } catch (err) {
        this.logger.warn(
          `Ingest ảnh phụ #${i + 1} tour ${tourId} thất bại, giữ tạm URL ngoài: ` +
            (err instanceof Error ? err.message : String(err)),
        );
        images.push(url);
      }
    }

    if (!changed) return null;
    return { ...input, thumbnailUrl, thumbnailSourceUrl, images, imageSourceUrls };
  }
}

/** URL ngoai can ingest — path noi bo (da qua ingest) khong co scheme http(s) */
function isExternalUrl(url: string | null): url is string {
  return !!url && /^https?:\/\//i.test(url);
}
