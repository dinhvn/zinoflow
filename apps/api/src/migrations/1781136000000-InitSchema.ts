import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Schema v1 — 6 bang theo spec §10 + seed prompt templates dau tien.
 * SQL viet tay de review duoc chinh xac (khong dung migration:generate cho v1).
 */
export class InitSchema1781136000000 implements MigrationInterface {
  name = "InitSchema1781136000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE content_jobs (
        id            uuid PRIMARY KEY,
        site_code     varchar(50)  NOT NULL,
        source_type   varchar(20)  NOT NULL,
        source_ref    varchar(255) NOT NULL,
        topic         text         NOT NULL,
        keyword_seed  jsonb        NOT NULL DEFAULT '[]',
        tone_profile  varchar(100),
        status        varchar(30)  NOT NULL,
        ai_provider   varchar(20)  NOT NULL,
        ai_model      varchar(100) NOT NULL,
        created_at    timestamptz  NOT NULL,
        updated_at    timestamptz  NOT NULL
      );
      CREATE INDEX idx_content_jobs_status     ON content_jobs (status);
      CREATE INDEX idx_content_jobs_created_at ON content_jobs (created_at);
      CREATE INDEX idx_content_jobs_source_ref ON content_jobs (source_ref);
      CREATE INDEX idx_content_jobs_site_code  ON content_jobs (site_code);
    `);

    await queryRunner.query(`
      CREATE TABLE content_drafts (
        id             uuid PRIMARY KEY,
        job_id         uuid NOT NULL REFERENCES content_jobs(id) ON DELETE CASCADE,
        version        int  NOT NULL,
        title          text,
        outline_json   jsonb,
        article_json   jsonb,
        draft_markdown text,
        quality_score  numeric(5,2),
        lock_version   int NOT NULL DEFAULT 1,
        created_at     timestamptz NOT NULL,
        updated_at     timestamptz NOT NULL,
        CONSTRAINT uq_content_drafts_job_version UNIQUE (job_id, version)
      );
      CREATE INDEX idx_content_drafts_job_id ON content_drafts (job_id);
    `);

    await queryRunner.query(`
      CREATE TABLE content_review_records (
        id         uuid PRIMARY KEY,
        draft_id   uuid NOT NULL REFERENCES content_drafts(id) ON DELETE CASCADE,
        action     varchar(20) NOT NULL,
        note       text,
        actor      varchar(100) NOT NULL,
        created_at timestamptz NOT NULL
      );
      CREATE INDEX idx_review_records_draft_id ON content_review_records (draft_id);
    `);

    await queryRunner.query(`
      CREATE TABLE prompt_templates (
        id           uuid PRIMARY KEY,
        template_key varchar(100) NOT NULL,
        version      int NOT NULL DEFAULT 1,
        content      text NOT NULL,
        is_active    boolean NOT NULL DEFAULT true,
        created_at   timestamptz NOT NULL,
        CONSTRAINT uq_prompt_templates_key_version UNIQUE (template_key, version)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE content_quality_results (
        id         uuid PRIMARY KEY,
        draft_id   uuid NOT NULL REFERENCES content_drafts(id) ON DELETE CASCADE,
        gate_name  varchar(50) NOT NULL,
        passed     boolean NOT NULL,
        details    jsonb NOT NULL DEFAULT '[]',
        created_at timestamptz NOT NULL
      );
      CREATE INDEX idx_quality_results_draft_id ON content_quality_results (draft_id);
    `);

    await queryRunner.query(`
      CREATE TABLE ai_usage_logs (
        id            uuid PRIMARY KEY,
        job_id        uuid REFERENCES content_jobs(id) ON DELETE SET NULL,
        provider      varchar(20)  NOT NULL,
        model         varchar(100) NOT NULL,
        operation     varchar(50)  NOT NULL,
        input_tokens  int NOT NULL,
        output_tokens int NOT NULL,
        cost_usd      numeric(12,6) NOT NULL,
        latency_ms    int NOT NULL,
        created_at    timestamptz NOT NULL
      );
      CREATE INDEX idx_ai_usage_logs_job_id     ON ai_usage_logs (job_id);
      CREATE INDEX idx_ai_usage_logs_created_at ON ai_usage_logs (created_at);
    `);

    // Seed prompt templates v1 cho loai bai top-list (spec §17.2-B, §17.6).
    // Placeholder {{...}} duoc thay boi prompt builder o Day 4-5.
    await queryRunner.query(
      `INSERT INTO prompt_templates (id, template_key, version, content, is_active, created_at)
       VALUES
       (gen_random_uuid(), 'toplist.outline.vi', 1, $1, true, now()),
       (gen_random_uuid(), 'toplist.section.vi', 1, $2, true, now())`,
      [
        // outline prompt
        `Ban la chuyen gia content affiliate tieng Viet. Hay tao OUTLINE cho bai top-list.
Chu de: {{topic}}
Tu khoa chinh: {{primaryKeyword}}
Website: {{siteCode}} ({{siteNiche}})
Danh sach san pham (JSON): {{products}}

Yeu cau:
- Title 50-70 ky tu, chua tu khoa chinh tu nhien.
- sectionHeadings: 3-5 muc H2 (tieu chi xep hang, huong dan chon, ...).
- plannedProducts: chon cac san pham phu hop nhat tu danh sach.
- plannedFaqQuestions: 3-6 cau hoi theo search intent thuc te.
- KHONG tu che thong tin san pham khong co trong du lieu.`,
        // section expand prompt
        `Ban la chuyen gia content affiliate tieng Viet. Viet noi dung cho 1 SECTION cua bai top-list.
Bai viet: {{title}}
Section can viet: {{sectionHeading}}
Du lieu san pham lien quan (JSON): {{products}}
Tone: {{toneProfile}}

Yeu cau:
- 120-250 tu, giong tu nhien, khong khoa truong.
- Chi dung thong tin co trong du lieu san pham, KHONG tu che thong so/gia.
- Khong claim qua da (tot nhat, so 1, cam ket 100%...).`,
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ai_usage_logs`);
    await queryRunner.query(`DROP TABLE IF EXISTS content_quality_results`);
    await queryRunner.query(`DROP TABLE IF EXISTS prompt_templates`);
    await queryRunner.query(`DROP TABLE IF EXISTS content_review_records`);
    await queryRunner.query(`DROP TABLE IF EXISTS content_drafts`);
    await queryRunner.query(`DROP TABLE IF EXISTS content_jobs`);
  }
}
