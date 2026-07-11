import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ app: { getPath: () => tmpdir() } }));

import { DatabaseManager } from "./database";

let directory: string;
let manager: DatabaseManager;

beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "writeme-sqlite-"));
    manager = new DatabaseManager(path.join(directory, "test.sqlite"));
});

afterEach(async () => {
    manager?.close();
    await rm(directory, { recursive: true, force: true });
});

describe("DatabaseManager persistence boundary", () => {
    it("uses a real temporary SQLite database and validates collection records", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const saved = manager.save("notes", {
            title: "hello",
            content: "body",
            extra: "private",
        });

        expect(saved.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/);
        expect(manager.get<{ title: string }>("notes", saved.id)?.title).toBe("hello");
        expect(
            manager.db.prepare("SELECT name FROM pragma_table_info('notes') WHERE name = 'extra'").get(),
        ).toBeUndefined();
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("Stripped unknown notes fields: extra"));
        expect(() => manager.save("notes", { title: 1 })).toThrow();
        expect(() => manager.getAll("sqlite_master")).toThrow("Unknown database collection");
        warn.mockRestore();
    });

    it("denies generic deletes that require specialized relational cleanup", () => {
        manager.save("notes", { id: "note", title: "note" });
        manager.save("noteGroups", { id: "group", title: "group" });
        manager.save("noteGroupMembers", {
            id: "member",
            groupId: "group",
            noteId: "note",
        });
        manager.save("aiChats", { id: "chat", noteId: "note" });

        for (const collection of ["notes", "noteGroups", "aiChats"] as const) {
            expect(() => manager.delete(collection, collection)).toThrow(
                `Generic deletion is not allowed for collection: ${collection}`,
            );
        }

        expect(manager.get("notes", "note")).toBeDefined();
        expect(manager.get("noteGroups", "group")).toBeDefined();
        expect(manager.get("aiChats", "chat")).toBeDefined();

        manager.deleteNoteGroup("group");
        expect(manager.get("noteGroups", "group")).toBeUndefined();
        expect(manager.get("noteGroupMembers", "member")).toBeUndefined();

        manager.save("tabs", { id: "tab", noteId: "note" });
        expect(() => manager.delete("tabs", "tab")).not.toThrow();
    });

    it("applies migration conflict rules and matches settings by name", () => {
        manager.save("notes", {
            id: "same",
            title: "sqlite",
            updatedAt: "2026-01-02T00:00:00.000Z",
        });
        manager.save("notes", {
            id: "older",
            title: "sqlite",
            updatedAt: "2026-01-03T00:00:00.000Z",
        });
        manager.save("settings", {
            id: "sqlite-setting",
            name: "theme",
            value: "dark",
            updatedAt: "2026-01-01T00:00:00.000Z",
        });

        const notes = manager.migrateCollection("notes", [
            { id: "missing", title: "dexie", updatedAt: "2026-01-01T00:00:00.000Z" },
            { id: "same", title: "dexie", updatedAt: "2026-01-04T00:00:00.000Z" },
            { id: "older", title: "dexie", updatedAt: "2026-01-02T00:00:00.000Z" },
            { id: "no-time", title: "dexie" },
        ]);
        const settings = manager.migrateCollection("settings", [
            {
                id: "dexie-setting",
                name: "theme",
                value: "light",
                updatedAt: "2026-01-02T00:00:00.000Z",
            },
        ]);

        expect(notes).toEqual({
            found: 4,
            imported: 2,
            updated: 1,
            identical: 0,
            skipped: 1,
        });
        expect(manager.get<{ title: string }>("notes", "same")?.title).toBe("dexie");
        expect(manager.get<{ title: string }>("notes", "older")?.title).toBe("sqlite");
        expect(settings.updated).toBe(1);
        expect(manager.get<{ id: string; value: string }>("settings", "sqlite-setting")).toMatchObject({
            id: "sqlite-setting",
            value: "light",
        });
    });

    it("preserves legacy settings over untimestamped generated defaults", () => {
        manager.save("settings", {
            id: "generated",
            name: "theme",
            value: "system",
        });

        const counts = manager.migrateCollection("settings", [{ id: "legacy", name: "theme", value: "dark" }]);

        expect(counts.updated).toBe(1);
        expect(manager.get<{ id: string; value: string }>("settings", "generated")).toMatchObject({
            id: "generated",
            value: "dark",
        });
    });

    it("independently verifies migrated destination keys and counts", () => {
        manager.save("notes", { id: "present", title: "note" });

        expect(manager.verifyCollection("notes", [{ id: "present" }, { id: "missing" }])).toEqual({
            sourceCount: 2,
            destinationCount: 1,
            matched: 1,
        });
    });
});

describe("recent notes", () => {
    it("filters the workspace before applying the limit", () => {
        manager.save("notes", {
            id: "workspace",
            title: "workspace",
            noteType: "note",
            filePath: "/workspace/note.md",
            updatedAt: "2026-01-01T00:00:00.000Z",
        });
        manager.save("notes", {
            id: "other",
            title: "other",
            noteType: "note",
            filePath: "/workspace-other/newer.md",
            updatedAt: "2026-01-02T00:00:00.000Z",
        });

        expect(manager.getRecentNotes(1, "/workspace").map((note) => note.id)).toEqual(["workspace"]);
    });
});

describe("note deletion", () => {
    it("soft deletes while retaining relationships and history, and closes note tabs", () => {
        manager.save("notes", { id: "note", title: "note" });
        manager.save("tabs", { id: "tab", noteId: "note", type: "note-tab" });
        manager.save("noteGroups", { id: "group", title: "group" });
        manager.save("noteGroupMembers", {
            id: "member",
            groupId: "group",
            noteId: "note",
        });
        manager.save("cursorPositions", {
            id: "cursor",
            noteId: "note",
            y: 2,
            anchor: 1,
        });
        manager.save("aiChats", { id: "chat", noteId: "note", title: "chat" });
        manager.save("aiMessages", {
            id: "message",
            chatId: "chat",
            role: "user",
            content: "keep",
        });

        manager.softDeleteNote("note", "2026-01-01T00:00:00.000Z");

        expect(manager.get("tabs", "tab")).toBeUndefined();
        expect(manager.get("noteGroupMembers", "member")).toBeDefined();
        expect(manager.get("cursorPositions", "cursor")).toBeDefined();
        expect(manager.get("aiChats", "chat")).toBeDefined();
        expect(manager.get("aiMessages", "message")).toBeDefined();
        expect(manager.get("noteGroups", "group")).toBeDefined();
    });

    it("atomically removes note-scoped records but retains workspace chats and groups", () => {
        manager.save("notes", { id: "note", title: "note" });
        manager.save("tabs", { id: "tab", noteId: "note" });
        manager.save("noteGroups", { id: "group", title: "group" });
        manager.save("noteGroupMembers", {
            id: "member",
            groupId: "group",
            noteId: "note",
        });
        manager.save("cursorPositions", { id: "cursor", noteId: "note" });
        manager.save("aiChats", { id: "chat", noteId: "note", title: "chat" });
        manager.save("aiChats", { id: "workspace-chat", title: "workspace" });
        manager.save("aiMessages", {
            id: "message",
            chatId: "chat",
            role: "user",
            content: "secret",
        });
        manager.save("aiMessages", {
            id: "workspace-message",
            chatId: "workspace-chat",
            role: "user",
            content: "keep",
        });

        manager.hardDeleteNote("note");

        for (const [table, id] of [
            ["notes", "note"],
            ["tabs", "tab"],
            ["noteGroupMembers", "member"],
            ["cursorPositions", "cursor"],
            ["aiChats", "chat"],
            ["aiMessages", "message"],
        ] as const) {
            expect(manager.get(table, id)).toBeUndefined();
        }
        expect(manager.get("noteGroups", "group")).toBeDefined();
        expect(manager.get("aiChats", "workspace-chat")).toBeDefined();
        expect(manager.get("aiMessages", "workspace-message")).toBeDefined();
    });
});
