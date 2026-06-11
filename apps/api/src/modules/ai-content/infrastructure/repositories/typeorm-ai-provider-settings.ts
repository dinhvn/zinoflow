import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { AiProviderKey } from "@zinoflow/contracts";
import type { AiProviderSettings } from "../../application/ports/ai-provider-settings.port";
import { AiProviderSettingEntity } from "../entities/ai-provider-setting.entity";

@Injectable()
export class TypeOrmAiProviderSettings implements AiProviderSettings {
  constructor(
    @InjectRepository(AiProviderSettingEntity)
    private readonly repo: Repository<AiProviderSettingEntity>,
  ) {}

  async isEnabled(key: AiProviderKey): Promise<boolean> {
    const row = await this.repo.findOneBy({ providerKey: key });
    return row?.isEnabled ?? true; // chua co record = enabled
  }

  async setEnabled(key: AiProviderKey, enabled: boolean): Promise<void> {
    await this.repo.save({ providerKey: key, isEnabled: enabled, updatedAt: new Date() });
  }

  async getAll(keys: AiProviderKey[]): Promise<Record<string, boolean>> {
    const rows = await this.repo.find();
    const byKey = new Map(rows.map((r) => [r.providerKey, r.isEnabled]));
    return Object.fromEntries(keys.map((k) => [k, byKey.get(k) ?? true]));
  }
}
