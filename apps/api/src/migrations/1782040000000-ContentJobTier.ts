import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Phase 28.3 — content_jobs.content_tier: chi y nghia voi articleType
 * guide-diem-den (dat tu ContentTier cua diem den luc tao job), dung de
 * chon prompt key + gate rieng cho Flagship trong pipeline generate.
 */
export class ContentJobTier1782040000000 implements MigrationInterface {
  name = "ContentJobTier1782040000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE content_jobs ADD COLUMN content_tier varchar(16) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE content_jobs DROP COLUMN content_tier`);
  }
}
