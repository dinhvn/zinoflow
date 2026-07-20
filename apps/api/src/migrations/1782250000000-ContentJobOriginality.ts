import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Gate "originality" (07/2026, chong trung lap noi bo giua bai AI cung tinh) —
 * xem dichoithoi-backlog.md muc "Gate originality". 2 cot moi tren content_jobs:
 * - comparison_key: copy 1 lan luc tao job (slug tinh), chi set khi
 *   articleType=guide-diem-den — cung pattern content_tier (Phase 28.3).
 * - originality_excerpt: doan van trich xuat (mo bai + section rui ro), ghi
 *   luc job Approved, dung lam corpus so sanh cho cac job sau.
 * pg_trgm can cho ham similarity() dung trong IOriginalityCorpusRepository.
 */
export class ContentJobOriginality1782250000000 implements MigrationInterface {
  name = "ContentJobOriginality1782250000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await queryRunner.query(`
      ALTER TABLE content_jobs
        ADD COLUMN IF NOT EXISTS comparison_key varchar(255) NULL,
        ADD COLUMN IF NOT EXISTS originality_excerpt text NULL
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_content_jobs_comparison_key ON content_jobs (comparison_key, article_type)`,
    );
    // severity: error = chan Approve (4 gate cu, gia tri mac dinh giu nguyen
    // hanh vi), warning = chi hien canh bao (gate "originality" moi).
    await queryRunner.query(`
      ALTER TABLE content_quality_results
        ADD COLUMN IF NOT EXISTS severity varchar(10) NOT NULL DEFAULT 'error'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_content_jobs_comparison_key`);
    await queryRunner.query(`
      ALTER TABLE content_jobs
        DROP COLUMN IF EXISTS comparison_key,
        DROP COLUMN IF EXISTS originality_excerpt
    `);
    await queryRunner.query(`ALTER TABLE content_quality_results DROP COLUMN IF EXISTS severity`);
  }
}
