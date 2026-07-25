import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Doi PK bang staging tu destination_slug -> (destination_slug, source) de luu
 * SONG SONG 2 nguon trich xuat (skill thu cong / gsg tu dong qua Gemini Search
 * Grounding) cho cung 1 diem den, khong ghi de lan nhau. Dong hien co (neu co)
 * duoc backfill source='skill' — dung nguon goc that (skill thu cong tao ra
 * truoc khi co nhanh GSG). dichoithoi-destination-ai-extraction-plan.md §6 A1.
 */
export class DestinationAiExtractionSource1782600000000 implements MigrationInterface {
  name = "DestinationAiExtractionSource1782600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE dichoithoi_destination_ai_extractions
        ADD COLUMN source varchar(8) NOT NULL DEFAULT 'skill'
    `);
    await queryRunner.query(`
      ALTER TABLE dichoithoi_destination_ai_extractions
        DROP CONSTRAINT dichoithoi_destination_ai_extractions_pkey
    `);
    await queryRunner.query(`
      ALTER TABLE dichoithoi_destination_ai_extractions
        ADD CONSTRAINT dichoithoi_destination_ai_extractions_pkey
        PRIMARY KEY (destination_slug, source)
    `);
    await queryRunner.query(`
      ALTER TABLE dichoithoi_destination_ai_extractions
        ALTER COLUMN source DROP DEFAULT
    `);
    await queryRunner.query(`
      ALTER TABLE dichoithoi_destination_ai_extractions
        ADD CONSTRAINT dichoithoi_destination_ai_extractions_source_check
        CHECK (source IN ('skill', 'gsg'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE dichoithoi_destination_ai_extractions
        DROP CONSTRAINT dichoithoi_destination_ai_extractions_source_check
    `);
    // Rollback gia dinh moi truong dev — xoa dong 'gsg' de tranh vi pham PK
    // don-cot khi ha cap (khong con nghia trong prod da chay nhieu nguon).
    await queryRunner.query(`
      DELETE FROM dichoithoi_destination_ai_extractions WHERE source <> 'skill'
    `);
    await queryRunner.query(`
      ALTER TABLE dichoithoi_destination_ai_extractions
        DROP CONSTRAINT dichoithoi_destination_ai_extractions_pkey
    `);
    await queryRunner.query(`
      ALTER TABLE dichoithoi_destination_ai_extractions
        DROP COLUMN source
    `);
    await queryRunner.query(`
      ALTER TABLE dichoithoi_destination_ai_extractions
        ADD PRIMARY KEY (destination_slug)
    `);
  }
}
