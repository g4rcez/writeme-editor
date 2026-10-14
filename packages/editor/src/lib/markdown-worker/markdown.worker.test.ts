import { describe, expect, it } from "vitest";
import { encodeCodeResult } from "@/app/elements/code-block/code-result";
import { processMarkdown, splitIntoChunks } from "./markdown.worker";

describe("processMarkdown", () => {
    it("keeps result comments attached to fences at a worker chunk boundary", () => {
        const marker = "<!-- writeme-code-result:v1:encoded -->";
        const source = `${Array.from({ length: 399 }, () => "paragraph").join("\n")}\n${marker}\n\`\`\`\`javascript\n\`\`\`\n${Array.from({ length: 410 }, () => "inside").join("\n")}\n\`\`\`\`\nend`;
        const chunks = splitIntoChunks(source);
        expect(chunks).toHaveLength(2);
        expect(chunks[0]).toContain(`${marker}\n\`\`\`\`javascript`);
        expect(chunks[0]).toContain("inside\n````");
        expect(chunks[1]).toBe("end");
    });

    it("preserves kept result metadata when parsing large notes in a worker", () => {
        const encoded = encodeCodeResult({
            version: 1,
            executedAt: "2026-10-14T12:30:00.000Z",
            language: "javascript",
            sourceFingerprint: "a".repeat(64),
            stdout: "x".repeat(40_000),
            stderr: "",
        });
        const html = processMarkdown(
            `<!-- writeme-code-result:v1:${encoded} -->\n\`\`\`javascript title="large.js"\n2 + 2\n\`\`\``,
        );
        expect(html).toContain(`data-writeme-execution-result="${encoded}"`);
        expect(html).toContain('data-title="large.js"');
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
