import { Column, Entity, PrimaryColumn } from "typeorm";
import type { AiProviderKey } from "@zinoflow/contracts";

/** Bang ai_provider_settings — trang thai bat/tat tung provider (Settings page). */
@Entity("ai_provider_settings")
export class AiProviderSettingEntity {
  @PrimaryColumn({ name: "provider_key", type: "varchar", length: 20 })
  providerKey!: AiProviderKey;

  @Column({ name: "is_enabled", type: "boolean", default: true })
  isEnabled!: boolean;

  @Column({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
