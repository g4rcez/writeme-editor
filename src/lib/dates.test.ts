import { describe, it, expect } from "vitest";
import { Dates } from "./dates";

describe("Dates.evaluateTimezone", () => {
  it("converts EST to BRL (America/Sao_Paulo)", () => {
    const result = Dates.evaluateTimezone("1PM EST to BRL");
    // EST is UTC-5, BRL is UTC-3. 1PM EST should be 3PM BRL.
    expect(result).toMatch(/3:00 PM/);
  });

  it("converts UTC to PST", () => {
    const result = Dates.evaluateTimezone("10:00 UTC to PST");
    // "PST" resolves to America/Los_Angeles which observes DST.
    // During PDT (UTC-7): 10:00 UTC = 3:00 AM PDT.
    // During PST (UTC-8): 10:00 UTC = 2:00 AM PST.
    expect(result).toMatch(/\d+:00 AM/);
  });

  it("handles JST to CET", () => {
    const result = Dates.evaluateTimezone("9AM JST to CET");
    // JST is UTC+9, CET is UTC+1. 9AM JST should be 1AM CET.
    expect(result).toMatch(/1:00 AM/);
  });

  it("returns null for non-time strings", () => {
    expect(Dates.evaluateTimezone("hello to world")).toBeNull();
    expect(Dates.evaluateTimezone("100 USD to BRL")).toBeNull();
  });

  it("handles standard IANA timezones", () => {
    const result = Dates.evaluateTimezone("12:00 UTC to Europe/London");
    expect(result).not.toBeNull();
  });

  it("resolves city name (Rio de Janeiro) with 'in'", () => {
    const result = Dates.evaluateTimezone("12:00 UTC in Rio de Janeiro");
    expect(result).toMatch(/9:00 AM/);
  });

  it("resolves city name case-insensitively (RIO DE JANEIRO)", () => {
    const result = Dates.evaluateTimezone("12:00 UTC in RIO DE JANEIRO");
    expect(result).toMatch(/9:00 AM/);
  });

  it("resolves Portuguese city alias (Luxemburgo)", () => {
    const result = Dates.evaluateTimezone("15:00 UTC in Luxemburgo");
    expect(result).not.toBeNull();
    expect(result).toMatch(/\d+:\d+ (AM|PM)/);
  });

  it("resolves 'now in <city>' without throwing", () => {
    const result = Dates.evaluateTimezone("now in Tokyo");
    expect(result).not.toBeNull();
    expect(result).toMatch(/\d+:\d+ (AM|PM)/);
  });

  it("supports 'in' conjunction with existing abbreviations", () => {
    const result = Dates.evaluateTimezone("1PM EST in BRL");
    expect(result).toMatch(/3:00 PM/);
  });

  it("returns null for garbage location", () => {
    const result = Dates.evaluateTimezone("now in zzznowhere");
    expect(result).toBeNull();
  });
});
