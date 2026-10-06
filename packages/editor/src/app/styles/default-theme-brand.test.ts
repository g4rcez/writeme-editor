import { describe, expect, it } from "vitest";
import { darkTheme } from "./dark";
import { lightTheme } from "./light";

describe("default theme brand colors", () => {
    it("uses the primary purple for emphasis in both default themes", () => {
        expect(darkTheme.colors.emphasis.DEFAULT).toBe(darkTheme.colors.primary.DEFAULT);
        expect(darkTheme.colors.emphasis.subtle).toBe(darkTheme.colors.primary.subtle);
        expect(darkTheme.colors.emphasis.hover).toBe(darkTheme.colors.primary.hover);
        expect(darkTheme.colors.emphasis.foreground).toBe(darkTheme.colors.primary.foreground);

        expect(lightTheme.colors.emphasis.DEFAULT).toBe(lightTheme.colors.primary.DEFAULT);
        expect(lightTheme.colors.emphasis.subtle).toBe(lightTheme.colors.primary.subtle);
        expect(lightTheme.colors.emphasis.hover).toBe(lightTheme.colors.primary.hover);
        expect(lightTheme.colors.emphasis.foreground).toBe(lightTheme.colors.primary.foreground);
    });
});
