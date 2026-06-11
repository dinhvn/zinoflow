import type { AiProviderKey } from "@zinoflow/contracts";

/**
 * Port doc/ghi trang thai bat/tat provider (Settings page).
 * Provider chua co record = enabled (default).
 */
export const AI_PROVIDER_SETTINGS = Symbol("AI_PROVIDER_SETTINGS");

export interface AiProviderSettings {
  isEnabled(key: AiProviderKey): Promise<boolean>;
  setEnabled(key: AiProviderKey, enabled: boolean): Promise<void>;
  /** Map day du cho UI: key -> enabled. */
  getAll(keys: AiProviderKey[]): Promise<Record<string, boolean>>;
}
