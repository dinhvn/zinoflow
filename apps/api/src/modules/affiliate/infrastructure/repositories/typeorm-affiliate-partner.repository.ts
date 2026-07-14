import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type {
  AffiliatePartnerRecord,
  AffiliatePartnerRepository,
  CreateAffiliatePartnerInput,
  UpdateAffiliatePartnerInput,
} from "../../application/ports/affiliate-partner.repository";
import { AffiliatePartnerEntity } from "../entities/affiliate-partner.entity";

@Injectable()
export class TypeOrmAffiliatePartnerRepository implements AffiliatePartnerRepository {
  constructor(
    @InjectRepository(AffiliatePartnerEntity)
    private readonly repo: Repository<AffiliatePartnerEntity>,
  ) {}

  async listAll(): Promise<AffiliatePartnerRecord[]> {
    return this.repo.find({ order: { name: "ASC" } });
  }

  async listActive(): Promise<AffiliatePartnerRecord[]> {
    return this.repo.find({ where: { isActive: true } });
  }

  async findById(id: string): Promise<AffiliatePartnerRecord | null> {
    return this.repo.findOneBy({ id });
  }

  async findByCode(code: string): Promise<AffiliatePartnerRecord | null> {
    return this.repo.findOneBy({ code });
  }

  async create(input: CreateAffiliatePartnerInput): Promise<AffiliatePartnerRecord> {
    return this.repo.save(this.repo.create(input));
  }

  async update(id: string, input: UpdateAffiliatePartnerInput): Promise<AffiliatePartnerRecord> {
    await this.repo.update({ id }, input);
    const updated = await this.findById(id);
    if (!updated) throw new Error(`Doi tac affiliate id=${id} bien mat sau update`);
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }

  async upsertByCode(
    code: string,
    input: Omit<CreateAffiliatePartnerInput, "code">,
  ): Promise<{ created: boolean }> {
    const existing = await this.findByCode(code);
    if (existing) {
      // networkId da duoc use case resolve san (khop code cot "loai affiliate" hoac giu nguyen gia tri cu)
      await this.repo.update(
        { code },
        {
          name: input.name,
          homepageUrl: input.homepageUrl,
          description: input.description,
          networkId: input.networkId,
          isActive: input.isActive,
        },
      );
      return { created: false };
    }
    await this.repo.save(this.repo.create({ code, ...input }));
    return { created: true };
  }
}
