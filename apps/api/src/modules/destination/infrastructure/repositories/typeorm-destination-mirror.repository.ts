import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { ListDestinationsQuery } from "@zinoflow/contracts";
import { DestinationMirrorEntity } from "../entities/destination-mirror.entity";
import { AdminProvinceEntity } from "../entities/admin-units.entity";
import type {
  DestinationMirrorListResult,
  DestinationMirrorRepository,
  ProvinceOption,
} from "../../application/ports/destination-mirror.repository";
import type { SiteDestinationRow } from "../../domain/destination-mirror";
import { deriveContentState } from "../../domain/destination-mirror";
import { normalizeVietnamese } from "../../../shared/text/vietnamese";

/** Repository mirror diem den tren Postgres (implement port application). */
@Injectable()
export class TypeOrmDestinationMirrorRepository implements DestinationMirrorRepository {
  constructor(
    @InjectRepository(DestinationMirrorEntity)
    private readonly repo: Repository<DestinationMirrorEntity>,
    @InjectRepository(AdminProvinceEntity)
    private readonly provinceRepo: Repository<AdminProvinceEntity>,
  ) {}

  findAll(): Promise<DestinationMirrorEntity[]> {
    return this.repo.find();
  }

  async list(query: ListDestinationsQuery): Promise<DestinationMirrorListResult> {
    const qb = this.repo
      .createQueryBuilder("d")
      .leftJoinAndMapOne(
        "d.province",
        AdminProvinceEntity,
        "p",
        "p.province_code = d.province_code",
      );

    if (query.q) {
      qb.andWhere("d.name_unaccented ILIKE :q", {
        q: `%${normalizeVietnamese(query.q)}%`,
      });
    }
    if (query.provinceCode) {
      qb.andWhere("d.province_code = :pc", { pc: query.provinceCode });
    }
    if (query.kind) {
      qb.andWhere("d.kind = :kind", { kind: query.kind });
    }

    qb.orderBy("d.name", "ASC");

    let entities = await qb.getMany();

    // contentState la gia tri suy ra (domain) — loc sau khi load.
    // Quy mo vai tram diem den nen loc trong memory la du nhanh.
    if (query.contentState) {
      entities = entities.filter(
        (e) =>
          deriveContentState({
            activeContentJobId: e.activeContentJobId,
            contentSource: e.contentSource,
            contentHash: e.contentHash,
          }) === query.contentState,
      );
    }

    const total = entities.length;
    const start = (query.page - 1) * query.limit;
    const items = entities.slice(start, start + query.limit).map((e) => {
      const province = (e as DestinationMirrorEntity & {
        province?: AdminProvinceEntity;
      }).province;
      return Object.assign(e, { provinceName: province?.shortName ?? null });
    });

    return { items, total };
  }

  async upsertFromSite(
    row: SiteDestinationRow,
    flags: string[],
    syncedAt: Date,
  ): Promise<void> {
    await this.repo.save({
      slug: row.slug,
      siteId: row.siteId,
      kind: row.kind,
      parentSlug: row.parentSlug,
      provinceCode: row.provinceCode,
      name: row.name,
      nameUnaccented: normalizeVietnamese(row.name),
      shortDescription: row.shortDescription,
      thumbnail: row.thumbnail,
      lat: row.lat?.toString() ?? null,
      lng: row.lng?.toString() ?? null,
      addressNew: row.addressNew,
      addressOld: row.addressOld,
      contactPhone: row.contactPhone,
      contactWebsite: row.contactWebsite,
      bookingUrl: row.bookingUrl,
      hotelGroupId: row.hotelGroupId,
      isFeatured: row.isFeatured,
      siteStatus: row.siteStatus,
      contentSource: row.contentSource,
      contentHash: row.contentHash,
      syncFlags: flags,
      hasLocalChanges: false,
      siteUpdatedAt: row.siteUpdatedAt,
      syncedAt,
    });
  }

  async setFlags(slug: string, flags: string[]): Promise<void> {
    await this.repo.update({ slug }, { syncFlags: flags });
  }

  async setActiveJob(slug: string, jobId: string | null): Promise<void> {
    await this.repo.update({ slug }, { activeContentJobId: jobId });
  }

  async listProvinces(): Promise<ProvinceOption[]> {
    const provinces = await this.provinceRepo.find({ order: { name: "ASC" } });
    return provinces.map((p) => ({
      provinceCode: p.provinceCode,
      name: p.name,
      shortName: p.shortName,
    }));
  }
}
