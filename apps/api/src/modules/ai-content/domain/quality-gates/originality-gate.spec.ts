import { evaluateDestinationOriginalityGate } from "./originality-gate";

describe("evaluateDestinationOriginalityGate", () => {
  it("passed khi khong co bai nao vuot nguong", () => {
    const check = evaluateDestinationOriginalityGate({
      similarTo: [
        { slug: "thac-datanla", score: 0.2 },
        { slug: "thac-cam-ly", score: 0.35 },
      ],
    });
    expect(check.passed).toBe(true);
    expect(check.severity).toBe("warning");
    expect(check.details).toHaveLength(0);
  });

  it("khong passed nhung KHONG chan (severity warning) khi vuot nguong", () => {
    const check = evaluateDestinationOriginalityGate({
      similarTo: [{ slug: "thac-pongour", score: 0.62 }],
    });
    expect(check.passed).toBe(false);
    expect(check.severity).toBe("warning");
    expect(check.details[0]).toContain("thac-pongour");
    expect(check.details[0]).toContain("62%");
  });

  it("dung nguong tuy chinh khi truyen vao", () => {
    const check = evaluateDestinationOriginalityGate({
      similarTo: [{ slug: "thac-pongour", score: 0.45 }],
      threshold: 0.4,
    });
    expect(check.passed).toBe(false);
  });
});
