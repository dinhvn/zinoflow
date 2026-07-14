import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type {
  AffiliateNetworkRecord,
  AffiliateNetworkRepository,
  CreateAffiliateNetworkInput,
  UpdateAffiliateNetworkInput,
} from "../../application/ports/affiliate-network.repository";
import { AffiliateNetworkEntity } from "../entities/affiliate-network.entity";

@Injectable()
export class TypeOrmAffiliateNetworkRepository implements AffiliateNetworkRepository {
  constructor(
    @InjectRepository(AffiliateNetworkEntity)
    private readonly repo: Repository<AffiliateNetworkEntity>,
  ) {}

  async listAll(): Promise<AffiliateNetworkRecord[]> {
    return this.repo.find({ order: { name: "ASC" } });
  }

  async listActive(): Promise<AffiliateNetworkRecord[]> {
    return this.repo.find({ where: { isActive: true } });
  }

  async findById(id: string): Promise<AffiliateNetworkRecord | null> {
    return this.repo.findOneBy({ id });
  }

  async create(input: CreateAffiliateNetworkInput): Promise<AffiliateNetworkRecord> {
    return this.repo.save(this.repo.create(input));
  }

  async update(id: string, input: UpdateAffiliateNetworkInput): Promise<AffiliateNetworkRecord> {
    await this.repo.update({ id }, input);
    const updated = await this.findById(id);
    if (!updated) throw new Error(`Mang affiliate id=${id} bien mat sau update`);
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }
}
