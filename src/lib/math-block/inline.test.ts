import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  INLINE_MATH_PATTERN,
  evaluateInlineMath,
  runInlineMath,
} from "solver";

describe("INLINE_MATH_PATTERN", () => {
  it("matches >>math expr=", () => {
    expect(INLINE_MATH_PATTERN.test(">>math 1 + 1=")).toBe(true);
  });

  it("matches with optional space before =", () => {
    expect(INLINE_MATH_PATTERN.test(">>math 1 + 1 =")).toBe(true);
  });

  it("does not match without trailing =", () => {
    expect(INLINE_MATH_PATTERN.test(">>math 1 + 1")).toBe(false);
  });

  it("does not match other commands", () => {
    expect(INLINE_MATH_PATTERN.test(">>money 1USD to BRL=")).toBe(false);
  });
});

describe("evaluateInlineMath", () => {
  const FIXED = new Date("2025-01-15T12:00:00.000Z");
  beforeEach(() => vi.useFakeTimers({ now: FIXED }));
  afterEach(() => vi.useRealTimers());

  it("evaluates plain arithmetic", () => {
    expect(evaluateInlineMath("1 + 1")).toEqual({ ok: true, value: "2" });
  });

  it("dispatches to natural-language dates (12 days ago)", () => {
    expect(evaluateInlineMath("12 days ago")).toEqual({
      ok: true,
      value: "2025-01-03",
    });
  });

  it("dispatches to natural-language dates (today + 5 days)", () => {
    expect(evaluateInlineMath("today + 5 days")).toEqual({
      ok: true,
      value: "2025-01-20",
    });
  });

  it("applies large-number shorthand preprocessor", () => {
    expect(evaluateInlineMath("2k + 3")).toEqual({ ok: true, value: "2003" });
  });

  it("applies bitwise keyword preprocessor", () => {
    const result = evaluateInlineMath("0xff and 0x0f");
    expect(result.ok).toBe(true);
  });

  it("returns error result for invalid math", () => {
    const result = evaluateInlineMath("totally bogus &&&");
    expect(result.ok).toBe(false);
  });
});

describe("runInlineMath", () => {
  const FIXED = new Date("2025-01-15T12:00:00.000Z");
  beforeEach(() => vi.useFakeTimers({ now: FIXED }));
  afterEach(() => vi.useRealTimers());

  it("renders 'expr = result' for arithmetic", () => {
    expect(runInlineMath(">>math 1 + 1=")).toBe("1 + 1 = 2");
  });

  it("renders natural-language date", () => {
    expect(runInlineMath(">>math 12 days ago=")).toBe(
      "12 days ago = 2025-01-03",
    );
  });

  it("strips ** -> ^ before evaluating", () => {
    expect(runInlineMath(">>math 2 ** 8=")).toBe("2 ^ 8 = 256");
  });

  it("handles trailing space before =", () => {
    expect(runInlineMath(">>math 1 + 1 =")).toBe("1 + 1 = 2");
  });

  it("returns empty string for empty expression", () => {
    expect(runInlineMath(">>math =")).toBe("");
  });
});
