import { describe, it, expect } from "vitest";
import { Dates } from "./dates";

describe("Dates.evaluateTimezone", () => {
  it("converts EST to BRL (America/Sao_Paulo)", () => {
    const result = Dates.evaluateTimezone("1PM EST to BRL");
    // EST is UTC-5, BRL is UTC-3. 1PM EST = 18:00 UTC = 15:00 BRL.
    expect(result).toMatch(/15:00/);
  });

  it("converts UTC to PST", () => {
    const result = Dates.evaluateTimezone("10:00 UTC to PST");
    // PST resolves to America/Los_Angeles which observes DST.
    // During PDT (UTC-7): 10:00 UTC = 03:00. During PST (UTC-8): 02:00.
    expect(result).toMatch(/0[23]:00/);
  });

  it("handles JST to CET", () => {
    const result = Dates.evaluateTimezone("9AM JST to CET");
    // JST is UTC+9, CET is fixed UTC+1. 9AM JST = 00:00 UTC = 01:00 CET.
    expect(result).toMatch(/01:00/);
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
    // UTC+0 → BRT (UTC-3): 12:00 UTC = 09:00 BRT
    expect(result).toMatch(/09:00/);
  });

  it("resolves city name case-insensitively (RIO DE JANEIRO)", () => {
    const result = Dates.evaluateTimezone("12:00 UTC in RIO DE JANEIRO");
    expect(result).toMatch(/09:00/);
  });

  it("resolves Portuguese city alias (Luxemburgo)", () => {
    const result = Dates.evaluateTimezone("15:00 UTC in Luxemburgo");
    expect(result).not.toBeNull();
    expect(result).toMatch(/\d\d:\d\d/);
  });

  it("resolves 'now in <city>' without throwing", () => {
    const result = Dates.evaluateTimezone("now in Tokyo");
    expect(result).not.toBeNull();
    expect(result).toMatch(/\d\d:\d\d/);
  });

  it("supports 'in' conjunction with existing abbreviations", () => {
    const result = Dates.evaluateTimezone("1PM EST in BRL");
    expect(result).toMatch(/15:00/);
  });

  it("returns null for garbage location", () => {
    const result = Dates.evaluateTimezone("now in zzznowhere");
    expect(result).toBeNull();
  });
});
