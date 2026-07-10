import {
  Body,
  Controller,
  Get,
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
  importDestinationsRequestSchema,
  listDestinationsQuerySchema,
  parseMapsLinkRequestSchema,
  saveAiInputsRequestSchema,
  relinkAllRequestSchema,
  suggestDestinationMetaRequestSchema,
  updateThumbnailRequestSchema,
  updateTicketLinksRequestSchema,
  updatePriceBreakdownRequestSchema,
  updatePracticalNotesRequestSchema,
  upsertDestinationRequestSchema,
  type AddressMappingProvinces,
  type AddressMappingsQuery,
  type AddressMappingsResponse,
  type AffiliateLinkItem,
  type PriceBreakdownItem,
  type PracticalNoteItem,
  type SuggestPracticalNotesResponse,
  type CheckImageRequest,
  type CheckImageResponse,
  type CreateDestinationJobRequest,
  type CreateDestinationJobResponse,
  type DestinationDetail,
  type DestinationTaxonomy,
  type FetchSheetRequest,
  type FetchSheetResponse,
  type ImportDestinationsRequest,
  type ImportDestinationsResult,
  type ListDestinationsQuery,
  type ListDestinationsResponse,
  type ParseMapsLinkRequest,
  type ParseMapsLinkResponse,
  type PublishDestinationResult,
  type RecomputeRelatedReport,
  type RelinkAllRequest,
  type RelinkAllReport,
  type SaveAiInputsRequest,
  type SuggestDestinationMetaRequest,
  type DestinationMetaSuggestion,
  type SyncDestinationsResult,
  migrateDestinationImagesRequestSchema,
  type MigrateDestinationImagesReport,
  type MigrateDestinationImagesRequest,
  type UpdateThumbnailRequest,
  type UpdateTicketLinksRequest,
  type UpdatePriceBreakdownRequest,
  type UpdatePracticalNotesRequest,
  type UploadDestinationImageResponse,
  type UpsertDestinationRequest,
  updateTaxonomyDescriptionRequestSchema,
  type TaxonomyContent,
  type UpdateTaxonomyDescriptionRequest,
  type ListCoverageScoresResponse,
} from "@zinoflow/contracts";
import { ZodValidationPipe } from "../../shared/validation/zod-validation.pipe";
import { ValidationError } from "../../shared/errors/app-error";
import { ListDestinationsUseCase } from "../application/use-cases/list-destinations.usecase";
import { SyncDestinationsUseCase } from "../application/use-cases/sync-destinations.usecase";
import { GetDestinationTaxonomyUseCase } from "../application/use-cases/get-destination-taxonomy.usecase";
import { CreateDestinationJobUseCase } from "../application/use-cases/create-destination-job.usecase";
import { PublishDestinationUseCase } from "../application/use-cases/publish-destination.usecase";
import { RelinkAllUseCase } from "../application/use-cases/relink-all.usecase";
import { UpdateThumbnailUseCase } from "../application/use-cases/update-thumbnail.usecase";
import { UpdateTicketLinksUseCase } from "../application/use-cases/update-ticket-links.usecase";
import { UpdatePriceBreakdownUseCase } from "../application/use-cases/update-price-breakdown.usecase";
import { UpdatePracticalNotesUseCase } from "../application/use-cases/update-practical-notes.usecase";
import { SuggestPracticalNotesUseCase } from "../application/use-cases/suggest-practical-notes.usecase";
import { UploadDestinationImageUseCase } from "../application/use-cases/upload-destination-image.usecase";
import { MigrateDestinationImagesUseCase } from "../application/use-cases/migrate-destination-images.usecase";
import { GetDestinationDetailUseCase } from "../application/use-cases/get-destination-detail.usecase";
import { ParseMapsLinkUseCase } from "../application/use-cases/parse-maps-link.usecase";
import { UpsertDestinationUseCase } from "../application/use-cases/upsert-destination.usecase";
import { ImportDestinationsUseCase } from "../application/use-cases/import-destinations.usecase";
import { ListAddressMappingsUseCase } from "../application/use-cases/list-address-mappings.usecase";
import { ManageTaxonomyContentUseCase } from "../application/use-cases/manage-taxonomy-content.usecase";
import { GetCoverageScoresUseCase } from "../application/use-cases/get-coverage-scores.usecase";
import { SuggestDestinationMetaUseCase } from "../../ai-content/application/use-cases/suggest-destination-meta.usecase";
import { Patch } from "@nestjs/common";
import { RecomputeRelatedService } from "../application/services/recompute-related.service";
import { IMAGE_CHECKER, type ImageChecker } from "../application/ports/image-checker.port";
import {
  SHEET_CSV_FETCHER,
  type SheetCsvFetcher,
} from "../../shared/sheet-import/ports/sheet-csv-fetcher.port";
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
    private readonly createJob: CreateDestinationJobUseCase,
    private readonly publishDestination: PublishDestinationUseCase,
    private readonly relinkAll: RelinkAllUseCase,
    private readonly updateThumbnail: UpdateThumbnailUseCase,
    private readonly updateTicketLinks: UpdateTicketLinksUseCase,
    private readonly updatePriceBreakdown: UpdatePriceBreakdownUseCase,
    private readonly updatePracticalNotes: UpdatePracticalNotesUseCase,
    private readonly suggestPracticalNotes: SuggestPracticalNotesUseCase,
    private readonly uploadImage: UploadDestinationImageUseCase,
    private readonly migrateImages: MigrateDestinationImagesUseCase,
    private readonly getDetail: GetDestinationDetailUseCase,
    private readonly upsertDestination: UpsertDestinationUseCase,
    private readonly importDestinations: ImportDestinationsUseCase,
    private readonly listAddressMappings: ListAddressMappingsUseCase,
    private readonly manageTaxonomyContent: ManageTaxonomyContentUseCase,
    private readonly getCoverageScores: GetCoverageScoresUseCase,
    private readonly suggestMeta: SuggestDestinationMetaUseCase,
    private readonly parseMapsLink: ParseMapsLinkUseCase,
    private readonly recomputeRelated: RecomputeRelatedService,
    @Inject(IMAGE_CHECKER) private readonly imageChecker: ImageChecker,
    @Inject(SHEET_CSV_FETCHER) private readonly sheetFetcher: SheetCsvFetcher,
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

  /** Sua metadata diem den (mirror; neu da co tren web thi ghi luon SQL Server) */
  @Patch(":slug")
  updateMeta(
    @Param("slug") slug: string,
    @Body(new ZodValidationPipe(upsertDestinationRequestSchema)) request: UpsertDestinationRequest,
  ): Promise<{ slug: string }> {
    return this.upsertDestination.update(slug, request);
  }

  @Get("taxonomy")
  taxonomy(): Promise<DestinationTaxonomy> {
    return this.getTaxonomy.execute();
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
   * Re-link toan bo (spec §12.2). DAT TRUOC :slug/publish de Nest khong nuot
   * "relink" thanh slug. Body {dryRun:true} = xem truoc, khong ghi.
   */
  @Post("relink")
  relink(
    @Body(new ZodValidationPipe(relinkAllRequestSchema)) request: RelinkAllRequest,
  ): Promise<RelinkAllReport> {
    return this.relinkAll.execute(request.dryRun);
  }

  /** Tinh lai RelatedJson TOAN BO diem published (spec §12.3) */
  @Post("recompute-related")
  async recompute(): Promise<RecomputeRelatedReport> {
    const startedAt = Date.now();
    const result = await this.recomputeRelated.recomputeAll();
    return { ...result, durationMs: Date.now() - startedAt };
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

  /** Tach lat/lng tu link Google Maps dan vao (spec §2.1.1) */
  @Post("parse-maps-link")
  parseMapsLinkUrl(
    @Body(new ZodValidationPipe(parseMapsLinkRequestSchema)) request: ParseMapsLinkRequest,
  ): Promise<ParseMapsLinkResponse> {
    return this.parseMapsLink.execute(request.url);
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

  /** Cap nhat danh sach link mua ve (affiliate-link-conversion-spec §5) */
  @Post(":slug/ticket-links")
  setTicketLinks(
    @Param("slug") slug: string,
    @Body(new ZodValidationPipe(updateTicketLinksRequestSchema)) request: UpdateTicketLinksRequest,
  ): Promise<AffiliateLinkItem[]> {
    return this.updateTicketLinks.execute(slug, request);
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

  /** Publish bai DA DUYET cua 1 diem den xuong SQL Server (gate thu cong thu 2) */
  @Post(":slug/publish")
  publish(@Param("slug") slug: string): Promise<PublishDestinationResult> {
    return this.publishDestination.execute(slug);
  }
}
