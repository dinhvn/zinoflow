import { Inject, Injectable } from "@nestjs/common";
import { DomainRuleError } from "../../../shared/errors/app-error";
import { TOUR_REPOSITORY, type TourRepository } from "../ports/tour.repository";
import { TOUR_SITE_DB, type TourSiteDb } from "../ports/tour-site-db.port";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../../../destination/application/ports/destination-mirror.repository";

/** Gan/go 1 tour khoi 1 diem den — 1 tour co the gan NHIEU diem den (tour-spec §3/§6) */
@Injectable()
export class AssignTourToDestinationUseCase {
  constructor(
    @Inject(TOUR_REPOSITORY) private readonly tours: TourRepository,
    @Inject(TOUR_SITE_DB) private readonly siteDb: TourSiteDb,
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly destinationRepo: DestinationMirrorRepository,
  ) {}

  async assign(tourId: string, destinationSlug: string, isPrimary: boolean): Promise<void> {
    const tour = await this.tours.findById(tourId);
    if (!tour) throw new DomainRuleError(`Không tìm thấy tour id=${tourId}`);
    if (tour.siteId === null) {
      throw new DomainRuleError("Tour chưa publish (chưa có siteId) — thử lại sau khi lưu");
    }
    const destination = await this.destinationRepo.findBySlug(destinationSlug);
    if (!destination) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${destinationSlug}"`);
    }
    if (destination.siteId === null) {
      throw new DomainRuleError(
        `Điểm đến "${destinationSlug}" chưa publish trên website — publish bài trước`,
      );
    }
    await this.tours.assignToDestination(tourId, destinationSlug, isPrimary);
    await this.siteDb.assignToDestination(tour.siteId, destinationSlug, isPrimary, true);
  }

  async unassign(tourId: string, destinationSlug: string): Promise<void> {
    const tour = await this.tours.findById(tourId);
    if (!tour) throw new DomainRuleError(`Không tìm thấy tour id=${tourId}`);
    await this.tours.unassignFromDestination(tourId, destinationSlug);
    if (tour.siteId !== null) {
      await this.siteDb.unassignFromDestination(tour.siteId, destinationSlug);
    }
  }
}
