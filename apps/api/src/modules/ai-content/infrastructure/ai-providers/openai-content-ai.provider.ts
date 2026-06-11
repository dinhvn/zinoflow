import { Injectable } from "@nestjs/common";
import type { ZodType, z } from "zod/v4";
import type {
  AiCallUsage,
  ContentAiProvider,
  StructuredGenerationRequest,
} from "../../application/ports/content-ai-provider.port";
import { AiProviderError } from "../../../shared/errors/app-error";

/**
 * OpenAI adapter SKELETON (M2 deliverable #5) — interface compile, CHUA goi API that.
 *
 * Khi implement that (M3+):
 * - Dung SDK chinh thuc "openai", structured output qua responses API + zod helper.
 * - isConfigured() doi thanh Boolean(process.env.OPENAI_API_KEY).
 * - Them bang gia vao openai-pricing.ts + model list vao PROVIDER_CATALOG.
 */
@Injectable()
export class OpenAiContentAiProvider implements ContentAiProvider {
  readonly key = "openai" as const;

  isConfigured(): boolean {
    // Co tinh tra false ke ca khi co OPENAI_API_KEY: adapter chua implement,
    // registry se fallback ve stub thay vi nem loi giua chung generation.
    return false;
  }

  async generateStructured<TSchema extends ZodType>(
    request: StructuredGenerationRequest,
    _schema: TSchema,
  ): Promise<{ output: z.infer<TSchema>; usage: AiCallUsage }> {
    throw new AiProviderError(
      `OpenAI adapter chua duoc implement (skeleton M2) - operation "${request.operation}"`,
    );
  }
}
