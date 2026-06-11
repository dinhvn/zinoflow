/**
 * Bang gia Anthropic API (USD per 1M tokens) — cap nhat 06/2026.
 * Nguon: platform.claude.com/docs/en/pricing. Khi Anthropic doi gia thi sua o day,
 * cost da ghi vao ai_usage_logs KHONG tinh lai (gia tri lich su).
 */
const PRICE_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

/**
 * Tinh cost USD cho 1 call. Model ngoai bang gia tra ve 0 kem flag de caller log warning
 * (khong nem loi — thieu gia khong duoc lam fail viec generate).
 */
export function computeAnthropicCostUsd(
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
