import { describe, expect, test } from "bun:test";
import type { SavedNote } from "../src/contracts.js";
import { noteLinks, outline, parseCommentThreads, safeValue, stripAssets } from "../src/documents.js";

function note(ref: string, path: string, content: string): SavedNote {
    return {
        id: ref,
        ref,
        path,
        root: "workspace",
        title: path,
        noteType: "markdown",
        tags: [],
        favorite: false,
        project: "",
        createdAt: null,
        updatedAt: null,
        metadata: {},
        content,
        source: "filesystem",
        revision: "1",
    };
}
describe("pure saved documents", () => {
    test.each(["C:\\workspace", "\\\\server\\workspace"])(
        "resolves relative links in a Windows workspace at %s",
        (directory) => {
            const source = note("a", `${directory}\\a.md`, "[B](./b.md) [[b]]");
            const target = note("b", `${directory}\\b.md`, "");
            expect(noteLinks(source, [source, target])).toEqual([
                { href: "./b.md", ref: "b" },
                { href: "b", ref: "b" },
            ]);
        },
    );
    test("section offsets preserve CRLF and omit frontmatter headings", () => {
        const text = "---\r\ntitle: Example\r\n---\r\n\r\n# First\r\nBody\r\n\r\n# Last\r\nLast body";
        const headings = outline(text);
        expect(headings.map((heading) => heading.text)).toEqual(["First", "Last"]);
        expect(text.slice(headings[0]!.offset, headings[0]!.end)).toBe("# First\r\nBody\r\n\r\n");
        expect(text.slice(headings[1]!.offset, headings[1]!.end)).toBe("# Last\r\nLast body");
    });
    test("headings exclude fenced code and section ends at next peer", () => {
        const text = "# Top\n\n## Child\n\n```md\n# Fake\n```\n\n# Next\n";
        const headings = outline(text);
        expect(headings.map((entry) => entry.text)).toEqual(["Top", "Child", "Next"]);
        expect(text.slice(headings[0]!.offset, headings[0]!.end)).not.toContain("# Next");
    });
    test("comments merge duplicate IDs and preserve fenced whitespace", () => {
        const result = parseCommentThreads(
            "# Comments\n\n## quote\n\n> Sentence\n\n- first\n\n## quote\n\n> Sentence\n\n- second\n",
        );
        expect(result).toEqual([{ id: "quote", quote: "Sentence", comments: ["first", "second"] }]);
    });
    test("assets omitted and long nested arrays explicitly truncated", () => {
        expect(stripAssets("![pic](data:image/png;base64,SECRET)")).not.toContain("SECRET");
        expect(safeValue({ files: { id: "SECRET" } })).toEqual({ files: "[embedded asset omitted]" });
        expect(safeValue(Array.from({ length: 201 }, () => 1))).toMatchObject({
            total: 201,
            truncated: true,
        });
    });
    test("relative links and wikilinks resolve only scoped notes", () => {
        const source = note(
            "a",
            "folder/a.md",
            "[B](./b.md) [[b]] [outside](../../etc/passwd) `[[ignored]]`",
        );
        expect(noteLinks(source, [source, note("b", "folder/b.md", "")])).toEqual([
            { href: "./b.md", ref: "b" },
            { href: "b", ref: "b" },
            { href: "../../etc/passwd", ref: null },
        ]);
    });
});
