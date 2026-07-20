import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Sua lo hong SEO Article (audit 07/2026, dichoithoi-backlog.md muc "Article
 * SEO"): publish-article.usecase.ts truoc day hardcode thumbnail=null. Them
 * cot cover_image_id de nguoi dung chon tay 1 anh tu Thu vien anh noi dung
 * (content_images) lam anh dai dien — CHI y nghia voi articleType=cam-nang.
 * Khong dat FK vi content_images/content_jobs khong dung FK constraint o cho
 * nao khac trong repo (gallery Destination cung la jsonb roi, khong FK).
 */
export class ArticleCoverImage1782400000000 implements MigrationInterface {
  name = "ArticleCoverImage1782400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE content_jobs
        ADD COLUMN IF NOT EXISTS cover_image_id uuid NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE content_jobs DROP COLUMN IF EXISTS cover_image_id`);
  }
}
