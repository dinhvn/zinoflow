import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * M4 (Phase 4) — doi booking_url (1 link) sang ticket_links (nhieu link, JSONB
 * AffiliateLinkItem[]) tren mirror dichoithoi_destinations. Du lieu cu (neu co)
 * duoc bao ton bang cach chuyen thanh 1 phan tu voi linkStatus='no-rule' —
 * nguoi dung can vao lai form de gan provider/rule dung (khong bia affiliateUrl).
 * Spec: docs/dichoithoi/dichoithoi-affiliate-link-conversion-spec.md.
 */
export class DestinationTicketLinks1781910000000 implements MigrationInterface {
  name = "DestinationTicketLinks1781910000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE dichoithoi_destinations ADD COLUMN ticket_links jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(`
      UPDATE dichoithoi_destinations
      SET ticket_links = jsonb_build_array(jsonb_build_object(
        'provider', 'other',
        'label', NULL,
        'sourceUrl', booking_url,
        'affiliateUrl', booking_url,
        'linkStatus', 'no-rule'
      ))
      WHERE booking_url IS NOT NULL AND booking_url <> ''
    `);
    await queryRunner.query(`ALTER TABLE dichoithoi_destinations DROP COLUMN booking_url`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE dichoithoi_destinations ADD COLUMN booking_url varchar(512) NULL`);
    await queryRunner.query(`
      UPDATE dichoithoi_destinations
      SET booking_url = ticket_links->0->>'sourceUrl'
      WHERE jsonb_array_length(ticket_links) > 0
    `);
    await queryRunner.query(`ALTER TABLE dichoithoi_destinations DROP COLUMN ticket_links`);
  }
}
