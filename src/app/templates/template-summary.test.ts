import { describe, expect, it } from "vitest";
import { getTemplatePreview, getTemplateStorageLabel, getTemplateVariables } from "./template-summary";

describe("template summary helpers", () => {
    it("extracts unique template variables with usage counts", () => {
        expect(getTemplateVariables("# {{TITLE}}\nHello {{ name }} {{TITLE}} {{due-date}}")).toStrictEqual([
            { name: "DUE-DATE", count: 1 },
            { name: "NAME", count: 1 },
            { name: "TITLE", count: 2 },
        ]);
    });

    it("builds a readable markdown preview", () => {
        expect(
            getTemplatePreview("# Weekly Review\n\nCapture [wins](https://example.com), `next steps`, and blockers."),
        ).toBe("Weekly Review Capture wins, next steps, and blockers.");
    });

    it("uses a stable empty preview", () => {
        expect(getTemplatePreview("```js\nreturn DATE\n```\n")).toBe("No preview content yet.");
    });

    it("labels file-backed and in-app templates", () => {
        expect(getTemplateStorageLabel("/Users/me/.templates/weekly.md")).toBe("weekly.md");
        expect(getTemplateStorageLabel(null)).toBe("Saved in writeme");
    });
});
