import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { HotelEntity } from "../entities/hotel.entity";
import { HotelDestinationMapEntity } from "../entities/hotel-destination-map.entity";
import type {
  HotelDestinationMapRecord,
  HotelRecord,
  HotelRepository as IHotelRepository,
  UpsertHotelInput,
} from "../../application/ports/hotel.repository";

function toRecord(e: HotelEntity): HotelRecord {
  return {
    id: e.id,
    name: e.name,
    address: e.address,
    lat: e.lat === null ? null : Number(e.lat),
    lng: e.lng === null ? null : Number(e.lng),
    provinceCode: e.provinceCode,
    priceFrom: e.priceFrom === null ? null : Number(e.priceFrom),
    rating: e.rating === null ? null : Number(e.rating),
    reviewCount: e.reviewCount,
    thumbnailUrl: e.thumbnailUrl,
    images: e.images,
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
function toColumns(input: UpsertHotelInput): Partial<HotelEntity> {
  return {
    ...input,
    lat: input.lat === null ? null : input.lat.toString(),
    lng: input.lng === null ? null : input.lng.toString(),
    priceFrom: input.priceFrom === null ? null : input.priceFrom.toString(),
    rating: input.rating === null ? null : input.rating.toString(),
  };
}

@Injectable()
export class TypeOrmHotelRepository implements IHotelRepository {
  constructor(
    @InjectRepository(HotelEntity) private readonly repo: Repository<HotelEntity>,
    @InjectRepository(HotelDestinationMapEntity)
    private readonly mapRepo: Repository<HotelDestinationMapEntity>,
  ) {}

  async findAll(): Promise<HotelRecord[]> {
    return (await this.repo.find({ order: { name: "ASC" } })).map(toRecord);
  }

  async findById(id: string): Promise<HotelRecord | null> {
    const e = await this.repo.findOneBy({ id });
    return e ? toRecord(e) : null;
  }

  async create(input: UpsertHotelInput): Promise<HotelRecord> {
    const saved = await this.repo.save(this.repo.create({ ...toColumns(input), siteId: null }));
    return toRecord(saved);
  }

  async update(id: string, input: UpsertHotelInput): Promise<HotelRecord> {
    await this.repo.update({ id }, toColumns(input));
    const updated = await this.findById(id);
    if (!updated) throw new Error(`Hotel id=${id} bien mat sau update`);
    return updated;
  }

  async setSiteId(id: string, siteId: number): Promise<void> {
    await this.repo.update({ id }, { siteId });
  }

  async countDestinationsByHotel(): Promise<Map<string, number>> {
    const rows = await this.mapRepo
      .createQueryBuilder("m")
      .select("m.hotel_id", "hotelId")
      .addSelect("COUNT(*)", "count")
      .groupBy("m.hotel_id")
      .getRawMany<{ hotelId: string; count: string }>();
    return new Map(rows.map((r) => [r.hotelId, Number(r.count)]));
  }

  async assignToDestination(hotelId: string, destinationSlug: string): Promise<void> {
    await this.mapRepo.upsert(
      { hotelId, destinationSlug, distanceM: null, isManual: true },
      ["hotelId", "destinationSlug"],
    );
  }

  async unassignFromDestination(hotelId: string, destinationSlug: string): Promise<void> {
    await this.mapRepo.delete({ hotelId, destinationSlug });
  }

  async listForDestination(destinationSlug: string): Promise<HotelDestinationMapRecord[]> {
    return this.mapRepo.find({ where: { destinationSlug } });
  }
}
