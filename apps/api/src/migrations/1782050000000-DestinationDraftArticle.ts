import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Pivot gop editor noi dung bai viet vao trang detail (khong con qua ContentJob/
 * ContentDraft lam nguon luu tru chinh cho guide-diem-den). Them cot draft_article
 * de mirror tu chua ban nhap (tieu de/intro/6 block/FAQ/quickFacts/metadata).
 */
export class DestinationDraftArticle1782050000000 implements MigrationInterface {
  name = "DestinationDraftArticle1782050000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE dichoithoi_destinations ADD COLUMN draft_article jsonb NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE dichoithoi_destinations DROP COLUMN draft_article`);
  }
}
