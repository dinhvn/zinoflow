import { Inject, Injectable } from "@nestjs/common";
import type {
  DestinationMirror,
  ListDestinationsQuery,
  ListDestinationsResponse,
} from "@zinoflow/contracts";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { deriveContentState } from "../../domain/destination-mirror";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";

/** Danh sach diem den cho man hub /dichoithoi (spec §7.2). */
@Injectable()
export class ListDestinationsUseCase {
  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
  ) {}

  async execute(query: ListDestinationsQuery): Promise<ListDestinationsResponse> {
    const { items, total } = await this.mirrorRepo.list(query);
    return {
      items: items.map((e) => this.toDto(e)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  private toDto(e: DestinationMirrorEntity): DestinationMirror {
    return {
      siteId: e.siteId,
      slug: e.slug,
      kind: e.kind as DestinationMirror["kind"],
      parentSlug: e.parentSlug,
      provinceCode: e.provinceCode,
      // ProvinceName join o repository (admin_provinces) — null khi chua gan tinh
      provinceName: (e as DestinationMirrorEntity & { provinceName?: string }).provinceName ?? null,
      name: e.name,
      shortDescription: e.shortDescription,
      thumbnail: e.thumbnail,
      lat: e.lat === null ? null : Number(e.lat),
      lng: e.lng === null ? null : Number(e.lng),
      addressNew: e.addressNew,
      addressOld: e.addressOld,
      contactPhone: e.contactPhone,
      contactWebsite: e.contactWebsite,
      bookingUrl: e.bookingUrl,
      hotelGroupId: e.hotelGroupId,
      isFeatured: e.isFeatured,
      siteStatus: e.siteStatus,
      contentState: deriveContentState({
        activeContentJobId: e.activeContentJobId,
        contentSource: e.contentSource,
        contentHash: e.contentHash,
      }),
      activeContentJobId: e.activeContentJobId,
      syncFlags: e.syncFlags as DestinationMirror["syncFlags"],
      siteUpdatedAt: e.siteUpdatedAt?.toISOString() ?? null,
      syncedAt: e.syncedAt?.toISOString() ?? null,
    };
  }
}
