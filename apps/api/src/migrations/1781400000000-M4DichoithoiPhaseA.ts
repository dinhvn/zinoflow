import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * M4 Phase A — khu Dichoithoi (spec dichoithoi-destination-spec §3.2, §3.7, §13):
 * 1. dichoithoi_destinations: mirror metadata diem den tu SQL Server.
 * 2. dichoithoi_destination_relations: quan he soan/duyet ben AI tool.
 * 3. admin_provinces / admin_wards / admin_ward_mappings: taxonomy hanh chinh
 *    sau sap nhap (seed du lieu qua scripts/seed-dvhcvn.ts — tach khoi migration
 *    de file migration khong phinh 13k dong).
 */
export class M4DichoithoiPhaseA1781400000000 implements MigrationInterface {
  name = "M4DichoithoiPhaseA1781400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE dichoithoi_destinations (
        slug varchar(64) PRIMARY KEY,
        site_id int NULL,
        kind varchar(16) NOT NULL,
        parent_slug varchar(64) NULL,
        province_code varchar(2) NULL,
        name varchar(128) NOT NULL,
        name_unaccented varchar(128) NOT NULL,
        short_description text NULL,
        thumbnail varchar(256) NULL,
        lat decimal(9,6) NULL,
        lng decimal(9,6) NULL,
        address_new varchar(256) NULL,
        address_old varchar(256) NULL,
        contact_phone varchar(32) NULL,
        contact_website varchar(256) NULL,
        booking_url varchar(512) NULL,
        hotel_group_id varchar(50) NULL,
        is_featured boolean NOT NULL DEFAULT false,
        site_status smallint NULL,
        content_source smallint NULL,
        content_hash varchar(64) NULL,
        active_content_job_id uuid NULL,
        sync_flags jsonb NOT NULL DEFAULT '[]',
        has_local_changes boolean NOT NULL DEFAULT false,
        site_updated_at timestamptz NULL,
        synced_at timestamptz NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_dichoithoi_destinations_site_id ON dichoithoi_destinations (site_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_dichoithoi_destinations_province ON dichoithoi_destinations (province_code)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_dichoithoi_destinations_name_unaccented ON dichoithoi_destinations (name_unaccented)`,
    );

    await queryRunner.query(`
      CREATE TABLE dichoithoi_destination_relations (
        id serial PRIMARY KEY,
        source_slug varchar(64) NOT NULL,
        target_slug varchar(64) NOT NULL,
        relation_type varchar(16) NOT NULL,
        weight int NOT NULL DEFAULT 0,
        is_auto boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_dichoithoi_relation UNIQUE (source_slug, target_slug, relation_type)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_dichoithoi_relations_source ON dichoithoi_destination_relations (source_slug)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_dichoithoi_relations_target ON dichoithoi_destination_relations (target_slug)`,
    );

    await queryRunner.query(`
      CREATE TABLE admin_provinces (
        province_code varchar(2) PRIMARY KEY,
        name varchar(255) NOT NULL,
        short_name varchar(255) NOT NULL,
        code varchar(5) NOT NULL,
        place_type varchar(255) NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE admin_wards (
        ward_code varchar(6) PRIMARY KEY,
        name varchar(255) NOT NULL,
        province_code varchar(2) NOT NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_admin_wards_province ON admin_wards (province_code)`,
    );

    await queryRunner.query(`
      CREATE TABLE admin_ward_mappings (
        id serial PRIMARY KEY,
        old_ward_code varchar(16) NULL,
        old_ward_name varchar(255) NULL,
        old_district_name varchar(255) NULL,
        old_province_name varchar(255) NULL,
        new_ward_code varchar(16) NULL,
        new_ward_name varchar(255) NULL,
        new_province_name varchar(255) NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_admin_ward_mappings_new_ward ON admin_ward_mappings (new_ward_code)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_admin_ward_mappings_old_province ON admin_ward_mappings (old_province_name)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS admin_ward_mappings`);
    await queryRunner.query(`DROP TABLE IF EXISTS admin_wards`);
    await queryRunner.query(`DROP TABLE IF EXISTS admin_provinces`);
    await queryRunner.query(`DROP TABLE IF EXISTS dichoithoi_destination_relations`);
    await queryRunner.query(`DROP TABLE IF EXISTS dichoithoi_destinations`);
  }
}
