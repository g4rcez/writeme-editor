import { describe, expect, it } from "vitest";
import { appendNoteSnapshot, NOTE_HISTORY_LIMIT, type NoteSnapshot } from "./note-history";

const snapshot = (id: string, content: string, createdAt: string): NoteSnapshot => ({
    id,
    noteId: "note-1",
    content,
    createdAt: new Date(createdAt),
});

describe("note history", () => {
    it("deduplicates identical consecutive content", () => {
        const existing = [snapshot("first", "same", "2026-01-02T00:00:00.000Z")];

        const next = appendNoteSnapshot(existing, "note-1", "same", new Date("2026-01-03T00:00:00.000Z"));

        expect(next).toEqual(existing);
    });

    it("keeps the newest bounded history", () => {
        let history: NoteSnapshot[] = [];
        for (let index = 0; index < NOTE_HISTORY_LIMIT + 1; index += 1) {
            history = appendNoteSnapshot(history, "note-1", `content-${index}`, new Date(Date.UTC(2026, 0, index + 1)));
        }

        expect(history).toHaveLength(NOTE_HISTORY_LIMIT);
        expect(history[0]?.content).toBe(`content-${NOTE_HISTORY_LIMIT}`);
        expect(history.at(-1)?.content).toBe("content-1");
    });
});
