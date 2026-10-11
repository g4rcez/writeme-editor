import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { describe, expect, test } from "bun:test";
import { parseToolRequest, toolOutputSchemas, toolSchemas, type ToolRequest } from "../src/api.js";
import { ReaderError, type SavedNote, type WorkspaceSnapshot } from "../src/contracts.js";
import { errorCodeSchema, toToolError, toolErrorSchema } from "../src/errors.js";
import { createServer } from "../src/server.js";
import { readTool } from "../src/tools/read.js";

function fixture(): WorkspaceSnapshot {
    const note: SavedNote = {
        id: "note-id",
        ref: "workspace:note.md",
        path: "note.md",
        root: "workspace",
        title: "Note",
        noteType: "markdown",
        tags: [],
        favorite: false,
        project: "",
        createdAt: null,
        updatedAt: null,
        metadata: {},
        content: "# Heading\n\nSaved body",
        source: "filesystem",
        revision: "content-revision",
    };
    return {
        observedAt: "2026-10-11T00:00:00Z",
        profile: "production",
        dataDir: "/fixture",
        workspace: "/fixture/notes",
        roots: [{ kind: "workspace", path: "/fixture/notes" }],
        storageMode: "filesystem",
        notes: [note],
        settings: {},
        collections: { projects: [], noteGroups: [], noteGroupMembers: [], views: [], tabs: [] },
        capabilities: {},
        complete: true,
        warnings: [],
    };
}
function reader(snapshot = fixture()) {
    return { snapshot: async (): Promise<WorkspaceSnapshot> => snapshot, close: (): void => {} };
}
function refFromRequest(request: ToolRequest): string | undefined {
    if (request.name === "get_note") return request.args.ref;
    if (request.name === "search_notes") return request.args.query;
    return undefined;
}

describe("public API schema and error regression", () => {
    test("schema-derived requests narrow and preserve filename whitespace", () => {
        const request = parseToolRequest("get_note", { ref: "workspace: note .md" });
        expect(refFromRequest(request)).toBe("workspace: note .md");
        expect(toolSchemas.get_note.safeParse({ ref: "x", format: "section" }).success).toBe(false);
        expect(
            toolSchemas.get_note.safeParse({ ref: "x", format: "section", section: "Heading" }).success,
        ).toBe(true);
    });

    test("all note response variants require their representation fields and full summary", async () => {
        const snapshot = fixture();
        const note = snapshot.notes[0];
        if (!note) throw new Error("Fixture note missing");
        const cases = [
            { format: "metadata", required: "title" },
            { format: "metadata_json", required: "content" },
            { format: "content", required: "content" },
            { format: "outline", required: "outline" },
            { format: "section", required: "section" },
            { format: "excalidraw", required: "elements" },
        ];
        for (const entry of cases) {
            note.content =
                entry.format === "excalidraw"
                    ? '```json\n{"elements":[],"appState":{},"files":{}}\n```'
                    : "# Heading\n\nSaved body";
            const result = await readTool(reader(snapshot), "get_note", {
                ref: note.ref,
                format: entry.format,
                ...(entry.format === "section" ? { section: "Heading" } : {}),
            });
            expect(toolOutputSchemas.get_note.safeParse(result).success).toBe(true);
            expect(result.responseFormat).toBe(entry.format);
            const missing = { ...result };
            delete missing[entry.required];
            expect(toolOutputSchemas.get_note.safeParse(missing).success).toBe(false);
            if (entry.format !== "metadata_json") {
                const missingSummary = { ...result };
                delete missingSummary.favorite;
                expect(toolOutputSchemas.get_note.safeParse(missingSummary).success).toBe(false);
            }
        }
        const rawDrawing = await readTool(reader(snapshot), "get_note", {
            ref: note.ref,
            format: "excalidraw",
            raw: true,
        });
        expect(toolOutputSchemas.get_note.parse(rawDrawing).responseFormat).toBe("content");
        expect(
            toolOutputSchemas.get_note.safeParse({ ...rawDrawing, responseFormat: "unknown" }).success,
        ).toBe(false);
    });

    test("generic and unknown domain errors redact internal detail", () => {
        for (const error of [
            new Error("SECRET supplied value"),
            new ReaderError("UNKNOWN_INTERNAL", "SECRET internal detail"),
            "SECRET",
        ]) {
            const result = toToolError(error);
            expect(result.error.code).toBe("READ_FAILED");
            expect(result.error.retryable).toBe(false);
            expect(JSON.stringify(result)).not.toContain("SECRET");
            expect(toolErrorSchema.safeParse(result).success).toBe(true);
        }
    });

    test("known domain error codes are stable and only database busy is retryable", () => {
        for (const code of errorCodeSchema.options) {
            const result = toToolError(new ReaderError(code, "Known failure"));
            expect(result.error.code).toBe(code);
            expect(result.error.retryable).toBe(code === "DATABASE_BUSY");
            expect(result.contractVersion).toBe("1.0");
        }
    });

    test("schema error details contain paths/codes without supplied values", () => {
        const parsed = toolSchemas.list_notes.safeParse({
            favorite: "SECRET favorite",
            offset: "SECRET offset",
        });
        if (parsed.success) throw new Error("Expected invalid input");
        const result = toToolError(parsed.error);
        expect(result.error.code).toBe("INVALID_ARGUMENT");
        expect(result.error.details?.issues).toContainEqual({ path: ["favorite"], code: "invalid_type" });
        expect(JSON.stringify(result)).not.toContain("SECRET");
    });

    test("missing backing file metadata supports nullable revision", async () => {
        const snapshot = fixture();
        const note = snapshot.notes[0];
        if (!note) throw new Error("Fixture note missing");
        note.content = null;
        note.revision = null;
        note.error = "Saved backing file unavailable";
        snapshot.complete = false;
        const result = toolOutputSchemas.get_note.parse(
            await readTool(reader(snapshot), "get_note", { ref: note.ref }),
        );
        expect(result.responseFormat).toBe("metadata");
        expect(result.revision).toBeNull();
        expect(result.complete).toBe(false);
    });

    test("long structural titles remain strings while nested metadata reports truncation", async () => {
        const snapshot = fixture();
        const note = snapshot.notes[0];
        if (!note) throw new Error("Fixture note missing");
        note.title = "Title".repeat(5000);
        note.metadata.longText = "x".repeat(20000);
        const result = toolOutputSchemas.get_note.parse(
            await readTool(reader(snapshot), "get_note", { ref: note.ref }),
        );
        expect(result.title).toBe(note.title);
        expect(typeof result.title).toBe("string");
        expect(result.complete).toBe(false);
        expect(result.truncated).toBe(true);
        expect(result.metadata).toMatchObject({ longText: { totalCharacters: 20000, truncated: true } });
    });

    test("real MCP client receives structured invalid response without corrupt saved payload", async () => {
        const snapshot = fixture();
        snapshot.collections.projects = [{ title: "SECRET invalid project" }];
        const server = createServer(reader(snapshot));
        const client = new Client({ name: "contract-regression", version: "1" });
        const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
        await server.connect(serverTransport);
        await client.connect(clientTransport);
        try {
            const result = await client.callTool({ name: "list_projects", arguments: {} });
            expect(result.isError).toBe(true);
            const envelope = toolErrorSchema.parse(result.structuredContent);
            expect(envelope.error).toEqual({
                code: "INVALID_RESPONSE",
                message: "Saved collection records require a string ID",
                retryable: false,
            });
            expect(JSON.stringify(result)).not.toContain("SECRET");
        } finally {
            await client.close();
            await server.close();
        }
    });
});
