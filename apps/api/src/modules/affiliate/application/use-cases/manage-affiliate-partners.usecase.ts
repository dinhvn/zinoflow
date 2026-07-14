import { Inject, Injectable } from "@nestjs/common";
import type {
  AffiliatePartner,
  CreateAffiliatePartnerRequest,
  UpdateAffiliatePartnerRequest,
} from "@zinoflow/contracts";
import { ValidationError } from "../../../shared/errors/app-error";
import {
  AFFILIATE_PARTNER_REPOSITORY,
  type AffiliatePartnerRecord,
  type AffiliatePartnerRepository,
} from "../ports/affiliate-partner.repository";

function toDto(p: AffiliatePartnerRecord): AffiliatePartner {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    homepageUrl: p.homepageUrl,
    description: p.description,
    networkId: p.networkId,
    matchDomain: p.matchDomain,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

/** CRUD "Đối tác affiliate" (klook/vexere/booking...) — nguồn dropdown provider cho ticketLinks/Hotel/Tour */
@Injectable()
export class ManageAffiliatePartnersUseCase {
  constructor(
    @Inject(AFFILIATE_PARTNER_REPOSITORY) private readonly partners: AffiliatePartnerRepository,
  ) {}

  async list(): Promise<AffiliatePartner[]> {
    return (await this.partners.listAll()).map(toDto);
  }

  async create(request: CreateAffiliatePartnerRequest): Promise<AffiliatePartner> {
    const created = await this.partners.create({
      code: request.code,
      name: request.name,
      homepageUrl: request.homepageUrl ?? null,
      description: request.description ?? null,
      networkId: request.networkId ?? null,
      matchDomain: request.matchDomain ?? null,
      isActive: request.isActive,
    });
    return toDto(created);
  }

  async update(id: string, request: UpdateAffiliatePartnerRequest): Promise<AffiliatePartner> {
    const existing = await this.partners.findById(id);
    if (!existing) {
      throw new ValidationError(`Không tìm thấy đối tác affiliate id=${id}`);
    }
    const updated = await this.partners.update(id, request);
    return toDto(updated);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.partners.findById(id);
    if (!existing) {
      throw new ValidationError(`Không tìm thấy đối tác affiliate id=${id}`);
    }
    await this.partners.delete(id);
  }
}
