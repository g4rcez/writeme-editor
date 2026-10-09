import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createMermaidThemeVariables, cssVarToken } from "./mermaid-theme";

const mermaidThemeVariables = createMermaidThemeVariables(cssVarToken);

describe("createMermaidThemeVariables", () => {
    it("uses a darker high-contrast token pair for flowchart nodes", () => {
        expect(mermaidThemeVariables.nodeBkg).toBe("var(--var-color-primary-subtle)");
        expect(mermaidThemeVariables.nodeTextColor).toBe("var(--var-color-foreground)");
        expect(mermaidThemeVariables.primaryColor).toBe("var(--var-color-primary-subtle)");
        expect(mermaidThemeVariables.primaryTextColor).toBe("var(--var-color-foreground)");
        expect(mermaidThemeVariables.nodeBorder).toBe("var(--var-color-primary)");
    });

    it("uses foreground/background tokens for diagram lines and labels", () => {
        expect(mermaidThemeVariables.lineColor).toBe("var(--var-color-foreground)");
        expect(mermaidThemeVariables.defaultLinkColor).toBe("var(--var-color-foreground)");
        expect(mermaidThemeVariables.edgeLabelBackground).toBe("var(--var-color-background)");
        expect(mermaidThemeVariables.textColor).toBe("var(--var-color-foreground)");
    });

    it("reads complete theme colors for Mermaid", () => {
        document.documentElement.style.setProperty("--var-color-primary-subtle", "hsla(258, 100%, 18%)");
        document.documentElement.style.setProperty("--var-color-foreground", "hsla(131, 20%, 80%)");

        const variables = createMermaidThemeVariables();

        expect(variables.nodeBkg).toBe("hsla(258, 100%, 18%)");
        expect(variables.nodeTextColor).toBe("hsla(131, 20%, 80%)");
    });

    it("keeps Mermaid CSS overrides token-backed", () => {
        const css = readFileSync(resolve(__dirname, "../../styles/mermaid.css"), "utf8");

        expect(css).toContain("var(--var-color-foreground)");
        expect(css).not.toMatch(/hsl\(\d/);
        expect(css).not.toMatch(/#[0-9a-f]{3,8}/i);
    });
});
