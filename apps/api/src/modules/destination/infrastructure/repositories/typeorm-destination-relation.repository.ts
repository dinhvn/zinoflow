import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DestinationRelationEntity } from "../entities/destination-relation.entity";
import type {
  DestinationRelationRepository,
  RelationRecord,
} from "../../application/ports/destination-mirror.repository";

/** Repository quan he diem den tren Postgres (implement port application). */
@Injectable()
export class TypeOrmDestinationRelationRepository implements DestinationRelationRepository {
  constructor(
    @InjectRepository(DestinationRelationEntity)
    private readonly repo: Repository<DestinationRelationEntity>,
  ) {}

  async replaceMentioned(sourceSlug: string, targetSlugs: readonly string[]): Promise<void> {
    await this.repo.delete({ sourceSlug, relationType: "mentioned", isAuto: true });
    if (targetSlugs.length > 0) {
      await this.insertMentioned(sourceSlug, targetSlugs);
    }
  }

  async addMentioned(sourceSlug: string, targetSlugs: readonly string[]): Promise<void> {
    if (targetSlugs.length === 0) return;
    await this.insertMentioned(sourceSlug, targetSlugs);
  }

  async findCuratedRelated(sourceSlug: string): Promise<RelationRecord[]> {
    const rows = await this.repo.find({
      where: { sourceSlug, relationType: "related" },
      order: { weight: "DESC" },
    });
    return rows.map(toRecord);
  }

  async findAllCuratedRelated(): Promise<RelationRecord[]> {
    const rows = await this.repo.find({
      where: { relationType: "related" },
      order: { weight: "DESC" },
    });
    return rows.map(toRecord);
  }

  async addCuratedRelated(sourceSlug: string, targetSlug: string, weight = 0): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .insert()
      .values({ sourceSlug, targetSlug, relationType: "related", weight, isAuto: false })
      .orIgnore()
      .execute();
  }

  async removeCuratedRelated(sourceSlug: string, targetSlug: string): Promise<void> {
    await this.repo.delete({ sourceSlug, targetSlug, relationType: "related" });
  }

  async findSourcesLinkingTo(targetSlug: string): Promise<string[]> {
    const rows = await this.repo.find({ where: { targetSlug }, select: ["sourceSlug"] });
    return [...new Set(rows.map((r) => r.sourceSlug))];
  }

  async findExcluded(sourceSlug: string): Promise<string[]> {
    const rows = await this.repo.find({
      where: { sourceSlug, relationType: "excluded" },
      select: ["targetSlug"],
    });
    return rows.map((r) => r.targetSlug);
  }

  async addExcluded(sourceSlug: string, targetSlug: string): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .insert()
      .values({ sourceSlug, targetSlug, relationType: "excluded", weight: 0, isAuto: false })
      .orIgnore()
      .execute();
  }

  async removeExcluded(sourceSlug: string, targetSlug: string): Promise<void> {
    await this.repo.delete({ sourceSlug, targetSlug, relationType: "excluded" });
  }

  private async insertMentioned(
    sourceSlug: string,
    targetSlugs: readonly string[],
  ): Promise<void> {
    // ON CONFLICT DO NOTHING: re-link goi nhieu lan, dong da co thi bo qua
    await this.repo
      .createQueryBuilder()
      .insert()
      .values(
        [...new Set(targetSlugs)].map((targetSlug) => ({
          sourceSlug,
          targetSlug,
          relationType: "mentioned",
          weight: 0,
          isAuto: true,
        })),
      )
      .orIgnore()
      .execute();
  }
}

function toRecord(e: DestinationRelationEntity): RelationRecord {
  return {
    sourceSlug: e.sourceSlug,
    targetSlug: e.targetSlug,
    relationType: e.relationType as RelationRecord["relationType"],
    weight: e.weight,
    isAuto: e.isAuto,
  };
}
