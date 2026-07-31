import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Danh muc bai cam nang — gan truc tiep tren bai, dung cho trang hub
 * /cam-nang/danh-muc/{slug} + loc/lien ket bai lien quan (KHAC voi
 * ArticleDestinationMap.Topic von gan theo tung cap bai-diem-den).
 * (dichoithoi-camnang-affiliate-overflow-plan.md, chot 31/07/2026).
 */
export class ArticleCategory1782850000000 implements MigrationInterface {
  name = "ArticleCategory1782850000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE content_jobs
        ADD COLUMN IF NOT EXISTS category varchar(32) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE content_jobs DROP COLUMN IF EXISTS category`);
  }
}
