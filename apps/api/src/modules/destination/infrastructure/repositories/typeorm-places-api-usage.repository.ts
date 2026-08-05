import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { MoreThanOrEqual, Repository } from "typeorm";
import type { PlacesApiUsageRepository } from "../../application/ports/places-api-usage.repository";
import { PlacesApiUsageLogEntity } from "../entities/places-api-usage-log.entity";

@Injectable()
export class TypeOrmPlacesApiUsageRepository implements PlacesApiUsageRepository {
  constructor(
    @InjectRepository(PlacesApiUsageLogEntity)
    private readonly repo: Repository<PlacesApiUsageLogEntity>,
  ) {}

  async record(): Promise<void> {
    await this.repo.insert({ calledAt: new Date() });
  }

  async countThisMonth(): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return this.repo.count({ where: { calledAt: MoreThanOrEqual(startOfMonth) } });
  }
}
