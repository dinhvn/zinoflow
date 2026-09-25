import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Ghi chu tuy chon nguoi dung tu nhap luc gui batch (yeu cau nguoi dung
 * 08/2026: "hiện tại chỉ để là loại nên khó phân biệt") — giup phan biet
 * nhieu batch cung taskType voi nhau ma khong can nho entityId/thoi diem.
 */
export class AiBatchNote1782940000000 implements MigrationInterface {
  name = "AiBatchNote1782940000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ai_batches
      ADD COLUMN IF NOT EXISTS note text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE ai_batches DROP COLUMN IF EXISTS note`);
  }
}
