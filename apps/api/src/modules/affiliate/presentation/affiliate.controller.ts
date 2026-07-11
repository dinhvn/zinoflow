import { Body, Controller, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import {
  createAffiliateLinkRuleRequestSchema,
  reapplyAffiliateRuleRequestSchema,
  resolveAffiliateLinkRequestSchema,
  updateAffiliateLinkRuleRequestSchema,
  type AffiliateLinkRule,
  type CreateAffiliateLinkRuleRequest,
  type ReapplyAffiliateRuleRequest,
  type ResolveAffiliateLinkRequest,
  type ResolveAffiliateLinkResponse,
  type UpdateAffiliateLinkRuleRequest,
} from "@zinoflow/contracts";
import { ZodValidationPipe } from "../../shared/validation/zod-validation.pipe";
import { ManageAffiliateRulesUseCase } from "../application/use-cases/manage-affiliate-rules.usecase";
import { ResolveAffiliateLinkUseCase } from "../application/use-cases/resolve-affiliate-link.usecase";
import { JOB_QUEUE, QUEUE_NAMES, type JobQueue } from "../../shared/jobs/job-queue.port";

/** REST man "Quy tắc affiliate" (spec affiliate-link-conversion §5) */
@Controller("affiliate")
export class AffiliateController {
  constructor(
    private readonly manageRules: ManageAffiliateRulesUseCase,
    private readonly resolveLink: ResolveAffiliateLinkUseCase,
    @Inject(JOB_QUEUE) private readonly jobQueue: JobQueue,
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

  /**
   * Ap dung lai 1 rule (hoac toan bo neu ruleId=null) cho toan bo module da
   * dang ky — qua pg-boss (fire-and-forget, xem ReapplyAffiliateRuleWorker),
   * KHONG con chay dong bo trong request nhu truoc (spec §4 build item 3).
   */
  @Post("reapply")
  async reapplyRule(
    @Body(new ZodValidationPipe(reapplyAffiliateRuleRequestSchema))
    request: ReapplyAffiliateRuleRequest,
  ): Promise<{ jobId: string | null }> {
    const jobId = await this.jobQueue.send(QUEUE_NAMES.affiliateReapply, {
      ruleId: request.ruleId,
    });
    return { jobId };
  }
}
