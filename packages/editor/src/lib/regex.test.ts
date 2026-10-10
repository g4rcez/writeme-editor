import { describe, expect, it } from "vitest";
import { escapeRegExp } from "./regex";

describe("escapeRegExp", () => {
    it("matches regex metacharacters literally", () => {
        const value = ".*+?^${}()|[]\\";
        const expression = new RegExp(`^${escapeRegExp(value)}$`);

        expect(expression.test(value)).toBe(true);
        expect(expression.test("other")).toBe(false);
    });
});
