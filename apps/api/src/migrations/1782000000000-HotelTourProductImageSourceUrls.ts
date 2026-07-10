import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Them cot luu URL anh nguon ngoai cho Hotel/Tour/Product (dichoithoi-destination-spec.md
 * §14.5, backlog §B Phase C muc 3): sau khi ingest anh ve hosting minh, cot
 * thumbnail_url/images chuyen thanh path noi bo — can giu lai URL nguon de
 * biet xuat xu + tai lai duoc khi can, KHONG mat du lieu goc.
 */
export class HotelTourProductImageSourceUrls1782000000000 implements MigrationInterface {
  name = "HotelTourProductImageSourceUrls1782000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE hotels ADD COLUMN thumbnail_source_url varchar(512) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE hotels ADD COLUMN image_source_urls jsonb NOT NULL DEFAULT '[]'`,
    );

    await queryRunner.query(
      `ALTER TABLE tours ADD COLUMN thumbnail_source_url varchar(512) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE tours ADD COLUMN image_source_urls jsonb NOT NULL DEFAULT '[]'`,
    );

    await queryRunner.query(
      `ALTER TABLE products ADD COLUMN thumbnail_source_url varchar(512) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE products DROP COLUMN IF EXISTS thumbnail_source_url`);
    await queryRunner.query(`ALTER TABLE tours DROP COLUMN IF EXISTS image_source_urls`);
    await queryRunner.query(`ALTER TABLE tours DROP COLUMN IF EXISTS thumbnail_source_url`);
    await queryRunner.query(`ALTER TABLE hotels DROP COLUMN IF EXISTS image_source_urls`);
    await queryRunner.query(`ALTER TABLE hotels DROP COLUMN IF EXISTS thumbnail_source_url`);
  }
}
