import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SharedSheetImportModule } from "../shared/sheet-import/shared-sheet-import.module";
import { AffiliateController } from "./presentation/affiliate.controller";
import { ManageAffiliateNetworksUseCase } from "./application/use-cases/manage-affiliate-networks.usecase";
import { ManageAffiliatePartnersUseCase } from "./application/use-cases/manage-affiliate-partners.usecase";
import { ImportAffiliatePartnersUseCase } from "./application/use-cases/import-affiliate-partners.usecase";
import { ResolveAffiliateLinkUseCase } from "./application/use-cases/resolve-affiliate-link.usecase";
import { ReapplyAffiliateRuleUseCase } from "./application/use-cases/reapply-affiliate-rule.usecase";
import { ReapplyAffiliateRuleWorker } from "./infrastructure/workers/reapply-affiliate-rule.worker";
import { AffiliateReapplyRegistry } from "./application/services/affiliate-reapply-registry.service";
import { AFFILIATE_NETWORK_REPOSITORY } from "./application/ports/affiliate-network.repository";
import { AFFILIATE_PARTNER_REPOSITORY } from "./application/ports/affiliate-partner.repository";
import { TypeOrmAffiliateNetworkRepository } from "./infrastructure/repositories/typeorm-affiliate-network.repository";
import { TypeOrmAffiliatePartnerRepository } from "./infrastructure/repositories/typeorm-affiliate-partner.repository";
import { AffiliateNetworkEntity } from "./infrastructure/entities/affiliate-network.entity";
import { AffiliatePartnerEntity } from "./infrastructure/entities/affiliate-partner.entity";

/**
 * Module affiliate — nen tang dung CHUNG cho ticketLinks (diem den)/hotel/tour
 * (doc affiliate-provider-management-analysis). Mo hinh 2 tang: affiliate_networks
 * (template dung chung 1 mang) + affiliate_partners (doi tac cu the, gan vao 1
 * mang). KHONG phu thuoc Destination/Hotel/Tour — cac module do tu dang ky vao
 * AffiliateReapplyRegistry.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([AffiliateNetworkEntity, AffiliatePartnerEntity]),
    SharedSheetImportModule,
  ],
  controllers: [AffiliateController],
  providers: [
    ManageAffiliateNetworksUseCase,
    ManageAffiliatePartnersUseCase,
    ImportAffiliatePartnersUseCase,
    ResolveAffiliateLinkUseCase,
    ReapplyAffiliateRuleUseCase,
    ReapplyAffiliateRuleWorker,
    AffiliateReapplyRegistry,
    { provide: AFFILIATE_NETWORK_REPOSITORY, useClass: TypeOrmAffiliateNetworkRepository },
    { provide: AFFILIATE_PARTNER_REPOSITORY, useClass: TypeOrmAffiliatePartnerRepository },
  ],
  exports: [
    ResolveAffiliateLinkUseCase,
    AffiliateReapplyRegistry,
    AFFILIATE_NETWORK_REPOSITORY,
    AFFILIATE_PARTNER_REPOSITORY,
  ],
})
export class AffiliateModule {}
