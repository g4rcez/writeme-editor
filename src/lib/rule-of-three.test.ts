import { describe, expect, it } from "vitest";
import { preprocessRule3, solveRule3 } from "./rule-of-three";

describe("solveRule3", () => {
  it("solves for position a (lefttop)", () => {
    const r = solveRule3("x / 20, 30 / 40");
    expect(r).toEqual({ ok: true, value: 15, variable: "x" });
  });

  it("solves for position b (leftbottom)", () => {
    const r = solveRule3("10 / x, 30 / 60");
    expect(r).toEqual({ ok: true, value: 20, variable: "x" });
  });

  it("solves for position c (righttop)", () => {
    const r = solveRule3("10 / 20, x / 40");
    expect(r).toEqual({ ok: true, value: 20, variable: "x" });
  });

  it("solves for position d (rightbottom)", () => {
    const r = solveRule3("10 / 20, 30 / x");
    expect(r).toEqual({ ok: true, value: 60, variable: "x" });
  });

  it("accepts minimal whitespace", () => {
    const r = solveRule3("10/20,x/40");
    expect(r).toEqual({ ok: true, value: 20, variable: "x" });
  });

  it("accepts extra whitespace", () => {
    const r = solveRule3("  10 / 20 , x / 40 ");
    expect(r).toEqual({ ok: true, value: 20, variable: "x" });
  });

  it("handles negative numbers", () => {
    const r = solveRule3("-5 / 10, x / 20");
    expect(r).toEqual({ ok: true, value: -10, variable: "x" });
  });

  it("handles floating point inputs", () => {
    const r = solveRule3("1.5 / 3, x / 6");
    expect(r).toEqual({ ok: true, value: 3, variable: "x" });
  });

  it("returns error for no unknowns", () => {
    const r = solveRule3("10 / 20, 30 / 40");
    expect(r).toEqual({ ok: false, error: "No unknown variable" });
  });

  it("returns error for multiple unknowns", () => {
    const r = solveRule3("x / y, 10 / 20");
    expect(r).toEqual({ ok: false, error: "Multiple unknowns" });
  });

  it("returns error for division by zero when solving a", () => {
    // a = (b * c) / d, d=0
    const r = solveRule3("x / 10, 5 / 0");
    expect(r).toEqual({ ok: false, error: "Division by zero" });
  });

  it("returns error for division by zero when solving b", () => {
    // b = (a * d) / c, c=0
    const r = solveRule3("10 / x, 0 / 20");
    expect(r).toEqual({ ok: false, error: "Division by zero" });
  });

  it("returns error for malformed input", () => {
    const r = solveRule3("not valid");
    expect(r).toEqual({ ok: false, error: "Invalid rule3 syntax" });
  });

  it("variable can have numbers in name", () => {
    const r = solveRule3("x1 / 20, 10 / 40");
    expect(r).toEqual({ ok: true, value: 5, variable: "x1" });
  });
});

describe("preprocessRule3", () => {
  it("replaces a rule3 call with its result", () => {
    expect(preprocessRule3("rule3(10/20, x/40)")).toBe("20");
  });

  it("replaces rule3 embedded in a larger expression", () => {
    expect(preprocessRule3("y = rule3(10/20, x/40) * 2")).toBe("y = 20 * 2");
  });

  it("leaves unrecognized expressions unchanged", () => {
    expect(preprocessRule3("some random text")).toBe("some random text");
  });

  it("leaves malformed rule3 calls unchanged", () => {
    expect(preprocessRule3("rule3(bad input)")).toBe("rule3(bad input)");
  });

  it("handles spaces in rule3 call", () => {
    expect(preprocessRule3("rule3( 10 / 20 , x / 40 )")).toBe("20");
  });
});
