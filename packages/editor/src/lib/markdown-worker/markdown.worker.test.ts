import { describe, expect, it } from "vitest";
import { processMarkdown, splitIntoChunks } from "./markdown.worker";

describe("processMarkdown", () => {
    it("keeps multiline footnote definitions together at worker chunk boundaries", () => {
        const definition = "[^source]: First paragraph.\n\n    ## Heading inside definition\n\n" + "    Continuation.\n".repeat(80);
        const markdown = "Context.\n".repeat(390) + "\n" + definition + "\n## Following section\n\nOutside.";
        const chunks = splitIntoChunks(markdown);
        expect(chunks).toHaveLength(2);
        expect(chunks[0]).toContain(definition.trimEnd());
        expect(chunks[1]).toContain("Following section");
        const html = chunks.map(processMarkdown).join("\n");
        expect(html.match(/data-footnote-definition="source"/g)).toHaveLength(1);
        expect(html).toContain("Heading inside definition");
    });
    it("preserves footnote references and formatted multiline definitions in large-document parsing", () => {
        const html = processMarkdown("Body [^source] and again [^source].\n\n[^source]: **Source**\n\n    Second paragraph.");
        expect(html.match(/data-footnote-reference="source"/g)).toHaveLength(2);
        expect(html).toContain('data-footnote-definition="source"');
        expect(html).toContain("<strong>Source</strong>");
        expect(html).toContain("<p>Second paragraph.</p>");
    });
    it("preserves highlighted comment links in large-document parsing", () => {
        const html = processMarkdown("[==Selected sentence==](./comments_advisor.md#selected-sentence) and `==code==`");
        expect(html).toContain('<a href="./comments_advisor.md#selected-sentence"><mark>Selected sentence</mark></a>');
        expect(html).toContain("<code>==code==</code>");
    });
    it("converts a markdown heading to an HTML h1", () => {
        const html = processMarkdown("# Hello");
        expect(html).toContain("<h1");
        expect(html).toContain("Hello");
    });

    it("converts a markdown paragraph to an HTML p", () => {
        const html = processMarkdown("Hello world");
        expect(html).toContain("<p");
        expect(html).toContain("Hello world");
    });

    it("converts a fenced code block", () => {
        const html = processMarkdown("```ts\nconst x = 1;\n```");
        expect(html).toContain("<code");
        expect(html).toContain("const x = 1;");
    });

    it("strips common leading indentation before parsing", () => {
        const html = processMarkdown("  # Indented heading");
        expect(html).toContain("<h1");
    });

    it("renders inline and block LaTeX while importing large documents", () => {
        const html = processMarkdown("Inline $x^2$.\n\n$$\n\\int_0^1 x\\,dx\n$$");

        expect(html).toContain('data-type="inline-math"');
        expect(html).toContain('data-type="block-math"');
        expect(html).toContain('data-latex="x^2"');
        expect(html).toContain('data-latex="\\int_0^1 x\\,dx"');
    });

    it("returns a non-empty string for empty input", () => {
        const html = processMarkdown("");
        expect(typeof html).toBe("string");
    });
});
