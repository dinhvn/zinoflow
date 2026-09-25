import { scoreCandidate } from "./geocode-candidate-scoring";

describe("scoreCandidate", () => {
  it("gives highest score for identical name and zero distance", () => {
    expect(scoreCandidate("Biệt thự Hằng Nga", "Biệt thự Hằng Nga", 0, 20_000)).toBe(1);
  });

  it("gives lower score when distance grows towards the bias radius", () => {
    const near = scoreCandidate("Biệt thự Hằng Nga", "Biệt thự Hằng Nga", 1_000, 20_000);
    const far = scoreCandidate("Biệt thự Hằng Nga", "Biệt thự Hằng Nga", 19_000, 20_000);
    expect(near).toBeGreaterThan(far);
  });

  it("treats null distance (no parent cluster coords) as neutral, not zero", () => {
    const withNullDistance = scoreCandidate("Biệt thự Hằng Nga", "Biệt thự Hằng Nga", null, 20_000);
    const withFarDistance = scoreCandidate("Biệt thự Hằng Nga", "Biệt thự Hằng Nga", 20_000, 20_000);
    expect(withNullDistance).toBeGreaterThan(withFarDistance);
  });

  it("gives low score for completely unrelated names even when very close", () => {
    const score = scoreCandidate("Biệt thự Hằng Nga", "Trạm xăng ABC", 10, 20_000);
    expect(score).toBeLessThan(0.5);
  });
});
