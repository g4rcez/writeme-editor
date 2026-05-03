import { describe, expect, it } from "vitest";
import { classifyLine } from "./classifier";

describe("classifyLine", () => {
  it("empty string → empty", () => {
    expect(classifyLine("")).toEqual({ kind: "empty" });
    expect(classifyLine("   ")).toEqual({ kind: "empty" });
  });

  it("# heading → header", () => {
    expect(classifyLine("# Income")).toEqual({
      kind: "header",
      text: "Income",
    });
    expect(classifyLine("# My Section")).toEqual({
      kind: "header",
      text: "My Section",
    });
  });

  it("plain # without space is bare, not header", () => {
    expect(classifyLine("#foo")).toMatchObject({ kind: "bare" });
  });

  it("// comment → comment", () => {
    expect(classifyLine("// this is a note")).toMatchObject({
      kind: "comment",
    });
  });

  it('"quoted text" comment → comment', () => {
    expect(classifyLine('"this is a comment"')).toMatchObject({
      kind: "comment",
    });
  });

  it("x = 10 → variable", () => {
    expect(classifyLine("x = 10")).toEqual({
      kind: "variable",
      name: "x",
      expr: "10",
      raw: "x = 10",
    });
  });

  it("em = 16 → variable (css override case)", () => {
    expect(classifyLine("em = 16")).toMatchObject({
      kind: "variable",
      name: "em",
    });
  });

  it("x == 10 is NOT a variable (comparison)", () => {
    expect(classifyLine("x == 10")).toMatchObject({ kind: "bare" });
  });

  it("variable with expression RHS", () => {
    expect(classifyLine("rate = 1.5 * 100")).toEqual({
      kind: "variable",
      name: "rate",
      expr: "1.5 * 100",
      raw: "rate = 1.5 * 100",
    });
  });

  it("label: expr → label", () => {
    expect(classifyLine("revenue: 100 + 50")).toEqual({
      kind: "label",
      label: "revenue",
      expr: "100 + 50",
      raw: "revenue: 100 + 50",
    });
  });

  it("label with spaces in name", () => {
    expect(classifyLine("total cost: 200")).toMatchObject({
      kind: "label",
      label: "total cost",
    });
  });

  it("sum alone → sum", () => {
    expect(classifyLine("sum")).toEqual({ kind: "sum" });
    expect(classifyLine("total")).toEqual({ kind: "sum" });
    expect(classifyLine("SUM")).toEqual({ kind: "sum" });
  });

  it("sum: expr is a label, not sum", () => {
    expect(classifyLine("sum: 10 + 5")).toMatchObject({
      kind: "label",
      label: "sum",
    });
  });

  it("avg alone → avg", () => {
    expect(classifyLine("avg")).toEqual({ kind: "avg" });
    expect(classifyLine("average")).toEqual({ kind: "avg" });
  });

  it("bare arithmetic", () => {
    expect(classifyLine("1 + 1")).toMatchObject({
      kind: "bare",
      expr: "1 + 1",
    });
  });

  it("bare detects hex base", () => {
    expect(classifyLine("0xFF + 1")).toMatchObject({
      kind: "bare",
      base: "hex",
    });
  });

  it("bare detects binary base", () => {
    expect(classifyLine("0b1010")).toMatchObject({ kind: "bare", base: "bin" });
  });

  it("bare detects octal base", () => {
    expect(classifyLine("0o17")).toMatchObject({ kind: "bare", base: "oct" });
  });

  it("currency expression is bare", () => {
    expect(classifyLine("10 USD to EUR")).toMatchObject({ kind: "bare" });
  });

  it("epoch expression is bare", () => {
    expect(classifyLine("epoch 1700000000")).toMatchObject({ kind: "bare" });
  });

  it("prev is bare", () => {
    expect(classifyLine("prev + 5")).toMatchObject({ kind: "bare" });
  });
});
