import { computeAnthropicCostUsd } from "./anthropic-pricing";

describe("computeAnthropicCostUsd", () => {
  it("computes opus-4-8 cost ($5 input / $25 output per 1M)", () => {
    const { costUsd, priced } = computeAnthropicCostUsd("claude-opus-4-8", 1_000_000, 1_000_000);
    expect(priced).toBe(true);
    expect(costUsd).toBeCloseTo(30);
  });

  it("computes realistic article cost (3k in, 5k out tren sonnet)", () => {
    const { costUsd } = computeAnthropicCostUsd("claude-sonnet-4-6", 3_000, 5_000);
    // 3000*3/1M + 5000*15/1M = 0.009 + 0.075
    expect(costUsd).toBeCloseTo(0.084);
  });

  it("returns 0 + priced=false for unknown model (khong throw)", () => {
    const { costUsd, priced } = computeAnthropicCostUsd("claude-unknown", 1000, 1000);
    expect(costUsd).toBe(0);
    expect(priced).toBe(false);
  });
});
