import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * M6 — Image tool (product collage): bang job + item render anh dang Facebook.
 * Spec: docs/specs/image-tool-technical-spec.md §10, §13.
 */
export class M6ImageRenderJobs1781800000000 implements MigrationInterface {
  name = "M6ImageRenderJobs1781800000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE image_render_jobs (
        id uuid PRIMARY KEY,
        aspect varchar(16) NOT NULL,
        per_image int NOT NULL,
        status varchar(16) NOT NULL,
        total_items int NOT NULL,
        completed_items int NOT NULL DEFAULT 0,
        export_format varchar(8) NOT NULL,
        export_quality int NOT NULL,
        export_scale decimal(4,2) NOT NULL,
        output_dir varchar(512) NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_image_jobs_status ON image_render_jobs (status)`);
    await queryRunner.query(`CREATE INDEX idx_image_jobs_created_at ON image_render_jobs (created_at)`);

    await queryRunner.query(`
      CREATE TABLE image_render_items (
        id uuid PRIMARY KEY,
        job_id uuid NOT NULL,
        index int NOT NULL,
        props_json jsonb NOT NULL,
        output_file varchar(512) NULL,
        status varchar(16) NOT NULL DEFAULT 'Pending',
        error text NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_image_items_job ON image_render_items (job_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS image_render_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS image_render_jobs`);
  }
}
