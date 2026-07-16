import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Bang staging cho tinh nang Claude trich xuat thong tin diem den tu Google Maps +
 * web tham khao (dichoithoi-destination-ai-extraction-plan.md §2.1) — skill ghi vao
 * day, CMS hien bang so sanh cu/moi cho nguoi dung duyet. 1 dong/diem den (upsert
 * khi chay lai), khong luu lich su nhieu phien ban.
 */
export class DestinationAiExtractionStaging1782140000000 implements MigrationInterface {
  name = "DestinationAiExtractionStaging1782140000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE dichoithoi_destination_ai_extractions (
        destination_slug varchar(64) PRIMARY KEY
          REFERENCES dichoithoi_destinations(slug) ON DELETE CASCADE,
        source_urls jsonb NOT NULL,
        extracted_at timestamptz NOT NULL,
        fields jsonb NOT NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE dichoithoi_destination_ai_extractions`);
  }
}
