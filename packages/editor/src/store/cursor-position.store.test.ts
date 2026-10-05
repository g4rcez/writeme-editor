import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CursorPosition } from "./repositories/entities/cursor-position";

const { savedRows, cursorPositions } = vi.hoisted(() => {
    const savedRows = new Map<string, CursorPosition>();

    const cursorPositions = {
        put: vi.fn(async (row: CursorPosition) => {
            savedRows.set(row.noteId, row);
        }),
        get: vi.fn(async (noteId: string) => savedRows.get(noteId) ?? null),
        count: vi.fn(async () => savedRows.size),
        toArray: vi.fn(async () => Array.from(savedRows.values())),
        bulkDelete: vi.fn(async (noteIds: string[]) => {
            for (const noteId of noteIds) {
                savedRows.delete(noteId);
            }
        }),
    };

    return { savedRows, cursorPositions };
});

vi.mock("./repositories/browser/dexie-db", () => ({
    db: { cursorPositions },
}));

import { CursorPositionStore } from "./cursor-position.store";

describe("CursorPositionStore", () => {
    let now = 0;
    let dateNowSpy: { mockRestore: () => void };

    beforeEach(() => {
        now = 0;
        savedRows.clear();
        vi.clearAllMocks();
        dateNowSpy = vi.spyOn(Date, "now").mockImplementation(() => {
            now += 1;
            return now;
        });
    });

    afterEach(() => {
        dateNowSpy.mockRestore();
    });

    it("persists cursor positions by note ID in IndexedDB", async () => {
        await CursorPositionStore.save("note-1", 42, 120);

        expect(cursorPositions.put).toHaveBeenCalledWith({
            noteId: "note-1",
            anchor: 42,
            y: 120,
            updatedAt: 1,
        });
    });

    it("loads a saved cursor position from IndexedDB", async () => {
        await CursorPositionStore.save("note-1", 42, 120);

        await expect(CursorPositionStore.get("note-1")).resolves.toStrictEqual({
            noteId: "note-1",
            anchor: 42,
            y: 120,
            updatedAt: 1,
        });
    });

    it("evicts the oldest cursor memory entries after the store limit", async () => {
        for (let index = 0; index < 51; index += 1) {
            await CursorPositionStore.save(`note-${index}`, index, index * 10);
        }

        expect(cursorPositions.bulkDelete).toHaveBeenCalledWith(["note-0"]);
        expect(savedRows.has("note-0")).toBe(false);
        expect(savedRows.size).toBe(50);
    });
});
