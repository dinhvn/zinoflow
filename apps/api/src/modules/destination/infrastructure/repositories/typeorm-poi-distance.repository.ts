import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type {
  PoiDistancePair,
  PoiDistanceRepository,
} from "../../application/ports/poi-distance.repository";
import { PoiDistanceEntity } from "../entities/poi-distance.entity";

@Injectable()
export class TypeOrmPoiDistanceRepository implements PoiDistanceRepository {
  constructor(
    @InjectRepository(PoiDistanceEntity)
    private readonly repo: Repository<PoiDistanceEntity>,
  ) {}

  async findAll(): Promise<PoiDistancePair[]> {
    const rows = await this.repo.find();
    return rows.map((r) => ({
      poiASlug: r.poiASlug,
      poiBSlug: r.poiBSlug,
      distanceMeters: r.distanceMeters,
    }));
  }

  async replaceAllForSlugs(
    slugs: readonly string[],
    pairs: readonly PoiDistancePair[],
  ): Promise<void> {
    await this.repo.manager.transaction(async (manager) => {
      if (slugs.length > 0) {
        await manager
          .createQueryBuilder()
          .delete()
          .from(PoiDistanceEntity)
          .where("poi_a_slug IN (:...slugs) OR poi_b_slug IN (:...slugs)", {
            slugs: [...slugs],
          })
          .execute();
      }
      if (pairs.length === 0) return;
      const entities = pairs.map((p) =>
        manager.create(PoiDistanceEntity, {
          poiASlug: p.poiASlug,
          poiBSlug: p.poiBSlug,
          distanceMeters: p.distanceMeters,
        }),
      );
      await manager.save(PoiDistanceEntity, entities);
    });
  }

  async upsertPairs(pairs: readonly PoiDistancePair[]): Promise<void> {
    if (pairs.length === 0) return;
    await this.repo.upsert(
      pairs.map((p) => ({
        poiASlug: p.poiASlug,
        poiBSlug: p.poiBSlug,
        distanceMeters: p.distanceMeters,
      })),
      ["poiASlug", "poiBSlug"],
    );
  }
}
