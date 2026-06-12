import { Column, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm";

/**
 * 3 bang hanh chinh seed tu dataset dvhcvn (spec dichoithoi-destination-spec §13).
 * Du lieu cong cu soan thao: form dia chi + migration dia chi cu->moi.
 * Seed idempotent qua scripts/seed-dvhcvn.ts.
 */

@Entity("admin_provinces")
export class AdminProvinceEntity {
  /** Ma tinh 2 so theo dvhcvn (vd '01' Ha Noi, '79' HCM) */
  @PrimaryColumn({ name: "province_code", type: "varchar", length: 2 })
  provinceCode!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ name: "short_name", type: "varchar", length: 255 })
  shortName!: string;

  /** Ma chu (HNI, HCM...) */
  @Column({ type: "varchar", length: 5 })
  code!: string;

  @Column({ name: "place_type", type: "varchar", length: 255 })
  placeType!: string;
}

@Entity("admin_wards")
export class AdminWardEntity {
  @PrimaryColumn({ name: "ward_code", type: "varchar", length: 6 })
  wardCode!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ name: "province_code", type: "varchar", length: 2 })
  @Index()
  provinceCode!: string;
}

@Entity("admin_ward_mappings")
@Index(["newWardCode"])
@Index(["oldProvinceName"])
export class AdminWardMappingEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "old_ward_code", type: "varchar", length: 16, nullable: true })
  oldWardCode!: string | null;

  @Column({ name: "old_ward_name", type: "varchar", length: 255, nullable: true })
  oldWardName!: string | null;

  @Column({ name: "old_district_name", type: "varchar", length: 255, nullable: true })
  oldDistrictName!: string | null;

  @Column({ name: "old_province_name", type: "varchar", length: 255, nullable: true })
  oldProvinceName!: string | null;

  @Column({ name: "new_ward_code", type: "varchar", length: 16, nullable: true })
  newWardCode!: string | null;

  @Column({ name: "new_ward_name", type: "varchar", length: 255, nullable: true })
  newWardName!: string | null;

  @Column({ name: "new_province_name", type: "varchar", length: 255, nullable: true })
  newProvinceName!: string | null;
}
