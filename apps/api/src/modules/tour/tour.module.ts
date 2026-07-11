import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AffiliateModule } from "../affiliate/affiliate.module";
import { DestinationModule } from "../destination/destination.module";
import { SharedMediaModule } from "../shared/media/shared-media.module";
import { SharedSheetImportModule } from "../shared/sheet-import/shared-sheet-import.module";
import { ToursController } from "./presentation/tours.controller";
import { ListToursUseCase } from "./application/use-cases/list-tours.usecase";
import { UpsertTourUseCase } from "./application/use-cases/upsert-tour.usecase";
import { ImportToursUseCase } from "./application/use-cases/import-tours.usecase";
import { AssignTourToDestinationUseCase } from "./application/use-cases/assign-tour-to-destination.usecase";
import { ListToursForDestinationUseCase } from "./application/use-cases/list-tours-for-destination.usecase";
import { RecomputeTourCardsUseCase } from "./application/use-cases/recompute-tour-cards.usecase";
import { IngestTourImagesUseCase } from "./application/use-cases/ingest-tour-images.usecase";
import { TourAffiliateReapplyService } from "./application/services/tour-affiliate-reapply.service";
import { TOUR_REPOSITORY } from "./application/ports/tour.repository";
import { TOUR_SITE_DB } from "./application/ports/tour-site-db.port";
import { TypeOrmTourRepository } from "./infrastructure/repositories/typeorm-tour.repository";
import { MssqlTourSiteDbAdapter } from "./infrastructure/dichoithoi/mssql-tour-site-db.adapter";
import { TourImageIngestWorker } from "./infrastructure/workers/tour-image-ingest.worker";
import { TourEntity } from "./infrastructure/entities/tour.entity";
import { TourDestinationMapEntity } from "./infrastructure/entities/tour-destination-map.entity";

/**
 * Module Tour (M4 Phase 6) — khoi goi y tren trang diem den, song song Hotel,
 * khac biet: khong lat/lng rieng, them thoi luong/diem khoi hanh, 1 tour co
 * the gan NHIEU diem den (tour-spec §2/§3).
 */
@Module({
  imports: [
    AffiliateModule,
    DestinationModule,
    SharedMediaModule,
    SharedSheetImportModule,
    TypeOrmModule.forFeature([TourEntity, TourDestinationMapEntity]),
  ],
  controllers: [ToursController],
  providers: [
    ListToursUseCase,
    UpsertTourUseCase,
    ImportToursUseCase,
    AssignTourToDestinationUseCase,
    ListToursForDestinationUseCase,
    RecomputeTourCardsUseCase,
    IngestTourImagesUseCase,
    TourImageIngestWorker,
    TourAffiliateReapplyService,
    { provide: TOUR_REPOSITORY, useClass: TypeOrmTourRepository },
    { provide: TOUR_SITE_DB, useClass: MssqlTourSiteDbAdapter },
  ],
  exports: [TOUR_REPOSITORY],
})
export class TourModule {}
