import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Thu vien anh noi dung (dichoithoi-content-image-library-plan.md §3.1 Muc A,
 * Giai doan 1) — bang doc lap khoi anh diem den, dung chung token DI IMAGE_UPLOADER
 * (bien env base-dir rieng: DICHOITHOI_FTP_CONTENT_IMAGE_BASE_DIR).
 * status: "active" (dung duoc ngay) | "pending" (danh cho nguon tu dong tim anh sau
 * nay — dichoithoi-auto-image-search-plan.md, chua co UI/logic dung o Muc A).
 */
export class ContentImages1782200000000 implements MigrationInterface {
  name = "ContentImages1782200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE content_images (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        path         varchar(512) NOT NULL,
        alt_text     varchar(256) NOT NULL,
        caption      varchar(512),
        width        int NOT NULL,
        height       int NOT NULL,
        status       varchar(16) NOT NULL DEFAULT 'active',
        usage_count  int NOT NULL DEFAULT 0,
        uploaded_at  timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IX_content_images_status ON content_images (status);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE content_images`);
  }
}
