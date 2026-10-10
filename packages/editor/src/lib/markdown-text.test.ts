import { describe, expect, it } from "vitest";
import { markdownLineToPlainText } from "./markdown-text";

describe("markdownLineToPlainText", () => {
    it("removes inline Markdown syntax and uses wiki-link aliases", () => {
        expect(markdownLineToPlainText("**Review** `code`, [guide](url), and [[Guide|the guide]]")).toBe(
            "Review code, guide, and the guide",
        );
    });

    it("can include a wiki-link subpath when no alias exists", () => {
        expect(markdownLineToPlainText("[[Guide#Setup]]", { includeWikiSubpath: true })).toBe("Guide#Setup");
        expect(markdownLineToPlainText("[[Guide#Setup]]")).toBe("Guide");
    });

    it("uses link labels for image syntax and collapses whitespace", () => {
        expect(markdownLineToPlainText("![[Image|Portrait]]   ![Diagram](image.png)")).toBe("Portrait Diagram");
    });
});
