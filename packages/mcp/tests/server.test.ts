import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { describe, expect, test } from "bun:test";
import type { SavedNote, WorkspaceSnapshot } from "../src/contracts.js";
import { createServer } from "../src/server.js";
import { readTool, toolSchemas } from "../src/tools/read.js";

function fixture(): WorkspaceSnapshot {
    const note: SavedNote = {
        id: "11111111-1111-4111-8111-111111111111",
        ref: "workspace:a.md",
        path: "a.md",
        root: "workspace",
        title: "A",
        noteType: "markdown",
        tags: ["one"],
        favorite: false,
        project: "p",
        createdAt: null,
        updatedAt: null,
        metadata: {},
        content: "# Hello\n\n![image](data:image/png;base64,SECRET)\n\n## Child\nSaved text",
        source: "filesystem",
        revision: "r1",
    };
    return {
        observedAt: "2026-10-11T00:00:00Z",
        profile: "production",
        dataDir: "/fixture",
        workspace: "w",
        roots: [{ kind: "workspace", path: "/fixture/notes" }],
        storageMode: "filesystem",
        notes: [
            note,
            {
                ...note,
                id: "comments",
                ref: "workspace:comments_a.md",
                path: "comments_a.md",
                content: "## one\n\n> A sentence\n\n- Comment\n",
            },
        ],
        settings: { theme: "dark" },
        collections: {
            projects: [{ id: "p" }],
            noteGroups: [{ id: "g" }],
            noteGroupMembers: [{ id: "m", groupId: "g", noteId: note.id }],
            views: [{ id: "v" }],
            tabs: [{ id: "t", noteId: note.id }],
        },
        capabilities: { activeTab: true },
        complete: true,
        warnings: [],
    };
}
function reader(snapshot = fixture()) {
    return { snapshot: async () => snapshot, close: () => {} };
}
describe("saved workspace tools", () => {
    test("user metadata does not control response completeness", async () => {
        const snapshot = fixture();
        snapshot.notes[0]!.metadata = { complete: false, truncated: true };
        const result = await readTool(reader(snapshot), "get_note", { ref: "workspace:a.md" });
        expect(result.complete).toBe(true);
        expect(result).not.toHaveProperty("truncated");
        expect(result.metadata).toEqual({ complete: false, truncated: true });
    });
    test("metadata outside the requested page does not mark returned items truncated", async () => {
        const snapshot = fixture();
        snapshot.notes[0]!.metadata = { long: "x".repeat(17000) };
        const result = await readTool(reader(snapshot), "list_notes", { offset: 1, limit: 1 });
        expect(result.complete).toBe(true);
        expect(result).not.toHaveProperty("truncated");
    });
    test("deep metadata omission is explicit and metadata pagination still omits assets", async () => {
        const snapshot = fixture();
        let nested: import("../src/contracts.js").JsonValue = "deep text";
        for (let i = 0; i < 15; i++) nested = { nested };
        snapshot.notes[0]!.metadata = { nested, base64: "BINARY", files: { binary: "BINARY" } };
        expect(await readTool(reader(snapshot), "get_note", { ref: "workspace:a.md" })).toMatchObject({
            complete: false,
            truncated: true,
        });
        const result = await readTool(reader(snapshot), "get_note", {
            ref: "workspace:a.md",
            format: "metadata_json",
        });
        expect(result.complete).toBe(true);
        expect(JSON.stringify(result)).not.toContain("BINARY");
        expect(JSON.stringify(result)).toContain("deep text");
    });
    test("missing membership table does not claim an empty complete group", async () => {
        const snapshot = fixture();
        snapshot.capabilities.noteGroupMembers = false;
        await expect(readTool(reader(snapshot), "get_group", { id: "g" })).rejects.toMatchObject({
            code: "UNAVAILABLE",
        });
    });
    test("every read tool dispatches with saved provenance", async () => {
        for (const name of Object.keys(toolSchemas) as (keyof typeof toolSchemas)[]) {
            const inputs: Partial<Record<keyof typeof toolSchemas, Record<string, unknown>>> = {
                get_note: { ref: "workspace:a.md" },
                get_note_links: { ref: "workspace:a.md" },
                get_comments: { ref: "workspace:a.md" },
                get_group: { id: "g" },
                get_view: { id: "v" },
                search_notes: { query: "Saved" },
            };
            const result = await readTool(reader(), name, inputs[name] ?? {});
            expect(result.observedAt).toBe("2026-10-11T00:00:00Z");
            expect(result.snapshotComplete).toBe(true);
        }
    });
    test("metadata excludes content, sanitized and raw chunks preserve their contracts", async () => {
        expect(await readTool(reader(), "get_note", { ref: "workspace:a.md" })).not.toHaveProperty("content");
        const clean = await readTool(reader(), "get_note", { ref: "workspace:a.md", format: "content" });
        expect(JSON.stringify(clean)).not.toContain("SECRET");
        const raw = await readTool(reader(), "get_note", {
            ref: "workspace:a.md",
            format: "content",
            raw: true,
            contentLimit: 8,
        });
        expect(raw.content).toMatchObject({ text: "# Hello\n", nextOffset: 8, complete: false });
        const rest = await readTool(reader(), "get_note", {
            ref: "workspace:a.md",
            format: "content",
            raw: true,
            contentOffset: 8,
        });
        expect((raw.content as { text: string }).text + (rest.content as { text: string }).text).toBe(
            fixture().notes[0]!.content!,
        );
    });
    test("pagination filters, section and comments", async () => {
        expect(await readTool(reader(), "list_notes", { limit: 1 })).toMatchObject({
            total: 2,
            nextOffset: 1,
            complete: false,
        });
        expect(await readTool(reader(), "search_notes", { query: "Saved" })).toMatchObject({ total: 1 });
        expect(
            await readTool(reader(), "get_note", {
                ref: "workspace:a.md",
                format: "section",
                section: "Child",
            }),
        ).toMatchObject({ content: { text: "## Child\nSaved text" } });
        expect(await readTool(reader(), "get_comments", { ref: "workspace:a.md" })).toMatchObject({
            companionRef: "workspace:comments_a.md",
            items: [{ threadId: "one", body: "Comment" }],
        });
        expect(await readTool(reader(), "get_status", {})).toMatchObject({
            capabilities: { activeTab: false, selection: false, unsaved: false, splits: false },
        });
    });
    test("invalid refs and bounds rejected", async () => {
        await expect(readTool(reader(), "get_note", { ref: "../../etc/passwd" })).rejects.toThrow(
            "No saved note",
        );
        await expect(readTool(reader(), "list_notes", { limit: 201 })).rejects.toThrow();
    });
    test("drawing elements paginated and embedded assets omitted", async () => {
        const snapshot = fixture();
        snapshot.notes[0]!.content =
            "---\ntype: excalidraw\n---\n\n```json\n" +
            JSON.stringify({
                elements: [{ id: 1 }, { id: 2 }],
                files: { blob: "SECRET" },
                appState: { zoom: 1 },
            }) +
            "\n```\n";
        const result = await readTool(reader(snapshot), "get_note", {
            ref: "workspace:a.md",
            format: "excalidraw",
            limit: 1,
        });
        expect(result).toMatchObject({ embeddedFilesOmitted: true, elements: { total: 2, nextOffset: 1 } });
        expect(JSON.stringify(result)).not.toContain("SECRET");
    });
    test("saved collection availability, sorted tabs and paged warnings", async () => {
        const snapshot = fixture();
        snapshot.capabilities.views = false;
        snapshot.collections.tabs = [
            { id: "second", order: 2 },
            { id: "first", order: 1 },
        ];
        snapshot.warnings = ["one", "two"];
        await expect(readTool(reader(snapshot), "list_views", {})).rejects.toThrow("unavailable");
        expect(await readTool(reader(snapshot), "list_tabs", {})).toMatchObject({
            items: [{ id: "first" }, { id: "second" }],
        });
        expect(await readTool(reader(snapshot), "get_status", { offset: 1, limit: 1 })).toMatchObject({
            warnings: { items: ["two"] },
        });
        expect(await readTool(reader(snapshot), "get_settings", {})).toMatchObject({
            items: [{ description: "Saved application color theme" }],
        });
    });
    test("renamed companion ownership, folders, duplicate sections and missing content", async () => {
        const snapshot = fixture();
        snapshot.notes[1]!.path = "old_name.md";
        snapshot.notes[1]!.metadata.commentSourceId = snapshot.notes[0]!.id;
        expect(await readTool(reader(snapshot), "get_comments", { ref: "workspace:a.md" })).toMatchObject({
            total: 1,
        });
        snapshot.notes[0]!.path = "folder/a.md";
        expect(await readTool(reader(snapshot), "list_notes", { folder: "folder" })).toMatchObject({
            total: 1,
        });
        snapshot.notes[0]!.content = "# Same\n\n# Same\n";
        await expect(
            readTool(reader(snapshot), "get_note", {
                ref: "workspace:a.md",
                format: "section",
                section: "Same",
            }),
        ).rejects.toThrow("Multiple headings");
        snapshot.notes[0]!.content = null;
        await expect(readTool(reader(snapshot), "get_note_links", { ref: "workspace:a.md" })).rejects.toThrow(
            "unavailable",
        );
    });
    test("nested metadata truncation is explicit and metadata JSON is retrievable", async () => {
        const snapshot = fixture();
        snapshot.notes[0]!.metadata.values = Array.from({ length: 220 }, (_, index) => index);
        expect(await readTool(reader(snapshot), "get_note", { ref: "workspace:a.md" })).toMatchObject({
            complete: false,
            truncated: true,
        });
        const complete = await readTool(reader(snapshot), "get_note", {
            ref: "workspace:a.md",
            format: "metadata_json",
        });
        expect(JSON.parse((complete.content as { text: string }).text).values).toHaveLength(220);
    });
    test("real MCP initialize, tools, resource reads and structured errors", async () => {
        const server = createServer(reader());
        const client = new Client({ name: "test", version: "1" });
        const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
        await server.connect(serverTransport);
        await client.connect(clientTransport);
        try {
            const listed = await client.listTools();
            expect(listed.tools).toHaveLength(16);
            expect(listed.tools.every((tool) => tool.annotations?.readOnlyHint)).toBe(true);
            const status = await client.callTool({ name: "get_status", arguments: {} });
            expect(status.isError).not.toBe(true);
            const error = await client.callTool({
                name: "get_note",
                arguments: { ref: "workspace:missing.md" },
            });
            expect(error.isError).toBe(true);
            expect(error.structuredContent).toMatchObject({ error: { code: "NOT_FOUND" } });
            const resource = await client.readResource({ uri: "writeme://notes/workspace%3Aa.md" });
            expect(JSON.stringify(resource)).toContain("Saved text");
            expect(JSON.stringify(resource)).not.toContain("SECRET");
            expect((await client.readResource({ uri: "writeme://workspace" })).contents).toHaveLength(1);
        } finally {
            await client.close();
            await server.close();
        }
    });
});
