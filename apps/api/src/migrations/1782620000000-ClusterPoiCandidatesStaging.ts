import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Bang staging cho tinh nang tim diem con (POI) trong 1 cum bang Gemini + Google
 * Search Grounding (dichoithoi-cluster-poi-discovery-plan.md) — 1 dong/cum (upsert
 * khi chay lai, khong giu lich su nhieu phien ban), CMS hien bang duyet cho nguoi
 * dung truoc khi ghi that.
 */
export class ClusterPoiCandidatesStaging1782620000000 implements MigrationInterface {
  name = "ClusterPoiCandidatesStaging1782620000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE dichoithoi_cluster_poi_candidates (
        cluster_slug varchar(64) PRIMARY KEY
          REFERENCES dichoithoi_destinations(slug) ON DELETE CASCADE,
        extracted_at timestamptz NOT NULL,
        candidates jsonb NOT NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE dichoithoi_cluster_poi_candidates`);
  }
}
