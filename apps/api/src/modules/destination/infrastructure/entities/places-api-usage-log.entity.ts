import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

/**
 * 1 dong / 1 lan goi Google Places API thanh cong — dung de dem quota
 * theo thang lich (dichoithoi-destination-geocode-audit-plan.md, canh bao
 * 800/1000 free-tier Enterprise SKU).
 */
@Entity("dichoithoi_places_api_usage_logs")
export class PlacesApiUsageLogEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "called_at", type: "timestamptz" })
  calledAt!: Date;
}
