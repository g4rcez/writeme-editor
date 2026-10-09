import { describe, expect, it } from "vitest";
import { catppuccinMochaTheme } from "./catppuccin-mocha";
import { lightTheme } from "./light";
import { createWritemeThemeCss } from "./theme-css";

describe("createWritemeThemeCss", () => {
    it("emits complete canonical tokens for the default theme", () => {
        const css = createWritemeThemeCss("default", lightTheme, "light");

        expect(css).toContain("--var-color-background: hsla(");
        expect(css).toContain("--var-color-primary: hsla(");
        expect(css).toContain("--var-card-background: hsla(");
        expect(css).toContain("--json-bg: hsla(");
        expect(css).not.toContain("--background:");
        expect(css).not.toContain("--primary-DEFAULT:");
    });

    it("keeps custom dark themes class-scoped and includes the dark base tokens", () => {
        const css = createWritemeThemeCss("catppuccin-mocha", catppuccinMochaTheme, "dark");

        expect(css).toContain("html.catppuccin-mocha");
        expect(css).toContain("--var-color-background:");
        expect(css).toContain("--var-color-shadow-table:");
        expect(css).not.toContain("--background:");
    });
});
