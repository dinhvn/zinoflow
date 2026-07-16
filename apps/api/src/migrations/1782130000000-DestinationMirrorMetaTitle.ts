import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Cot meta_title rieng tren mirror (khac draft_article.metadata.metaTitle cua
 * AI) — sua nhanh qua bulk-edit CSV, GHI THANG vao v2.DestinationContent.MetaTitle
 * ben SQL Server (xem MssqlSiteDbAdapter.updateMetaTitle), khong dong cham draft.
 */
export class DestinationMirrorMetaTitle1782130000000 implements MigrationInterface {
  name = "DestinationMirrorMetaTitle1782130000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "dichoithoi_destinations" ADD COLUMN "meta_title" varchar(150)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "dichoithoi_destinations" DROP COLUMN "meta_title"`);
  }
}
