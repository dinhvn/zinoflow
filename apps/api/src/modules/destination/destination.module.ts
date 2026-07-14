import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AiContentModule } from "../ai-content/ai-content.module";
import { AffiliateModule } from "../affiliate/affiliate.module";
import { DestinationsController } from "./presentation/destinations.controller";
import { DestinationTagsController } from "./presentation/destination-tags.controller";
import { DestinationTicketsController } from "./presentation/destination-tickets.controller";
import { ListDestinationsUseCase } from "./application/use-cases/list-destinations.usecase";
import { SyncDestinationsUseCase } from "./application/use-cases/sync-destinations.usecase";
import { GetDestinationTaxonomyUseCase } from "./application/use-cases/get-destination-taxonomy.usecase";
import { CreateDestinationJobUseCase } from "./application/use-cases/create-destination-job.usecase";
import { PublishDestinationUseCase } from "./application/use-cases/publish-destination.usecase";
import { RelinkAllUseCase } from "./application/use-cases/relink-all.usecase";
import { RelinkAllWorker } from "./infrastructure/workers/relink-all.worker";
import { RecomputeRelatedService } from "./application/services/recompute-related.service";
import { DICHOITHOI_SITE_DB } from "./application/ports/dichoithoi-site-db.port";
import { CACHE_PURGE } from "./application/ports/cache-purge.port";
import { HttpCachePurgeAdapter } from "./infrastructure/cache/http-cache-purge.adapter";
import {
  DESTINATION_MIRROR_REPOSITORY,
  DESTINATION_RELATION_REPOSITORY,
} from "./application/ports/destination-mirror.repository";
import { REFERENCE_FETCHER } from "./application/ports/reference-fetcher.port";
import { IMAGE_CHECKER } from "./application/ports/image-checker.port";
import { SHEET_CSV_FETCHER } from "../shared/sheet-import/ports/sheet-csv-fetcher.port";
import { URL_RESOLVER } from "./application/ports/url-resolver.port";
import { HttpReferenceFetcher } from "./infrastructure/reference/http-reference-fetcher";
import { HttpImageChecker } from "./infrastructure/reference/http-image-checker";
import { HttpUrlResolver } from "./infrastructure/reference/http-url-resolver";
import { ParseMapsLinkUseCase } from "./application/use-cases/parse-maps-link.usecase";
import { SharedMediaModule } from "../shared/media/shared-media.module";
import { SharedSheetImportModule } from "../shared/sheet-import/shared-sheet-import.module";
import { UpdateThumbnailUseCase } from "./application/use-cases/update-thumbnail.usecase";
import { ManageDestinationTicketsUseCase } from "./application/use-cases/manage-destination-tickets.usecase";
import { ImportDestinationTicketsUseCase } from "./application/use-cases/import-destination-tickets.usecase";
import { SyncDestinationTicketLinksService } from "./application/services/sync-destination-ticket-links.service";
import { DESTINATION_TICKET_REPOSITORY } from "./application/ports/destination-ticket.repository";
import { TypeOrmDestinationTicketRepository } from "./infrastructure/repositories/typeorm-destination-ticket.repository";
import { DestinationTicketEntity } from "./infrastructure/entities/destination-ticket.entity";
import { UpdatePriceBreakdownUseCase } from "./application/use-cases/update-price-breakdown.usecase";
import { UpdatePracticalNotesUseCase } from "./application/use-cases/update-practical-notes.usecase";
import { SuggestPracticalNotesUseCase } from "./application/use-cases/suggest-practical-notes.usecase";
import { UpdateEditorialReviewUseCase } from "./application/use-cases/update-editorial-review.usecase";
import { SuggestEditorialReviewUseCase } from "./application/use-cases/suggest-editorial-review.usecase";
import { UpdateExternalReviewUrlsUseCase } from "./application/use-cases/update-external-review-urls.usecase";
import { DestinationAffiliateReapplyService } from "./application/services/destination-affiliate-reapply.service";
import { UploadDestinationImageUseCase } from "./application/use-cases/upload-destination-image.usecase";
import { MigrateDestinationImagesUseCase } from "./application/use-cases/migrate-destination-images.usecase";
import { IMAGE_DOWNLOADER } from "./application/ports/image-downloader.port";
import { LocalFileImageDownloader } from "./infrastructure/reference/local-file-image-downloader";
import { GetDestinationDetailUseCase } from "./application/use-cases/get-destination-detail.usecase";
import { UpsertDestinationUseCase } from "./application/use-cases/upsert-destination.usecase";
import { RenameDestinationSlugUseCase } from "./application/use-cases/rename-destination-slug.usecase";
import { ImportDestinationsUseCase } from "./application/use-cases/import-destinations.usecase";
import { ListAddressMappingsUseCase } from "./application/use-cases/list-address-mappings.usecase";
import { ManageTaxonomyContentUseCase } from "./application/use-cases/manage-taxonomy-content.usecase";
import { ListDestinationTagAssignmentsUseCase } from "./application/use-cases/list-destination-tag-assignments.usecase";
import { SuggestTagAssignmentsUseCase } from "./application/use-cases/suggest-tag-assignments.usecase";
import { ApplyTagAssignmentsUseCase } from "./application/use-cases/apply-tag-assignments.usecase";
import { ReverseCheckTagAssignmentsUseCase } from "./application/use-cases/reverse-check-tag-assignments.usecase";
import { GenerateTagDescriptionUseCase } from "./application/use-cases/generate-tag-description.usecase";
import { UpdateTagDescriptionUseCase } from "./application/use-cases/update-tag-description.usecase";
import { GetCoverageScoresUseCase } from "./application/use-cases/get-coverage-scores.usecase";
import { GetDichoithoiDashboardAlertsUseCase } from "./application/use-cases/get-dichoithoi-dashboard-alerts.usecase";
import { UpdateDestinationDraftArticleUseCase } from "./application/use-cases/update-destination-draft-article.usecase";
import { GenerateDestinationBlockUseCase } from "./application/use-cases/generate-destination-block.usecase";
import { RunDestinationDraftQualityChecksUseCase } from "./application/use-cases/run-destination-draft-quality-checks.usecase";
import { PreviewDestinationPublishHtmlUseCase } from "./application/use-cases/preview-destination-publish-html.usecase";
import { AddDestinationGalleryImageUseCase } from "./application/use-cases/add-destination-gallery-image.usecase";
import { UpdateDestinationGalleryUseCase } from "./application/use-cases/update-destination-gallery.usecase";
import { MssqlSiteDbAdapter } from "./infrastructure/dichoithoi/mssql-site-db.adapter";
import { TypeOrmDestinationMirrorRepository } from "./infrastructure/repositories/typeorm-destination-mirror.repository";
import { TypeOrmDestinationRelationRepository } from "./infrastructure/repositories/typeorm-destination-relation.repository";
import { DestinationMirrorEntity } from "./infrastructure/entities/destination-mirror.entity";
import { DestinationRelationEntity } from "./infrastructure/entities/destination-relation.entity";
import {
  AdminProvinceEntity,
  AdminWardEntity,
  AdminWardMappingEntity,
} from "./infrastructure/entities/admin-units.entity";

/**
 * Module Dichoithoi (M4) — AI tool dong vai CMS cho noi dung diem den.
 * Kien truc: docs/dichoithoi/dichoithoi-system-overview.md;
 * tinh nang: docs/dichoithoi/dichoithoi-destination-spec.md.
 * Generate bai van di qua module ai-content — module nay KHONG goi AI provider.
 */
@Module({
  imports: [
    AiContentModule,
    AffiliateModule,
    SharedMediaModule,
    SharedSheetImportModule,
    TypeOrmModule.forFeature([
      DestinationMirrorEntity,
      DestinationRelationEntity,
      DestinationTicketEntity,
      AdminProvinceEntity,
      AdminWardEntity,
      AdminWardMappingEntity,
    ]),
  ],
  controllers: [DestinationsController, DestinationTagsController, DestinationTicketsController],
  providers: [
    ListDestinationTagAssignmentsUseCase,
    SuggestTagAssignmentsUseCase,
    ApplyTagAssignmentsUseCase,
    ReverseCheckTagAssignmentsUseCase,
    GenerateTagDescriptionUseCase,
    UpdateTagDescriptionUseCase,
    GetCoverageScoresUseCase,
    GetDichoithoiDashboardAlertsUseCase,
    ListDestinationsUseCase,
    SyncDestinationsUseCase,
    GetDestinationTaxonomyUseCase,
    CreateDestinationJobUseCase,
    PublishDestinationUseCase,
    RelinkAllUseCase,
    RelinkAllWorker,
    UpdateThumbnailUseCase,
    ManageDestinationTicketsUseCase,
    ImportDestinationTicketsUseCase,
    SyncDestinationTicketLinksService,
    UpdatePriceBreakdownUseCase,
    UpdatePracticalNotesUseCase,
    SuggestPracticalNotesUseCase,
    UpdateEditorialReviewUseCase,
    SuggestEditorialReviewUseCase,
    UpdateExternalReviewUrlsUseCase,
    DestinationAffiliateReapplyService,
    UploadDestinationImageUseCase,
    MigrateDestinationImagesUseCase,
    GetDestinationDetailUseCase,
    UpsertDestinationUseCase,
    RenameDestinationSlugUseCase,
    ImportDestinationsUseCase,
    ListAddressMappingsUseCase,
    ManageTaxonomyContentUseCase,
    ParseMapsLinkUseCase,
    RecomputeRelatedService,
    UpdateDestinationDraftArticleUseCase,
    GenerateDestinationBlockUseCase,
    RunDestinationDraftQualityChecksUseCase,
    PreviewDestinationPublishHtmlUseCase,
    AddDestinationGalleryImageUseCase,
    UpdateDestinationGalleryUseCase,
    { provide: DICHOITHOI_SITE_DB, useClass: MssqlSiteDbAdapter },
    { provide: CACHE_PURGE, useClass: HttpCachePurgeAdapter },
    { provide: REFERENCE_FETCHER, useClass: HttpReferenceFetcher },
    { provide: IMAGE_CHECKER, useClass: HttpImageChecker },
    { provide: URL_RESOLVER, useClass: HttpUrlResolver },
    { provide: IMAGE_DOWNLOADER, useClass: LocalFileImageDownloader },
    { provide: DESTINATION_MIRROR_REPOSITORY, useClass: TypeOrmDestinationMirrorRepository },
    { provide: DESTINATION_RELATION_REPOSITORY, useClass: TypeOrmDestinationRelationRepository },
    { provide: DESTINATION_TICKET_REPOSITORY, useClass: TypeOrmDestinationTicketRepository },
  ],
  exports: [DICHOITHOI_SITE_DB, DESTINATION_MIRROR_REPOSITORY],
})
export class DestinationModule {}
