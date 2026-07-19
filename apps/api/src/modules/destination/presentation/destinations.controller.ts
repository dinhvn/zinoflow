import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  addressMappingsQuerySchema,
  checkImageRequestSchema,
  createDestinationJobRequestSchema,
  fetchSheetRequestSchema,
  updateDestinationDraftArticleRequestSchema,
  generateDestinationBlockRequestSchema,
  destinationBlockKeySchema,
  importDestinationsRequestSchema,
  exportDestinationsQuerySchema,
  bulkUpdateDestinationFieldsRequestSchema,
  DESTINATION_BULK_EDIT_FIELD_KEYS,
  listDestinationsQuerySchema,
  saveAiInputsRequestSchema,
  relinkAllRequestSchema,
  renameDestinationSlugRequestSchema,
  restructurePastedContentRequestSchema,
  suggestDestinationMetaRequestSchema,
  updateThumbnailRequestSchema,
  updateHeroImageMetaRequestSchema,
  updatePriceBreakdownRequestSchema,
  updatePracticalNotesRequestSchema,
  updateEditorialReviewRequestSchema,
  updateMetaTitleRequestSchema,
  updateExternalReviewUrlsRequestSchema,
  updateDestinationGalleryRequestSchema,
  type GalleryItem,
  type UpdateDestinationGalleryRequest,
  upsertDestinationRequestSchema,
  type AddressMappingProvinces,
  type AddressMappingsQuery,
  type AddressMappingsResponse,
  type PriceBreakdownItem,
  type PracticalNoteItem,
  type SuggestPracticalNotesResponse,
  type UpdateEditorialReviewRequest,
  type UpdateMetaTitleRequest,
  type SuggestEditorialReviewResponse,
  type ExternalReviewUrlItem,
  type UpdateExternalReviewUrlsRequest,
  type CheckImageRequest,
  type CheckImageResponse,
  type CreateDestinationJobRequest,
  type CreateDestinationJobResponse,
  type DestinationDetail,
  type DestinationTaxonomy,
  type GetDestinationsMapResponse,
  type FetchSheetRequest,
  type FetchSheetResponse,
  type ImportDestinationsRequest,
  type ImportDestinationsResult,
  type ExportDestinationsQuery,
  type DestinationBulkEditFieldKey,
  type BulkUpdateDestinationFieldsRequest,
  type BulkUpdateDestinationFieldsResult,
  type ListDestinationsQuery,
  type ListDestinationsResponse,
  type PublishDestinationResult,
  type RecomputeRelatedReport,
  type RecomputeClusterDistancesReport,
  type RelinkAllRequest,
  type RelinkAllReport,
  type RenameDestinationSlugRequest,
  type RenameDestinationSlugResponse,
  type SaveAiInputsRequest,
  type SuggestDestinationMetaRequest,
  type DestinationArticle,
  type DestinationMetaSuggestion,
  type RestructurePastedContentRequest,
  type SyncDestinationsResult,
  migrateDestinationImagesRequestSchema,
  type MigrateDestinationImagesReport,
  type MigrateDestinationImagesRequest,
  type UpdateThumbnailRequest,
  type UpdateHeroImageMetaRequest,
  type UpdatePriceBreakdownRequest,
  type UpdatePracticalNotesRequest,
  type UploadDestinationImageResponse,
  type UpsertDestinationRequest,
  updateTaxonomyDescriptionRequestSchema,
  type TaxonomyContent,
  type UpdateTaxonomyDescriptionRequest,
  type ListCoverageScoresResponse,
  type DichoithoiDashboardAlertsResponse,
  type UpdateDestinationDraftArticleRequest,
  type GenerateDestinationBlockRequest,
  type DestinationBlockKey,
  type ContentSection,
  type DestinationDraftQualityChecksResponse,
  type PreviewDestinationPublishHtmlResponse,
  acceptDestinationAiExtractionFieldsRequestSchema,
  type AcceptDestinationAiExtractionFieldsRequest,
  type DestinationAiExtraction,
  type GetDestinationAiExtractionResponse,
} from "@zinoflow/contracts";
import { ZodValidationPipe } from "../../shared/validation/zod-validation.pipe";
import { ValidationError } from "../../shared/errors/app-error";
import { ListDestinationsUseCase } from "../application/use-cases/list-destinations.usecase";
import { SyncDestinationsUseCase } from "../application/use-cases/sync-destinations.usecase";
import { GetDestinationTaxonomyUseCase } from "../application/use-cases/get-destination-taxonomy.usecase";
import { GetDestinationsMapUseCase } from "../application/use-cases/get-destinations-map.usecase";
import { CreateDestinationJobUseCase } from "../application/use-cases/create-destination-job.usecase";
import { PublishDestinationUseCase } from "../application/use-cases/publish-destination.usecase";
import { RelinkAllUseCase } from "../application/use-cases/relink-all.usecase";
import { UpdateThumbnailUseCase } from "../application/use-cases/update-thumbnail.usecase";
import { UpdateDestinationHeroImageMetaUseCase } from "../application/use-cases/update-destination-hero-image-meta.usecase";
import { UpdatePriceBreakdownUseCase } from "../application/use-cases/update-price-breakdown.usecase";
import { UpdatePracticalNotesUseCase } from "../application/use-cases/update-practical-notes.usecase";
import { SuggestPracticalNotesUseCase } from "../application/use-cases/suggest-practical-notes.usecase";
import { UpdateEditorialReviewUseCase } from "../application/use-cases/update-editorial-review.usecase";
import { UpdateMetaTitleUseCase } from "../application/use-cases/update-meta-title.usecase";
import { SuggestEditorialReviewUseCase } from "../application/use-cases/suggest-editorial-review.usecase";
import { UpdateExternalReviewUrlsUseCase } from "../application/use-cases/update-external-review-urls.usecase";
import { UploadDestinationImageUseCase } from "../application/use-cases/upload-destination-image.usecase";
import { MigrateDestinationImagesUseCase } from "../application/use-cases/migrate-destination-images.usecase";
import { GetDestinationDetailUseCase } from "../application/use-cases/get-destination-detail.usecase";
import { UpsertDestinationUseCase } from "../application/use-cases/upsert-destination.usecase";
import { RenameDestinationSlugUseCase } from "../application/use-cases/rename-destination-slug.usecase";
import { ImportDestinationsUseCase } from "../application/use-cases/import-destinations.usecase";
import { ExportDestinationsUseCase } from "../application/use-cases/export-destinations.usecase";
import { BulkUpdateDestinationFieldsUseCase } from "../application/use-cases/bulk-update-destination-fields.usecase";
import { ListAddressMappingsUseCase } from "../application/use-cases/list-address-mappings.usecase";
import { ManageTaxonomyContentUseCase } from "../application/use-cases/manage-taxonomy-content.usecase";
import { GetCoverageScoresUseCase } from "../application/use-cases/get-coverage-scores.usecase";
import { GetDichoithoiDashboardAlertsUseCase } from "../application/use-cases/get-dichoithoi-dashboard-alerts.usecase";
import { SuggestDestinationMetaUseCase } from "../../ai-content/application/use-cases/suggest-destination-meta.usecase";
import { RestructurePastedContentUseCase } from "../../ai-content/application/use-cases/restructure-pasted-content.usecase";
import { UpdateDestinationDraftArticleUseCase } from "../application/use-cases/update-destination-draft-article.usecase";
import { GenerateDestinationBlockUseCase } from "../application/use-cases/generate-destination-block.usecase";
import { RunDestinationDraftQualityChecksUseCase } from "../application/use-cases/run-destination-draft-quality-checks.usecase";
import { PreviewDestinationPublishHtmlUseCase } from "../application/use-cases/preview-destination-publish-html.usecase";
import { AddDestinationGalleryImageUseCase } from "../application/use-cases/add-destination-gallery-image.usecase";
import { UpdateDestinationGalleryUseCase } from "../application/use-cases/update-destination-gallery.usecase";
import { GetDestinationAiExtractionUseCase } from "../application/use-cases/get-destination-ai-extraction.usecase";
import { AcceptDestinationAiExtractionFieldsUseCase } from "../application/use-cases/accept-destination-ai-extraction-fields.usecase";
import { Patch } from "@nestjs/common";
import { RecomputeRelatedService } from "../application/services/recompute-related.service";
import { RecomputeClusterDistancesUseCase } from "../application/use-cases/recompute-cluster-distances.usecase";
import { GetRelationsMapDataUseCase } from "../application/use-cases/get-relations-map-data.usecase";
import { GetRelatedSpotlightUseCase } from "../application/use-cases/get-related-spotlight.usecase";
import { ManageCuratedRelationUseCase } from "../application/use-cases/manage-curated-relation.usecase";
import { ManageExcludedRelationUseCase } from "../application/use-cases/manage-excluded-relation.usecase";
import {
  manageCuratedRelationRequestSchema,
  manageExcludedRelationRequestSchema,
  type GetRelationsMapDataResponse,
  type GetRelatedSpotlightResponse,
  type ManageCuratedRelationRequest,
  type ManageExcludedRelationRequest,
} from "@zinoflow/contracts";
import { IMAGE_CHECKER, type ImageChecker } from "../application/ports/image-checker.port";
import {
  SHEET_CSV_FETCHER,
  type SheetCsvFetcher,
} from "../../shared/sheet-import/ports/sheet-csv-fetcher.port";
import { JOB_QUEUE, QUEUE_NAMES, type JobQueue } from "../../shared/jobs/job-queue.port";
import { Inject } from "@nestjs/common";

/** Gioi han kich thuoc anh goc upload (truoc khi convert) — 15MB */
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

/**
 * REST khu Dichoithoi (spec dichoithoi-destination-spec §5.1):
 * Phase A list/sync/taxonomy, Phase B jobs, Phase C publish + relink + related.
 */
@Controller("destinations")
export class DestinationsController {
  constructor(
    private readonly listDestinations: ListDestinationsUseCase,
    private readonly syncDestinations: SyncDestinationsUseCase,
    private readonly getTaxonomy: GetDestinationTaxonomyUseCase,
    private readonly getDestinationsMap: GetDestinationsMapUseCase,
    private readonly createJob: CreateDestinationJobUseCase,
    private readonly publishDestination: PublishDestinationUseCase,
    private readonly relinkAll: RelinkAllUseCase,
    private readonly updateThumbnail: UpdateThumbnailUseCase,
    private readonly updateHeroImageMeta: UpdateDestinationHeroImageMetaUseCase,
    private readonly updatePriceBreakdown: UpdatePriceBreakdownUseCase,
    private readonly updatePracticalNotes: UpdatePracticalNotesUseCase,
    private readonly suggestPracticalNotes: SuggestPracticalNotesUseCase,
    private readonly updateEditorialReview: UpdateEditorialReviewUseCase,
    private readonly updateMetaTitle: UpdateMetaTitleUseCase,
    private readonly suggestEditorialReview: SuggestEditorialReviewUseCase,
    private readonly updateExternalReviewUrls: UpdateExternalReviewUrlsUseCase,
    private readonly uploadImage: UploadDestinationImageUseCase,
    private readonly migrateImages: MigrateDestinationImagesUseCase,
    private readonly getDetail: GetDestinationDetailUseCase,
    private readonly upsertDestination: UpsertDestinationUseCase,
    private readonly renameSlug: RenameDestinationSlugUseCase,
    private readonly importDestinations: ImportDestinationsUseCase,
    private readonly exportDestinations: ExportDestinationsUseCase,
    private readonly bulkUpdateFields: BulkUpdateDestinationFieldsUseCase,
    private readonly listAddressMappings: ListAddressMappingsUseCase,
    private readonly manageTaxonomyContent: ManageTaxonomyContentUseCase,
    private readonly getCoverageScores: GetCoverageScoresUseCase,
    private readonly getDashboardAlerts: GetDichoithoiDashboardAlertsUseCase,
    private readonly suggestMeta: SuggestDestinationMetaUseCase,
    private readonly restructurePastedContent: RestructurePastedContentUseCase,
    private readonly updateDraftArticle: UpdateDestinationDraftArticleUseCase,
    private readonly generateBlock: GenerateDestinationBlockUseCase,
    private readonly runDraftQualityChecks: RunDestinationDraftQualityChecksUseCase,
    private readonly previewPublishHtml: PreviewDestinationPublishHtmlUseCase,
    private readonly addGalleryImageUseCase: AddDestinationGalleryImageUseCase,
    private readonly updateGalleryUseCase: UpdateDestinationGalleryUseCase,
    private readonly getAiExtraction: GetDestinationAiExtractionUseCase,
    private readonly acceptAiExtractionFields: AcceptDestinationAiExtractionFieldsUseCase,
    private readonly recomputeRelated: RecomputeRelatedService,
    private readonly recomputeClusterDistancesUseCase: RecomputeClusterDistancesUseCase,
    private readonly getRelationsMapData: GetRelationsMapDataUseCase,
    private readonly getRelatedSpotlight: GetRelatedSpotlightUseCase,
    private readonly manageCuratedRelation: ManageCuratedRelationUseCase,
    private readonly manageExcludedRelation: ManageExcludedRelationUseCase,
    @Inject(IMAGE_CHECKER) private readonly imageChecker: ImageChecker,
    @Inject(SHEET_CSV_FETCHER) private readonly sheetFetcher: SheetCsvFetcher,
    @Inject(JOB_QUEUE) private readonly jobQueue: JobQueue,
  ) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(listDestinationsQuerySchema))
    query: ListDestinationsQuery,
  ): Promise<ListDestinationsResponse> {
    return this.listDestinations.execute(query);
  }

  /** Dong bo mirror tu SQL Server (1 chieu doc) — nut "Dong bo" tren UI */
  @Post("sync")
  sync(): Promise<SyncDestinationsResult> {
    return this.syncDestinations.execute();
  }

  /** Tao diem den MOI trong AI tool (siteId=null cho toi khi publish) — spec §7.3 */
  @Post()
  create(
    @Body(new ZodValidationPipe(upsertDestinationRequestSchema)) request: UpsertDestinationRequest,
  ): Promise<{ slug: string }> {
    return this.upsertDestination.create(request);
  }

  /** AI goi y mo ta + phan loai (mem, KHONG dung lat/lng/dia chi) — spec §3.5 */
  @Post("suggest-meta")
  suggestMetadata(
    @Body(new ZodValidationPipe(suggestDestinationMetaRequestSchema))
    request: SuggestDestinationMetaRequest,
  ): Promise<DestinationMetaSuggestion> {
    return this.suggestMeta.execute(request);
  }

  /**
   * AI tach bai viet CO SAN (dan tu ChatGPT/Gemini khac hoac tu viet) vao dung cau truc
   * DestinationArticle — redesign luong viet bai §Phase 2. Khong tu tao job/draft, FE tu
   * goi POST jobs/manual roi PUT drafts/:id voi article tra ve o day.
   */
  @Post("restructure-paste")
  restructurePaste(
    @Body(new ZodValidationPipe(restructurePastedContentRequestSchema))
    request: RestructurePastedContentRequest,
  ): Promise<DestinationArticle> {
    return this.restructurePastedContent.execute(request);
  }

  /** Tai Google Sheet (cong khai) ve CSV — client parse + xem truoc roi import */
  @Post("fetch-sheet")
  async fetchSheet(
    @Body(new ZodValidationPipe(fetchSheetRequestSchema)) request: FetchSheetRequest,
  ): Promise<FetchSheetResponse> {
    return { csv: await this.sheetFetcher.fetchCsv(request.url) };
  }

  /** Import hang loat (UPSERT theo slug, khong wipe) — spec §7.2 nut +Them */
  @Post("import")
  importBulk(
    @Body(new ZodValidationPipe(importDestinationsRequestSchema)) request: ImportDestinationsRequest,
  ): Promise<ImportDestinationsResult> {
    return this.importDestinations.execute(request.items);
  }

  /**
   * Xuat CSV (slug + cot field da chon) theo dung bo loc dang xem tren trang
   * list (khong cat trang) — buoc 1 cua luong sua nhanh hang loat qua Sheet.
   */
  @Get("export")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="diem-den.csv"')
  async exportCsv(
    @Query(new ZodValidationPipe(exportDestinationsQuerySchema)) query: ExportDestinationsQuery,
  ): Promise<string> {
    const fields = query.fields
      .split(",")
      .map((f) => f.trim())
      .filter((f): f is DestinationBulkEditFieldKey =>
        (DESTINATION_BULK_EDIT_FIELD_KEYS as readonly string[]).includes(f),
      );
    if (fields.length === 0) {
      throw new ValidationError("Chưa chọn cột hợp lệ nào để xuất");
    }
    const csv = await this.exportDestinations.execute(fields, {
      q: query.q,
      provinceCode: query.provinceCode,
      kind: query.kind,
      contentState: query.contentState,
      production: query.production,
    });
    // BOM UTF-8 de Excel/Google Sheets doc dung tieng Viet co dau khi mo file
    return `﻿${csv}`;
  }

  /** Buoc 4 luong sua nhanh hang loat: khop theo slug, GHI DE o co gia tri, bo qua o rong */
  @Post("bulk-update-fields")
  bulkUpdateDestinationFields(
    @Body(new ZodValidationPipe(bulkUpdateDestinationFieldsRequestSchema))
    request: BulkUpdateDestinationFieldsRequest,
  ): Promise<BulkUpdateDestinationFieldsResult> {
    return this.bulkUpdateFields.execute(request.items);
  }

  /** Sua metadata diem den (mirror; neu da co tren web thi ghi luon SQL Server) */
  @Patch(":slug")
  updateMeta(
    @Param("slug") slug: string,
    @Body(new ZodValidationPipe(upsertDestinationRequestSchema)) request: UpsertDestinationRequest,
  ): Promise<{ slug: string }> {
    return this.upsertDestination.update(slug, request);
  }

  /**
   * Doi slug 1 diem den DA TON TAI (Phase 24 chieu ghi) — thao tac RIENG, canh
   * bao ro tren UI, cascade con chau/hotel-tour-map/products.tags + SlugRedirect
   * (xem RenameDestinationSlugUseCase). DAT TRUOC :slug/jobs de khong nham lan.
   */
  @Post(":slug/rename-slug")
  renameDestinationSlug(
    @Param("slug") slug: string,
    @Body(new ZodValidationPipe(renameDestinationSlugRequestSchema))
    request: RenameDestinationSlugRequest,
  ): Promise<RenameDestinationSlugResponse> {
    return this.renameSlug.execute(slug, request.newSlug);
  }

  @Get("taxonomy")
  taxonomy(): Promise<DestinationTaxonomy> {
    return this.getTaxonomy.execute();
  }

  /** DTO nhe cho trang ban do tong quan CMS (relations-plan §5.2, Giai doan A4) */
  @Get("map")
  getMap(): Promise<GetDestinationsMapResponse> {
    return this.getDestinationsMap.execute();
  }

  /** Du lieu nen lop quan he tren ban do (relations-plan §5.3, Giai doan C4). Truoc ":slug". */
  @Get("relations-map-data")
  relationsMapData(): Promise<GetRelationsMapDataResponse> {
    return this.getRelationsMapData.execute();
  }

  /** Tra cuu dia chi cu->moi sau sap nhap (trang /dichoithoi/dia-chi). Truoc ":slug". */
  @Get("address-mappings")
  addressMappings(
    @Query(new ZodValidationPipe(addressMappingsQuerySchema))
    query: AddressMappingsQuery,
  ): Promise<AddressMappingsResponse> {
    return this.listAddressMappings.list(query);
  }

  /** Danh sach tinh/thanh (cu + moi) cho bo loc tra cuu dia chi. Truoc ":slug". */
  @Get("address-mappings/provinces")
  addressMappingProvinces(): Promise<AddressMappingProvinces> {
    return this.listAddressMappings.provinces();
  }

  /** Noi dung danh muc (group/type/province + Description) — trang admin Phase 18.2. Truoc ":slug". */
  @Get("taxonomy-content")
  taxonomyContent(): Promise<TaxonomyContent> {
    return this.manageTaxonomyContent.getContent();
  }

  /** Sua doan gioi thieu 1 group/type/province (content-seo-ux-plan §10.3). Truoc ":slug". */
  @Patch("taxonomy-content")
  updateTaxonomyContent(
    @Body(new ZodValidationPipe(updateTaxonomyDescriptionRequestSchema))
    request: UpdateTaxonomyDescriptionRequest,
  ): Promise<{ ok: true }> {
    return this.manageTaxonomyContent.updateDescription(request);
  }

  /** Coverage Score toan bo diem da published, diem thap truoc (spec §2.2.2). Truoc ":slug". */
  @Get("coverage-scores")
  coverageScores(): Promise<ListCoverageScoresResponse> {
    return this.getCoverageScores.execute();
  }

  /** Khoi "Viec can lam" tren hub CMS (spec §7.2, Phase 23). Truoc ":slug". */
  @Get("dashboard-alerts")
  dashboardAlerts(): Promise<DichoithoiDashboardAlertsResponse> {
    return this.getDashboardAlerts.execute();
  }

  /**
   * Chi tiet 1 diem den cho trang /dichoithoi/[slug] (spec §7.3).
   * DAT SAU cac GET tinh ("taxonomy") de khong nuot chung thanh slug.
   */
  @Get(":slug")
  detail(@Param("slug") slug: string): Promise<DestinationDetail> {
    return this.getDetail.execute(slug);
  }

  /** Tao job AI cho 1 diem den — mode create (bai moi) | update (viet lai bai cu) */
  @Post(":slug/jobs")
  createDestinationJob(
    @Param("slug") slug: string,
    @Body(new ZodValidationPipe(createDestinationJobRequestSchema))
    request: CreateDestinationJobRequest,
  ): Promise<CreateDestinationJobResponse> {
    return this.createJob.execute(slug, request);
  }

  /** Luu thong tin cung cap cho AI (ghi chu + URL nguon) ma KHONG tao bai */
  @Post(":slug/ai-inputs")
  async saveAiInputs(
    @Param("slug") slug: string,
    @Body(new ZodValidationPipe(saveAiInputsRequestSchema)) request: SaveAiInputsRequest,
  ): Promise<{ ok: true }> {
    await this.createJob.saveInputs(slug, request.userNotes ?? null, request.referenceUrls ?? []);
    return { ok: true };
  }

  /**
   * Doc dong staging trich xuat AI (skill dichoithoi-extract-destination-info ghi vao) —
   * null khi chua tung chay skill cho diem nay (dichoithoi-destination-ai-extraction-plan §2.1).
   */
  @Get(":slug/ai-extraction")
  getAiExtractionForSlug(@Param("slug") slug: string): Promise<GetDestinationAiExtractionResponse> {
    return this.getAiExtraction.execute(slug);
  }

  /** Chap nhan cac truong da tick trong bang so sanh trich xuat AI (§2.3) */
  @Post(":slug/ai-extraction/accept")
  acceptAiExtraction(
    @Param("slug") slug: string,
    @Body(new ZodValidationPipe(acceptDestinationAiExtractionFieldsRequestSchema))
    request: AcceptDestinationAiExtractionFieldsRequest,
  ): Promise<DestinationAiExtraction> {
    return this.acceptAiExtractionFields.execute(slug, request.acceptedIndexes);
  }

  /**
   * Re-link toan bo — XEM TRUOC (spec §12.2). DAT TRUOC :slug/publish de Nest
   * khong nuot "relink" thanh slug. LUON chay dong bo o che do doc-only (khong
   * ghi) — tra bao cao chi tiet ngay de admin xem truoc khi bam "Ap dung".
   * Ghi that da chuyen sang POST relink/apply (qua pg-boss, xem duoi).
   */
  @Post("relink")
  relink(
    @Body(new ZodValidationPipe(relinkAllRequestSchema)) _request: RelinkAllRequest,
  ): Promise<RelinkAllReport> {
    return this.relinkAll.execute(true);
  }

  /**
   * Re-link toan bo — AP DUNG THAT, qua pg-boss (Phase 2 build item 3, khong
   * con chay dong bo trong request nhu truoc — xem RelinkAllWorker). Fire-
   * and-forget, cung pattern voi POST /hotels/auto-assign — admin da xem bao
   * cao chi tiet o buoc xem truoc ngay truoc do roi moi bam nut nay.
   */
  @Post("relink/apply")
  async relinkApply(): Promise<{ jobId: string | null }> {
    const jobId = await this.jobQueue.send(QUEUE_NAMES.destinationRelink, {});
    return { jobId };
  }

  /** Tinh lai RelatedJson TOAN BO diem published (spec §12.3) */
  @Post("recompute-related")
  async recompute(): Promise<RecomputeRelatedReport> {
    const startedAt = Date.now();
    const result = await this.recomputeRelated.recomputeAll();
    return { ...result, durationMs: Date.now() - startedAt };
  }

  /** Tinh lai khoang cach cum/tinh (relations-plan §1.2, Giai doan A2) */
  @Post("recompute-cluster-distances")
  recomputeClusterDistances(): Promise<RecomputeClusterDistancesReport> {
    return this.recomputeClusterDistancesUseCase.execute();
  }

  /** Lop "spotlight" — RelatedJson that da tinh san cua 1 diem (§5.6, Giai doan C4) */
  @Get(":slug/related-spotlight")
  relatedSpotlight(@Param("slug") slug: string): Promise<GetRelatedSpotlightResponse> {
    return this.getRelatedSpotlight.execute(slug);
  }

  /** Noi/xoa quan he curated tay tren ban do (§5.7 muc 1-2, Giai doan C4) */
  @Post("relations/curated")
  async curatedRelation(
    @Body(new ZodValidationPipe(manageCuratedRelationRequestSchema))
    request: ManageCuratedRelationRequest,
  ): Promise<{ ok: true }> {
    await this.manageCuratedRelation.execute(request);
    return { ok: true };
  }

  /** Loai tru/khoi phuc 1 goi y tu dong (§5.7 muc 3, Giai doan C4) */
  @Post("relations/excluded")
  async excludedRelation(
    @Body(new ZodValidationPipe(manageExcludedRelationRequestSchema))
    request: ManageExcludedRelationRequest,
  ): Promise<{ ok: true }> {
    await this.manageExcludedRelation.execute(request);
    return { ok: true };
  }

  /**
   * Migrate anh layout cu sang folder-theo-slug (notes refactor §8 buoc 2).
   * dryRun=true chi quet; that thi chay theo limit, bam nhieu lan cho het (idempotent).
   */
  @Post("migrate-images")
  migrateDestinationImages(
    @Body(new ZodValidationPipe(migrateDestinationImagesRequestSchema))
    request: MigrateDestinationImagesRequest,
  ): Promise<MigrateDestinationImagesReport> {
    return this.migrateImages.execute(request);
  }

  /** Kiem tra anh ton tai tren hosting (HEAD request — spec §14.3) */
  @Post("check-image")
  checkImage(
    @Body(new ZodValidationPipe(checkImageRequestSchema)) request: CheckImageRequest,
  ): Promise<CheckImageResponse> {
    return this.imageChecker.check(request.path);
  }

  /** Cap nhat duong dan thumbnail cho 1 diem den (spec §14.3) */
  @Post(":slug/thumbnail")
  async setThumbnail(
    @Param("slug") slug: string,
    @Body(new ZodValidationPipe(updateThumbnailRequestSchema)) request: UpdateThumbnailRequest,
  ): Promise<{ ok: true }> {
    await this.updateThumbnail.execute(slug, request.thumbnail);
    return { ok: true };
  }

  /** Cap nhat mo ta rieng (alt/caption/credit) cho Anh dai dien, giong Thu vien anh */
  @Post(":slug/hero-image-meta")
  async setHeroImageMeta(
    @Param("slug") slug: string,
    @Body(new ZodValidationPipe(updateHeroImageMetaRequestSchema)) request: UpdateHeroImageMetaRequest,
  ): Promise<{ ok: true }> {
    await this.updateHeroImageMeta.execute(slug, request.heroImageMeta);
    return { ok: true };
  }

  /** Cap nhat gia ve theo doi tuong — nhap tay hoan toan (content-seo-ux-plan §5.5a) */
  @Post(":slug/price-breakdown")
  setPriceBreakdown(
    @Param("slug") slug: string,
    @Body(new ZodValidationPipe(updatePriceBreakdownRequestSchema))
    request: UpdatePriceBreakdownRequest,
  ): Promise<PriceBreakdownItem[]> {
    return this.updatePriceBreakdown.execute(slug, request);
  }

  /** Goi y ban nhap "Luu y thuc te" (content-seo-ux-plan §5.7) — CHUA luu */
  @Get(":slug/practical-notes/suggest")
  suggestPracticalNotesForSlug(
    @Param("slug") slug: string,
  ): Promise<SuggestPracticalNotesResponse> {
    return this.suggestPracticalNotes.execute(slug);
  }

  /** Luu ban "Luu y thuc te" nguoi dung DA duyet/sua (content-seo-ux-plan §5.7) */
  @Post(":slug/practical-notes")
  setPracticalNotes(
    @Param("slug") slug: string,
    @Body(new ZodValidationPipe(updatePracticalNotesRequestSchema))
    request: UpdatePracticalNotesRequest,
  ): Promise<PracticalNoteItem[]> {
    return this.updatePracticalNotes.execute(slug, request);
  }

  /** Goi y ban nhap "Danh gia bien tap" (Phase 28.0) — CHUA luu */
  @Get(":slug/editorial-review/suggest")
  suggestEditorialReviewForSlug(
    @Param("slug") slug: string,
  ): Promise<SuggestEditorialReviewResponse> {
    return this.suggestEditorialReview.execute(slug);
  }

  /** Luu ban "Danh gia bien tap" nguoi dung DA duyet/sua (Phase 28.0) */
  @Post(":slug/editorial-review")
  setEditorialReview(
    @Param("slug") slug: string,
    @Body(new ZodValidationPipe(updateEditorialReviewRequestSchema))
    request: UpdateEditorialReviewRequest,
  ): Promise<string | null> {
    return this.updateEditorialReview.execute(slug, request);
  }

  /** Luu metaTitle thu cong tu trang chi tiet (them cach cho bulk-edit CSV) */
  @Post(":slug/meta-title")
  setMetaTitle(
    @Param("slug") slug: string,
    @Body(new ZodValidationPipe(updateMetaTitleRequestSchema))
    request: UpdateMetaTitleRequest,
  ): Promise<string | null> {
    return this.updateMetaTitle.execute(slug, request);
  }

  /** Cap nhat link "Xem them tren" Google Maps/TripAdvisor... (Phase 28.0) */
  @Post(":slug/external-review-urls")
  setExternalReviewUrls(
    @Param("slug") slug: string,
    @Body(new ZodValidationPipe(updateExternalReviewUrlsRequestSchema))
    request: UpdateExternalReviewUrlsRequest,
  ): Promise<ExternalReviewUrlItem[]> {
    return this.updateExternalReviewUrls.execute(slug, request);
  }

  /**
   * Upload anh dai dien: nhan file goc (multipart "file") -> convert 3 co WebP ->
   * FTP len hosting -> ghi cot Thumbnail (spec §14.3 giai doan 2). Gioi han 15MB.
   */
  @Post(":slug/images")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_IMAGE_BYTES } }))
  uploadDestinationImage(
    @Param("slug") slug: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<UploadDestinationImageResponse> {
    if (!file) {
      throw new ValidationError("Thiếu file ảnh (field 'file')");
    }
    if (!file.mimetype.startsWith("image/")) {
      throw new ValidationError(`File không phải ảnh (${file.mimetype})`);
    }
    return this.uploadImage.execute(slug, file.buffer);
  }

  /** Them 1 anh vao thu vien anh (khac anh dai dien) — multipart "file", gioi han 15MB. */
  @Post(":slug/gallery/images")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_IMAGE_BYTES } }))
  addGalleryImage(
    @Param("slug") slug: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<GalleryItem[]> {
    if (!file) {
      throw new ValidationError("Thiếu file ảnh (field 'file')");
    }
    if (!file.mimetype.startsWith("image/")) {
      throw new ValidationError(`File không phải ảnh (${file.mimetype})`);
    }
    return this.addGalleryImageUseCase.execute(slug, file.buffer);
  }

  /** Ghi de nguyen mang thu vien anh — sua alt/caption/credit, doi thu tu, xoa anh */
  @Post(":slug/gallery")
  updateGallery(
    @Param("slug") slug: string,
    @Body(new ZodValidationPipe(updateDestinationGalleryRequestSchema))
    request: UpdateDestinationGalleryRequest,
  ): Promise<GalleryItem[]> {
    return this.updateGalleryUseCase.execute(slug, request);
  }

  /**
   * Luu tay ban nhap bai viet (tieu de/intro/7 block/FAQ/quickFacts/metadata) — pivot
   * gop editor vao trang detail. Ghi thang, khong qua job/duyet (redesign luong viet bai lan 2).
   */
  @Patch(":slug/draft-article")
  setDraftArticle(
    @Param("slug") slug: string,
    @Body(new ZodValidationPipe(updateDestinationDraftArticleRequestSchema))
    request: UpdateDestinationDraftArticleRequest,
  ): Promise<Record<string, unknown>> {
    return this.updateDraftArticle.execute(slug, request.draftArticle);
  }

  /** AI tao goi y cho DUNG 1 block — khong tao ContentJob/ContentDraft (redesign luong viet bai lan 2). */
  @Post(":slug/blocks/:blockKey/suggest")
  suggestBlock(
    @Param("slug") slug: string,
    @Param("blockKey", new ZodValidationPipe(destinationBlockKeySchema)) blockKey: DestinationBlockKey,
    @Body(new ZodValidationPipe(generateDestinationBlockRequestSchema))
    request: GenerateDestinationBlockRequest,
  ): Promise<ContentSection> {
    return this.generateBlock.execute(slug, blockKey, request);
  }

  /** Chay 4 gate tren draft_article HIEN TAI, doc lap voi draftId/job (redesign luong viet bai lan 2). */
  @Post(":slug/draft-article/quality-checks")
  runDraftQualityChecksForSlug(
    @Param("slug") slug: string,
  ): Promise<DestinationDraftQualityChecksResponse> {
    return this.runDraftQualityChecks.execute(slug);
  }

  /** Xem truoc HTML se ghi luc Publish (dry-run, khong ghi DB) — redesign luong viet bai lan 2. */
  @Post(":slug/draft-article/preview-publish-html")
  previewPublishHtmlForSlug(
    @Param("slug") slug: string,
  ): Promise<PreviewDestinationPublishHtmlResponse> {
    return this.previewPublishHtml.execute(slug);
  }

  /** Publish draft_article HIEN TAI cua 1 diem den xuong SQL Server (gate chay ngay tai day) */
  @Post(":slug/publish")
  publish(@Param("slug") slug: string): Promise<PublishDestinationResult> {
    return this.publishDestination.execute(slug);
  }
}
