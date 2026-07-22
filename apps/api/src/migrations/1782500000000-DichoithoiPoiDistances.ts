import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Bang khoang cach duong bo that (OpenRouteService) giua 2 diem den con (POI)
 * cung 1 cha (cum/tinh) hoac gan nhau theo ban kinh vat ly — dichoithoi-poi-
 * distance-plan.md Giai doan 1. Cung khuon `dichoithoi_cluster_distances`
 * (relations-plan §1.2): poi_a_slug < poi_b_slug (thu tu chuan hoa, tranh luu
 * 2 chieu cho cung 1 cap).
 */
export class DichoithoiPoiDistances1782500000000 implements MigrationInterface {
  name = "DichoithoiPoiDistances1782500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE dichoithoi_poi_distances (
        poi_a_slug varchar(64) NOT NULL REFERENCES dichoithoi_destinations(slug) ON DELETE CASCADE,
        poi_b_slug varchar(64) NOT NULL REFERENCES dichoithoi_destinations(slug) ON DELETE CASCADE,
        distance_meters integer NOT NULL,
        PRIMARY KEY (poi_a_slug, poi_b_slug),
        CHECK (poi_a_slug < poi_b_slug)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE dichoithoi_poi_distances`);
  }
}
