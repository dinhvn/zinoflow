/**
 * Bang gia Google Gemini API (USD per 1M tokens) — cap nhat 06/2026, prompt <= 200k.
 * Nguon: ai.google.dev/pricing. Khi Google doi gia thi sua o day.
 */
const PRICE_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  "gemini-2.5-pro": { input: 1.25, output: 10 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
};

/** Model ngoai bang gia: cost 0 + priced=false de caller log warning (khong throw). */
export function computeGeminiCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): { costUsd: number; priced: boolean } {
  const price = PRICE_PER_MILLION_TOKENS[model];
  if (!price) {
    return { costUsd: 0, priced: false };
  }
  const costUsd = (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
  return { costUsd, priced: true };
}
