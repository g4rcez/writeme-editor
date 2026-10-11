import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dates } from "../src/dates.js";

describe("package date helpers", () => {
    beforeEach(() => vi.useFakeTimers({ now: new Date(2025, 4, 3, 12) }));
    afterEach(() => vi.useRealTimers());

    it.each([
        "epoch 1234567890",
        "unix 1234567890",
        "timestamp 1234567890",
        "1234567890 as date",
        "epoch 1234567890000",
    ])("converts %s to UTC independently of the host timezone", (expression) => {
        expect(Dates.evaluateEpoch(expression)).toBe("2009-02-13 23:31:30 UTC");
    });

    it.each(["1234567890", "epoch -1", "epoch abc", "epoch 999999999999999999999"])(
        "rejects invalid epoch expression %s",
        (expression) => expect(Dates.evaluateEpoch(expression)).toBeNull(),
    );

    it.each(["days to May 4 2025", "how many days to May 4 2025", "days until May 4 2025"])(
        "supports shared package grammar: %s",
        (expression) => {
            expect(Dates.evaluateDaysUntil(expression)).toBe("1 day");
            expect(Dates.evaluateNatural(expression)).toBe("1 day");
        },
    );

    it("advances a past date without an explicit year", () => {
        expect(Dates.evaluateDaysUntil("days until Jan 1")).toBe("243 days");
        expect(Dates.evaluateDaysUntil("days until Jan 1 2025")).toBe("-122 days");
    });

    it("counts elapsed days and preserves singular output", () => {
        expect(Dates.evaluateDaysUntil("days since May 1 2025")).toBe("2 days");
        expect(Dates.evaluateDaysUntil("days after May 2 2025")).toBe("1 day");
    });

    it("handles leap days and month boundaries", () => {
        vi.setSystemTime(new Date(2024, 1, 28, 12));
        expect(Dates.evaluateDateArithmetic("today + 1 day")).toBe("2024-02-29");
        vi.setSystemTime(new Date(2025, 0, 31, 12));
        expect(Dates.evaluateDateArithmetic("today + 1 month")).toBe("2025-02-28");
    });

    it("dispatches relative arithmetic and epochs through evaluateNatural", () => {
        expect(Dates.evaluateNatural("today + 2 days")).toBe("2025-05-05");
        expect(Dates.evaluateNatural("epoch 0")).toBe("1970-01-01 00:00:00 UTC");
    });

    it("converts timezones using location aliases", () => {
        expect(Dates.evaluateTimezone("12:00 UTC in Rio de Janeiro")).toMatch(/09:00/);
        expect(Dates.evaluateTimezone("9AM JST to CET")).toMatch(/01:00/);
    });

    it("returns null for expressions outside the date grammar", () => {
        expect(Dates.evaluateNatural("1 + 1")).toBeNull();
        expect(Dates.evaluateDaysUntil("days until zzznowhere")).toBeNull();
        expect(Dates.evaluateTimezone("now in zzznowhere")).toBeNull();
    });
});
