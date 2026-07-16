import { Inject, Injectable, Logger } from "@nestjs/common";
import type {
  DestinationAiExtraction,
  DestinationAiExtractionFieldItem,
  DestinationOpeningHours,
  ExternalReviewUrlItem,
  PriceBreakdownItem,
} from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_AI_EXTRACTION_REPOSITORY,
  type DestinationAiExtractionRepository,
} from "../ports/destination-ai-extraction.repository";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMetadataInput,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import { normalizeVietnamese } from "../../../shared/text/vietnamese";

const MAX_EXTERNAL_REVIEW_URLS = 5;

/**
 * Ap dung cac truong da tick trong bang so sanh trich xuat AI (dichoithoi-
 * destination-ai-extraction-plan §2.3) — ghi vao cot that tuong ung, danh dau
 * accepted trong bang staging. Field khong tick hoac found=false bi bo qua
 * (khong co gi de ap dung). externalReviewUrl la MERGE (khong xoa entry cu
 * nguoi dung da nhap tay, ton trong gioi han 5).
 */
@Injectable()
export class AcceptDestinationAiExtractionFieldsUseCase {
  private readonly logger = new Logger(AcceptDestinationAiExtractionFieldsUseCase.name);

  constructor(
    @Inject(DESTINATION_AI_EXTRACTION_REPOSITORY)
    private readonly extractionRepo: DestinationAiExtractionRepository,
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
  ) {}

  async execute(slug: string, acceptedIndexes: number[]): Promise<DestinationAiExtraction> {
    const extraction = await this.extractionRepo.findBySlug(slug);
    if (!extraction) {
      throw new DomainRuleError(`Chưa có dữ liệu trích xuất AI cho "${slug}"`);
    }
    const destination = await this.mirrorRepo.findBySlug(slug);
    if (!destination) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${slug}" trong mirror`);
    }

    const meta: DestinationMetadataInput = {
      name: destination.name,
      kind: destination.kind,
      parentSlug: destination.parentSlug,
      provinceCode: destination.provinceCode,
      shortDescription: destination.shortDescription,
      thumbnail: destination.thumbnail,
      lat: destination.lat === null ? null : Number(destination.lat),
      lng: destination.lng === null ? null : Number(destination.lng),
      googleMapsUrl: destination.googleMapsUrl,
      addressNew: destination.addressNew,
      addressOld: destination.addressOld,
      contactPhone: destination.contactPhone,
      contactWebsite: destination.contactWebsite,
      hotelGroupId: destination.hotelGroupId,
      priority: destination.priority,
      contentTier: destination.contentTier,
    };
    let metaChanged = false;
    let metaTitle: string | null = destination.metaTitle;
    let metaTitleChanged = false;
    let openingHours: DestinationOpeningHours | null = null;
    let openingHoursChanged = false;
    let aiReferenceSummary: string | null = null;
    let aiReferenceSummaryChanged = false;
    const reviewUrls: ExternalReviewUrlItem[] = destination.externalReviewUrls.map((r) => ({
      ...r,
    }));
    let reviewUrlsChanged = false;
    let priceBreakdown: PriceBreakdownItem[] = [];
    let priceBreakdownChanged = false;
    let editorialReview: string | null = destination.editorialReview;
    let editorialReviewChanged = false;

    const fields = extraction.fields.map((f) => ({ ...f }));
    const appliedIndexes: number[] = [];

    for (const index of acceptedIndexes) {
      const field = fields[index];
      if (!field || !field.found) continue; // khong co gi de ap dung
      appliedIndexes.push(index);

      switch (field.key) {
        case "name":
          meta.name = field.newValue as string;
          metaChanged = true;
          break;
        case "addressNew":
          meta.addressNew = field.newValue as string | null;
          metaChanged = true;
          break;
        case "contactPhone":
          meta.contactPhone = field.newValue as string | null;
          metaChanged = true;
          break;
        case "contactWebsite":
          meta.contactWebsite = field.newValue as string | null;
          metaChanged = true;
          break;
        case "shortDescription":
          meta.shortDescription = field.newValue as string | null;
          metaChanged = true;
          break;
        case "metaTitle":
          metaTitle = field.newValue as string | null;
          metaTitleChanged = true;
          break;
        case "openingHours":
          openingHours = field.newValue as DestinationOpeningHours | null;
          openingHoursChanged = true;
          break;
        case "aiReferenceSummary":
          aiReferenceSummary = field.newValue as string | null;
          aiReferenceSummaryChanged = true;
          break;
        case "externalReviewUrl": {
          const item = field.newValue as ExternalReviewUrlItem;
          const existingIdx = reviewUrls.findIndex(
            (r) => r.label.trim().toLowerCase() === item.label.trim().toLowerCase(),
          );
          if (existingIdx >= 0) {
            reviewUrls[existingIdx] = item;
            reviewUrlsChanged = true;
          } else if (reviewUrls.length < MAX_EXTERNAL_REVIEW_URLS) {
            reviewUrls.push(item);
            reviewUrlsChanged = true;
          }
          // Da du 5 va khong khop label nao — bo qua, khong tu chon xoa entry nao khac.
          break;
        }
        case "priceBreakdown":
          // Ghi de nguyen mang (khong merge) — cung hanh vi voi UpdatePriceBreakdownUseCase.
          priceBreakdown = field.newValue as PriceBreakdownItem[];
          priceBreakdownChanged = true;
          break;
        case "editorialReview":
          editorialReview = field.newValue as string | null;
          editorialReviewChanged = true;
          break;
      }
    }

    if (metaChanged) {
      await this.mirrorRepo.updateMetadata(slug, meta);
      if (destination.siteId !== null) {
        await this.siteDb.updateMetadata(destination.siteId, {
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
          googleMapsUrl: meta.googleMapsUrl,
          addressNew: meta.addressNew,
          addressOld: meta.addressOld,
          contactPhone: meta.contactPhone,
          contactWebsite: meta.contactWebsite,
          hotelGroupId: meta.hotelGroupId,
          priority: meta.priority,
          contentTier: meta.contentTier,
        });
      }
    }
    if (metaTitleChanged) {
      await this.mirrorRepo.setMetaTitle(slug, metaTitle);
      if (destination.siteId !== null) {
        await this.siteDb.updateMetaTitle(destination.siteId, metaTitle);
      }
    }
    if (openingHoursChanged) {
      await this.mirrorRepo.setOpeningHours(slug, openingHours);
    }
    if (aiReferenceSummaryChanged) {
      await this.mirrorRepo.setAiReferenceSummary(slug, aiReferenceSummary);
    }
    if (reviewUrlsChanged) {
      await this.mirrorRepo.setExternalReviewUrls(slug, reviewUrls);
      if (destination.siteId !== null) {
        await this.siteDb.updateExternalReviewUrls(destination.siteId, JSON.stringify(reviewUrls));
      }
    }
    if (priceBreakdownChanged) {
      await this.mirrorRepo.setPriceBreakdown(slug, priceBreakdown);
      if (destination.siteId !== null) {
        await this.siteDb.updatePriceBreakdown(destination.siteId, JSON.stringify(priceBreakdown));
      }
    }
    if (editorialReviewChanged) {
      await this.mirrorRepo.setEditorialReview(slug, editorialReview);
      if (destination.siteId !== null) {
        await this.siteDb.updateEditorialReview(destination.siteId, editorialReview);
      }
    }

    const updatedFields: DestinationAiExtractionFieldItem[] = fields.map((f, i) =>
      appliedIndexes.includes(i) ? { ...f, status: "accepted" } : f,
    );
    await this.extractionRepo.updateFields(slug, updatedFields);

    this.logger.log(
      `Chấp nhận ${appliedIndexes.length} trường trích xuất AI cho ${slug}`,
    );
    return {
      destinationSlug: extraction.destinationSlug,
      sourceUrls: extraction.sourceUrls,
      extractedAt: extraction.extractedAt.toISOString(),
      fields: updatedFields,
    };
  }
}
