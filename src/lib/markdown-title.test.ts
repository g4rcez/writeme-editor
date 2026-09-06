import { describe, expect, it } from "vitest";
import { findFirstMarkdownH1, replaceFirstMarkdownH1 } from "./markdown-title";

describe("markdown title", () => {
    it("uses the first non-empty line only when it is an H1", () => {
        expect(findFirstMarkdownH1("\n# Project *notes* #\n\nBody")).toEqual({
            title: "Project notes",
            lineIndex: 1,
        });
        expect(findFirstMarkdownH1("Body\n# Not a title")).toBeNull();
        expect(findFirstMarkdownH1("\n## Section")).toBeNull();
    });

    it("replaces the first H1 while preserving the document newline style", () => {
        expect(replaceFirstMarkdownH1("\r\n# Old\r\nBody", "New")).toBe("\r\n# New\r\nBody");
        expect(replaceFirstMarkdownH1("Body\n# Old", "New")).toBeNull();
    });
});
