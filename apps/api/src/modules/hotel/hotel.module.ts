import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AffiliateModule } from "../affiliate/affiliate.module";
import { DestinationModule } from "../destination/destination.module";
import { SharedMediaModule } from "../shared/media/shared-media.module";
import { SharedSheetImportModule } from "../shared/sheet-import/shared-sheet-import.module";
import { HotelsController } from "./presentation/hotels.controller";
import { ListHotelsUseCase } from "./application/use-cases/list-hotels.usecase";
import { UpsertHotelUseCase } from "./application/use-cases/upsert-hotel.usecase";
import { ImportHotelsUseCase } from "./application/use-cases/import-hotels.usecase";
import { AssignHotelToDestinationUseCase } from "./application/use-cases/assign-hotel-to-destination.usecase";
import { ListHotelsForDestinationUseCase } from "./application/use-cases/list-hotels-for-destination.usecase";
import { RecomputeHotelCardsUseCase } from "./application/use-cases/recompute-hotel-cards.usecase";
import { AutoAssignHotelsByDistanceUseCase } from "./application/use-cases/auto-assign-hotels-by-distance.usecase";
import { IngestHotelImagesUseCase } from "./application/use-cases/ingest-hotel-images.usecase";
import { HotelAffiliateReapplyService } from "./application/services/hotel-affiliate-reapply.service";
import { HOTEL_REPOSITORY } from "./application/ports/hotel.repository";
import { HOTEL_SITE_DB } from "./application/ports/hotel-site-db.port";
import { TypeOrmHotelRepository } from "./infrastructure/repositories/typeorm-hotel.repository";
import { MssqlHotelSiteDbAdapter } from "./infrastructure/dichoithoi/mssql-hotel-site-db.adapter";
import { HotelAutoAssignWorker } from "./infrastructure/workers/hotel-auto-assign.worker";
import { HotelImageIngestWorker } from "./infrastructure/workers/hotel-image-ingest.worker";
import { HotelEntity } from "./infrastructure/entities/hotel.entity";
import { HotelDestinationMapEntity } from "./infrastructure/entities/hotel-destination-map.entity";

/**
 * Module Hotel (M4 Phase 5) — khoi goi y tren trang diem den, khong AI, khong
 * review 2 chot, publish thang (hotel-spec §2). Dung chung affiliate voi
 * ticketLinks/tour qua AffiliateModule.
 */
@Module({
  imports: [
    AffiliateModule,
    DestinationModule,
    SharedMediaModule,
    SharedSheetImportModule,
    TypeOrmModule.forFeature([HotelEntity, HotelDestinationMapEntity]),
  ],
  controllers: [HotelsController],
  providers: [
    ListHotelsUseCase,
    UpsertHotelUseCase,
    ImportHotelsUseCase,
    AssignHotelToDestinationUseCase,
    ListHotelsForDestinationUseCase,
    RecomputeHotelCardsUseCase,
    AutoAssignHotelsByDistanceUseCase,
    HotelAutoAssignWorker,
    IngestHotelImagesUseCase,
    HotelImageIngestWorker,
    HotelAffiliateReapplyService,
    { provide: HOTEL_REPOSITORY, useClass: TypeOrmHotelRepository },
    { provide: HOTEL_SITE_DB, useClass: MssqlHotelSiteDbAdapter },
  ],
  exports: [HOTEL_REPOSITORY],
})
export class HotelModule {}
