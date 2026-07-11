import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Phase 28.2 — mirror 2 cot da co san tren v2.Destination (Order,
 * DistanceFromCenter, phuc hoi tu schema cu, chua tung duoc website dung)
 * de dung cho 2 lop "Diem tham quan" trang Flagship (content-seo-ux-plan
 * §10.6.1 khoi 5): lop 1 sort theo Order (cung IsFeatured da co), lop 2 nhom
 * theo DistanceFromCenter (met).
 */
export class DestinationOrderDistanceFromCenter1782030000000 implements MigrationInterface {
  name = "DestinationOrderDistanceFromCenter1782030000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE dichoithoi_destinations ADD COLUMN "order" int NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE dichoithoi_destinations ADD COLUMN distance_from_center decimal(18, 0) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE dichoithoi_destinations DROP COLUMN distance_from_center`);
    await queryRunner.query(`ALTER TABLE dichoithoi_destinations DROP COLUMN "order"`);
  }
}
