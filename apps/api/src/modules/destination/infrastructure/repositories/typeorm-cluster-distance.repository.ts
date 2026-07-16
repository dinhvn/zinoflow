import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type {
  ClusterDistancePair,
  ClusterDistanceRepository,
} from "../../application/ports/cluster-distance.repository";
import { ClusterDistanceEntity } from "../entities/cluster-distance.entity";

@Injectable()
export class TypeOrmClusterDistanceRepository implements ClusterDistanceRepository {
  constructor(
    @InjectRepository(ClusterDistanceEntity)
    private readonly repo: Repository<ClusterDistanceEntity>,
  ) {}

  async replaceAll(pairs: readonly ClusterDistancePair[]): Promise<void> {
    await this.repo.manager.transaction(async (manager) => {
      await manager.query(`TRUNCATE TABLE dichoithoi_cluster_distances`);
      if (pairs.length === 0) return;
      const entities = pairs.map((p) =>
        manager.create(ClusterDistanceEntity, {
          clusterASlug: p.clusterASlug,
          clusterBSlug: p.clusterBSlug,
          distanceMeters: p.distanceMeters,
        }),
      );
      await manager.save(ClusterDistanceEntity, entities);
    });
  }

  async findAll(): Promise<ClusterDistancePair[]> {
    const rows = await this.repo.find();
    return rows.map((r) => ({
      clusterASlug: r.clusterASlug,
      clusterBSlug: r.clusterBSlug,
      distanceMeters: r.distanceMeters,
    }));
  }
}
