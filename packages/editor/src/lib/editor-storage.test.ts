import type { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import type { Note } from "@/store/note";
import { getEditorAllNotes, setEditorAllNotes, setEditorAllNotesSource } from "./editor-storage";

const editor = () => ({ storage: {} }) as unknown as Editor;
const notes = (...ids: string[]) => ids.map((id) => ({ id }) as Note);

describe("editor notes storage", () => {
    it("reads through the live source, so a pane never keeps an outdated copy", () => {
        let current = notes("a");
        const target = editor();
        setEditorAllNotesSource(target, () => current);
        expect(getEditorAllNotes(target)).toBe(current);

        current = notes("a", "b");
        expect(getEditorAllNotes(target)).toBe(current);
    });

    it("prefers the source over a stored snapshot", () => {
        const target = editor();
        setEditorAllNotes(target, notes("old"));
        const live = notes("live");
        setEditorAllNotesSource(target, () => live);
        expect(getEditorAllNotes(target)).toBe(live);
    });

    it("still supports a stored snapshot", () => {
        const target = editor();
        const snapshot = notes("a");
        setEditorAllNotes(target, snapshot);
        expect(getEditorAllNotes(target)).toBe(snapshot);
    });

    it("returns the same empty array every time so identity checks stay valid", () => {
        const target = editor();
        expect(getEditorAllNotes(target)).toBe(getEditorAllNotes(target));
        expect(getEditorAllNotes(target)).toEqual([]);
    });
});
