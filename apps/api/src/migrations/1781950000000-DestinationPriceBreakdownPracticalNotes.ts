import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Phase 12 — 2 khoi noi dung moi cho Destination (content-seo-ux-plan §5.5a/§5.7):
 * gia ve theo doi tuong (nhap tay hoan toan) + luu y thuc te (AI goi y, nguoi
 * dung duyet). Ca 2 deu la mang JSON tu do, khong lien quan AI-generated content
 * chinh (ContentHtml) nen luu rieng cot, giong pattern ticket_links.
 */
export class DestinationPriceBreakdownPracticalNotes1781950000000 implements MigrationInterface {
  name = "DestinationPriceBreakdownPracticalNotes1781950000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE dichoithoi_destinations ADD COLUMN price_breakdown jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE dichoithoi_destinations ADD COLUMN practical_notes jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE dichoithoi_destinations DROP COLUMN practical_notes`);
    await queryRunner.query(`ALTER TABLE dichoithoi_destinations DROP COLUMN price_breakdown`);
  }
}
