import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Bang staging trich xuat thong tin nguon cho bai cam nang TRUOC khi AI viet
 * (article-ai-extraction-plan.md GĐ2/GĐ3) — khac han
 * dichoithoi_destination_ai_extractions (gan theo destination_slug, nhieu
 * field co dinh): bang nay gan theo job_id, chi 1 field text tu do
 * (extracted_summary) vi bai cam nang khong co field co dinh nhu dia chi/SDT.
 */
export class ArticleAiExtractions1782870000000 implements MigrationInterface {
  name = "ArticleAiExtractions1782870000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS article_ai_extractions (
        job_id uuid NOT NULL REFERENCES content_jobs(id) ON DELETE CASCADE,
        source varchar(20) NOT NULL,
        source_urls jsonb NOT NULL DEFAULT '[]',
        extracted_summary text NOT NULL DEFAULT '',
        extracted_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (job_id, source)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS article_ai_extractions`);
  }
}
