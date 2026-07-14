import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Link Google Maps nhap tay 1 lan, thay the flow cu (dan link -> parse lat/lng
 * -> chi lay toa do, bo link). lat/lng van giu (hotel auto-assign + related-builder
 * van dung so that) nhung tu gio la CACHE tu tinh lai moi lan google_maps_url doi
 * (usecase upsert-destination), khong con nhap tay truc tiep qua form.
 */
export class DestinationGoogleMapsUrl1782110000000 implements MigrationInterface {
  name = "DestinationGoogleMapsUrl1782110000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE dichoithoi_destinations ADD COLUMN google_maps_url text NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE dichoithoi_destinations DROP COLUMN google_maps_url`);
  }
}
