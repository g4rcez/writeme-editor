import { describe, expect, it } from "vitest";
import { appendNoteSnapshot, type NoteSnapshot } from "./note-history";

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

    it("retains snapshots beyond the former history limit", () => {
        let history: NoteSnapshot[] = [];
        for (let index = 0; index < 75; index += 1) {
            history = appendNoteSnapshot(history, "note-1", `content-${index}`, new Date(Date.UTC(2026, 0, index + 1)));
        }

        expect(history).toHaveLength(75);
        expect(history[0]?.content).toBe("content-74");
        expect(history.at(-1)?.content).toBe("content-0");
    });
});
