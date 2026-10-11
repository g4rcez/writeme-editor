import { Client, ProtocolError, ProtocolErrorCode } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
    contractWorkspace,
    drawingContent,
    latexContent,
    mainContent,
    type ContractFixture,
} from "./fixtures/contract-workspace";

const runtime = process.env.MCP_RUNTIME ?? process.execPath;
const runtimeName = path.basename(runtime).replace(/\.exe$/i, "");
const runtimeArgs =
    runtimeName === "deno"
        ? ["run", "--node-modules-dir=manual", "--allow-read", "--allow-write", "--allow-env", "--allow-sys"]
        : [];
const stdioCwd = process.env.MCP_STDIO_CWD ?? path.resolve(import.meta.dir, "..");
const stdioEntry =
    process.env.MCP_STDIO_ENTRY ??
    path.join(stdioCwd, process.env.MCP_RUNTIME ? "dist/index.js" : "src/index.ts");

type JsonObject = Record<string, unknown>;
type Manifest = {
    contractVersion: string;
    tools: Record<
        string,
        {
            inputSchema: JsonObject;
            outputSchema: JsonObject;
            annotations: JsonObject;
        }
    >;
    resources: { workspace: string; note: string };
    errorSchema: JsonObject;
};
const machineSchema = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(machineSchema);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
        Object.entries(value)
            .filter(([key]) => !["description", "title", "examples", "$comment"].includes(key))
            .map(([key, entry]) => [
                key,
                ["properties", "$defs", "definitions", "patternProperties", "dependentSchemas"].includes(
                    key,
                ) &&
                entry &&
                typeof entry === "object"
                    ? Object.fromEntries(
                          Object.entries(entry).map(([property, schema]) => [
                              property,
                              machineSchema(schema),
                          ]),
                      )
                    : ["default", "const", "enum"].includes(key)
                      ? entry
                      : machineSchema(entry),
            ]),
    );
};
const withoutObservation = (value: JsonObject): JsonObject => {
    const { observedAt: _observedAt, ...rest } = value;
    return rest;
};
const items = (result: JsonObject): JsonObject[] => result.items as JsonObject[];

async function session(fixture: ContractFixture): Promise<{
    client: Client;
    call: (name: string, args?: JsonObject, error?: string) => Promise<JsonObject>;
    manifest: Manifest;
}> {
    // This checked-in file is intentionally never generated or updated by this test.
    const manifest = JSON.parse(
        await readFile(path.resolve(import.meta.dir, "../contract/v1.json"), "utf8"),
    ) as Manifest;
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats(ajv);
    const client = new Client({
        name: "writeme-independent-contract",
        version: "1.0.0",
    });
    await client.connect(
        new StdioClientTransport({
            command: runtime,
            cwd: stdioCwd,
            args: [...runtimeArgs, stdioEntry, "--data-dir", fixture.directory],
        }),
    );
    const validate = (schema: JsonObject, data: unknown): void => {
        const validator = ajv.compile(schema);
        if (!validator(data))
            throw new Error(
                `Contract schema mismatch: ${JSON.stringify(validator.errors)}\n${JSON.stringify(data)}`,
            );
    };
    const call = async (name: string, args: JsonObject = {}, error?: string): Promise<JsonObject> => {
        expect(ajv.compile(manifest.tools[name]!.inputSchema)(args)).toBe(error !== "INVALID_ARGUMENT");
        const response = await client.callTool({ name, arguments: args });
        const content = response.content as { type: string; text?: string }[];
        expect(content).toHaveLength(1);
        expect(content[0]?.type).toBe("text");
        const json = JSON.parse(content[0]!.text!) as JsonObject;
        expect(json).toEqual(response.structuredContent as JsonObject);
        expect(json.contractVersion).toBe("1.0");
        if (error) {
            expect(response.isError).toBe(true);
            expect(json.error).toMatchObject({ code: error, retryable: false });
            validate(manifest.errorSchema, json);
        } else {
            expect(response.isError ?? false).toBe(false);
            expect(typeof json.snapshotRevision).toBe("string");
            expect(String(json.snapshotRevision).length).toBeGreaterThan(0);
            validate(manifest.tools[name]!.outputSchema, json);
            if (name === "get_note")
                expect(json.responseFormat).toBe(
                    args.raw && args.format === "excalidraw" ? "content" : (args.format ?? "metadata"),
                );
        }
        return json;
    };
    return { client, call, manifest };
}

for (const filesystem of [false, true]) {
    const mode = filesystem ? "filesystem" : "SQLite";
    test(`v1 independent schemas and real stdio all-tool content contract (${mode})`, async () => {
        const fixture = await contractWorkspace(filesystem);
        let client: Client | undefined;
        try {
            const before = await fixture.hashes();
            const connected = await session(fixture);
            client = connected.client;
            const { call: read, manifest } = connected;
            let unchangedSnapshot: unknown;
            const call = async (name: string, args: JsonObject = {}): Promise<JsonObject> => {
                const result = await read(name, args);
                unchangedSnapshot ??= result.snapshotRevision;
                expect(result.snapshotRevision).toBe(unchangedSnapshot);
                return result;
            };
            const advertised = await client.listTools();
            expect(advertised.tools.map((tool) => tool.name).sort()).toEqual(
                Object.keys(manifest.tools).sort(),
            );
            expect(advertised.tools).toHaveLength(16);
            for (const tool of advertised.tools) {
                const baseline = manifest.tools[tool.name]!;
                expect(machineSchema(tool.inputSchema)).toEqual(machineSchema(baseline.inputSchema));
                expect(machineSchema(tool.outputSchema)).toEqual(machineSchema(baseline.outputSchema));
                expect(machineSchema(tool.annotations)).toEqual(machineSchema(baseline.annotations));
            }
            const status = await call("get_status");
            expect(status.storageMode).toBe(filesystem ? "filesystem" : "database");
            expect(status.capabilities).toMatchObject({
                readOnly: true,
                savedStateOnly: true,
                unsaved: false,
                selection: false,
                splits: false,
                activeTab: false,
            });
            const workspace = await call("get_workspace");
            const snapshotRevision = workspace.snapshotRevision;
            expect(status.snapshotRevision).toBe(snapshotRevision);
            const notes = await call("list_notes", {
                expectedRevision: snapshotRevision,
            });
            const refs = items(notes).map((note) => String(note.ref));
            expect(refs).toEqual([...refs].sort((a, b) => a.localeCompare(b)));
            expect(withoutObservation(await call("list_notes"))).toEqual(withoutObservation(notes));
            expect(items(await call("list_notes", { favorite: true }))).toHaveLength(1);
            expect(items(await call("list_notes", { project: "project-one" }))).toHaveLength(7);
            expect(items(await call("list_notes", { noteType: "meeting-note" }))).toHaveLength(1);
            expect(
                items(
                    await call("search_notes", {
                        query: "canonical body",
                        tag: "contract",
                    }),
                ).map((note) => note.id),
            ).toEqual(["main"]);
            const metadata = await call("get_note", { ref: "main" });
            expect(metadata).toMatchObject({
                id: "main",
                title: "Contract",
                favorite: true,
                metadata: { author: "Contract author" },
            });
            expect(metadata).not.toHaveProperty("content");
            expect(metadata.snapshotRevision).toBe(snapshotRevision);
            const raw = await call("get_note", {
                ref: "main",
                format: "content",
                raw: true,
            });
            expect(raw.content).toMatchObject({
                text: mainContent,
                complete: true,
            });
            const sanitized = await call("get_note", {
                ref: "main",
                format: "content",
            });
            expect(JSON.stringify(sanitized)).not.toContain("PRIVATE_ASSET");
            expect(JSON.stringify(sanitized)).toContain("[embedded asset omitted]");
            expect(JSON.stringify(sanitized)).not.toContain("STALE_DATABASE_COPY");
            const outline = await call("get_note", {
                ref: "main",
                format: "outline",
            });
            expect(items(outline.outline as JsonObject).map((entry) => entry.text)).toEqual([
                "Contract",
                "Detail",
            ]);
            expect(
                (
                    await call("get_note", {
                        ref: "main",
                        format: "section",
                        section: "Detail",
                        raw: true,
                    })
                ).content,
            ).toMatchObject({
                text: mainContent.slice(mainContent.indexOf("## Detail")),
            });
            const metadataJson = await call("get_note", {
                ref: "main",
                format: "metadata_json",
            });
            expect(JSON.parse((metadataJson.content as { text: string }).text)).toEqual({
                author: "Contract author",
            });
            const drawing = await call("get_note", {
                ref: "drawing",
                format: "excalidraw",
            });
            expect(drawing.embeddedFilesOmitted).toBe(true);
            expect(items(drawing.elements as JsonObject)).toEqual([{ id: "shape-one", type: "rectangle" }]);
            expect(JSON.stringify(drawing)).not.toContain("PRIVATE_DRAWING");
            expect(
                (
                    await call("get_note", {
                        ref: "drawing",
                        format: "excalidraw",
                        raw: true,
                    })
                ).content,
            ).toMatchObject({ text: drawingContent });
            expect(
                (
                    await call("get_note", {
                        ref: "latex",
                        format: "content",
                        raw: true,
                    })
                ).content,
            ).toMatchObject({ text: latexContent });
            expect((await call("get_note", { ref: "meeting" })).metadata).toMatchObject({
                meetingTranscript: [
                    {
                        speaker: "Speaker 1",
                        text: "Saved transcript",
                        start: 0,
                        end: 1,
                    },
                ],
            });
            expect((await call("list_tags")).items).toEqual(["contract", "saved-tag"]);
            const links = await call("get_note_links", { ref: "main" });
            expect(items(links.outgoing as JsonObject)).toContainEqual({
                href: "./target.md",
                ref: "target",
            });
            const backlinks = await call("get_note_links", { ref: "target" });
            expect(items(backlinks.backlinks as JsonObject).map((note) => note.id)).toContain("main");
            const settings = await call("get_settings");
            expect(items(settings)).toContainEqual(
                expect.objectContaining({ key: "autosave", value: false }),
            );
            expect(JSON.stringify(settings)).not.toContain("PRIVATE_");
            expect(JSON.stringify(settings)).not.toContain("apiKey");
            expect(items(await call("list_projects")).map((project) => project.id)).toEqual(["project-one"]);
            expect(items(await call("list_groups")).map((group) => group.id)).toEqual(["group-one"]);
            expect(items((await call("get_group", { id: "group-one" })).members as JsonObject)).toEqual([
                { id: "member-one", noteId: "main", groupId: "group-one" },
            ]);
            expect(items(await call("list_views")).map((view) => view.id)).toEqual(["view-one"]);
            expect((await call("get_view", { id: "view-one" })).record).toMatchObject({
                id: "view-one",
                columns: ["title", "tags"],
                viewConfig: { filter: { favorite: true } },
            });
            const tabs = await call("list_tabs");
            expect(tabs.live).toBe(false);
            expect(items(tabs).map((tab) => tab.noteId)).toEqual(["main", "target"]);
            expect(items(await call("list_templates")).map((note) => note.id)).toEqual(["template"]);
            expect(items(await call("get_comments", { ref: "main" }))).toEqual([
                {
                    threadId: "detail-thread",
                    quote: "Section body",
                    commentIndex: 0,
                    body: "First saved comment",
                },
                {
                    threadId: "detail-thread",
                    quote: "Section body",
                    commentIndex: 1,
                    body: "Second saved comment",
                },
            ]);
            const resourceList = await client.listResources();
            expect(resourceList.resources.map((resource) => resource.uri)).toContain(
                manifest.resources.workspace,
            );
            const templates = await client.listResourceTemplates();
            expect(templates.resourceTemplates.map((resource) => resource.uriTemplate)).toContain(
                manifest.resources.note,
            );
            const resourceValue = async (uri: string): Promise<JsonObject> => {
                const response = await client!.readResource({ uri });
                const resource = response.contents[0];
                if (!resource || !("text" in resource)) throw new Error("Expected JSON text resource");
                expect(resource.mimeType).toBe("application/json");
                return JSON.parse(resource.text) as JsonObject;
            };
            expect(withoutObservation(await resourceValue(manifest.resources.workspace))).toEqual(
                withoutObservation(workspace),
            );
            expect(withoutObservation(await resourceValue("writeme://notes/main"))).toEqual(
                withoutObservation(sanitized),
            );
            if (filesystem) {
                const encodedRef = "workspace:space # ü.md";
                const encoded = await resourceValue(`writeme://notes/${encodeURIComponent(encodedRef)}`);
                expect(encoded.ref).toBe(encodedRef);
                expect(encoded.content).toMatchObject({
                    text: "# Encoded reference\nDiscovered file.",
                });
            }
            const firstPage = await call("list_notes", { limit: 1 });
            expect(firstPage.complete).toBe(false);
            expect(firstPage.nextOffset).toBe(1);
            const rest = await call("list_notes", {
                offset: 1,
                limit: 200,
                expectedRevision: firstPage.snapshotRevision,
            });
            expect([items(firstPage)[0]!.ref, ...items(rest).map((note) => note.ref)]).toEqual(refs);
            const firstChunk = await call("get_note", {
                ref: "main",
                format: "content",
                raw: true,
                contentLimit: 1,
            });
            const restChunk = await call("get_note", {
                ref: "main",
                format: "content",
                raw: true,
                contentOffset: 1,
                contentLimit: 64000,
                expectedRevision: firstChunk.snapshotRevision,
            });
            expect(
                (firstChunk.content as { text: string }).text + (restChunk.content as { text: string }).text,
            ).toBe(mainContent);
            await client.close();
            expect(await fixture.hashes()).toEqual(before);
        } finally {
            await client?.close();
            await fixture.close();
        }
    }, 30_000);

    test(`v1 failures, strict validation and stale pagination rejection (${mode})`, async () => {
        const fixture = await contractWorkspace(filesystem);
        let client: Client | undefined;
        try {
            const connected = await session(fixture);
            client = connected.client;
            const { call } = connected;
            const before = await fixture.hashes();
            const rejectedProtocol = async (request: () => Promise<unknown>): Promise<ProtocolError> => {
                try {
                    await request();
                } catch (error) {
                    expect(error).toBeInstanceOf(ProtocolError);
                    if (!(error instanceof ProtocolError)) throw error;
                    expect(error).not.toHaveProperty("isError");
                    expect(error.message + JSON.stringify(error.data)).not.toContain("PRIVATE_");
                    return error;
                }
                throw new Error("Expected JSON-RPC exception rather than a tool result");
            };
            const unknownTool = await rejectedProtocol(() =>
                client!.callTool({
                    name: "PRIVATE_UNKNOWN_TOOL",
                    arguments: {},
                }),
            );
            expect(unknownTool.code).toBe(ProtocolErrorCode.InvalidParams);
            expect(unknownTool.data).toBeUndefined();
            const missingResource = await rejectedProtocol(() =>
                client!.readResource({
                    uri: "writeme://notes/PRIVATE_MISSING_RESOURCE",
                }),
            );
            expect(missingResource.code).toBe(ProtocolErrorCode.InternalError);
            expect(missingResource.data).toMatchObject({
                contractVersion: "1.0",
                error: { code: "NOT_FOUND", retryable: false },
            });
            const resourceValidator = new Ajv2020({ strict: false });
            addFormats(resourceValidator);
            expect(resourceValidator.compile(connected.manifest.errorSchema)(missingResource.data)).toBe(
                true,
            );
            await rejectedProtocol(() =>
                client!.readResource({
                    uri: "writeme://notes/%ZZPRIVATE_MALFORMED_REFERENCE",
                }),
            );
            await call("get_note", { ref: "absent" }, "NOT_FOUND");
            await call("get_group", { id: "absent" }, "NOT_FOUND");
            await call("get_view", { id: "absent" }, "NOT_FOUND");
            const invalidInputs: [string, JsonObject][] = [
                ["list_notes", { offset: -1 }],
                ["list_notes", { offset: 0.5 }],
                ["list_notes", { limit: 0 }],
                ["list_notes", { limit: 201 }],
                ["list_notes", { favorite: "PRIVATE_INVALID_VALUE" }],
                ["list_notes", { unexpected: "PRIVATE_UNKNOWN_VALUE" }],
                ["get_note", {}],
                ["get_note", { ref: "" }],
                ["get_note", { ref: "main", format: "PRIVATE_BAD_FORMAT" }],
                ["get_note", { ref: "main", format: "section" }],
                ["get_note", { ref: "main", contentOffset: -1 }],
                ["get_note", { ref: "main", contentLimit: 64001 }],
                ["get_note", { ref: "main", contentLimit: 0 }],
                ["search_notes", { query: "" }],
                ["search_notes", { query: "x".repeat(1001) }],
                ["get_status", { expectedRevision: 123 }],
                ["get_status", { expectedRevision: "" }],
            ];
            for (const [name, input] of invalidInputs) {
                const error = await call(name, input, "INVALID_ARGUMENT");
                expect(JSON.stringify(error)).not.toContain("PRIVATE_");
                if (input.favorite)
                    expect(error.error).toMatchObject({
                        details: {
                            issues: [{ path: ["favorite"], code: "invalid_type" }],
                        },
                    });
            }
            expect(await fixture.hashes()).toEqual(before);
            await call("get_status", { expectedRevision: "unknown-opaque-revision" }, "REVISION_MISMATCH");
            const first = await call("list_notes", { limit: 1 });
            await fixture.mutate();
            const changed = await fixture.hashes();
            for (const [name, args] of Object.entries({
                get_status: {},
                get_workspace: {},
                list_notes: { offset: 1 },
                search_notes: { query: "Saved" },
                get_note: { ref: "main", format: "content", contentOffset: 1 },
                list_tags: {},
                get_note_links: { ref: "main" },
                get_settings: {},
                list_projects: {},
                list_groups: {},
                get_group: { id: "group-one" },
                list_views: {},
                get_view: { id: "view-one" },
                list_tabs: {},
                list_templates: {},
                get_comments: { ref: "main" },
            }))
                await call(name, { ...args, expectedRevision: first.snapshotRevision }, "REVISION_MISMATCH");
            const restarted = await call("list_notes", { limit: 1 });
            expect(restarted.snapshotRevision).not.toBe(first.snapshotRevision);
            await call("list_notes", {
                offset: restarted.nextOffset,
                expectedRevision: restarted.snapshotRevision,
            });
            expect(await fixture.hashes()).toEqual(changed);
            fixture.removeViews();
            const withoutViews = await fixture.hashes();
            await call("list_views", {}, "UNAVAILABLE");
            await call("get_view", { id: "view-one" }, "UNAVAILABLE");
            expect(await fixture.hashes()).toEqual(withoutViews);
        } finally {
            await client?.close();
            await fixture.close();
        }
    }, 30_000);
}
