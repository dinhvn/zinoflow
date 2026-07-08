import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * M4 (Phase 8) — anh xa ContentJob (cam-nang) -> bai da publish o SQL Server.
 * KHONG luu RawContent (nguon that van la content_drafts) — chi theo doi
 * trang thai publish/refresh cho "Lam moi khoi dong" + batch refresh.
 * Spec: docs/dichoithoi/dichoithoi-article-spec.md §8.
 */
export class ArticlePublications1781940000000 implements MigrationInterface {
  name = "ArticlePublications1781940000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE article_publications (
        job_id             uuid PRIMARY KEY,
        site_id            int NOT NULL,
        slug               varchar(128) NOT NULL UNIQUE,
        published_at       timestamptz NOT NULL,
        last_refreshed_at  timestamptz NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS article_publications`);
  }
}
