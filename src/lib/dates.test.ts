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
    // UTC is 0, PST is UTC-8. 10:00 UTC should be 2:00 AM PST.
    expect(result).toMatch(/2:00 AM/);
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
});
