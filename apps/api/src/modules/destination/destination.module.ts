import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AiContentModule } from "../ai-content/ai-content.module";
import { AffiliateModule } from "../affiliate/affiliate.module";
import { DestinationsController } from "./presentation/destinations.controller";
import { ListDestinationsUseCase } from "./application/use-cases/list-destinations.usecase";
import { SyncDestinationsUseCase } from "./application/use-cases/sync-destinations.usecase";
import { GetDestinationTaxonomyUseCase } from "./application/use-cases/get-destination-taxonomy.usecase";
import { CreateDestinationJobUseCase } from "./application/use-cases/create-destination-job.usecase";
import { PublishDestinationUseCase } from "./application/use-cases/publish-destination.usecase";
import { RelinkAllUseCase } from "./application/use-cases/relink-all.usecase";
import { RecomputeRelatedService } from "./application/services/recompute-related.service";
import { DICHOITHOI_SITE_DB } from "./application/ports/dichoithoi-site-db.port";
import {
  DESTINATION_MIRROR_REPOSITORY,
  DESTINATION_RELATION_REPOSITORY,
} from "./application/ports/destination-mirror.repository";
import { REFERENCE_FETCHER } from "./application/ports/reference-fetcher.port";
import { IMAGE_CHECKER } from "./application/ports/image-checker.port";
import { IMAGE_PROCESSOR } from "./application/ports/image-processor.port";
import { IMAGE_UPLOADER } from "./application/ports/image-uploader.port";
import { SHEET_CSV_FETCHER } from "./application/ports/sheet-csv-fetcher.port";
import { HttpReferenceFetcher } from "./infrastructure/reference/http-reference-fetcher";
import { HttpImageChecker } from "./infrastructure/reference/http-image-checker";
import { SharpImageProcessor } from "./infrastructure/image/sharp-image-processor";
import { FtpsImageUploader } from "./infrastructure/dichoithoi/ftps-image-uploader";
import { GoogleSheetCsvFetcher } from "./infrastructure/reference/google-sheet-csv-fetcher";
import { UpdateThumbnailUseCase } from "./application/use-cases/update-thumbnail.usecase";
import { UpdateTicketLinksUseCase } from "./application/use-cases/update-ticket-links.usecase";
import { DestinationAffiliateReapplyService } from "./application/services/destination-affiliate-reapply.service";
import { UploadDestinationImageUseCase } from "./application/use-cases/upload-destination-image.usecase";
import { MigrateDestinationImagesUseCase } from "./application/use-cases/migrate-destination-images.usecase";
import { IMAGE_DOWNLOADER } from "./application/ports/image-downloader.port";
import { LocalFileImageDownloader } from "./infrastructure/reference/local-file-image-downloader";
import { GetDestinationDetailUseCase } from "./application/use-cases/get-destination-detail.usecase";
import { UpsertDestinationUseCase } from "./application/use-cases/upsert-destination.usecase";
import { ImportDestinationsUseCase } from "./application/use-cases/import-destinations.usecase";
import { ListAddressMappingsUseCase } from "./application/use-cases/list-address-mappings.usecase";
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
    TypeOrmModule.forFeature([
      DestinationMirrorEntity,
      DestinationRelationEntity,
      AdminProvinceEntity,
      AdminWardEntity,
      AdminWardMappingEntity,
    ]),
  ],
  controllers: [DestinationsController],
  providers: [
    ListDestinationsUseCase,
    SyncDestinationsUseCase,
    GetDestinationTaxonomyUseCase,
    CreateDestinationJobUseCase,
    PublishDestinationUseCase,
    RelinkAllUseCase,
    UpdateThumbnailUseCase,
    UpdateTicketLinksUseCase,
    DestinationAffiliateReapplyService,
    UploadDestinationImageUseCase,
    MigrateDestinationImagesUseCase,
    GetDestinationDetailUseCase,
    UpsertDestinationUseCase,
    ImportDestinationsUseCase,
    ListAddressMappingsUseCase,
    RecomputeRelatedService,
    { provide: DICHOITHOI_SITE_DB, useClass: MssqlSiteDbAdapter },
    { provide: REFERENCE_FETCHER, useClass: HttpReferenceFetcher },
    { provide: IMAGE_CHECKER, useClass: HttpImageChecker },
    { provide: IMAGE_PROCESSOR, useClass: SharpImageProcessor },
    { provide: IMAGE_UPLOADER, useClass: FtpsImageUploader },
    { provide: IMAGE_DOWNLOADER, useClass: LocalFileImageDownloader },
    { provide: SHEET_CSV_FETCHER, useClass: GoogleSheetCsvFetcher },
    { provide: DESTINATION_MIRROR_REPOSITORY, useClass: TypeOrmDestinationMirrorRepository },
    { provide: DESTINATION_RELATION_REPOSITORY, useClass: TypeOrmDestinationRelationRepository },
  ],
  exports: [DICHOITHOI_SITE_DB, DESTINATION_MIRROR_REPOSITORY],
})
export class DestinationModule {}
