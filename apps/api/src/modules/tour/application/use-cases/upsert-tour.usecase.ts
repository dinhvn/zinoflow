import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Tour, UpsertTourRequest } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  TOUR_REPOSITORY,
  type TourRecord,
  type TourRepository,
  type UpsertTourInput,
} from "../ports/tour.repository";
import { TOUR_SITE_DB, type TourSiteDb } from "../ports/tour-site-db.port";
import { ResolveAffiliateLinkUseCase } from "../../../affiliate/application/use-cases/resolve-affiliate-link.usecase";
import { JOB_QUEUE, QUEUE_NAMES, type JobQueue } from "../../../shared/jobs/job-queue.port";
import { tourToDto } from "./list-tours.usecase";
import { RecomputeTourCardsUseCase } from "./recompute-tour-cards.usecase";

/**
 * Tao moi / sua tour — publish THANG xuong SQL Server ngay (tour-spec §2/§4:
 * khong AI, khong quality gate, khong review 2 chot).
 *
 * Anh (thumbnailUrl/images) — neu la URL ngoai thi KHONG ingest dong bo o day
 * nua (Phase 21.3, audit 07/2026, giong het thay doi cho Hotel) — publish
 * NGAY voi URL hien co, enqueue job `tour.image-ingest` chay nen
 * (xem ingest-tour-images.usecase.ts). Ingest loi trong job -> giu URL ngoai
 * tam thoi, khong chan gi (never-block).
 */
@Injectable()
export class UpsertTourUseCase {
  private readonly logger = new Logger(UpsertTourUseCase.name);

  constructor(
    @Inject(TOUR_REPOSITORY) private readonly tours: TourRepository,
    @Inject(TOUR_SITE_DB) private readonly siteDb: TourSiteDb,
    private readonly resolveLink: ResolveAffiliateLinkUseCase,
    private readonly recomputeCards: RecomputeTourCardsUseCase,
    @Inject(JOB_QUEUE) private readonly jobQueue: JobQueue,
  ) {}

  async create(request: UpsertTourRequest): Promise<Tour> {
    const input = await this.toInput(request, null);
    const created = await this.tours.create(input);
    await this.publish(created.id, null, input);
    const withSite = await this.tours.findById(created.id);
    if (!withSite) throw new DomainRuleError("Tour biến mất ngay sau khi tạo");
    await this.enqueueImageIngestIfNeeded(created.id, input);
    return tourToDto(withSite, 0);
  }

  async update(id: string, request: UpsertTourRequest): Promise<Tour> {
    const existing = await this.tours.findById(id);
    if (!existing) throw new DomainRuleError(`Không tìm thấy tour id=${id}`);
    const input = await this.toInput(request, existing);
    await this.tours.update(id, input);
    await this.publish(id, existing.siteId, input);
    const updated = await this.tours.findById(id);
    if (!updated) throw new DomainRuleError("Tour biến mất ngay sau khi cập nhật");
    // Gia/rating doi -> mọi diem den dang gan tour nay can tinh lai TourCardsJson
    if (updated.siteId !== null) {
      await this.recomputeCards.forTour(updated.siteId);
    }
    await this.enqueueImageIngestIfNeeded(id, input);
    const counts = await this.tours.countDestinationsByTour();
    return tourToDto(updated, counts.get(id) ?? 0);
  }

  private async enqueueImageIngestIfNeeded(id: string, input: UpsertTourInput): Promise<void> {
    const hasExternalImage =
      isExternalUrl(input.thumbnailUrl) || input.images.some((url) => isExternalUrl(url));
    if (hasExternalImage) {
      await this.jobQueue.send(QUEUE_NAMES.tourImageIngest, { tourId: id });
    }
  }

  /**
   * existing = null khi tao moi. Khi sua, giu nguyen thumbnailSourceUrl/
   * imageSourceUrls cua ban ghi cu neu URL anh khong doi — tranh bug ghi de
   * mat provenance moi lan sua 1 truong khong lien quan anh (vd doi gia).
   */
  private async toInput(
    request: UpsertTourRequest,
    existing: TourRecord | null,
  ): Promise<UpsertTourInput> {
    const resolved = await this.resolveLink.execute(request.sourceUrl, request.provider ?? null);
    const thumbnailUrl = request.thumbnailUrl?.trim() || null;
    const images = request.images ?? [];
    return {
      name: request.name.trim(),
      shortDescription: request.shortDescription?.trim() || null,
      durationDays: request.durationDays ?? null,
      durationNights: request.durationNights ?? null,
      departureFrom: request.departureFrom?.trim() || null,
      provinceCode: request.provinceCode ?? null,
      priceFrom: request.priceFrom ?? null,
      rating: request.rating ?? null,
      reviewCount: request.reviewCount ?? null,
      thumbnailUrl,
      thumbnailSourceUrl:
        existing && existing.thumbnailUrl === thumbnailUrl ? existing.thumbnailSourceUrl : null,
      images,
      imageSourceUrls: images.map((url) => {
        const idx = existing?.images.indexOf(url) ?? -1;
        return idx >= 0 ? (existing!.imageSourceUrls[idx] ?? "") : "";
      }),
      provider: resolved.provider,
      sourceUrl: request.sourceUrl.trim(),
      affiliateUrl: resolved.affiliateUrl,
      linkStatus: resolved.linkStatus,
    };
  }

  private async publish(id: string, siteId: number | null, input: UpsertTourInput): Promise<void> {
    const { siteId: newSiteId } = await this.siteDb.upsertTour({
      siteId,
      name: input.name,
      shortDescription: input.shortDescription,
      durationDays: input.durationDays,
      durationNights: input.durationNights,
      departureFrom: input.departureFrom,
      provinceCode: input.provinceCode,
      priceFrom: input.priceFrom,
      rating: input.rating,
      reviewCount: input.reviewCount,
      thumbnailUrl: input.thumbnailUrl,
      imagesJson: JSON.stringify(input.images),
      provider: input.provider,
      sourceUrl: input.sourceUrl,
      affiliateUrl: input.affiliateUrl,
      linkStatus: input.linkStatus,
    });
    if (siteId === null) {
      await this.tours.setSiteId(id, newSiteId);
      this.logger.log(`Publish tour mới "${input.name}" -> siteId ${newSiteId}`);
    }
  }
}

/** URL ngoai can ingest — path noi bo (da qua ingest) khong co scheme http(s) */
function isExternalUrl(url: string | null): url is string {
  return !!url && /^https?:\/\//i.test(url);
}
