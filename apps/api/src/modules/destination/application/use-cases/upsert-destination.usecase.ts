import { Inject, Injectable, Logger } from "@nestjs/common";
import type { UpsertDestinationRequest } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMetadataInput,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import { normalizeVietnamese } from "../../../shared/text/vietnamese";

/**
 * Tao moi / sua metadata 1 diem den (spec §7.3 tab Thong tin).
 * - Tao: them dong mirror (siteId=null) — diem song trong AI tool cho toi khi publish.
 * - Sua: cap nhat mirror; neu diem da ton tai tren web (siteId != null) thi ghi
 *   metadata thang SQL Server luon de website phan anh ngay (khong cho publish bai).
 */
@Injectable()
export class UpsertDestinationUseCase {
  private readonly logger = new Logger(UpsertDestinationUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
  ) {}

  /** Tao moi — slug phai chua ton tai. */
  async create(request: UpsertDestinationRequest): Promise<{ slug: string }> {
    const existing = await this.mirrorRepo.findBySlug(request.slug);
    if (existing) {
      throw new DomainRuleError(`Slug "${request.slug}" đã tồn tại`, [
        "Chọn slug khác hoặc mở điểm đến đang có để sửa",
      ]);
    }
    await this.assertParentAndProvince(request);
    await this.mirrorRepo.createLocal(request.slug, toMeta(request));
    this.logger.log(`Tao diem den moi (local): ${request.slug}`);
    return { slug: request.slug };
  }

  /** Sua metadata diem den da co. */
  async update(slug: string, request: UpsertDestinationRequest): Promise<{ slug: string }> {
    const existing = await this.mirrorRepo.findBySlug(slug);
    if (!existing) throw new DomainRuleError(`Không tìm thấy điểm đến "${slug}"`);
    await this.assertParentAndProvince(request, slug);

    const meta = toMeta(request);
    await this.mirrorRepo.updateMetadata(slug, meta);

    // Da ton tai tren web -> day metadata sang SQL Server ngay (website phan anh)
    if (existing.siteId !== null) {
      await this.siteDb.updateMetadata(existing.siteId, {
        slug,
        kind: meta.kind as "province" | "cluster" | "poi",
        parentSlug: meta.parentSlug,
        provinceCode: meta.provinceCode,
        name: meta.name,
        nameUnaccented: normalizeVietnamese(meta.name),
        shortDescription: meta.shortDescription,
        thumbnail: meta.thumbnail,
        lat: meta.lat,
        lng: meta.lng,
        addressNew: meta.addressNew,
        addressOld: meta.addressOld,
        contactPhone: meta.contactPhone,
        contactWebsite: meta.contactWebsite,
        hotelGroupId: meta.hotelGroupId,
        isFeatured: meta.isFeatured,
      });
    }
    this.logger.log(`Cap nhat metadata diem den: ${slug}`);
    return { slug };
  }

  /** Cha + tinh phai ton tai (neu duoc chi dinh) — tranh lien ket gay. */
  private async assertParentAndProvince(
    request: UpsertDestinationRequest,
    selfSlug?: string,
  ): Promise<void> {
    if (request.parentSlug) {
      if (request.parentSlug === selfSlug) {
        throw new DomainRuleError("Điểm đến không thể là cha của chính nó");
      }
      const parent = await this.mirrorRepo.findBySlug(request.parentSlug);
      if (!parent) {
        throw new DomainRuleError(`Không tìm thấy điểm cha "${request.parentSlug}"`);
      }
    }
  }
}

/** Chuan hoa request (optional/undefined -> null) thanh metadata input cho repo. */
function toMeta(request: UpsertDestinationRequest): DestinationMetadataInput {
  return {
    name: request.name,
    kind: request.kind,
    parentSlug: request.parentSlug ?? null,
    provinceCode: request.provinceCode ?? null,
    shortDescription: request.shortDescription ?? null,
    thumbnail: request.thumbnail ?? null,
    lat: request.lat ?? null,
    lng: request.lng ?? null,
    addressNew: request.addressNew ?? null,
    addressOld: request.addressOld ?? null,
    contactPhone: request.contactPhone ?? null,
    contactWebsite: request.contactWebsite ?? null,
    hotelGroupId: request.hotelGroupId ?? null,
    isFeatured: request.isFeatured ?? false,
  };
}
