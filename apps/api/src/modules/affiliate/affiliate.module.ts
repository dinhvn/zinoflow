import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AffiliateController } from "./presentation/affiliate.controller";
import { ManageAffiliateRulesUseCase } from "./application/use-cases/manage-affiliate-rules.usecase";
import { ResolveAffiliateLinkUseCase } from "./application/use-cases/resolve-affiliate-link.usecase";
import { ReapplyAffiliateRuleUseCase } from "./application/use-cases/reapply-affiliate-rule.usecase";
import { AffiliateReapplyRegistry } from "./application/services/affiliate-reapply-registry.service";
import { AFFILIATE_RULE_REPOSITORY } from "./application/ports/affiliate-rule.repository";
import { TypeOrmAffiliateRuleRepository } from "./infrastructure/repositories/typeorm-affiliate-rule.repository";
import { AffiliateLinkRuleEntity } from "./infrastructure/entities/affiliate-link-rule.entity";

/**
 * Module affiliate — nen tang dung CHUNG cho ticketLinks (diem den)/hotel/tour
 * (dichoithoi-affiliate-link-conversion-spec.md). KHONG phu thuoc Destination/
 * Hotel/Tour — cac module do tu dang ky vao AffiliateReapplyRegistry.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AffiliateLinkRuleEntity])],
  controllers: [AffiliateController],
  providers: [
    ManageAffiliateRulesUseCase,
    ResolveAffiliateLinkUseCase,
    ReapplyAffiliateRuleUseCase,
    AffiliateReapplyRegistry,
    { provide: AFFILIATE_RULE_REPOSITORY, useClass: TypeOrmAffiliateRuleRepository },
  ],
  exports: [ResolveAffiliateLinkUseCase, AffiliateReapplyRegistry, AFFILIATE_RULE_REPOSITORY],
})
export class AffiliateModule {}
