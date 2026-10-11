import { describe, expect, it } from "vitest";
import { preprocessRule3, solveRule3 } from "../src/index.js";

describe("rule of three", () => {
    it.each([
        ["x/4, 5/10", 2],
        ["2/x, 5/10", 4],
        ["2/4, x/10", 5],
        ["2/4, 5/x", 10],
        ["-2.5/5, x/10", -5],
    ])("solves %s", (expression, value) => {
        expect(solveRule3(expression)).toEqual({ ok: true, variable: "x", value });
    });

    it.each(["x/4, 5/0", "2/x, 0/10", "2/0, x/10", "0/4, 5/x"])("rejects division by zero in %s", (expression) =>
        expect(solveRule3(expression)).toEqual({ ok: false, error: "Division by zero" }),
    );

    it.each([
        ["2/4, 5/10", "No unknown variable"],
        ["x/4, y/10", "Multiple unknowns"],
        ["x + 4", "Invalid rule3 syntax"],
    ])("rejects invalid proportion %s", (expression, error) => {
        expect(solveRule3(expression)).toEqual({ ok: false, error });
    });

    it("replaces valid calls while preserving invalid calls for evaluation errors", () => {
        expect(preprocessRule3("rule3(2/4, x/10) + rule3(x/4, 5/10)")).toBe("5 + 2");
        expect(preprocessRule3("rule3(2/0, x/10)")).toBe("rule3(2/0, x/10)");
    });
});
