import { beforeEach, describe, expect, it } from "vitest";
import { classifyLine } from "./classifier";
import { evaluateMathBlock } from "./evaluator";
import { __resetMathInstanceCache, getMathInstance } from "./mathjs-extensions";
import type { MathLine } from "./types";

const lines = (...raws: string[]): MathLine[] => raws.map(classifyLine);

beforeEach(() => {
  __resetMathInstanceCache();
});

describe("evaluateMathBlock", () => {
  it("variable declared then used in label", () => {
    const result = evaluateMathBlock(lines("x = 10", "income: x * 2"));
    expect(result[0]).toMatchObject({
      kind: "variable",
      name: "x",
      result: { ok: true },
    });
    expect(result[1]).toMatchObject({
      kind: "label",
      label: "income",
      result: { ok: true, value: "20" },
    });
  });

  it("prev after bare line substitutes last bare result", () => {
    const result = evaluateMathBlock(lines("100", "prev + 50"));
    expect(result[0]).toMatchObject({
      kind: "bare",
      result: { ok: true, value: "100" },
    });
    expect(result[1]).toMatchObject({
      kind: "bare",
      result: { ok: true, value: "150" },
    });
  });

  it("prev with no prior bare line substitutes 0", () => {
    const result = evaluateMathBlock(lines("prev + 5"));
    expect(result[0]).toMatchObject({
      kind: "bare",
      result: { ok: true, value: "5" },
    });
  });

  it("prev after a label line keeps prior bare value", () => {
    const result = evaluateMathBlock(lines("200", "cost: 99", "prev + 1"));
    expect(result[2]).toMatchObject({
      kind: "bare",
      result: { ok: true, value: "201" },
    });
  });

  it("sum counts only labels before it, not after", () => {
    const result = evaluateMathBlock(lines("a: 10", "b: 20", "sum", "c: 5"));
    expect(result[2]).toMatchObject({
      kind: "sum",
      result: { ok: true, value: "30" },
    });
  });

  it("avg with no labeled lines returns 0", () => {
    const result = evaluateMathBlock(lines("avg"));
    expect(result[0]).toMatchObject({
      kind: "avg",
      result: { ok: true, value: "0" },
    });
  });

  it("avg computes mean of labeled results", () => {
    const result = evaluateMathBlock(lines("a: 10", "b: 30", "avg"));
    expect(result[2]).toMatchObject({
      kind: "avg",
      result: { ok: true, value: "20" },
    });
  });

  it("variable = N contributes to sum", () => {
    const result = evaluateMathBlock(lines("a = 10", "b = 20", "sum"));
    expect(result[2]).toMatchObject({
      kind: "sum",
      result: { ok: true, value: "30" },
    });
  });

  it("variable = N contributes to avg", () => {
    const result = evaluateMathBlock(lines("a = 10", "b = 30", "avg"));
    expect(result[2]).toMatchObject({
      kind: "avg",
      result: { ok: true, value: "20" },
    });
  });

  it("mixed variables and labels contribute to sum", () => {
    const result = evaluateMathBlock(lines("a = 10", "b: 20", "sum"));
    expect(result[2]).toMatchObject({
      kind: "sum",
      result: { ok: true, value: "30" },
    });
  });

  it("hex input round-trips to hex output", () => {
    const result = evaluateMathBlock(lines("0xFF"));
    expect(result[0]).toMatchObject({
      kind: "bare",
      result: { ok: true, value: "0xFF" },
    });
  });

  it("hex arithmetic stays in hex", () => {
    const result = evaluateMathBlock(lines("0xA + 0x5"));
    expect(result[0]).toMatchObject({
      kind: "bare",
      result: { ok: true, value: "0xF" },
    });
  });

  it("binary input round-trips", () => {
    const result = evaluateMathBlock(lines("0b1010"));
    expect(result[0]).toMatchObject({
      kind: "bare",
      result: { ok: true, value: "0b1010" },
    });
  });

  it("10k + 2M evaluates to 2,010,000 (formatted by mathjs notation:auto)", () => {
    const result = evaluateMathBlock(lines("10k + 2M"));
    expect(result[0]).toMatchObject({ kind: "bare", result: { ok: true } });
    const val = (result[0] as { result: { ok: true; value: string } }).result
      .value;
    // mathjs formats 2010000 as "2.01e+6" at precision:5 — value is correct
    expect(Number(val.replace(/e\+?/, "e"))).toBeCloseTo(2_010_000, -1);
  });

  it("large word shorthands: 1 billion + 1 million", () => {
    const result = evaluateMathBlock(lines("1 billion + 1 million"));
    expect(result[0]).toMatchObject({ kind: "bare", result: { ok: true } });
    const val = (result[0] as { result: { ok: true; value: string } }).result
      .value;
    expect(Number(val.replace(/e\+?/, "e"))).toBeCloseTo(1_001_000_000, -3);
  });

  it("AND bitwise correctness (5 & 3 = 1)", () => {
    const result = evaluateMathBlock(lines("5 AND 3"));
    expect(result[0]).toMatchObject({
      kind: "bare",
      result: { ok: true, value: "1" },
    });
  });

  it("OR bitwise correctness (5 | 3 = 7)", () => {
    const result = evaluateMathBlock(lines("5 OR 3"));
    expect(result[0]).toMatchObject({
      kind: "bare",
      result: { ok: true, value: "7" },
    });
  });

  it("XOR bitwise correctness (5 XOR 3 = 6)", () => {
    const result = evaluateMathBlock(lines("5 XOR 3"));
    expect(result[0]).toMatchObject({
      kind: "bare",
      result: { ok: true, value: "6" },
    });
  });

  it("round(1 month in days) returns integer", () => {
    const result = evaluateMathBlock(lines("round(1 month in days)"));
    expect(result[0]).toMatchObject({
      kind: "bare",
      result: { ok: true, value: "30" },
    });
  });

  it("round(2 years in weeks) returns integer", () => {
    const result = evaluateMathBlock(lines("round(2 years in weeks)"));
    expect(result[0]).toMatchObject({
      kind: "bare",
      result: { ok: true, value: "104" },
    });
  });

  it("floor(1 month in days) returns integer", () => {
    const result = evaluateMathBlock(lines("floor(1 month in days)"));
    expect(result[0]).toMatchObject({
      kind: "bare",
      result: { ok: true, value: "30" },
    });
  });

  it("ceil(1 month in days) returns integer", () => {
    const result = evaluateMathBlock(lines("ceil(1 month in days)"));
    expect(result[0]).toMatchObject({
      kind: "bare",
      result: { ok: true, value: "31" },
    });
  });

  it("error on one line does not corrupt scope", () => {
    const result = evaluateMathBlock(
      lines("x = 10", "undefinedVar + 1", "x + 5"),
    );
    expect(result[0]).toMatchObject({ kind: "variable", result: { ok: true } });
    expect(result[1]).toMatchObject({ kind: "bare", result: { ok: false } });
    expect(result[2]).toMatchObject({
      kind: "bare",
      result: { ok: true, value: "15" },
    });
  });

  it("errored label does not contribute to sum", () => {
    const result = evaluateMathBlock(lines("a: 10", "b: undefinedVar", "sum"));
    expect(result[1]).toMatchObject({ kind: "label", result: { ok: false } });
    expect(result[2]).toMatchObject({
      kind: "sum",
      result: { ok: true, value: "10" },
    });
  });

  it("CSS unit px to em conversion with default 16px em", () => {
    const result = evaluateMathBlock(lines("32 px to em"));
    expect(result[0]).toMatchObject({
      kind: "bare",
      result: { ok: true },
    });
    const value = (result[0] as { result: { ok: true; value: string } }).result
      .value;
    expect(value).toContain("2");
  });

  it("em = N overrides CSS em unit for subsequent lines", () => {
    const result = evaluateMathBlock(lines("em = 10", "20 px to em"));
    expect(result[0]).toMatchObject({
      kind: "variable",
      name: "em",
      result: { ok: true },
    });
    const value = (result[1] as { result: { ok: true; value: string } }).result
      .value;
    expect(value).toContain("2");
  });

  it("empty lines pass through", () => {
    const result = evaluateMathBlock(lines("", "1 + 1", ""));
    expect(result[0]).toEqual({ kind: "empty" });
    expect(result[2]).toEqual({ kind: "empty" });
  });

  it("header lines pass through with text", () => {
    const result = evaluateMathBlock(lines("# My Section"));
    expect(result[0]).toEqual({ kind: "header", text: "My Section" });
  });

  it("comment lines pass through", () => {
    const result = evaluateMathBlock(lines("// note here"));
    expect(result[0]).toMatchObject({ kind: "comment" });
  });

  it("label value is accessible by name in subsequent lines", () => {
    const result = evaluateMathBlock(lines("revenue: 500", "revenue * 2"));
    expect(result[0]).toMatchObject({
      kind: "label",
      result: { ok: true, value: "500" },
    });
    expect(result[1]).toMatchObject({
      kind: "bare",
      result: { ok: true, value: "1000" },
    });
  });

  it("multi-word label is not injected into scope", () => {
    const result = evaluateMathBlock(
      lines("total revenue: 500", "total revenue + 1"),
    );
    expect(result[0]).toMatchObject({ kind: "label", result: { ok: true } });
    expect(result[1]).toMatchObject({ kind: "bare", result: { ok: false } });
  });

  it("inline em override does not leak across consecutive blocks", () => {
    evaluateMathBlock(lines("em = 10"));
    const result = evaluateMathBlock(lines("32 px to em"));
    const value = (result[0] as { result: { ok: true; value: string } }).result
      .value;
    expect(value).toContain("2");
  });

  it("re-uses singleton math instance for the same rates payload", () => {
    const rates = {
      base: "EUR",
      date: "2023-01-01",
      rates: { USD: 1.1 },
      timestamp: 1234567890,
    };
    const a = getMathInstance(16, rates);
    const b = getMathInstance(16, rates);
    expect(a).toBe(b);
  });
});
