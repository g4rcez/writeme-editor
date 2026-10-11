import { createHash } from "node:crypto";
import { posix } from "node:path";
import { CONTRACT_VERSION, parseToolRequest, type ToolArgs, type ToolName } from "../api.js";
export { toolSchemas, type ToolName } from "../api.js";
import {
    ReaderError,
    type JsonValue,
    type Row,
    type SavedNote,
    type WorkspaceReader,
    type WorkspaceSnapshot,
} from "../contracts.js";
import {
    noteLinks,
    outline,
    parseDrawing,
    parseCommentThreads,
    safeValue,
    sanitizedJson,
    stripAssets,
} from "../documents.js";

type ResponseState = { complete: boolean; truncated: boolean };
type Paging = Pick<ToolArgs<"get_status">, "offset" | "limit">;
type PageContext = { paging: Paging; response: ResponseState };

function page<T>(
    items: T[],
    context: PageContext,
): { items: T[]; total: number; offset: number; nextOffset: number | null; complete: boolean } {
    const offset = context.paging.offset;
    const end = offset + context.paging.limit;
    if (end < items.length) context.response.complete = false;
    return {
        items: items.slice(offset, end),
        total: items.length,
        offset,
        nextOffset: end < items.length ? end : null,
        complete: end >= items.length,
    };
}
function mappedPage<T, R>(
    items: T[],
    context: PageContext,
    convert: (item: T) => R,
): ReturnType<typeof page<R>> {
    const selected = page(items, context);
    return { ...selected, items: selected.items.map(convert) };
}
function safe(value: JsonValue, context: PageContext): JsonValue {
    return safeValue(value, 0, context.response);
}
function safeRecord(row: Row, context: PageContext): Row {
    const payload = safe(row, context);
    if (
        typeof row.id !== "string" ||
        payload === null ||
        Array.isArray(payload) ||
        typeof payload !== "object"
    ) {
        throw new ReaderError("INVALID_RESPONSE", "Saved collection records require a string ID");
    }
    return { ...payload, id: row.id };
}
function metadata(note: SavedNote, context: PageContext): Record<string, unknown> {
    const { content: _content, metadata: payload, ...rest } = note;
    const sanitized = safe(payload, context);
    if (sanitized === null || Array.isArray(sanitized) || typeof sanitized !== "object")
        throw new ReaderError("INVALID_RESPONSE", "Saved metadata must be an object");
    return { ...rest, metadata: sanitized };
}
function findNote(snapshot: WorkspaceSnapshot, reference: string): SavedNote {
    const note = snapshot.notes.find((entry) => entry.ref === reference || entry.id === reference);
    if (!note)
        throw new ReaderError(
            "NOT_FOUND",
            "No saved note matches this UUID or root-prefixed ref in the selected workspace",
        );
    return note;
}
function chunk(content: string, args: ToolArgs<"get_note">, context: PageContext): Record<string, unknown> {
    const offset = args.contentOffset;
    const end = offset + args.contentLimit;
    if (end < content.length) context.response.complete = false;
    return {
        text: content.slice(offset, end),
        totalCharacters: content.length,
        offset,
        nextOffset: end < content.length ? end : null,
        complete: end >= content.length,
    };
}
function capabilities(snapshot: WorkspaceSnapshot): Record<string, boolean> {
    return {
        ...snapshot.capabilities,
        activeTab: false,
        selection: false,
        unsaved: false,
        splits: false,
        savedStateOnly: true,
        readOnly: true,
    };
}
function noteResult(
    note: SavedNote,
    args: ToolArgs<"get_note">,
    context: PageContext,
): Record<string, unknown> {
    if (args.format === "metadata_json")
        return {
            ref: note.ref,
            responseFormat: "metadata_json",
            revision: note.revision,
            content: chunk(sanitizedJson(note.metadata), args, context),
        };
    const base = metadata(note, context);
    if (args.format === "metadata") return { ...base, responseFormat: "metadata" };
    if (note.content === null)
        throw new ReaderError("CONTENT_UNAVAILABLE", note.error ?? "Saved content unavailable");
    const content = args.raw ? note.content : stripAssets(note.content);
    if (args.format === "outline")
        return { ...base, responseFormat: "outline", outline: page(outline(content), context) };
    if (args.format === "section") {
        if (!args.section)
            throw new ReaderError("INVALID_ARGUMENT", "section is required for section format");
        const candidates = outline(content).filter((entry) => entry.text === args.section);
        if (candidates.length > 1)
            throw new ReaderError(
                "AMBIGUOUS_SECTION",
                `Multiple headings named ${args.section}; use outline offsets and content pagination to address a specific section`,
            );
        const heading = candidates[0];
        if (!heading) throw new ReaderError("NOT_FOUND", "Section not found");
        return {
            ...base,
            responseFormat: "section",
            section: heading,
            content: chunk(content.slice(heading.offset, heading.end), args, context),
        };
    }
    if (args.format === "excalidraw" && !args.raw) {
        let document: JsonValue;
        try {
            document = parseDrawing(note.content);
        } catch {
            throw new ReaderError("INVALID_DOCUMENT", "Saved drawing is not valid JSON");
        }
        if (!document || Array.isArray(document) || typeof document !== "object")
            throw new ReaderError("INVALID_DOCUMENT", "Saved drawing must be an object");
        const { elements, files, ...properties } = document;
        return {
            ...base,
            responseFormat: "excalidraw",
            document: safe(properties, context),
            elements: mappedPage(Array.isArray(elements) ? elements : [], context, (entry) =>
                safe(entry, context),
            ),
            embeddedFilesOmitted: files !== undefined,
        };
    }
    return {
        ...base,
        responseFormat: "content",
        raw: args.raw,
        sanitized: !args.raw,
        content: chunk(content, args, context),
    };
}

export async function readTool(
    reader: WorkspaceReader,
    name: ToolName,
    input: unknown,
): Promise<Record<string, unknown>> {
    const request = parseToolRequest(name, input);
    const context: PageContext = { paging: request.args, response: { complete: true, truncated: false } };
    const snapshot = stableSnapshot(await reader.snapshot());
    const snapshotRevision = createHash("sha256")
        .update(
            JSON.stringify({
                profile: snapshot.profile,
                workspace: snapshot.workspace,
                roots: snapshot.roots,
                storageMode: snapshot.storageMode,
                notes: snapshot.notes,
                settings: snapshot.settings,
                collections: snapshot.collections,
                capabilities: snapshot.capabilities,
                complete: snapshot.complete,
                warnings: snapshot.warnings,
            }),
        )
        .digest("hex");
    if (request.args.expectedRevision !== undefined && request.args.expectedRevision !== snapshotRevision) {
        throw new ReaderError(
            "REVISION_MISMATCH",
            "The saved snapshot changed. Restart pagination with the new snapshotRevision.",
        );
    }
    const collectionForTool: Partial<Record<ToolName, string>> = {
        get_settings: "settings",
        list_projects: "projects",
        list_groups: "noteGroups",
        get_group: "noteGroups",
        list_views: "views",
        get_view: "views",
        list_tabs: "tabs",
    };
    const collection = collectionForTool[name];
    if (collection && snapshot.capabilities[collection] === false)
        throw new ReaderError("UNAVAILABLE", `Saved ${collection} collection is unavailable in this profile`);
    if (name === "get_group" && snapshot.capabilities.noteGroupMembers === false)
        throw new ReaderError("UNAVAILABLE", "Saved group membership is unavailable in this profile");
    let result: Record<string, unknown>;
    switch (request.name) {
        case "get_status":
            result = {
                profile: snapshot.profile,
                storageMode: snapshot.storageMode,
                capabilities: capabilities(snapshot),
                warnings: page(snapshot.warnings, context),
            };
            break;
        case "get_workspace":
            result = {
                workspace: snapshot.workspace,
                storageMode: snapshot.storageMode,
                roots: page(snapshot.roots, context),
                capabilities: capabilities(snapshot),
                noteCount: snapshot.notes.length,
            };
            break;
        case "list_notes":
        case "search_notes":
        case "list_templates": {
            const args = request.args;
            const query = args.query?.toLocaleLowerCase();
            const notes = snapshot.notes.filter(
                (note) =>
                    (name !== "list_templates" ||
                        note.root === "templates" ||
                        note.noteType === "template") &&
                    (!query ||
                        `${note.title}\n${stripAssets(note.content ?? "")}`
                            .toLocaleLowerCase()
                            .includes(query)) &&
                    (!args.folder ||
                        (note.path ?? "")
                            .replaceAll("\\", "/")
                            .startsWith(`${args.folder.replace(/\/$/, "")}/`)) &&
                    (!args.tag || note.tags.includes(args.tag)) &&
                    (!args.project || note.project === args.project) &&
                    (!args.noteType || note.noteType === args.noteType) &&
                    (args.favorite === undefined || note.favorite === args.favorite),
            );
            result = mappedPage(notes, context, (note) => metadata(note, context));
            break;
        }
        case "get_note":
            result = noteResult(findNote(snapshot, request.args.ref), request.args, context);
            break;
        case "list_tags":
            result = page([...new Set(snapshot.notes.flatMap((note) => note.tags))].sort(), context);
            break;
        case "get_note_links": {
            const note = findNote(snapshot, request.args.ref);
            if (note.content === null)
                throw new ReaderError("CONTENT_UNAVAILABLE", note.error ?? "Saved content unavailable");
            result = {
                ref: note.ref,
                backlinksComplete: snapshot.notes.every((entry) => entry.content !== null),
                outgoing: page(noteLinks(note, snapshot.notes), context),
                backlinks: mappedPage(
                    snapshot.notes.filter((entry) =>
                        noteLinks(entry, snapshot.notes).some((link) => link.ref === note.ref),
                    ),
                    context,
                    (entry) => metadata(entry, context),
                ),
            };
            break;
        }
        case "get_settings":
            result = mappedPage(
                Object.entries(snapshot.settings).sort(([a], [b]) => compare(a, b)),
                context,
                ([key, value]) => ({
                    key,
                    value: safe(value, context),
                    description: settingDescription(key),
                }),
            );
            break;
        case "list_projects":
            result = mappedPage(snapshot.collections.projects, context, (row) => safeRecord(row, context));
            break;
        case "list_groups":
            result = mappedPage(snapshot.collections.noteGroups, context, (row) => safeRecord(row, context));
            break;
        case "list_views":
            result = mappedPage(snapshot.collections.views, context, (row) => safeRecord(row, context));
            break;
        case "list_tabs":
            result = {
                ...mappedPage(
                    [...snapshot.collections.tabs].sort(
                        (a, b) =>
                            Number(a.order ?? 0) - Number(b.order ?? 0) ||
                            compare(String(a.id), String(b.id)),
                    ),
                    context,
                    (row) => safeRecord(row, context),
                ),
                live: false,
            };
            break;
        case "get_group":
        case "get_view": {
            const row = (
                name === "get_group" ? snapshot.collections.noteGroups : snapshot.collections.views
            ).find((entry) => entry.id === request.args.id);
            if (!row) throw new ReaderError("NOT_FOUND", "Saved record not found");
            result = {
                record: safeRecord(row, context),
                ...(name === "get_group"
                    ? {
                          members: mappedPage(
                              snapshot.collections.noteGroupMembers.filter(
                                  (entry) => entry.groupId === request.args.id,
                              ),
                              context,
                              (entry) => safe(entry, context),
                          ),
                      }
                    : {}),
            };
            break;
        }
        case "get_comments": {
            const note = findNote(snapshot, request.args.ref);
            const notePath = (note.path ?? note.title).replaceAll("\\", "/").replace(/\.md$/i, "");
            const target = posix.join(posix.dirname(notePath), `comments_${posix.basename(notePath)}`);
            const companion =
                snapshot.notes.find(
                    (entry) => note.id !== null && entry.metadata.commentSourceId === note.id,
                ) ??
                snapshot.notes.find(
                    (entry) =>
                        !entry.metadata.commentSourceId &&
                        entry.root === note.root &&
                        (entry.path ?? entry.title).replaceAll("\\", "/").replace(/\.md$/i, "") === target,
                );
            if (companion?.content === null)
                throw new ReaderError("CONTENT_UNAVAILABLE", companion.error ?? "Saved comments unavailable");
            result = {
                ref: note.ref,
                companionRef: companion?.ref ?? null,
                ...mappedPage(
                    parseCommentThreads(stripAssets(companion?.content ?? "")).flatMap((thread) =>
                        thread.comments.map((body, index) => ({
                            threadId: thread.id,
                            quote: thread.quote,
                            commentIndex: index,
                            body,
                        })),
                    ),
                    context,
                    (entry) => safe(entry, context),
                ),
            };
            break;
        }
    }
    const nestedIncomplete = context.response.truncated;
    return {
        source: "saved",
        revision: snapshotRevision,
        snapshotRevision,
        contractVersion: CONTRACT_VERSION,
        observedAt: snapshot.observedAt,
        snapshotComplete: snapshot.complete,
        ...result,
        complete:
            snapshot.complete &&
            !nestedIncomplete &&
            context.response.complete &&
            result.backlinksComplete !== false,
        ...(nestedIncomplete
            ? {
                  truncated: true,
                  truncation:
                      "Nested values exceeded response limits; note metadata can be retrieved in full using get_note format metadata_json and content pagination",
              }
            : {}),
    };
}

function settingDescription(key: string): string {
    const descriptions: Record<string, string> = {
        theme: "Saved application color theme",
        fontFamily: "Saved editor font family",
        fontSize: "Saved editor font size",
        language: "Saved application language",
        locale: "Saved locale used for formatting",
    };
    return descriptions[key] ?? `Saved Writeme preference: ${key}`;
}

function compare(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}
function stableSnapshot(snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
    const byId = (a: { id?: JsonValue }, b: { id?: JsonValue }): number =>
        compare(String(a.id ?? ""), String(b.id ?? ""));
    return {
        ...snapshot,
        notes: [...snapshot.notes].sort((a, b) => compare(a.ref, b.ref) || compare(a.id ?? "", b.id ?? "")),
        settings: Object.fromEntries(Object.entries(snapshot.settings).sort(([a], [b]) => compare(a, b))),
        roots: [...snapshot.roots].sort((a, b) => compare(a.kind, b.kind) || compare(a.path, b.path)),
        capabilities: Object.fromEntries(
            Object.entries(snapshot.capabilities).sort(([a], [b]) => compare(a, b)),
        ),
        collections: {
            projects: [...snapshot.collections.projects].sort(byId),
            noteGroups: [...snapshot.collections.noteGroups].sort(byId),
            noteGroupMembers: [...snapshot.collections.noteGroupMembers].sort(byId),
            views: [...snapshot.collections.views].sort(byId),
            tabs: [...snapshot.collections.tabs].sort(byId),
        },
    };
}
