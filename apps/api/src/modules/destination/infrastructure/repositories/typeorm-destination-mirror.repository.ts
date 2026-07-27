import { Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type {
  AddressMappingsQuery,
  AffiliateLinkItem,
  DestinationOpeningHours,
  ExternalReviewUrlItem,
  GalleryItem,
  HeroImageMeta,
  ListDestinationsQuery,
  PracticalNoteItem,
  PriceBreakdownItem,
} from "@zinoflow/contracts";
import { DestinationMirrorEntity } from "../entities/destination-mirror.entity";
import type { ClusterPoiBackupEntity } from "../entities/cluster-poi-backup.entity";
import { AdminProvinceEntity, AdminWardMappingEntity } from "../entities/admin-units.entity";
import type {
  AddressMappingsListResult,
  DestinationMetadataInput,
  DestinationMirrorListResult,
  DestinationMirrorRepository,
  ProvinceOption,
} from "../../application/ports/destination-mirror.repository";
import type { SiteDestinationRow } from "../../domain/destination-mirror";
import {
  compareDestinationsForSort,
  deriveContentState,
  deriveProductionState,
  hasRealTicketPrice,
  isPendingTicketOpportunity,
} from "../../domain/destination-mirror";
import {
  CONTENT_JOB_REPOSITORY,
  type ContentJobRepository,
} from "../../../ai-content/application/ports/content-job.repository";
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
    @Inject(CONTENT_JOB_REPOSITORY)
    private readonly jobRepo: ContentJobRepository,
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

  async restoreFromBackup(
    newSlug: string,
    source: ClusterPoiBackupEntity,
    parentSlug: string,
    override: { name: string; shortDescription: string | null; priority: number },
  ): Promise<void> {
    await this.repo.insert({
      slug: newSlug,
      siteId: null, // diem khoi phuc tu backup — luon draft, publish lai tu dau
      kind: "poi",
      parentSlug,
      provinceCode: source.provinceCode,
      name: override.name,
      nameUnaccented: normalizeVietnamese(override.name),
      shortDescription: override.shortDescription,
      thumbnail: source.thumbnail,
      lat: source.lat,
      lng: source.lng,
      googleMapsUrl: source.googleMapsUrl,
      addressNew: source.addressNew,
      addressOld: source.addressOld,
      contactPhone: source.contactPhone,
      contactWebsite: source.contactWebsite,
      ticketLinks: source.ticketLinks,
      ticketPrice: source.ticketPrice,
      priceBreakdown: source.priceBreakdown,
      practicalNotes: source.practicalNotes,
      editorialReview: source.editorialReview,
      metaTitle: source.metaTitle,
      externalReviewUrls: source.externalReviewUrls,
      hotelGroupId: source.hotelGroupId,
      priority: override.priority,
      contentTier: source.contentTier,
      order: source.order,
      distanceFromCenter: null, // tinh lai bang nut CMS sau khi cay moi on dinh (chot 27/07/2026)
      siteStatus: null,
      contentSource: source.contentSource,
      contentHash: null,
      activeContentJobId: null,
      aiNotes: source.aiNotes,
      aiReferenceUrls: source.aiReferenceUrls,
      syncFlags: [],
      types: source.types,
      tags: source.tags,
      hasLocalChanges: true,
      siteUpdatedAt: null,
      syncedAt: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- xem ghi chu draftArticle o entity
      draftArticle: source.draftArticle as any,
      gallery: source.gallery,
      heroImageMeta: source.heroImageMeta,
      openingHours: source.openingHours,
      aiReferenceSummary: source.aiReferenceSummary,
      aiReferenceSummaryUpdatedAt: null,
      aiReferenceSummaryGsg: source.aiReferenceSummaryGsg,
      aiReferenceSummaryGsgUpdatedAt: null,
    });
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
      googleMapsUrl: meta.googleMapsUrl,
      addressNew: meta.addressNew,
      addressOld: meta.addressOld,
      contactPhone: meta.contactPhone,
      contactWebsite: meta.contactWebsite,
      hotelGroupId: meta.hotelGroupId,
      priority: meta.priority,
      contentTier: meta.contentTier,
    };
  }

  async list(query: ListDestinationsQuery): Promise<DestinationMirrorListResult> {
    const filtered = await this.getFilteredSorted(query);
    const total = filtered.length;
    const start = (query.page - 1) * query.limit;
    const items = filtered.slice(start, start + query.limit);
    return { items, total };
  }

  /** Nhu list() nhung tra ve TOAN BO ket qua khop filter, khong cat trang (dung cho export CSV). */
  async listAllMatching(
    query: Omit<ListDestinationsQuery, "page" | "limit">,
  ): Promise<DestinationMirrorEntity[]> {
    return this.getFilteredSorted(query);
  }

  /** Loc (SQL + in-memory) + sort — dung chung cho list() (co phan trang) va listAllMatching(). */
  private async getFilteredSorted(
    query: Omit<ListDestinationsQuery, "page" | "limit">,
  ): Promise<DestinationMirrorEntity[]> {
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
    if (query.parentSlug) {
      qb.andWhere("d.parent_slug = :parentSlug", { parentSlug: query.parentSlug });
    }
    if (query.kind) {
      qb.andWhere("d.kind = :kind", { kind: query.kind });
    }

    const entities = await qb.getMany();

    // Batch-load status cua cac job dang gan (1 query) de phan biet "da-duyet" (Approved)
    // voi "dang-soan" — tranh N+1 findById.
    const jobIds = entities
      .map((e) => e.activeContentJobId)
      .filter((id): id is string => id !== null);
    const jobStatuses = await this.jobRepo.findStatusesByIds(jobIds);

    // contentState/productionState/provinceName la gia tri suy ra/join — gan vao entity de
    // loc + sort. Quy mo vai tram diem den nen xu ly trong memory la du nhanh.
    const enriched = entities.map((e) => {
      const province = (e as DestinationMirrorEntity & {
        province?: AdminProvinceEntity;
      }).province;
      const provinceName = province?.shortName ?? null;
      const activeJobStatus = e.activeContentJobId
        ? jobStatuses.get(e.activeContentJobId) ?? null
        : null;
      const contentState = deriveContentState({
        activeContentJobId: e.activeContentJobId,
        activeJobStatus,
        contentSource: e.contentSource,
        contentHash: e.contentHash,
      });
      const productionState = deriveProductionState(e.siteId, e.siteStatus);
      return Object.assign(e, { provinceName, activeJobStatus, contentState, productionState });
    });

    let filtered = enriched;
    if (query.contentState) {
      filtered = filtered.filter((e) => e.contentState === query.contentState);
    }
    if (query.production) {
      filtered = filtered.filter((e) => e.productionState === query.production);
    }
    if (query.hasTicketOpportunity) {
      filtered = filtered.filter(
        (e) => hasRealTicketPrice(e.ticketPrice) || e.ticketLinks.length > 0,
      );
    }

    // Sort server-side tren TOAN BO du lieu da loc, truoc khi cat trang (spec sort).
    // Cast: entity.kind khai bao string nhung gia tri thuc luon thuoc union kind.
    const comparator = compareDestinationsForSort(query.sortBy, query.sortDir) as (
      a: (typeof filtered)[number],
      b: (typeof filtered)[number],
    ) => number;
    filtered.sort(comparator);
    if (query.hasTicketOpportunity) {
      // Uu tien nhom "co gia nhung chua co link mua online" — co hoi hoa hong bo lo (doc §11.3)
      filtered.sort((a, b) => {
        const aPending = isPendingTicketOpportunity(a.ticketPrice, a.ticketLinks.length);
        const bPending = isPendingTicketOpportunity(b.ticketPrice, b.ticketLinks.length);
        return aPending === bPending ? 0 : aPending ? -1 : 1;
      });
    }

    return filtered;
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
      googleMapsUrl: row.googleMapsUrl,
      addressNew: row.addressNew,
      addressOld: row.addressOld,
      contactPhone: row.contactPhone,
      contactWebsite: row.contactWebsite,
      hotelGroupId: row.hotelGroupId,
      priority: row.priority,
      contentTier: row.contentTier,
      order: row.order,
      distanceFromCenter: row.distanceFromCenter?.toString() ?? null,
      siteStatus: row.siteStatus,
      contentSource: row.contentSource,
      contentHash: row.contentHash,
      ticketPrice: row.ticketPrice,
      types: row.types,
      tags: row.tags,
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

  async setDistanceFromCenter(slug: string, distanceMeters: number): Promise<void> {
    await this.repo.update({ slug }, { distanceFromCenter: String(distanceMeters) });
  }

  async setTags(slug: string, tagSlugs: readonly string[]): Promise<void> {
    await this.repo.update({ slug }, { tags: [...tagSlugs] });
  }

  async setTypes(slug: string, typeSlugs: readonly string[]): Promise<void> {
    await this.repo.update({ slug }, { types: [...typeSlugs] });
  }

  async renameSlug(oldSlug: string, newSlug: string): Promise<void> {
    await this.repo.manager.transaction(async (manager) => {
      await manager.query(`UPDATE dichoithoi_destinations SET slug = $1 WHERE slug = $2`, [
        newSlug,
        oldSlug,
      ]);
      await manager.query(
        `UPDATE dichoithoi_destinations SET parent_slug = $1 WHERE parent_slug = $2`,
        [newSlug, oldSlug],
      );
      await manager.query(
        `UPDATE dichoithoi_destination_relations SET source_slug = $1 WHERE source_slug = $2`,
        [newSlug, oldSlug],
      );
      await manager.query(
        `UPDATE dichoithoi_destination_relations SET target_slug = $1 WHERE target_slug = $2`,
        [newSlug, oldSlug],
      );
      // hotel_destination_map/tour_destination_map/products do Hotel/Tour/Product module
      // "so huu" — cham thang qua manager (khong qua port cua ho) de tranh circular
      // dependency module (HotelModule/TourModule da import DestinationModule).
      await manager.query(
        `UPDATE hotel_destination_map SET destination_slug = $1 WHERE destination_slug = $2`,
        [newSlug, oldSlug],
      );
      await manager.query(
        `UPDATE tour_destination_map SET destination_slug = $1 WHERE destination_slug = $2`,
        [newSlug, oldSlug],
      );
      await manager.query(`UPDATE products SET tags = array_replace(tags, $1, $2)`, [
        oldSlug,
        newSlug,
      ]);
    });
  }

  async deleteCascade(slugs: readonly string[]): Promise<void> {
    if (slugs.length === 0) return;
    const list = [...slugs];
    await this.repo.manager.transaction(async (manager) => {
      await manager.query(
        `DELETE FROM dichoithoi_destination_relations WHERE source_slug = ANY($1) OR target_slug = ANY($1)`,
        [list],
      );
      await manager.query(
        `DELETE FROM dichoithoi_poi_distances WHERE poi_a_slug = ANY($1) OR poi_b_slug = ANY($1)`,
        [list],
      );
      await manager.query(
        `DELETE FROM dichoithoi_cluster_distances WHERE cluster_a_slug = ANY($1) OR cluster_b_slug = ANY($1)`,
        [list],
      );
      // hotel_destination_map/tour_destination_map/destination_tickets/products do
      // module khac "so huu" hoac khong co FK — cham thang qua manager (cung ly do
      // voi renameSlug o tren, tranh circular dependency module).
      await manager.query(`DELETE FROM hotel_destination_map WHERE destination_slug = ANY($1)`, [
        list,
      ]);
      await manager.query(`DELETE FROM tour_destination_map WHERE destination_slug = ANY($1)`, [
        list,
      ]);
      await manager.query(`DELETE FROM destination_tickets WHERE destination_slug = ANY($1)`, [
        list,
      ]);
      await manager.query(
        `DELETE FROM dichoithoi_destination_ai_extractions WHERE destination_slug = ANY($1)`,
        [list],
      );
      await manager.query(
        `UPDATE products SET tags = COALESCE(
           (SELECT array_agg(t) FROM unnest(tags) t WHERE t <> ALL($1)), '{}'
         ) WHERE tags && $1`,
        [list],
      );
      await manager.query(`DELETE FROM dichoithoi_destinations WHERE slug = ANY($1)`, [list]);
    });
  }

  async setTicketLinks(slug: string, ticketLinks: readonly AffiliateLinkItem[]): Promise<void> {
    await this.repo.update({ slug }, { ticketLinks: [...ticketLinks] });
  }

  async setPriceBreakdown(
    slug: string,
    priceBreakdown: readonly PriceBreakdownItem[],
  ): Promise<void> {
    await this.repo.update({ slug }, { priceBreakdown: [...priceBreakdown] });
  }

  async setPracticalNotes(
    slug: string,
    practicalNotes: readonly PracticalNoteItem[],
  ): Promise<void> {
    await this.repo.update({ slug }, { practicalNotes: [...practicalNotes] });
  }

  async setEditorialReview(slug: string, editorialReview: string | null): Promise<void> {
    await this.repo.update({ slug }, { editorialReview });
  }

  async setMetaTitle(slug: string, metaTitle: string | null): Promise<void> {
    await this.repo.update({ slug }, { metaTitle });
  }

  async setExternalReviewUrls(
    slug: string,
    externalReviewUrls: readonly ExternalReviewUrlItem[],
  ): Promise<void> {
    await this.repo.update({ slug }, { externalReviewUrls: [...externalReviewUrls] });
  }

  async setGallery(slug: string, gallery: readonly GalleryItem[]): Promise<void> {
    await this.repo.update({ slug }, { gallery: [...gallery] });
  }

  async setHeroImageMeta(slug: string, heroImageMeta: HeroImageMeta | null): Promise<void> {
    await this.repo.update({ slug }, { heroImageMeta });
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

  async setDraftArticle(slug: string, draftArticle: Record<string, unknown>): Promise<void> {
    await this.repo.update({ slug }, { draftArticle: draftArticle as DestinationMirrorEntity["draftArticle"] });
  }

  async setOpeningHours(slug: string, openingHours: DestinationOpeningHours | null): Promise<void> {
    await this.repo.update({ slug }, { openingHours });
  }

  async setAiReferenceSummary(slug: string, summary: string | null): Promise<void> {
    await this.repo.update(
      { slug },
      { aiReferenceSummary: summary, aiReferenceSummaryUpdatedAt: summary ? new Date() : null },
    );
  }

  async setAiReferenceSummaryGsg(slug: string, summary: string | null): Promise<void> {
    await this.repo.update(
      { slug },
      {
        aiReferenceSummaryGsg: summary,
        aiReferenceSummaryGsgUpdatedAt: summary ? new Date() : null,
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
