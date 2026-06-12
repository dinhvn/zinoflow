import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * M4 Phase B — content_jobs.source_context: ngu canh nguon cho prompt
 * (du lieu diem den dichoithoi, content cu khi update...). Null voi bai thuong.
 */
export class M4SourceContext1781500000000 implements MigrationInterface {
  name = "M4SourceContext1781500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE content_jobs ADD COLUMN source_context text NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE content_jobs DROP COLUMN source_context`);
  }
}
