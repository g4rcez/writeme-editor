import { describe, expect, it } from "vitest";
import { createWritingSegments } from "./segments";

describe("writing review segmentation", () => {
    it("splits long prose at the last whitespace before the limit and preserves offsets", () => {
        const text = `${"a".repeat(3_990)} middle ${"b".repeat(20)}`;
        const segments = createWritingSegments([{ text, from: 17, to: 17 + text.length }]);

        expect(segments).toHaveLength(2);
        expect(segments[0]).toMatchObject({ id: "0", from: 17, to: 4_015 });
        expect(segments[1]).toMatchObject({ id: "1", from: 4_015, to: 17 + text.length });
        expect(segments.map((segment) => segment.text).join("")).toBe(text);
        expect(segments.every((segment) => segment.text.length <= 4_000)).toBe(true);
    });

    it("never splits a surrogate pair when a long unbroken range crosses the limit", () => {
        const text = `${"a".repeat(3_999)}😀b`;
        const segments = createWritingSegments([{ text, from: 0, to: text.length }]);

        expect(segments.map((segment) => segment.text)).toEqual(["a".repeat(3_999), "😀b"]);
        expect(segments.map((segment) => segment.text).join("")).toBe(text);
        expect(segments.every((segment) => segment.text.length <= 4_000)).toBe(true);
    });
});
