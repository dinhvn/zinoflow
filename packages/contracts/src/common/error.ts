import { z } from "zod";

/**
 * Error groups theo spec docs/specs/ai-content-technical-spec.md §12.
 * Moi error tra ve tu API deu thuoc 1 trong cac nhom nay de client xu ly thong nhat.
 */
export const errorCodeSchema = z.enum([
  "ValidationError",
  "DomainRuleError",
  "AiProviderError",
  "UpstreamApiError",
  "UnknownError",
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

/**
 * Error envelope chuan cho moi response loi (spec §12).
 * traceId dung de doi chieu voi log phia server.
 */
export const errorEnvelopeSchema = z.object({
  errorCode: errorCodeSchema,
  message: z.string(),
  details: z.array(z.string()).default([]),
  traceId: z.string(),
});
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
