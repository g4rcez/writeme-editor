import { describe, expect, it } from "vitest";
import { normalizeMarkdownPaste } from "./normalize-markdown";

describe("normalizeMarkdownPaste", () => {
    it("restores escaped Markdown syntax and decodes escaped HTML entities", () => {
        const input = [
            "\\## Heading",
            "",
            "This is \\*\\*bold\\*\\* text.",
            "",
            "\\- first",
            "2\\. second",
            "",
            "&gt; quote",
            "&gt; **quoted**&gt;&gt; - item",
            "",
            "\\---",
            "",
            "\\\\",
            "\\### Next heading",
        ].join("\n");

        expect(normalizeMarkdownPaste(input)).toBe(
            [
                "## Heading",
                "",
                "This is **bold** text.",
                "",
                "- first",
                "2. second",
                "",
                "> quote",
                "> **quoted**",
                ">",
                "> - item",
                "",
                "---",
                "",
                "",
                "### Next heading",
            ].join("\n"),
        );
    });

    it("collapses duplicated LaTeX slashes without touching Markdown escapes", () => {
        const input = "\\## Math\n\n$Y \\\\subseteq X \\\\iff Y = X$";

        expect(normalizeMarkdownPaste(input)).toBe("## Math\n\n$Y \\subseteq X \\iff Y = X$");
    });

    it("keeps the contents of fenced code literal", () => {
        const input = ["\\```ts", "\\# not a heading", "\\*\\*not bold\\*\\*", "\\```"].join("\n");

        expect(normalizeMarkdownPaste(input)).toBe(
            ["```ts", "\\# not a heading", "\\*\\*not bold\\*\\*", "```"].join("\n"),
        );
    });

    it("keeps ordinary Markdown escapes unchanged", () => {
        const input = "Literal \\*asterisks\\* and \\# a hash";

        expect(normalizeMarkdownPaste(input)).toBe(input);
    });
});
