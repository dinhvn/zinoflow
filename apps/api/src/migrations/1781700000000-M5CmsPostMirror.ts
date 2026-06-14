import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * M5 — khu CMS khuyenmai (laruki/dochoi3s): bang mirror bai viet CMS tren Postgres.
 * Phan chieu WordpressPost (SQL Server) de UI list/filter + theo doi trang thai content AI.
 * Spec: docs/specs/laruki-dochoi3s-content-spec.md.
 */
export class M5CmsPostMirror1781700000000 implements MigrationInterface {
  name = "M5CmsPostMirror1781700000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE cms_post_mirror (
        cms_id int PRIMARY KEY,
        site_id smallint NOT NULL,
        post_id int NOT NULL DEFAULT 0,
        post_type smallint NULL,
        title varchar(256) NOT NULL,
        title_unaccented varchar(256) NOT NULL,
        link varchar(512) NULL,
        is_ready_auto boolean NOT NULL DEFAULT false,
        active_content_job_id uuid NULL,
        ai_content_written_at timestamptz NULL,
        ai_notes text NULL,
        ai_reference_urls jsonb NOT NULL DEFAULT '[]',
        date_published timestamptz NULL,
        date_updated timestamptz NULL,
        synced_at timestamptz NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_cms_post_mirror_site ON cms_post_mirror (site_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS cms_post_mirror`);
  }
}
