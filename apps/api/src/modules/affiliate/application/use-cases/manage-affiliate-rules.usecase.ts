import { Inject, Injectable } from "@nestjs/common";
import type {
  AffiliateLinkRule,
  CreateAffiliateLinkRuleRequest,
  UpdateAffiliateLinkRuleRequest,
} from "@zinoflow/contracts";
import { ValidationError } from "../../../shared/errors/app-error";
import {
  AFFILIATE_RULE_REPOSITORY,
  type AffiliateLinkRuleRecord,
  type AffiliateRuleRepository,
} from "../ports/affiliate-rule.repository";

function toDto(r: AffiliateLinkRuleRecord): AffiliateLinkRule {
  return {
    id: r.id,
    provider: r.provider,
    matchDomain: r.matchDomain,
    template: r.template,
    placeholder: r.placeholder,
    isActive: r.isActive,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

/** CRUD man "Quy tắc affiliate" (spec §5) — rule la DATA, sua khong can deploy */
@Injectable()
export class ManageAffiliateRulesUseCase {
  constructor(
    @Inject(AFFILIATE_RULE_REPOSITORY) private readonly rules: AffiliateRuleRepository,
  ) {}

  async list(): Promise<AffiliateLinkRule[]> {
    return (await this.rules.listAll()).map(toDto);
  }

  async create(request: CreateAffiliateLinkRuleRequest): Promise<AffiliateLinkRule> {
    if (!request.template.includes(request.placeholder)) {
      throw new ValidationError(
        `Template phải chứa placeholder ${request.placeholder}`,
        [request.template],
      );
    }
    const created = await this.rules.create({
      provider: request.provider,
      matchDomain: request.matchDomain ?? null,
      template: request.template,
      placeholder: request.placeholder,
      isActive: request.isActive,
      notes: request.notes ?? null,
    });
    return toDto(created);
  }

  async update(id: string, request: UpdateAffiliateLinkRuleRequest): Promise<AffiliateLinkRule> {
    const existing = await this.rules.findById(id);
    if (!existing) {
      throw new ValidationError(`Không tìm thấy rule affiliate id=${id}`);
    }
    const template = request.template ?? existing.template;
    const placeholder = request.placeholder ?? existing.placeholder;
    if (!template.includes(placeholder)) {
      throw new ValidationError(`Template phải chứa placeholder ${placeholder}`, [template]);
    }
    const updated = await this.rules.update(id, request);
    return toDto(updated);
  }
}
