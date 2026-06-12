import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AiContentModule } from "../ai-content/ai-content.module";
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
 * Kien truc: docs/specs/dichoithoi-system-overview.md;
 * tinh nang: docs/specs/dichoithoi-destination-spec.md.
 * Generate bai van di qua module ai-content — module nay KHONG goi AI provider.
 */
@Module({
  imports: [
    AiContentModule,
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
    RecomputeRelatedService,
    { provide: DICHOITHOI_SITE_DB, useClass: MssqlSiteDbAdapter },
    { provide: DESTINATION_MIRROR_REPOSITORY, useClass: TypeOrmDestinationMirrorRepository },
    { provide: DESTINATION_RELATION_REPOSITORY, useClass: TypeOrmDestinationRelationRepository },
  ],
  exports: [DICHOITHOI_SITE_DB],
})
export class DestinationModule {}
