import { describe, expect, it } from "vitest";
import { replaceFreehandNoteContent } from "./freehand-note";
import { buildPdfNoteContent, parsePdfNote, type PdfNotebook } from "./pdf-note";

const notebook: PdfNotebook = {
    version: 1,
    paper: "blank",
    pdf: { source: "asset:book", filename: "Book.pdf" },
    pages: [
        { height: 1400, strokes: [] },
        { height: 700, strokes: [] },
    ],
};

describe("PDF notes", () => {
    it("roundtrips a single document with independent portrait and landscape annotation pages", () => {
        expect(parsePdfNote(buildPdfNoteContent(notebook))).toEqual(notebook);
    });

    it("preserves the document reference and PDF type when ink changes", () => {
        const content = buildPdfNoteContent(notebook);
        const updated = {
            ...notebook,
            pages: [
                notebook.pages[0]!,
                {
                    ...notebook.pages[1]!,
                    strokes: [
                        {
                            points: [[20, 30, 0.5] as [number, number, number]],
                            color: "#000000",
                            size: 4,
                            tool: "pen" as const,
                            simulatePressure: false,
                        },
                    ],
                },
            ],
        };
        const saved = replaceFreehandNoteContent(content, updated);
        expect(saved).toMatch(/^---\ntype: pdf\n/);
        expect(parsePdfNote(saved)).toEqual(updated);
        expect(parsePdfNote(saved).pages[0]!.strokes).toEqual([]);
    });

    it("rejects a missing document source and missing page geometry", () => {
        expect(() => parsePdfNote(JSON.stringify({ ...notebook, pdf: {} }))).toThrow();
        expect(() => parsePdfNote(JSON.stringify({ ...notebook, pages: [{ strokes: [] }] }))).toThrow();
        expect(() => parsePdfNote(JSON.stringify({ ...notebook, pages: [{ strokes: [], height: -1 }] }))).toThrow();
    });
});
