import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from "typeorm";

/**
 * Quan he diem den — nguon soan/duyet ben AI tool (spec §3.7), dong bo sang
 * bang DestinationRelation (SQL Server) khi publish.
 * Chi luu quan he KHONG suy ra duoc: nearby | related | mentioned.
 * Cha-con qua parentSlug (mirror), cung loai qua type map ben site.
 */
@Entity("dichoithoi_destination_relations")
@Unique(["sourceSlug", "targetSlug", "relationType"])
export class DestinationRelationEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "source_slug", type: "varchar", length: 64 })
  @Index()
  sourceSlug!: string;

  @Column({ name: "target_slug", type: "varchar", length: 64 })
  @Index()
  targetSlug!: string;

  /** nearby | related | mentioned (spec §3.3 redesign doc) */
  @Column({ name: "relation_type", type: "varchar", length: 16 })
  relationType!: string;

  /** nearby: khoang cach met; related: do uu tien */
  @Column({ type: "int", default: 0 })
  weight!: number;

  @Column({ name: "is_auto", type: "boolean", default: true })
  isAuto!: boolean;

  @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
  createdAt!: Date;
}
