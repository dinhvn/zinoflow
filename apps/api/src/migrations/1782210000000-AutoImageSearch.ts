import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Tu dong tim anh minh hoa chung (dichoithoi-auto-image-search-plan.md) —
 * bo sung metadata nguon anh vao content_images (Muc A da co san cot `status`)
 * + bang rieng nho danh dau tu khoa bi tu choi (tranh goi y lai, §2.3).
 */
export class AutoImageSearch1782210000000 implements MigrationInterface {
  name = "AutoImageSearch1782210000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE content_images
        ADD COLUMN source varchar(16),
        ADD COLUMN source_url varchar(512),
        ADD COLUMN photographer varchar(256),
        ADD COLUMN related_job_id uuid,
        ADD COLUMN search_keyword varchar(256);
    `);
    await queryRunner.query(`
      CREATE TABLE content_image_rejected_keywords (
        job_id      uuid NOT NULL,
        keyword     varchar(256) NOT NULL,
        rejected_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (job_id, keyword)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE content_image_rejected_keywords`);
    await queryRunner.query(`
      ALTER TABLE content_images
        DROP COLUMN source,
        DROP COLUMN source_url,
        DROP COLUMN photographer,
        DROP COLUMN related_job_id,
        DROP COLUMN search_keyword;
    `);
  }
}
