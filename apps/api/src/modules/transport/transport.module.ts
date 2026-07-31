import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AffiliateModule } from "../affiliate/affiliate.module";
import { DestinationModule } from "../destination/destination.module";
import { SharedSheetImportModule } from "../shared/sheet-import/shared-sheet-import.module";
import { TransportsController } from "./presentation/transports.controller";
import { ListTransportsUseCase } from "./application/use-cases/list-transports.usecase";
import { UpsertTransportUseCase } from "./application/use-cases/upsert-transport.usecase";
import { ImportTransportsUseCase } from "./application/use-cases/import-transports.usecase";
import { DeleteTransportUseCase } from "./application/use-cases/delete-transport.usecase";
import { RecomputeTransportCardsUseCase } from "./application/use-cases/recompute-transport-cards.usecase";
import { TRANSPORT_REPOSITORY } from "./application/ports/transport.repository";
import { TRANSPORT_SITE_DB } from "./application/ports/transport-site-db.port";
import { TypeOrmTransportRepository } from "./infrastructure/repositories/typeorm-transport.repository";
import { MssqlTransportSiteDbAdapter } from "./infrastructure/dichoithoi/mssql-transport-site-db.adapter";
import { TransportEntity } from "./infrastructure/entities/transport.entity";
import { TransportStopEntity } from "./infrastructure/entities/transport-stop.entity";

/**
 * Module Van chuyen (Ve xe khach mode=2, Ve may bay mode=1 du phong) — khoi
 * "Cach toi day" tren trang diem den, khong AI, khong review 2 chot, publish
 * thang (transport-plan §2). Dung chung affiliate voi Hotel/Tour/Ve.
 */
@Module({
  imports: [
    AffiliateModule,
    DestinationModule,
    SharedSheetImportModule,
    TypeOrmModule.forFeature([TransportEntity, TransportStopEntity]),
  ],
  controllers: [TransportsController],
  providers: [
    ListTransportsUseCase,
    UpsertTransportUseCase,
    ImportTransportsUseCase,
    DeleteTransportUseCase,
    RecomputeTransportCardsUseCase,
    { provide: TRANSPORT_REPOSITORY, useClass: TypeOrmTransportRepository },
    { provide: TRANSPORT_SITE_DB, useClass: MssqlTransportSiteDbAdapter },
  ],
  exports: [TRANSPORT_REPOSITORY],
})
export class TransportModule {}
