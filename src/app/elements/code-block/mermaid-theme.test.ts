import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createMermaidThemeVariables, cssVarToken } from "./mermaid-theme";

const mermaidThemeVariables = createMermaidThemeVariables(cssVarToken);

describe("createMermaidThemeVariables", () => {
    it("uses a darker high-contrast token pair for flowchart nodes", () => {
        expect(mermaidThemeVariables.nodeBkg).toBe("hsla(var(--primary-subtle))");
        expect(mermaidThemeVariables.nodeTextColor).toBe("hsla(var(--foreground))");
        expect(mermaidThemeVariables.primaryColor).toBe("hsla(var(--primary-subtle))");
        expect(mermaidThemeVariables.primaryTextColor).toBe("hsla(var(--foreground))");
        expect(mermaidThemeVariables.nodeBorder).toBe("hsla(var(--primary-DEFAULT))");
    });

    it("uses foreground/background tokens for diagram lines and labels", () => {
        expect(mermaidThemeVariables.lineColor).toBe("hsla(var(--foreground))");
        expect(mermaidThemeVariables.defaultLinkColor).toBe("hsla(var(--foreground))");
        expect(mermaidThemeVariables.edgeLabelBackground).toBe("hsla(var(--background))");
        expect(mermaidThemeVariables.textColor).toBe("hsla(var(--foreground))");
    });

    it("resolves theme tokens to concrete HSLA colors for Mermaid color math", () => {
        document.documentElement.style.setProperty("--primary-subtle", "258, 100%, 18%");
        document.documentElement.style.setProperty("--foreground", "131, 20%, 80%");

        const variables = createMermaidThemeVariables();

        expect(variables.nodeBkg).toBe("hsla(258, 100%, 18%)");
        expect(variables.nodeTextColor).toBe("hsla(131, 20%, 80%)");
    });

    it("keeps Mermaid CSS overrides token-backed", () => {
        const css = readFileSync(resolve(__dirname, "../../styles/mermaid.css"), "utf8");

        expect(css).toContain("hsla(var(--foreground))");
        expect(css).not.toMatch(/hsl\(\d/);
        expect(css).not.toMatch(/#[0-9a-f]{3,8}/i);
    });
});
