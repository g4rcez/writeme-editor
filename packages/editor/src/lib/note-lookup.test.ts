import { describe, expect, it } from "vitest";
import { Note } from "@/store/note";
import { findCompatibleNote } from "./note-lookup";

function createNote(title: string, filePath: string, metadata = {}) {
    return Note.parse({
        id: filePath,
        title,
        filePath,
        metadata,
    });
}

describe("findCompatibleNote", () => {
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
