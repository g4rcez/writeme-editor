import { describe, expect, it } from "vitest";
import { createNativeThemeCss, nativeTheme } from "./native";
import { createWritemeThemeCss } from "./theme-css";

describe("nativeTheme", () => {
    it("uses OS system colors for native surfaces and text", () => {
        expect(nativeTheme.colors?.background).toBe("Canvas");
        expect(nativeTheme.colors?.foreground).toBe("CanvasText");
        expect(nativeTheme.colors?.card?.background).toBe("Canvas");
        expect(nativeTheme.colors?.border).toBe("color-mix(in srgb, ButtonBorder 84%, Canvas)");
    });

    it("publishes OS system colors and supports both system color schemes", () => {
        const css = createNativeThemeCss();

        expect(css).toContain("--var-color-background: Canvas");
        expect(css).toContain("--var-color-foreground: CanvasText");
        expect(css).toContain("--var-color-border: color-mix(in srgb, ButtonBorder 84%, Canvas)");
        expect(css).toContain("--var-card-border: color-mix(in srgb, ButtonBorder 84%, Canvas)");
        expect(css).toContain("--var-color-primary: var(--native-system-accent, AccentColor)");
        expect(css).toContain("color-scheme: light dark;");
        expect(css).toContain("color-mix(in srgb, var(--native-system-accent, AccentColor) 20%, transparent)");
        expect(css).not.toContain("@media (prefers-color-scheme: light)");
        expect(css).not.toContain("hsla(");

        const themeCss = createWritemeThemeCss("native", nativeTheme, "light");
        expect(themeCss).toContain("--var-color-background: Canvas");
        expect(themeCss).toContain("--var-table-background: Canvas");
    });
});
