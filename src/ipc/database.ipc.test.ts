import { beforeEach, describe, expect, it, vi } from "vitest";

const { handlers, db } = vi.hoisted(() => ({
    handlers: new Map<string, (...args: unknown[]) => unknown>(),
    db: new Proxy(
        {},
        {
            get(target, key) {
                const record = target as Record<PropertyKey, unknown>;
                return (record[key] ??= vi.fn());
            },
        },
    ) as Record<string, ReturnType<typeof vi.fn>>,
}));

vi.mock("electron", () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
            handlers.set(channel, handler);
        }),
    },
}));
vi.mock("../main-process/database", () => ({ dbManager: () => db }));

import { databaseIpcHandler } from "./database.ipc";

beforeEach(() => {
    handlers.clear();
    vi.clearAllMocks();
    databaseIpcHandler();
});

const invoke = (channel: string, ...args: unknown[]) => handlers.get(channel)?.({}, ...args);

describe("specialized database IPC validation", () => {
    it("bounds recent-note limits", () => {
        expect(() => invoke("db:notes:getRecentNotes", 10_001)).toThrow();
        expect(() => invoke("db:notes:getRecentNotes", 0)).toThrow();
        invoke("db:notes:getRecentNotes", 10_000, "/workspace");
        expect(db.getRecentNotes).toHaveBeenCalledWith(10_000, "/workspace");
    });

    it("propagates rejection of dangerous generic deletes", () => {
        const deleteRecord = db.delete!;
        deleteRecord.mockImplementation((table: string) => {
            if (["notes", "noteGroups", "aiChats"].includes(table)) {
                throw new TypeError("specialized cleanup required");
            }
        });

        for (const table of ["notes", "noteGroups", "aiChats"]) {
            expect(() => invoke("db:delete", table, "id")).toThrow("specialized cleanup required");
        }
        invoke("db:delete", "tabs", "id");
        expect(deleteRecord).toHaveBeenCalledWith("tabs", "id");
    });

    it("validates arrays and their members", () => {
        expect(() => invoke("db:tabs:updateOrder", [{ id: "tab", order: 1.5 }])).toThrow();
        expect(() => invoke("db:noteGroupMembers:reorder", [{ id: "", order: 1 }])).toThrow();
        expect(() => invoke("db:hashtags:sync", "note.md", [""])).toThrow();

        invoke("db:tabs:updateOrder", [{ id: "tab", order: 1 }]);
        expect(db.updateTabsOrder).toHaveBeenCalledWith([{ id: "tab", order: 1 }]);
    });

    it("validates dates, strings, and numeric payloads", () => {
        expect(() => invoke("db:notes:softDelete", "note", "not-a-date")).toThrow();
        expect(() => invoke("db:notes:getByFilePath", "")).toThrow();
        expect(() =>
            invoke("db:notes:updateContent", "note", "body", -1, "2026-01-01T00:00:00.000Z", "user"),
        ).toThrow();

        invoke("db:notes:softDelete", "note", "2026-01-01T00:00:00.000Z");
        expect(db.softDeleteNote).toHaveBeenCalledWith("note", "2026-01-01T00:00:00.000Z");
    });
});
