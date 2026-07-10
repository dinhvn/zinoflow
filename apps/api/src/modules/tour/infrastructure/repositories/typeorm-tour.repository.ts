import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TourEntity } from "../entities/tour.entity";
import { TourDestinationMapEntity } from "../entities/tour-destination-map.entity";
import type {
  TourDestinationMapRecord,
  TourRecord,
  TourRepository as ITourRepository,
  UpsertTourInput,
} from "../../application/ports/tour.repository";

function toRecord(e: TourEntity): TourRecord {
  return {
    id: e.id,
    name: e.name,
    shortDescription: e.shortDescription,
    durationDays: e.durationDays,
    durationNights: e.durationNights,
    departureFrom: e.departureFrom,
    provinceCode: e.provinceCode,
    priceFrom: e.priceFrom === null ? null : Number(e.priceFrom),
    rating: e.rating === null ? null : Number(e.rating),
    reviewCount: e.reviewCount,
    thumbnailUrl: e.thumbnailUrl,
    thumbnailSourceUrl: e.thumbnailSourceUrl,
    images: e.images,
    imageSourceUrls: e.imageSourceUrls,
    provider: e.provider,
    sourceUrl: e.sourceUrl,
    affiliateUrl: e.affiliateUrl,
    linkStatus: e.linkStatus,
    source: e.source,
    siteId: e.siteId,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

/** Cot decimal cua entity la string — chuyen tu number cua input truoc khi ghi */
function toColumns(input: UpsertTourInput): Partial<TourEntity> {
  return {
    ...input,
    priceFrom: input.priceFrom === null ? null : input.priceFrom.toString(),
    rating: input.rating === null ? null : input.rating.toString(),
  };
}

@Injectable()
export class TypeOrmTourRepository implements ITourRepository {
  constructor(
    @InjectRepository(TourEntity) private readonly repo: Repository<TourEntity>,
    @InjectRepository(TourDestinationMapEntity)
    private readonly mapRepo: Repository<TourDestinationMapEntity>,
  ) {}

  async findAll(): Promise<TourRecord[]> {
    return (await this.repo.find({ order: { name: "ASC" } })).map(toRecord);
  }

  async findById(id: string): Promise<TourRecord | null> {
    const e = await this.repo.findOneBy({ id });
    return e ? toRecord(e) : null;
  }

  async create(input: UpsertTourInput): Promise<TourRecord> {
    const saved = await this.repo.save(this.repo.create({ ...toColumns(input), siteId: null }));
    return toRecord(saved);
  }

  async update(id: string, input: UpsertTourInput): Promise<TourRecord> {
    await this.repo.update({ id }, toColumns(input));
    const updated = await this.findById(id);
    if (!updated) throw new Error(`Tour id=${id} bien mat sau update`);
    return updated;
  }

  async setSiteId(id: string, siteId: number): Promise<void> {
    await this.repo.update({ id }, { siteId });
  }

  async countDestinationsByTour(): Promise<Map<string, number>> {
    const rows = await this.mapRepo
      .createQueryBuilder("m")
      .select("m.tour_id", "tourId")
      .addSelect("COUNT(*)", "count")
      .groupBy("m.tour_id")
      .getRawMany<{ tourId: string; count: string }>();
    return new Map(rows.map((r) => [r.tourId, Number(r.count)]));
  }

  async assignToDestination(
    tourId: string,
    destinationSlug: string,
    isPrimary: boolean,
  ): Promise<void> {
    await this.mapRepo.upsert(
      { tourId, destinationSlug, isPrimary, isManual: true },
      ["tourId", "destinationSlug"],
    );
  }

  async unassignFromDestination(tourId: string, destinationSlug: string): Promise<void> {
    await this.mapRepo.delete({ tourId, destinationSlug });
  }

  async listForDestination(destinationSlug: string): Promise<TourDestinationMapRecord[]> {
    return this.mapRepo.find({ where: { destinationSlug }, order: { isPrimary: "DESC" } });
  }
}
