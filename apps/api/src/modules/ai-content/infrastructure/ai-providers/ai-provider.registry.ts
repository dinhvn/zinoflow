import { Injectable, Logger } from "@nestjs/common";
import type { AiProviderKey } from "@zinoflow/contracts";
import type {
  AiProviderRegistry,
  ContentAiProvider,
} from "../../application/ports/content-ai-provider.port";
import { StubContentAiProvider } from "./stub-content-ai.provider";

/**
 * Registry resolve AI provider theo key tren content job.
 * Provider that (Anthropic, OpenAI) dang ky o day; neu provider duoc yeu cau
 * chua configured (thieu API key) thi fallback ve stub kem canh bao —
 * pipeline van chay duoc de dev/test, khong bao gio silent-fail.
 */
@Injectable()
export class DefaultAiProviderRegistry implements AiProviderRegistry {
  private readonly logger = new Logger(DefaultAiProviderRegistry.name);
  private readonly providers = new Map<string, ContentAiProvider>();

  constructor(private readonly stub: StubContentAiProvider) {}

  /** Goi tu module wiring — Day 5 dang ky AnthropicProvider o day. */
  register(provider: ContentAiProvider): void {
    this.providers.set(provider.key, provider);
  }

  resolve(key: AiProviderKey): ContentAiProvider {
    const provider = this.providers.get(key);
    if (provider?.isConfigured()) {
      return provider;
    }
    this.logger.warn(
      `AI provider "${key}" ${provider ? "is not configured (missing API key)" : "is not registered"} - falling back to STUB provider`,
    );
    return this.stub;
  }
}
