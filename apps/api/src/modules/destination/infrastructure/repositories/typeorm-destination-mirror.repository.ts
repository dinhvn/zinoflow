import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { AddressMappingsQuery, ListDestinationsQuery } from "@zinoflow/contracts";
import { DestinationMirrorEntity } from "../entities/destination-mirror.entity";
import { AdminProvinceEntity, AdminWardMappingEntity } from "../entities/admin-units.entity";
import type {
  AddressMappingsListResult,
  DestinationMetadataInput,
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
    @InjectRepository(AdminWardMappingEntity)
    private readonly wardMappingRepo: Repository<AdminWardMappingEntity>,
  ) {}

  findAll(): Promise<DestinationMirrorEntity[]> {
    return this.repo.find();
  }

  findBySlug(slug: string): Promise<DestinationMirrorEntity | null> {
    return this.repo.findOne({ where: { slug } });
  }

  async createLocal(slug: string, meta: DestinationMetadataInput): Promise<void> {
    await this.repo.insert({
      slug,
      siteId: null, // diem tao trong AI tool — chua co tren SQL Server
      ...this.metaColumns(meta),
      contentSource: null,
      contentHash: null,
      activeContentJobId: null,
      syncFlags: [],
      hasLocalChanges: true, // co thay doi local chua publish (chan sync de)
      siteUpdatedAt: null,
      syncedAt: null,
    });
  }

  async updateMetadata(slug: string, meta: DestinationMetadataInput): Promise<void> {
    await this.repo.update({ slug }, this.metaColumns(meta));
  }

  /** Map metadata input -> cot entity (dung chung create + update) */
  private metaColumns(meta: DestinationMetadataInput): Partial<DestinationMirrorEntity> {
    return {
      kind: meta.kind,
      parentSlug: meta.parentSlug,
      provinceCode: meta.provinceCode,
      name: meta.name,
      nameUnaccented: normalizeVietnamese(meta.name),
      shortDescription: meta.shortDescription,
      thumbnail: meta.thumbnail,
      lat: meta.lat?.toString() ?? null,
      lng: meta.lng?.toString() ?? null,
      addressNew: meta.addressNew,
      addressOld: meta.addressOld,
      contactPhone: meta.contactPhone,
      contactWebsite: meta.contactWebsite,
      bookingUrl: meta.bookingUrl,
      hotelGroupId: meta.hotelGroupId,
      isFeatured: meta.isFeatured,
    };
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

  async setSiteId(slug: string, siteId: number): Promise<void> {
    await this.repo.update({ slug }, { siteId });
  }

  async setThumbnail(slug: string, thumbnail: string | null): Promise<void> {
    await this.repo.update({ slug }, { thumbnail });
  }

  async saveAiInputs(
    slug: string,
    notes: string | null,
    referenceUrls: Array<{ label: string; url: string }>,
  ): Promise<void> {
    await this.repo.update({ slug }, { aiNotes: notes, aiReferenceUrls: referenceUrls });
  }

  async markPublished(slug: string, contentHash: string): Promise<void> {
    await this.repo.update(
      { slug },
      {
        contentSource: 1,
        contentHash,
        activeContentJobId: null,
        hasLocalChanges: false,
        syncFlags: [],
      },
    );
  }

  async listProvinces(): Promise<ProvinceOption[]> {
    const provinces = await this.provinceRepo.find({ order: { name: "ASC" } });
    return provinces.map((p) => ({
      provinceCode: p.provinceCode,
      name: p.name,
      shortName: p.shortName,
    }));
  }

  async listAddressMappings(query: AddressMappingsQuery): Promise<AddressMappingsListResult> {
    const qb = this.wardMappingRepo.createQueryBuilder("m");

    if (query.q?.trim()) {
      const term = `%${query.q.trim()}%`;
      qb.andWhere(
        "(m.oldWardName ILIKE :term OR m.oldDistrictName ILIKE :term OR m.newWardName ILIKE :term)",
        { term },
      );
    }
    if (query.oldProvinceName) {
      qb.andWhere("m.oldProvinceName = :op", { op: query.oldProvinceName });
    }
    if (query.newProvinceName) {
      qb.andWhere("m.newProvinceName = :np", { np: query.newProvinceName });
    }

    qb.orderBy("m.oldProvinceName", "ASC")
      .addOrderBy("m.oldDistrictName", "ASC")
      .addOrderBy("m.oldWardName", "ASC")
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [rows, total] = await qb.getManyAndCount();
    return {
      items: rows.map((m) => ({
        id: m.id,
        oldWardCode: m.oldWardCode,
        oldWardName: m.oldWardName,
        oldDistrictName: m.oldDistrictName,
        oldProvinceName: m.oldProvinceName,
        newWardCode: m.newWardCode,
        newWardName: m.newWardName,
        newProvinceName: m.newProvinceName,
      })),
      total,
    };
  }

  async listAddressMappingProvinces(): Promise<{ oldProvinces: string[]; newProvinces: string[] }> {
    const distinct = async (column: "oldProvinceName" | "newProvinceName") => {
      const rows = await this.wardMappingRepo
        .createQueryBuilder("m")
        .select(`m.${column}`, "name")
        .where(`m.${column} IS NOT NULL`)
        .distinct(true)
        .orderBy("name", "ASC")
        .getRawMany<{ name: string }>();
      return rows.map((r) => r.name);
    };
    const [oldProvinces, newProvinces] = await Promise.all([
      distinct("oldProvinceName"),
      distinct("newProvinceName"),
    ]);
    return { oldProvinces, newProvinces };
  }
}
