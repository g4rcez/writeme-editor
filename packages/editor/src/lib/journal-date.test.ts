import { describe, expect, it } from "vitest";
import { Dates } from "@/lib/dates";
import { Note, NoteType } from "@/store/note";
import { findDailyQuickNote, getJournalDate, parseJournalDay } from "./journal-date";

describe("journal date", () => {
    it("uses explicit journal dates regardless of creation and subsequent edits", () => {
        const note = Note.new("Retrospective", "Keep this", NoteType.quick);
        note.metadata.journalDate = "2025-12-31";
        note.updatedAt = new Date(2026, 9, 14);
        expect(Dates.isoDate(getJournalDate(note)!)).toBe("2025-12-31");
        expect(findDailyQuickNote([note], new Date(2025, 11, 31))).toBe(note);
        expect(findDailyQuickNote([note], note.updatedAt)).toBeNull();
    });

    it("recognizes daily filenames and uses creation date for legacy custom titles", () => {
        const fileNote = Note.new("Renamed", "", NoteType.quick);
        fileNote.filePath = "/workspace/quicknotes/2024-02-29-quicknote.md";
        expect(Dates.isoDate(getJournalDate(fileNote)!)).toBe("2024-02-29");
        const titled = Note.new("2025-03-04-quicknote.md", "", NoteType.quick);
        expect(Dates.isoDate(getJournalDate(titled)!)).toBe("2025-03-04");
        const legacy = Note.parse({
            title: "My day",
            noteType: NoteType.quick,
            createdAt: new Date(2025, 2, 4),
            updatedAt: new Date(2026, 9, 14),
        });
        expect(Dates.isoDate(getJournalDate(legacy)!)).toBe("2025-03-04");
    });

    it("rejects impossible days and excludes deleted or ordinary notes", () => {
        expect(parseJournalDay("2025-02-29")).toBeNull();
        expect(parseJournalDay("2026-13-01")).toBeNull();
        expect(parseJournalDay("not-a-date")).toBeNull();
        expect(Dates.isoDate(parseJournalDay("2024-02-29")!)).toBe("2024-02-29");
        const deleted = Note.new("2024-02-29-quicknote.md", "", NoteType.quick);
        deleted.deletedAt = new Date();
        expect(
            findDailyQuickNote([deleted, Note.new("2024-02-29-quicknote.md", "")], new Date(2024, 1, 29)),
        ).toBeNull();
    });
});
