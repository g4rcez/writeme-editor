import { describe, expect, it } from "vitest";
import { nativeTheme } from "./native";
import { createWritemeThemeCss } from "./theme-css";

describe("nativeTheme", () => {
    it("does not use pure black as the native content background", () => {
        expect(nativeTheme.colors?.background).toBe(nativeTheme.colors?.card?.background);
        expect(nativeTheme.colors?.background).not.toBe("hsla(0, 0%, 0%)");
    });

    it("publishes themed card and table surfaces for utility classes", () => {
        const css = createWritemeThemeCss("html.native", nativeTheme, "dark");

        expect(css).toContain("--var-card-background: hsla(240, 3%, 11%)");
        expect(css).toContain("--var-card-border: hsla(240, 2%, 23%)");
        expect(css).toContain("--var-table-background: hsla(240, 3%, 11%)");
    });
});
