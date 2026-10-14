import { describe, expect, it } from "vitest";
import { Note } from "@/store/note";
import { findCompatibleNote, findCompatibleNotes } from "./note-lookup";

function createNote(title: string, filePath: string, metadata = {}) {
    return Note.parse({
        id: filePath,
        title,
        filePath,
        metadata,
    });
}

describe("findCompatibleNote", () => {
    it("prefers an explicit note ID over another note with the same display title", () => {
        const wrong = Note.parse({ id: "wrong", title: "Shared" });
        const chosen = Note.parse({ id: "chosen", title: "Shared" });
        expect(findCompatibleNote([wrong, chosen], { id: chosen.id, label: "Shared", path: "/note/chosen" })).toBe(
            chosen,
        );
        const shadow = Note.parse({ id: "shadow", title: chosen.id });
        expect(findCompatibleNotes([shadow, chosen], chosen.id)).toEqual([chosen]);
        expect(findCompatibleNotes([shadow, chosen], "/note/chosen")).toEqual([chosen]);
    });
    it("normalizes vault-root and Windows separators without losing qualified-path precedence", () => {
        const root = createNote("Note", "/vault/Note.md");
        const folder = createNote("Note", "/vault/Folder/Note.md");
        expect(findCompatibleNotes([root, folder], "Folder\\Note.md")).toEqual([folder]);
        expect(findCompatibleNotes([createNote("Folder/New", "")], "/Folder/New.md")).toHaveLength(1);
    });
    it("prefers folder-qualified paths before basename fallbacks", () => {
        const rootNote = createNote("Note", "/vault/Note.md");
        const folderNote = createNote("Note", "/vault/Folder/Note.md");

        expect(findCompatibleNote([rootNote, folderNote], "Folder/Note")?.filePath).toBe("/vault/Folder/Note.md");
    });

    it("resolves Obsidian aliases from frontmatter metadata", () => {
        const note = createNote("Canonical", "/vault/Canonical.md", {
            aliases: ["Alias One"],
        });

        expect(findCompatibleNote([note], "Alias One")?.title).toBe("Canonical");
    });
});
