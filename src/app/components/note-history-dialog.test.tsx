import { describe, expect, it } from "vitest";
import { formatSnapshotDate } from "./note-history-dialog";

const snapshot = {
    id: "snapshot-1",
    noteId: "note-1",
    content: "body",
    createdAt: new Date(2026, 0, 2, 15, 4),
} as const;

describe("note history UI helpers", () => {
    it("formats snapshot dates with the shared date helpers", () => {
        expect(formatSnapshotDate(snapshot)).toBe("2026-01-02 15:04");
    });
});
