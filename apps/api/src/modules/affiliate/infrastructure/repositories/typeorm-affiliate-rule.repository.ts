import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type {
  AffiliateLinkRuleRecord,
  AffiliateRuleRepository,
  CreateAffiliateLinkRuleInput,
  UpdateAffiliateLinkRuleInput,
} from "../../application/ports/affiliate-rule.repository";
import { AffiliateLinkRuleEntity } from "../entities/affiliate-link-rule.entity";

@Injectable()
export class TypeOrmAffiliateRuleRepository implements AffiliateRuleRepository {
  constructor(
    @InjectRepository(AffiliateLinkRuleEntity)
    private readonly repo: Repository<AffiliateLinkRuleEntity>,
  ) {}

  async listAll(): Promise<AffiliateLinkRuleRecord[]> {
    return this.repo.find({ order: { provider: "ASC" } });
  }

  async listActive(): Promise<AffiliateLinkRuleRecord[]> {
    return this.repo.find({ where: { isActive: true } });
  }

  async findById(id: string): Promise<AffiliateLinkRuleRecord | null> {
    return this.repo.findOneBy({ id });
  }

  async create(input: CreateAffiliateLinkRuleInput): Promise<AffiliateLinkRuleRecord> {
    return this.repo.save(this.repo.create(input));
  }

  async update(id: string, input: UpdateAffiliateLinkRuleInput): Promise<AffiliateLinkRuleRecord> {
    await this.repo.update({ id }, input);
    const updated = await this.findById(id);
    if (!updated) throw new Error(`Rule affiliate id=${id} bien mat sau update`);
    return updated;
  }
}
