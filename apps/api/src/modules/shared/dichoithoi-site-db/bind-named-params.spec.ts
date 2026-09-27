import { bindNamedParams } from "./bind-named-params";

describe("bindNamedParams", () => {
  it("replaces named params with positional placeholders in order of first use", () => {
    const result = bindNamedParams("SELECT * FROM t WHERE a = @a AND b = @b", { a: 1, b: "x" });
    expect(result.text).toBe("SELECT * FROM t WHERE a = $1 AND b = $2");
    expect(result.params).toEqual([1, "x"]);
  });

  it("reuses the same position when a name appears more than once", () => {
    const result = bindNamedParams("UPDATE t SET a = @v WHERE a IS DISTINCT FROM @v", { v: null });
    expect(result.text).toBe("UPDATE t SET a = $1 WHERE a IS DISTINCT FROM $1");
    expect(result.params).toEqual([null]);
  });

  it("leaves PostgreSQL casts untouched", () => {
    const result = bindNamedParams("SELECT @ids::int[]", { ids: [1, 2] });
    expect(result.text).toBe("SELECT $1::int[]");
  });

  it("throws when a referenced param has no value", () => {
    expect(() => bindNamedParams("SELECT @missing", {})).toThrow("@missing");
  });
});
