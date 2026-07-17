import { Column, CreateDateColumn, Entity, PrimaryColumn } from "typeorm";

/** De xuat AI cho Type cua 1 diem den, cho duyet — relations-plan §6.3, Giai doan B3. */
@Entity("dichoithoi_taxonomy_suggestions")
export class TaxonomySuggestionEntity {
  @PrimaryColumn({ name: "destination_slug", type: "varchar", length: 64 })
  destinationSlug!: string;

  @Column({ name: "suggested_types", type: "jsonb" })
  suggestedTypes!: string[];

  @Column({ type: "text" })
  reason!: string;

  @Column({ type: "varchar", length: 16, default: "pending" })
  status!: "pending" | "accepted" | "rejected";

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
