import { renderPromptTemplate } from "./prompt-template.renderer";

describe("renderPromptTemplate", () => {
  it("replaces string vars", () => {
    expect(renderPromptTemplate("Chủ đề: {{topic}}", { topic: "túi xách nữ" })).toBe(
      "Chủ đề: túi xách nữ",
    );
  });

  it("serializes objects/arrays as JSON", () => {
    const result = renderPromptTemplate("SP: {{products}}", {
      products: [{ name: "A" }],
    });
    expect(result).toBe('SP: [{"name":"A"}]');
  });

  it("renders null/undefined as empty string", () => {
    expect(renderPromptTemplate("Tone: {{tone}}.", { tone: null })).toBe("Tone: .");
  });

  it("keeps unknown placeholders visible (de phat hien template sai key)", () => {
    expect(renderPromptTemplate("X: {{khongTonTai}}", { topic: "a" })).toBe("X: {{khongTonTai}}");
  });

  it("replaces the same placeholder multiple times", () => {
    expect(renderPromptTemplate("{{a}} và {{a}}", { a: "1" })).toBe("1 và 1");
  });
});
