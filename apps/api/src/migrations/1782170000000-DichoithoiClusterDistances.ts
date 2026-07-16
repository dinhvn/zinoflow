import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Bang mo hinh khoang cach 2 tang (dichoithoi-destination-relations-plan.md §1.2,
 * Giai doan A2) — khoang cach giua toa do TRUNG TAM cac node cap cao (kind IN
 * province,cluster), tinh 1 lan qua RecomputeClusterDistancesUseCase, chi tinh lai
 * khi toa do trung tam 1 node doi (khong nam trong job recompute-related thuong
 * xuyen). cluster_a_slug < cluster_b_slug (thu tu chuan hoa, tranh luu 2 chieu).
 */
export class DichoithoiClusterDistances1782170000000 implements MigrationInterface {
  name = "DichoithoiClusterDistances1782170000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE dichoithoi_cluster_distances (
        cluster_a_slug varchar(64) NOT NULL REFERENCES dichoithoi_destinations(slug) ON DELETE CASCADE,
        cluster_b_slug varchar(64) NOT NULL REFERENCES dichoithoi_destinations(slug) ON DELETE CASCADE,
        distance_meters integer NOT NULL,
        PRIMARY KEY (cluster_a_slug, cluster_b_slug),
        CHECK (cluster_a_slug < cluster_b_slug)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE dichoithoi_cluster_distances`);
  }
}
