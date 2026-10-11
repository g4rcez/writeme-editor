import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, mkdtemp, open, readdir, realpath, rm, stat } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import {
    ReaderError,
    type CollectionName,
    type JsonValue,
    type ReaderOptions,
    type Row,
    type SavedNote,
    type WorkspaceReader,
    type WorkspaceSnapshot,
} from "./contracts.js";
import { savedMarkdownMetadata } from "./storage/markdown.js";
import { openReadonlyDatabase, type ReadDatabase } from "./storage/sqlite.js";

const MAX_CONTENT_BYTES = 10 * 1024 * 1024;
const collectionNames: CollectionName[] = ["projects", "noteGroups", "noteGroupMembers", "views", "tabs"];
const scalarSettings = new Set([
    "directory",
    "templatesDirectory",
    "quicknotesDirectory",
    "defaultAuthor",
    "meetingOnboardingStatus",
    "autoSyncInterval",
    "conflictResolution",
    "theme",
    "autosave",
    "autosaveDelay",
    "editorMode",
    "rawEditorVimMode",
    "editorFontSize",
    "sidebarWidth",
    "explorerRoot",
    "quickNoteShortcut",
    "mathNoteShortcut",
    "floatingEditorShortcut",
    "mathNoteId",
    "trashRetentionDays",
]);
const nestedSettings: Record<string, string[]> = {
    currency: ["cacheDuration", "preferredAPI"],
    meetingTranscription: ["model", "localSpeaker", "includeSystemAudio"],
};
const inside = (root: string, target: string): boolean => {
    const relative = path.relative(root, target);
    return (
        relative === "" ||
        (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
    );
};
const hidden = (root: string, target: string): boolean =>
    path
        .relative(root, target)
        .split(path.sep)
        .some((part) => part.startsWith("."));
const string = (value: unknown): string => (typeof value === "string" ? value : "");
const revision = (value: string): string => createHash("sha256").update(value).digest("hex");
const canonical = async (target: string): Promise<string | null> => {
    try {
        return await realpath(target);
    } catch {
        return null;
    }
};
async function canonicalMissing(target: string): Promise<string> {
    const resolved = await canonical(target);
    if (resolved) return resolved;
    const parent = path.dirname(target);
    return parent === target ? target : path.join(await canonicalMissing(parent), path.basename(target));
}
const fingerprint = async (target: string): Promise<string> => {
    try {
        const s = await stat(target, { bigint: true });
        return `${s.ino}:${s.size}:${s.mtimeNs}:${s.ctimeNs}`;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return "missing";
        throw error;
    }
};

async function readSavedFile(candidate: string, resolved: string): Promise<string> {
    const handle = await open(resolved, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
        const before = await handle.stat();
        if (!before.isFile() || before.size > MAX_CONTENT_BYTES) throw new Error("Unreadable document");
        if ((await canonical(candidate)) !== resolved) throw new Error("File changed during read");
        const content = await handle.readFile("utf8");
        const after = await handle.stat();
        if (
            before.size !== after.size ||
            before.mtimeMs !== after.mtimeMs ||
            Buffer.byteLength(content) > MAX_CONTENT_BYTES ||
            (await canonical(candidate)) !== resolved
        )
            throw new Error("File changed during read");
        return content;
    } finally {
        await handle.close();
    }
}

async function withDatabase<T>(source: string, run: (database: ReadDatabase) => Promise<T>): Promise<T> {
    if ((await fingerprint(source)) === "missing")
        throw new ReaderError(
            "DATABASE_NOT_FOUND",
            `No saved Writeme database at ${source}. Open the selected editor profile first, or select its existing data directory.`,
        );
    const temporary = await mkdtemp(path.join(tmpdir(), "writeme-mcp-read-"));
    let database: ReadDatabase | undefined;
    try {
        const target = path.join(temporary, "writeme.sqlite");
        let stable = false;
        for (let attempt = 0; attempt < 3; attempt++) {
            const before = await Promise.all([fingerprint(source), fingerprint(`${source}-wal`)]);
            await copyFile(source, target);
            if (before[1] !== "missing") await copyFile(`${source}-wal`, `${target}-wal`);
            else await rm(`${target}-wal`, { force: true });
            const after = await Promise.all([fingerprint(source), fingerprint(`${source}-wal`)]);
            if (JSON.stringify(before) === JSON.stringify(after)) {
                stable = true;
                break;
            }
        }
        if (!stable)
            throw new ReaderError(
                "DATABASE_BUSY",
                "The saved database changed repeatedly during snapshot capture. Retry when editor writes settle.",
            );
        database = await openReadonlyDatabase(target);
        database.exec("PRAGMA query_only = ON");
        return await run(database);
    } catch (error) {
        if (error instanceof ReaderError) throw error;
        throw new ReaderError(
            "DATABASE_READ_FAILED",
            `Cannot read saved Writeme database: ${error instanceof Error ? error.message : String(error)}`,
        );
    } finally {
        database?.close();
        await rm(temporary, { recursive: true, force: true });
    }
}

export function createWorkspaceReader(options: ReaderOptions): WorkspaceReader {
    let closed = false;
    return {
        close: (): void => {
            closed = true;
        },
        snapshot: async (): Promise<WorkspaceSnapshot> => {
            if (closed) throw new ReaderError("READER_CLOSED", "The workspace reader is closed.");
            return withDatabase(path.join(options.dataDir, "writeme.sqlite"), async (db) => {
                const warnings: string[] = [];
                const capabilities: Record<string, boolean> = {
                    viewsProfileScoped: true,
                    noteGroupsProfileScoped: true,
                };
                const tables = new Set(
                    (
                        db.query("SELECT name FROM sqlite_master WHERE type='table'").all() as {
                            name: string;
                        }[]
                    ).map((row) => row.name),
                );
                if (!tables.has("notes"))
                    throw new ReaderError(
                        "INCOMPATIBLE_SCHEMA",
                        "Missing required notes table. Open this profile in a compatible Writeme editor before retrying.",
                    );
                const columns = new Set(
                    (db.query('PRAGMA table_info("notes")').all() as { name: string }[]).map(
                        (row) => row.name,
                    ),
                );
                for (const name of ["id", "content", "filePath", "noteType"])
                    if (!columns.has(name))
                        throw new ReaderError(
                            "INCOMPATIBLE_SCHEMA",
                            `Missing required notes.${name} column. Update/open the editor profile before retrying.`,
                        );
                const rows = (table: string): Row[] => {
                    capabilities[table] = tables.has(table);
                    if (!tables.has(table)) return [];
                    const required: Record<string, string[]> = {
                        settings: ["name", "value"],
                        projects: ["id", "folderPath"],
                        noteGroups: ["id"],
                        noteGroupMembers: ["id", "noteId", "groupId"],
                        views: ["id", "columns", "viewConfig"],
                        tabs: ["id", "noteId", "project"],
                    };
                    const available = new Set(
                        (db.query(`PRAGMA table_info("${table}")`).all() as { name: string }[]).map(
                            (row) => row.name,
                        ),
                    );
                    if (required[table]?.some((column) => !available.has(column))) {
                        capabilities[table] = false;
                        warnings.push(`Optional table ${table} has an incompatible schema.`);
                        return [];
                    }
                    return db.query(`SELECT * FROM "${table}"`).all() as Row[];
                };
                const parse = (
                    value: JsonValue | undefined,
                    fallback: JsonValue,
                    context: string,
                ): JsonValue => {
                    if (value === null || value === undefined || value === "") return fallback;
                    if (typeof value !== "string") return value;
                    try {
                        return JSON.parse(value) as JsonValue;
                    } catch {
                        warnings.push(`Malformed JSON in ${context}.`);
                        return fallback;
                    }
                };
                const settings: Row = {};
                for (const row of rows("settings")) {
                    const name = string(row.name);
                    if (!scalarSettings.has(name) && !nestedSettings[name]) continue;
                    const warningCount = warnings.length;
                    const value = parse(row.value, null, `settings.${name}`);
                    if (
                        name === "directory" &&
                        (warnings.length !== warningCount || (value !== null && typeof value !== "string"))
                    )
                        throw new ReaderError(
                            "INVALID_SETTINGS",
                            "Saved directory is malformed. Repair the workspace setting in the editor or select a valid profile.",
                        );
                    if (scalarSettings.has(name)) {
                        if (value === null || ["string", "number", "boolean"].includes(typeof value))
                            settings[name] = value;
                        else warnings.push(`Invalid scalar setting ${name}.`);
                    } else if (value && typeof value === "object" && !Array.isArray(value)) {
                        settings[name] = Object.fromEntries(
                            nestedSettings[name]!.filter((key) =>
                                ["string", "number", "boolean"].includes(typeof value[key]),
                            ).map((key) => [key, value[key]!]),
                        ) as Row;
                    } else warnings.push(`Invalid nested setting ${name}.`);
                }
                const selected = options.workspace ?? (string(settings.directory) || null);
                const workspace = selected ? await canonical(path.resolve(selected)) : null;
                if (selected && (!workspace || !(await stat(workspace)).isDirectory()))
                    throw new ReaderError(
                        "WORKSPACE_NOT_FOUND",
                        `Cannot resolve workspace directory ${selected}.`,
                    );
                const roots: WorkspaceSnapshot["roots"] = [];
                for (const [kind, candidate] of [
                    ["workspace", workspace],
                    [
                        "templates",
                        string(settings.templatesDirectory) ||
                            path.join(workspace ?? homedir(), ".templates"),
                    ],
                    [
                        "quicknotes",
                        string(settings.quicknotesDirectory) ||
                            (workspace ? path.join(workspace, "quicknotes") : null),
                    ],
                ] as const) {
                    if (!candidate) continue;
                    const resolved = await canonical(candidate);
                    // Default child roots cannot grant access through an escaping symlink.
                    const explicit =
                        kind === "workspace" ||
                        Boolean(
                            settings[kind === "templates" ? "templatesDirectory" : "quicknotesDirectory"],
                        );
                    if (
                        resolved &&
                        (await stat(resolved)).isDirectory() &&
                        (explicit || !workspace || inside(workspace, resolved))
                    )
                        roots.push({ kind, path: resolved });
                }
                roots.sort((a, b) => b.path.length - a.path.length);
                const rootFor = (target: string): (typeof roots)[number] | undefined =>
                    roots.find((root) => inside(root.path, target) && !hidden(root.path, target));
                const notes: SavedNote[] = [];
                const indexed = new Set<string>();
                for (const row of rows("notes")) {
                    const id = string(row.id);
                    if (!id) {
                        warnings.push("Skipped note with invalid ID.");
                        continue;
                    }
                    const rawPath = string(row.filePath);
                    const absolute = rawPath ? path.resolve(workspace ?? options.dataDir, rawPath) : null;
                    if (
                        !absolute &&
                        workspace &&
                        string(row.project) !== selected &&
                        string(row.project) !== workspace
                    )
                        continue;
                    const resolved = absolute ? await canonical(absolute) : null;
                    const missingPath = absolute && !resolved ? await canonicalMissing(absolute) : null;
                    const scope = resolved
                        ? rootFor(resolved)
                        : missingPath
                          ? rootFor(missingPath)
                          : undefined;
                    if (row.deletedAt) {
                        if (resolved) indexed.add(resolved);
                        continue;
                    }
                    if (absolute && !scope) continue;
                    if (resolved) indexed.add(resolved);
                    const metadata = parse(row.metadata, {}, `note ${id} metadata`);
                    const tags = parse(row.tags, [], `note ${id} tags`);
                    if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== "string"))
                        warnings.push(`Invalid tags for note ${id}.`);
                    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
                        warnings.push(`Invalid metadata for note ${id}.`);
                    let content: string | null = string(row.content);
                    let error: string | undefined;
                    if (!absolute && content !== null && Buffer.byteLength(content) > MAX_CONTENT_BYTES) {
                        content = null;
                        error = "Saved content exceeds the 10 MiB read limit.";
                        warnings.push(`Note ${id}: ${error}`);
                    }
                    if (absolute) {
                        try {
                            if (!resolved) throw new Error("missing");
                            content = await readSavedFile(absolute, resolved);
                        } catch {
                            content = null;
                            error = "Backing file is missing, unreadable, or exceeds the 10 MiB read limit.";
                            warnings.push(`Note ${id}: ${error}`);
                        }
                    }
                    notes.push({
                        id,
                        ref: id,
                        path: resolved ?? absolute,
                        root: scope?.kind ?? null,
                        title: string(row.title),
                        noteType: string(row.noteType) || "note",
                        tags: Array.isArray(tags)
                            ? tags.filter((tag): tag is string => typeof tag === "string")
                            : [],
                        favorite: row.favorite === 1 || row.favorite === true,
                        project: string(row.project),
                        createdAt: string(row.createdAt) || null,
                        updatedAt: string(row.updatedAt) || null,
                        metadata:
                            metadata && typeof metadata === "object" && !Array.isArray(metadata)
                                ? metadata
                                : {},
                        content,
                        source: absolute ? "filesystem" : "sqlite",
                        revision: content === null ? null : revision(content),
                        ...(error ? { error } : {}),
                    });
                }
                const seen = new Set<string>();
                const walk = async (directory: string): Promise<void> => {
                    if (seen.has(directory)) return;
                    seen.add(directory);
                    try {
                        for (const entry of await readdir(directory, { withFileTypes: true })) {
                            try {
                                if (entry.name.startsWith(".")) continue;
                                const candidate = path.join(directory, entry.name);
                                const resolved = await canonical(candidate);
                                if (!resolved || !rootFor(resolved)) continue;
                                if (entry.isDirectory()) await walk(resolved);
                                else if (
                                    !indexed.has(resolved) &&
                                    /\.(md|mdx|tex|latex)$/i.test(entry.name) &&
                                    (await stat(resolved)).isFile()
                                ) {
                                    indexed.add(resolved);
                                    const root = rootFor(resolved)!;
                                    const content = await readSavedFile(candidate, resolved);
                                    const parsed = savedMarkdownMetadata(content, (message) =>
                                        warnings.push(`${root.kind}:${entry.name}: ${message}`),
                                    );
                                    notes.push({
                                        id: null,
                                        ref: `${root.kind}:${path.relative(root.path, resolved).split(path.sep).join("/")}`,
                                        path: resolved,
                                        root: root.kind,
                                        title:
                                            parsed.title ?? path.basename(resolved, path.extname(resolved)),
                                        noteType:
                                            parsed.noteType ??
                                            (root.kind === "templates"
                                                ? "template"
                                                : root.kind === "quicknotes"
                                                  ? "quick"
                                                  : /\.(tex|latex)$/i.test(resolved)
                                                    ? "latex"
                                                    : "note"),
                                        tags: parsed.tags,
                                        favorite: false,
                                        project: "",
                                        createdAt: null,
                                        updatedAt: null,
                                        metadata: parsed.metadata,
                                        content,
                                        source: "filesystem",
                                        revision: revision(content),
                                    });
                                }
                            } catch {
                                warnings.push(
                                    `Could not read document ${path.join(directory, entry.name)}; it may be unreadable, changing, or exceed the 10 MiB limit.`,
                                );
                            }
                        }
                    } catch {
                        warnings.push(`Could not completely scan ${directory}.`);
                    }
                };
                for (const root of roots) await walk(root.path);
                for (const note of notes) {
                    if (note.id && note.content !== null && (!note.path || /\.(md|mdx)$/i.test(note.path))) {
                        const parsed = savedMarkdownMetadata(note.content, (message) =>
                            warnings.push(`Note ${note.id}: ${message}`),
                        );
                        note.tags = [...new Set([...note.tags, ...parsed.tags])];
                    }
                }
                const noteIds = new Set(notes.map((note) => note.id));
                const collections = Object.fromEntries(
                    collectionNames.map((name) => [
                        name,
                        rows(name).filter((row) => {
                            if (!string(row.id)) {
                                warnings.push(`Skipped malformed ${name} record.`);
                                return false;
                            }
                            if (name === "tabs")
                                return (
                                    noteIds.has(string(row.noteId)) &&
                                    (row.project === (selected ?? "__local__") ||
                                        row.project === workspace ||
                                        (!options.workspace && !row.project))
                                );
                            if (name === "noteGroupMembers") return noteIds.has(string(row.noteId));
                            return true;
                        }),
                    ]),
                ) as Record<CollectionName, Row[]>;
                if (workspace) {
                    const groupIds = new Set(collections.noteGroupMembers.map((row) => row.groupId));
                    collections.noteGroups = collections.noteGroups.filter((row) => groupIds.has(row.id));
                }
                collections.projects = (
                    await Promise.all(
                        collections.projects.map(async (row) => {
                            if (!workspace) return row;
                            const folder = string(row.folderPath);
                            const resolved = folder ? await canonical(folder) : null;
                            return resolved && inside(workspace, resolved)
                                ? row
                                : notes.some((note) => note.project === row.id)
                                  ? row
                                  : null;
                        }),
                    )
                ).filter((row): row is Row => row !== null);
                for (const row of collections.views)
                    for (const field of ["columns", "viewConfig"])
                        if (row[field])
                            row[field] = parse(
                                row[field],
                                field === "columns" ? [] : {},
                                `view ${string(row.id)} ${field}`,
                            );
                notes.sort((a, b) => a.ref.localeCompare(b.ref));
                return {
                    observedAt: new Date().toISOString(),
                    profile: options.profile,
                    dataDir: path.resolve(options.dataDir),
                    workspace,
                    roots,
                    storageMode: workspace ? "filesystem" : "database",
                    notes,
                    settings,
                    collections,
                    capabilities,
                    complete: warnings.length === 0,
                    warnings,
                };
            });
        },
    };
}
