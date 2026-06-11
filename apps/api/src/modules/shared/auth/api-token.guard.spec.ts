import { safeEquals } from "./api-token.guard";

describe("safeEquals (auth token compare)", () => {
  it("returns true for identical tokens", () => {
    expect(safeEquals("secret-token-123", "secret-token-123")).toBe(true);
  });

  it("returns false for different tokens of same length", () => {
    expect(safeEquals("secret-token-123", "secret-token-456")).toBe(false);
  });

  it("returns false for different lengths (khong throw)", () => {
    expect(safeEquals("short", "a-much-longer-token")).toBe(false);
  });

  it("handles unicode safely", () => {
    expect(safeEquals("token-có-dấu", "token-có-dấu")).toBe(true);
    expect(safeEquals("token-có-dấu", "token-co-dau")).toBe(false);
  });
});
