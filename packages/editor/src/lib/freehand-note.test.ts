import { describe, expect, it } from "vitest";
import {
    buildFreehandNoteContent,
    emptyFreehandNotebook,
    parseFreehandNote,
    replaceFreehandNoteContent,
    strokeIntersects,
    type InkStroke,
} from "./freehand-note";

const stroke: InkStroke = {
    points: [
        [50, 50, 0.2],
        [150, 50, 0.8],
    ],
    color: "#2459c4",
    size: 4,
    tool: "pen",
    simulatePressure: false,
};

describe("handwritten note content", () => {
    it("roundtrips pages, paper, tools and stylus pressure", () => {
        const data = {
            ...emptyFreehandNotebook(),
            pages: [{ strokes: [stroke] }, { strokes: [{ ...stroke, tool: "highlighter" as const }] }],
        };
        expect(parseFreehandNote(buildFreehandNoteContent(data))).toEqual(data);
    });

    it("loads legacy freehand strokes without discarding ink", () => {
        expect(
            parseFreehandNote(JSON.stringify({ strokes: [{ points: [[20, 30, 0.5]], color: "#000000", size: 8 }] })),
        ).toMatchObject({
            paper: "blank",
            pages: [{ strokes: [{ points: [[20, 30, 0.5]], color: "#000000", size: 8 }] }],
        });
    });

    it("keeps surrounding markdown when updating the ink", () => {
        const content = buildFreehandNoteContent() + "\nPersonal metadata\n";
        const next = { ...emptyFreehandNotebook(), paper: "grid" as const };
        const result = replaceFreehandNoteContent(content, next);
        expect(result).toContain("Personal metadata");
        expect(parseFreehandNote(result)).toEqual(next);
    });

    it("rejects malformed ink instead of opening a silently empty canvas", () => {
        for (const content of [
            "broken JSON",
            '{"strokes":[{"points":[]}]}',
            '{"version":1,"paper":"lined","pages":[]}',
        ]) {
            expect(() => parseFreehandNote(content)).toThrow();
        }
    });

    it("erases a stroke crossing between sparse samples and leaves distant ink", () => {
        expect(strokeIntersects(stroke, [100, 20, 0.5], [100, 80, 0.5], 14)).toBe(true);
        expect(strokeIntersects(stroke, [100, 120, 0.5], [150, 120, 0.5], 14)).toBe(false);
        expect(strokeIntersects(stroke, [100, 50, 0.5], [100, 50, 0.5], 14)).toBe(true);
    });
});
