/**
 * Bang gia Google Gemini API (USD per 1M tokens) — cap nhat 25/07/2026, prompt <= 200k.
 * Nguon: ai.google.dev/pricing. Khi Google doi gia thi sua o day.
 * Gemini 2.5.x giu lai de tinh cost cho ai_usage_logs cu (Google da ngung cap model nay
 * cho API key moi tu 07/2026, nhung log lich su van con reference toi no).
 */
const PRICE_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  "gemini-3.1-pro-preview": { input: 2, output: 12 },
  "gemini-3.6-flash": { input: 1.5, output: 7.5 },
  "gemini-3.5-flash": { input: 1.5, output: 9 },
  "gemini-3.5-flash-lite": { input: 0.3, output: 2.5 },
  "gemini-3.1-flash-lite": { input: 0.25, output: 1.5 },
  "gemini-2.5-pro": { input: 1.25, output: 10 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
};

/** Gemini Batch API giam gia ~50% ca input/output so voi goi dong bo (docs/specs/ai-batch-mode.md §gioi thieu). */
const BATCH_DISCOUNT = 0.5;

/** Model ngoai bang gia: cost 0 + priced=false de caller log warning (khong throw). */
export function computeGeminiCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
  /** true = goi qua Batch API — ap gia giam 50% (bug thuc te 03/08/2026: truoc do
   * tinh cung gia voi sync, ket qua totalCostUsd hien thi cao gap doi thuc te). */
  isBatch = false,
): { costUsd: number; priced: boolean } {
  // Batch API (batches.get().model) tra ve co tien to "models/" (vd
  // "models/gemini-3.6-flash"), khac voi request.model luc submit (khong co
  // tien to) — bug thuc te 02/08/2026: lookup truot, cost luon ra 0 du token
  // > 0. generateContent (sync) khong bi vi khong doc lai model tu response.
  const normalizedModel = model.replace(/^models\//, "");
  const price = PRICE_PER_MILLION_TOKENS[normalizedModel];
  if (!price) {
    return { costUsd: 0, priced: false };
  }
  const discount = isBatch ? BATCH_DISCOUNT : 1;
  const costUsd = ((inputTokens * price.input + outputTokens * price.output) / 1_000_000) * discount;
  return { costUsd, priced: true };
}
