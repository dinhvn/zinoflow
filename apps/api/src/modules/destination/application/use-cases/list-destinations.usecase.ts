import { Inject, Injectable } from "@nestjs/common";
import type {
  ContentJobStatus,
  DestinationContentState,
  DestinationMirror,
  DestinationProductionState,
  ListDestinationsQuery,
  ListDestinationsResponse,
} from "@zinoflow/contracts";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { IMAGE_CHECKER, type ImageChecker } from "../ports/image-checker.port";
import { deriveContentState } from "../../domain/destination-mirror";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";

/**
 * Entity mirror da duoc repository.list() lam giau: gan san provinceName, status job
 * dang gan, contentState + productionState suy ra (xem repo). Usecase chi doc lai.
 */
type EnrichedMirrorEntity = DestinationMirrorEntity & {
  provinceName?: string | null;
  activeJobStatus: ContentJobStatus | null;
  contentState: DestinationContentState;
  productionState: DestinationProductionState;
};

/** Danh sach diem den cho man hub /dichoithoi (spec §7.2). */
@Injectable()
export class ListDestinationsUseCase {
  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(IMAGE_CHECKER) private readonly imageChecker: ImageChecker,
  ) {}

  async execute(query: ListDestinationsQuery): Promise<ListDestinationsResponse> {
    const { items, total } = await this.mirrorRepo.list(query);
    const enriched = items as EnrichedMirrorEntity[];
    await this.clearRejectedJobPointers(enriched);
    return {
      items: enriched.map((e) => this.toDto(e)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  /**
   * Self-healing: job Rejected la terminal — diem den khong con "dang soan".
   * Clear con tro de UI hien lai nut Tao bai (Failed GIU pointer: con retry duoc).
   * Dung status da batch-load o repo (khong query lai tung job).
   */
  private async clearRejectedJobPointers(items: EnrichedMirrorEntity[]): Promise<void> {
    for (const item of items) {
      if (!item.activeContentJobId || item.activeJobStatus !== "Rejected") continue;
      await this.mirrorRepo.setActiveJob(item.slug, null);
      item.activeContentJobId = null;
      item.activeJobStatus = null;
      // Khong con job -> tinh lai trang thai bai (bai-tay/da-publish/chua-co-bai)
      item.contentState = deriveContentState({
        activeContentJobId: null,
        activeJobStatus: null,
        contentSource: item.contentSource,
        contentHash: item.contentHash,
      });
    }
  }

  private toDto(e: EnrichedMirrorEntity): DestinationMirror {
    return {
      siteId: e.siteId,
      slug: e.slug,
      kind: e.kind as DestinationMirror["kind"],
      parentSlug: e.parentSlug,
      provinceCode: e.provinceCode,
      // ProvinceName join o repository (admin_provinces) — null khi chua gan tinh
      provinceName: e.provinceName ?? null,
      name: e.name,
      shortDescription: e.shortDescription,
      thumbnail: e.thumbnail,
      // Full URL de UI list hien anh cu truc tiep (base env + path tuong doi)
      imageUrl: this.imageChecker.buildUrl(e.thumbnail),
      lat: e.lat === null ? null : Number(e.lat),
      lng: e.lng === null ? null : Number(e.lng),
      addressNew: e.addressNew,
      addressOld: e.addressOld,
      contactPhone: e.contactPhone,
      contactWebsite: e.contactWebsite,
      ticketLinks: e.ticketLinks,
      ticketPrice: e.ticketPrice,
      priceBreakdown: e.priceBreakdown,
      practicalNotes: e.practicalNotes,
      editorialReview: e.editorialReview,
      externalReviewUrls: e.externalReviewUrls,
      gallery: e.gallery,
      hotelGroupId: e.hotelGroupId,
      isFeatured: e.isFeatured,
      contentTier: e.contentTier,
      siteStatus: e.siteStatus,
      // contentState + productionState do repository.list() suy san (co status job)
      contentState: e.contentState,
      productionState: e.productionState,
      activeContentJobId: e.activeContentJobId,
      syncFlags: e.syncFlags as DestinationMirror["syncFlags"],
      siteUpdatedAt: e.siteUpdatedAt?.toISOString() ?? null,
      syncedAt: e.syncedAt?.toISOString() ?? null,
    };
  }
}
