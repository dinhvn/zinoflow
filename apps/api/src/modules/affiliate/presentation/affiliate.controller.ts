import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import {
  createAffiliateLinkRuleRequestSchema,
  reapplyAffiliateRuleRequestSchema,
  resolveAffiliateLinkRequestSchema,
  updateAffiliateLinkRuleRequestSchema,
  type AffiliateLinkRule,
  type CreateAffiliateLinkRuleRequest,
  type ReapplyAffiliateRuleReport,
  type ReapplyAffiliateRuleRequest,
  type ResolveAffiliateLinkRequest,
  type ResolveAffiliateLinkResponse,
  type UpdateAffiliateLinkRuleRequest,
} from "@zinoflow/contracts";
import { ZodValidationPipe } from "../../shared/validation/zod-validation.pipe";
import { ManageAffiliateRulesUseCase } from "../application/use-cases/manage-affiliate-rules.usecase";
import { ResolveAffiliateLinkUseCase } from "../application/use-cases/resolve-affiliate-link.usecase";
import { ReapplyAffiliateRuleUseCase } from "../application/use-cases/reapply-affiliate-rule.usecase";

/** REST man "Quy tắc affiliate" (spec affiliate-link-conversion §5) */
@Controller("affiliate")
export class AffiliateController {
  constructor(
    private readonly manageRules: ManageAffiliateRulesUseCase,
    private readonly resolveLink: ResolveAffiliateLinkUseCase,
    private readonly reapply: ReapplyAffiliateRuleUseCase,
  ) {}

  @Get("rules")
  listRules(): Promise<AffiliateLinkRule[]> {
    return this.manageRules.list();
  }

  @Post("rules")
  createRule(
    @Body(new ZodValidationPipe(createAffiliateLinkRuleRequestSchema))
    request: CreateAffiliateLinkRuleRequest,
  ): Promise<AffiliateLinkRule> {
    return this.manageRules.create(request);
  }

  @Patch("rules/:id")
  updateRule(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateAffiliateLinkRuleRequestSchema))
    request: UpdateAffiliateLinkRuleRequest,
  ): Promise<AffiliateLinkRule> {
    return this.manageRules.update(id, request);
  }

  /** Preview affiliateUrl truoc khi luu — dung o moi form nhap link (spec §5) */
  @Post("resolve")
  resolve(
    @Body(new ZodValidationPipe(resolveAffiliateLinkRequestSchema))
    request: ResolveAffiliateLinkRequest,
  ): Promise<ResolveAffiliateLinkResponse> {
    return this.resolveLink.execute(request.sourceUrl, request.provider ?? null);
  }

  /** Ap dung lai 1 rule (hoac toan bo neu ruleId=null) cho toan bo module da dang ky */
  @Post("reapply")
  reapplyRule(
    @Body(new ZodValidationPipe(reapplyAffiliateRuleRequestSchema))
    request: ReapplyAffiliateRuleRequest,
  ): Promise<ReapplyAffiliateRuleReport> {
    return this.reapply.execute(request.ruleId);
  }
}
