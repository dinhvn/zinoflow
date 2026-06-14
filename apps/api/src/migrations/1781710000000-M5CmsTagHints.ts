import type { MigrationInterface, QueryRunner } from "typeorm";

/** M5 — them cot ai_tag_hints (thong tin tag nguoi dung cung cap cho AI). */
export class M5CmsTagHints1781710000000 implements MigrationInterface {
  name = "M5CmsTagHints1781710000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE cms_post_mirror ADD COLUMN ai_tag_hints text NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE cms_post_mirror DROP COLUMN IF EXISTS ai_tag_hints`);
  }
}
