import { Inject, Injectable } from "@nestjs/common";
import type {
  AffiliateNetwork,
  CreateAffiliateNetworkRequest,
  UpdateAffiliateNetworkRequest,
} from "@zinoflow/contracts";
import { ValidationError } from "../../../shared/errors/app-error";
import {
  AFFILIATE_NETWORK_REPOSITORY,
  type AffiliateNetworkRecord,
  type AffiliateNetworkRepository,
} from "../ports/affiliate-network.repository";

function toDto(n: AffiliateNetworkRecord): AffiliateNetwork {
  return {
    id: n.id,
    code: n.code,
    name: n.name,
    template: n.template,
    placeholder: n.placeholder,
    isActive: n.isActive,
    notes: n.notes,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  };
}

/** CRUD "Mạng affiliate" (vd Accesstrade) — template dùng chung cho mọi đối tác trong mạng */
@Injectable()
export class ManageAffiliateNetworksUseCase {
  constructor(
    @Inject(AFFILIATE_NETWORK_REPOSITORY) private readonly networks: AffiliateNetworkRepository,
  ) {}

  async list(): Promise<AffiliateNetwork[]> {
    return (await this.networks.listAll()).map(toDto);
  }

  async create(request: CreateAffiliateNetworkRequest): Promise<AffiliateNetwork> {
    if (!request.template.includes(request.placeholder)) {
      throw new ValidationError(`Template phải chứa placeholder ${request.placeholder}`, [
        request.template,
      ]);
    }
    const created = await this.networks.create({
      code: request.code,
      name: request.name,
      template: request.template,
      placeholder: request.placeholder,
      isActive: request.isActive,
      notes: request.notes ?? null,
    });
    return toDto(created);
  }

  async update(id: string, request: UpdateAffiliateNetworkRequest): Promise<AffiliateNetwork> {
    const existing = await this.networks.findById(id);
    if (!existing) {
      throw new ValidationError(`Không tìm thấy mạng affiliate id=${id}`);
    }
    const template = request.template ?? existing.template;
    const placeholder = request.placeholder ?? existing.placeholder;
    if (!template.includes(placeholder)) {
      throw new ValidationError(`Template phải chứa placeholder ${placeholder}`, [template]);
    }
    const updated = await this.networks.update(id, request);
    return toDto(updated);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.networks.findById(id);
    if (!existing) {
      throw new ValidationError(`Không tìm thấy mạng affiliate id=${id}`);
    }
    await this.networks.delete(id);
  }
}
