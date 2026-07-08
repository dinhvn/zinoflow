import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * M4 (Phase 5) — bang hotels + hotel_destination_map (Postgres, nguon su that).
 * Spec: docs/dichoithoi/dichoithoi-hotel-spec.md §3.
 */
export class HotelModule1781920000000 implements MigrationInterface {
  name = "HotelModule1781920000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE hotels (
        id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name           varchar(256) NOT NULL,
        address        varchar(512) NULL,
        lat            decimal(9,6) NULL,
        lng            decimal(9,6) NULL,
        province_code  varchar(2) NULL,
        price_from     decimal(12,0) NULL,
        rating         decimal(2,1) NULL,
        review_count   int NULL,
        thumbnail_url  varchar(512) NULL,
        images         jsonb NOT NULL DEFAULT '[]',
        provider       varchar(64) NULL,
        source_url     varchar(512) NOT NULL,
        affiliate_url  varchar(512) NULL,
        link_status    varchar(20) NOT NULL DEFAULT 'no-rule',
        source         smallint NOT NULL DEFAULT 0,
        site_id        int NULL,
        created_at     timestamptz NOT NULL DEFAULT now(),
        updated_at     timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_hotels_province ON hotels (province_code)`);

    await queryRunner.query(`
      CREATE TABLE hotel_destination_map (
        hotel_id          uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
        destination_slug  varchar(64) NOT NULL,
        distance_m        int NULL,
        is_manual         boolean NOT NULL DEFAULT false,
        PRIMARY KEY (hotel_id, destination_slug)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_hotel_map_destination ON hotel_destination_map (destination_slug)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS hotel_destination_map`);
    await queryRunner.query(`DROP TABLE IF EXISTS hotels`);
  }
}
