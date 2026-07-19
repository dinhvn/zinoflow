import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Mo ta rieng cho Anh dai dien (hero image) — {altText, caption, credit},
 * cung cau truc voi 1 phan tu Thu vien anh nhung khong co `path` (dung chung
 * thumbnail). Cho phep hien alt/caption/credit de tren anh hero to nhat trang
 * chi tiet dichoithoi (quyet dinh 07/2026, xem dichoithoi-backlog.md).
 */
export class DestinationHeroImageMeta1782240000000 implements MigrationInterface {
  name = "DestinationHeroImageMeta1782240000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE dichoithoi_destinations ADD COLUMN hero_image_meta jsonb NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE dichoithoi_destinations DROP COLUMN hero_image_meta`);
  }
}
