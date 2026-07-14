import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import {
  createAffiliateNetworkRequestSchema,
  createAffiliatePartnerRequestSchema,
  fetchSheetRequestSchema,
  importAffiliatePartnersRequestSchema,
  reapplyAffiliateRuleRequestSchema,
  resolveAffiliateLinkRequestSchema,
  updateAffiliateNetworkRequestSchema,
  updateAffiliatePartnerRequestSchema,
  type AffiliateNetwork,
  type AffiliatePartner,
  type CreateAffiliateNetworkRequest,
  type CreateAffiliatePartnerRequest,
  type FetchSheetRequest,
  type FetchSheetResponse,
  type ImportAffiliatePartnersRequest,
  type ImportAffiliatePartnersResult,
  type ReapplyAffiliateRuleRequest,
  type ResolveAffiliateLinkRequest,
  type ResolveAffiliateLinkResponse,
  type UpdateAffiliateNetworkRequest,
  type UpdateAffiliatePartnerRequest,
} from "@zinoflow/contracts";
import { ZodValidationPipe } from "../../shared/validation/zod-validation.pipe";
import { ManageAffiliateNetworksUseCase } from "../application/use-cases/manage-affiliate-networks.usecase";
import { ManageAffiliatePartnersUseCase } from "../application/use-cases/manage-affiliate-partners.usecase";
import { ImportAffiliatePartnersUseCase } from "../application/use-cases/import-affiliate-partners.usecase";
import { ResolveAffiliateLinkUseCase } from "../application/use-cases/resolve-affiliate-link.usecase";
import { JOB_QUEUE, QUEUE_NAMES, type JobQueue } from "../../shared/jobs/job-queue.port";
import {
  SHEET_CSV_FETCHER,
  type SheetCsvFetcher,
} from "../../shared/sheet-import/ports/sheet-csv-fetcher.port";

/** REST man "Mạng affiliate" + "Đối tác affiliate" (doc phân tích affiliate-provider-management) */
@Controller("affiliate")
export class AffiliateController {
  constructor(
    private readonly manageNetworks: ManageAffiliateNetworksUseCase,
    private readonly managePartners: ManageAffiliatePartnersUseCase,
    private readonly importPartners: ImportAffiliatePartnersUseCase,
    private readonly resolveLink: ResolveAffiliateLinkUseCase,
    @Inject(JOB_QUEUE) private readonly jobQueue: JobQueue,
    @Inject(SHEET_CSV_FETCHER) private readonly sheetFetcher: SheetCsvFetcher,
  ) {}

  /** Tai Google Sheet (cong khai) ve CSV — client parse + gui thang import (khong preview) */
  @Post("fetch-sheet")
  async fetchSheet(
    @Body(new ZodValidationPipe(fetchSheetRequestSchema)) request: FetchSheetRequest,
  ): Promise<FetchSheetResponse> {
    return { csv: await this.sheetFetcher.fetchCsv(request.url) };
  }

  @Get("networks")
  listNetworks(): Promise<AffiliateNetwork[]> {
    return this.manageNetworks.list();
  }

  @Post("networks")
  createNetwork(
    @Body(new ZodValidationPipe(createAffiliateNetworkRequestSchema))
    request: CreateAffiliateNetworkRequest,
  ): Promise<AffiliateNetwork> {
    return this.manageNetworks.create(request);
  }

  @Patch("networks/:id")
  updateNetwork(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateAffiliateNetworkRequestSchema))
    request: UpdateAffiliateNetworkRequest,
  ): Promise<AffiliateNetwork> {
    return this.manageNetworks.update(id, request);
  }

  @Delete("networks/:id")
  async deleteNetwork(@Param("id") id: string): Promise<{ ok: true }> {
    await this.manageNetworks.delete(id);
    return { ok: true };
  }

  @Get("partners")
  listPartners(): Promise<AffiliatePartner[]> {
    return this.managePartners.list();
  }

  @Post("partners")
  createPartner(
    @Body(new ZodValidationPipe(createAffiliatePartnerRequestSchema))
    request: CreateAffiliatePartnerRequest,
  ): Promise<AffiliatePartner> {
    return this.managePartners.create(request);
  }

  @Patch("partners/:id")
  updatePartner(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateAffiliatePartnerRequestSchema))
    request: UpdateAffiliatePartnerRequest,
  ): Promise<AffiliatePartner> {
    return this.managePartners.update(id, request);
  }

  @Delete("partners/:id")
  async deletePartner(@Param("id") id: string): Promise<{ ok: true }> {
    await this.managePartners.delete(id);
    return { ok: true };
  }

  /** Import hàng loạt đối tác từ Google Sheet public (client tự parse CSV) — lưu thẳng, không preview */
  @Post("partners/import")
  importBulk(
    @Body(new ZodValidationPipe(importAffiliatePartnersRequestSchema))
    request: ImportAffiliatePartnersRequest,
  ): Promise<ImportAffiliatePartnersResult> {
    return this.importPartners.execute(request);
  }

  /** Preview affiliateUrl truoc khi luu — dung o moi form nhap link */
  @Post("resolve")
  resolve(
    @Body(new ZodValidationPipe(resolveAffiliateLinkRequestSchema))
    request: ResolveAffiliateLinkRequest,
  ): Promise<ResolveAffiliateLinkResponse> {
    return this.resolveLink.execute(request.sourceUrl, request.provider ?? null);
  }

  /**
   * Ap dung lai affiliateUrl cho moi module da dang ky — qua pg-boss
   * (fire-and-forget, xem ReapplyAffiliateRuleWorker).
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
