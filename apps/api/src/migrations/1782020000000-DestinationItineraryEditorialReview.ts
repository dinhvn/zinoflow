import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Phase 28.0 — 3 khoi noi dung moi cho Destination (content-seo-ux-plan
 * §10.6.2 khoi 3, §10.6.2/§10.6.3 "danh gia bien tap", destination-spec §2.2
 * khoi #15 ExternalReviewUrls): lich trinh goi y (nhap tay), danh gia bien
 * tap (AI goi y + nguoi dung duyet), link Google Maps/TripAdvisor. Cung
 * pattern price_breakdown/practical_notes — luu rieng cot, khong lien quan
 * AI-generated content chinh (ContentHtml).
 */
export class DestinationItineraryEditorialReview1782020000000 implements MigrationInterface {
  name = "DestinationItineraryEditorialReview1782020000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE dichoithoi_destinations ADD COLUMN itinerary jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE dichoithoi_destinations ADD COLUMN editorial_review text NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE dichoithoi_destinations ADD COLUMN external_review_urls jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE dichoithoi_destinations DROP COLUMN external_review_urls`);
    await queryRunner.query(`ALTER TABLE dichoithoi_destinations DROP COLUMN editorial_review`);
    await queryRunner.query(`ALTER TABLE dichoithoi_destinations DROP COLUMN itinerary`);
  }
}
