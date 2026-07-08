import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * M4 (Phase 6) — bang tours + tour_destination_map (Postgres, nguon su that).
 * Spec: docs/dichoithoi/dichoithoi-tour-spec.md §3.
 */
export class TourModule1781930000000 implements MigrationInterface {
  name = "TourModule1781930000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE tours (
        id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name              varchar(256) NOT NULL,
        short_description varchar(500) NULL,
        duration_days     smallint NULL,
        duration_nights   smallint NULL,
        departure_from    varchar(256) NULL,
        province_code     varchar(2) NULL,
        price_from        decimal(12,0) NULL,
        rating            decimal(2,1) NULL,
        review_count      int NULL,
        thumbnail_url     varchar(512) NULL,
        images            jsonb NOT NULL DEFAULT '[]',
        provider          varchar(64) NULL,
        source_url        varchar(512) NOT NULL,
        affiliate_url     varchar(512) NULL,
        link_status       varchar(20) NOT NULL DEFAULT 'no-rule',
        source            smallint NOT NULL DEFAULT 0,
        site_id           int NULL,
        created_at        timestamptz NOT NULL DEFAULT now(),
        updated_at        timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_tours_province ON tours (province_code)`);

    await queryRunner.query(`
      CREATE TABLE tour_destination_map (
        tour_id           uuid NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
        destination_slug  varchar(64) NOT NULL,
        is_primary        boolean NOT NULL DEFAULT false,
        is_manual         boolean NOT NULL DEFAULT false,
        PRIMARY KEY (tour_id, destination_slug)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_tour_map_destination ON tour_destination_map (destination_slug)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS tour_destination_map`);
    await queryRunner.query(`DROP TABLE IF EXISTS tours`);
  }
}
