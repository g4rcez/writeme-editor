import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Dates } from "./dates";

describe("Dates.evaluateEpoch", () => {
    it("converts seconds epoch with 'epoch' prefix", () => {
        expect(Dates.evaluateEpoch("epoch 1234567890")).toBe("2009-02-13 23:31:30 UTC");
    });

    it("converts seconds epoch with 'unix' prefix", () => {
        expect(Dates.evaluateEpoch("unix 1234567890")).toBe("2009-02-13 23:31:30 UTC");
    });

    it("converts seconds epoch with 'timestamp' prefix", () => {
        expect(Dates.evaluateEpoch("timestamp 1234567890")).toBe("2009-02-13 23:31:30 UTC");
    });

    it("auto-detects milliseconds when value > 1e12", () => {
        expect(Dates.evaluateEpoch("epoch 1234567890000")).toBe("2009-02-13 23:31:30 UTC");
    });

    it("converts with 'as date' suffix", () => {
        expect(Dates.evaluateEpoch("1234567890 as date")).toBe("2009-02-13 23:31:30 UTC");
    });

    it("returns null for bare numbers", () => {
        expect(Dates.evaluateEpoch("1234567890")).toBeNull();
    });

    it("returns null for non-numeric input", () => {
        expect(Dates.evaluateEpoch("epoch abc")).toBeNull();
    });

    it("returns null for negative values", () => {
        expect(Dates.evaluateEpoch("epoch -1")).toBeNull();
    });
});

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

describe("Dates.evaluateDaysUntil", () => {
    const FIXED = new Date("2025-05-03T12:00:00.000Z");
    beforeEach(() => vi.useFakeTimers({ now: FIXED }));
    afterEach(() => vi.useRealTimers());

    it("days until future date in current year", () => {
        // Dec 25, 2025 is 236 days after May 3, 2025
        expect(Dates.evaluateDaysUntil("days until 25 Dec")).toBe("236 days");
    });

    it("advances to next year when target has passed (no explicit year)", () => {
        // Jan 1 is in the past relative to May 3; should resolve to Jan 1, 2026
        const result = Dates.evaluateDaysUntil("days until Jan 1");
        expect(result).toBe("243 days");
    });

    it("does not advance when explicit year is given", () => {
        // Jan 1, 2025 is in the past — explicit year, no auto-advance
        const result = Dates.evaluateDaysUntil("days until Jan 1 2025");
        // May 3 → Jan 1 is negative (past)
        expect(result).toMatch(/^-\d+ days$/);
    });

    it("days since a past date", () => {
        // May 1, 2025 → 2 days ago
        expect(Dates.evaluateDaysUntil("days since May 1 2025")).toBe("2 days");
    });

    it("singular 'day' for diff of 1", () => {
        expect(Dates.evaluateDaysUntil("days until May 4 2025")).toBe("1 day");
    });

    it("singular 'day' for diff of -1", () => {
        expect(Dates.evaluateDaysUntil("days since May 2 2025")).toBe("1 day");
    });

    it("returns null for unrecognised date string", () => {
        expect(Dates.evaluateDaysUntil("days until blahblah")).toBeNull();
    });

    it("returns null for non-matching pattern", () => {
        expect(Dates.evaluateDaysUntil("today + 5 days")).toBeNull();
        expect(Dates.evaluateDaysUntil("1 + 1")).toBeNull();
    });

    it("accepts 'till' as synonym for 'until'", () => {
        expect(Dates.evaluateDaysUntil("days till 25 Dec")).toBe("236 days");
    });

    it("accepts 'after' as synonym for 'since'", () => {
        expect(Dates.evaluateDaysUntil("days after May 1 2025")).toBe("2 days");
    });
});

const FIXED_DATE = new Date("2025-01-15T12:00:00.000Z");

describe("Dates.evaluateDateArithmetic", () => {
    beforeEach(() => vi.useFakeTimers({ now: FIXED_DATE }));
    afterEach(() => vi.useRealTimers());

    it("returns null for non-date expressions", () => {
        expect(Dates.evaluateDateArithmetic("1 + 1")).toBeNull();
        expect(Dates.evaluateDateArithmetic("10 USD to EUR")).toBeNull();
    });

    it("today alone returns current date", () => {
        expect(Dates.evaluateDateArithmetic("today")).toBe("2025-01-15");
    });

    it("tomorrow returns today + 1 day", () => {
        expect(Dates.evaluateDateArithmetic("tomorrow")).toBe("2025-01-16");
    });

    it("yesterday returns today - 1 day", () => {
        expect(Dates.evaluateDateArithmetic("yesterday")).toBe("2025-01-14");
    });

    it("today + N days", () => {
        expect(Dates.evaluateDateArithmetic("today + 17 days")).toBe("2025-02-01");
    });

    it("today + N day (singular)", () => {
        expect(Dates.evaluateDateArithmetic("today + 1 day")).toBe("2025-01-16");
    });

    it("today - N days", () => {
        expect(Dates.evaluateDateArithmetic("today - 5 days")).toBe("2025-01-10");
    });

    it("today + N weeks", () => {
        expect(Dates.evaluateDateArithmetic("today + 2 weeks")).toBe("2025-01-29");
    });

    it("today + N months", () => {
        expect(Dates.evaluateDateArithmetic("today + 3 months")).toBe("2025-04-15");
    });

    it("today + N years", () => {
        expect(Dates.evaluateDateArithmetic("today + 1 year")).toBe("2026-01-15");
    });

    it("today + N hours (crosses midnight)", () => {
        expect(Dates.evaluateDateArithmetic("today + 25 hours")).toBe("2025-01-16");
    });

    it("today + N minutes (same day)", () => {
        expect(Dates.evaluateDateArithmetic("today + 60 minutes")).toBe("2025-01-15");
    });

    it("today + N seconds (crosses midnight)", () => {
        expect(Dates.evaluateDateArithmetic("today + 86400 seconds")).toBe("2025-01-16");
    });

    it("today + 1 decade", () => {
        expect(Dates.evaluateDateArithmetic("today + 1 decade")).toBe("2035-01-15");
    });

    it("today + 2 decades", () => {
        expect(Dates.evaluateDateArithmetic("today + 2 decades")).toBe("2045-01-15");
    });

    it("case-insensitive base keyword", () => {
        expect(Dates.evaluateDateArithmetic("Today + 1 day")).toBe("2025-01-16");
        expect(Dates.evaluateDateArithmetic("TOMORROW")).toBe("2025-01-16");
    });

    it("chained operations", () => {
        expect(Dates.evaluateDateArithmetic("today + 1 month + 2 days")).toBe("2025-02-17");
    });

    it("N days ago", () => {
        expect(Dates.evaluateDateArithmetic("12 days ago")).toBe("2025-01-03");
    });

    it("1 day ago (singular)", () => {
        expect(Dates.evaluateDateArithmetic("1 day ago")).toBe("2025-01-14");
    });

    it("N weeks ago", () => {
        expect(Dates.evaluateDateArithmetic("2 weeks ago")).toBe("2025-01-01");
    });

    it("N months ago", () => {
        expect(Dates.evaluateDateArithmetic("3 months ago")).toBe("2024-10-15");
    });

    it("N years ago", () => {
        expect(Dates.evaluateDateArithmetic("1 year ago")).toBe("2024-01-15");
    });

    it("N decades ago", () => {
        expect(Dates.evaluateDateArithmetic("2 decades ago")).toBe("2005-01-15");
    });

    it("case-insensitive ago", () => {
        expect(Dates.evaluateDateArithmetic("5 Days Ago")).toBe("2025-01-10");
    });

    it("rejects 'ago' without quantity", () => {
        expect(Dates.evaluateDateArithmetic("days ago")).toBeNull();
    });

    it("rejects 'ago' with unknown unit", () => {
        expect(Dates.evaluateDateArithmetic("12 banana ago")).toBeNull();
    });

    it("N units + M (unitless inherits base unit: days)", () => {
        expect(Dates.evaluateDateArithmetic("12 days + 5")).toBe("2025-02-01");
    });

    it("N units + M (unitless inherits base unit: weeks)", () => {
        expect(Dates.evaluateDateArithmetic("2 weeks + 3")).toBe("2025-02-19");
    });

    it("N units - M (unitless subtraction inherits base unit)", () => {
        expect(Dates.evaluateDateArithmetic("12 days - 3")).toBe("2025-01-24");
    });

    it("N units + M with explicit unit override", () => {
        expect(Dates.evaluateDateArithmetic("12 days + 5 days")).toBe("2025-02-01");
    });

    it("N units + mixed explicit unit", () => {
        expect(Dates.evaluateDateArithmetic("1 month + 5 days")).toBe("2025-02-20");
    });

    it("N units chained with multiple ops", () => {
        expect(Dates.evaluateDateArithmetic("12 days + 5 + 2")).toBe("2025-02-03");
    });

    it("bare 'N units' alone still returns null (no anchor)", () => {
        expect(Dates.evaluateDateArithmetic("12 days")).toBeNull();
    });

    it("'N units ago' takes precedence over relative pattern", () => {
        expect(Dates.evaluateDateArithmetic("12 days ago")).toBe("2025-01-03");
    });

    it("'now' anchor returns today's date", () => {
        expect(Dates.evaluateDateArithmetic("now")).toBe("2025-01-15");
    });

    it("'now + N hours' stays same day at noon UTC + 3h", () => {
        expect(Dates.evaluateDateArithmetic("now + 3 hours")).toBe("2025-01-15");
    });

    it("anchored chain with mixed signs", () => {
        expect(Dates.evaluateDateArithmetic("today + 5 days - 2 days")).toBe("2025-01-18");
    });

    it("anchored chain mixing units", () => {
        expect(Dates.evaluateDateArithmetic("today + 1 week - 3 days")).toBe("2025-01-19");
    });

    it("relative with explicit unit subtraction", () => {
        expect(Dates.evaluateDateArithmetic("2 weeks - 3 days")).toBe("2025-01-26");
    });

    it("relative chain with mixed unit ops", () => {
        expect(Dates.evaluateDateArithmetic("2 weeks + 3 days - 1 day")).toBe("2025-01-31");
    });

    it("relative pattern is case-insensitive", () => {
        expect(Dates.evaluateDateArithmetic("12 DAYS + 5")).toBe("2025-02-01");
    });

    it("ago accepts hours unit", () => {
        expect(Dates.evaluateDateArithmetic("36 hours ago")).toBe("2025-01-14");
    });
});

describe("Dates.evaluateNatural", () => {
    const FIXED = new Date("2025-05-03T12:00:00.000Z");
    beforeEach(() => vi.useFakeTimers({ now: FIXED }));
    afterEach(() => vi.useRealTimers());

    it("dispatches to evaluateDaysUntil", () => {
        expect(Dates.evaluateNatural("days until 25 Dec")).toBe("236 days");
    });

    it("dispatches to evaluateDateArithmetic (today + N)", () => {
        expect(Dates.evaluateNatural("today + 5 days")).toBe("2025-05-08");
    });

    it("dispatches to evaluateDateArithmetic (N units ago)", () => {
        expect(Dates.evaluateNatural("12 days ago")).toBe("2025-04-21");
    });

    it("dispatches to evaluateEpoch", () => {
        expect(Dates.evaluateNatural("epoch 1234567890")).toBe("2009-02-13 23:31:30 UTC");
    });

    it("dispatches to evaluateTimezone", () => {
        const result = Dates.evaluateNatural("12:00 UTC in Tokyo");
        expect(result).toMatch(/\d\d:\d\d/);
    });

    it("returns null for plain math", () => {
        expect(Dates.evaluateNatural("1 + 1")).toBeNull();
        expect(Dates.evaluateNatural("100 USD to BRL")).toBeNull();
    });
});
