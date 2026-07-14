import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Thu vien anh cho diem den (nhieu anh, khac thumbnail don) — {path, altText,
 * caption, credit}[], thu tu = index mang. Ghi xuong SQL Server GalleryJson khi
 * publish/cap nhat, website da doc san cot nay (extras.Gallery, chi chua co du lieu).
 */
export class DestinationGallery1782060000000 implements MigrationInterface {
  name = "DestinationGallery1782060000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE dichoithoi_destinations ADD COLUMN gallery jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE dichoithoi_destinations DROP COLUMN gallery`);
  }
}
