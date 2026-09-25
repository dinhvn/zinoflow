import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Mo rong address_new/address_old/contact_website tu varchar(256) sang text —
 * bug thuc te 09/08/2026: dia chi Google Maps that (formattedAddressAtDiscovery)
 * co the vuot 256 ky tu (dia chi mo ta dai kem dia danh), gay loi "value too
 * long for type character varying(256)" khi Chap nhan hang loat ket qua tim
 * toa do (AcceptGeocodeCandidatesUseCase). google_maps_url da la text tu truoc
 * — ap dung cung chuan cho cac cot dia chi/website.
 */
export class DestinationAddressWebsiteToText1782970000000 implements MigrationInterface {
  name = "DestinationAddressWebsiteToText1782970000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE dichoithoi_destinations
        ALTER COLUMN address_new TYPE text,
        ALTER COLUMN address_old TYPE text,
        ALTER COLUMN contact_website TYPE text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE dichoithoi_destinations
        ALTER COLUMN address_new TYPE varchar(256),
        ALTER COLUMN address_old TYPE varchar(256),
        ALTER COLUMN contact_website TYPE varchar(256)
    `);
  }
}
