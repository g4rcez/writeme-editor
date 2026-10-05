import { tool, type ToolSet } from "ai";
import { v7 as uuid } from "uuid";
import { z } from "zod";
import type { AINoteEditProposal, AIWorkspaceActivity, AIWorkspaceData, AIWorkspaceSource } from "@/store/repositories/electron/ai.repository";
import { executeQuery } from "@/lib/views/engine";
import { parse } from "@/lib/views/parser";
import { NoteType, type Note } from "@/store/note";
import { repositories } from "@/store/repositories";

type ToolExecutionError = { success: false; message: string; result?: Record<string, unknown> };
type WorkspaceToolName = AIWorkspaceActivity["toolName"];
type WorkspaceNote = Pick<
    Note,
    "id" | "title" | "updatedAt" | "createdAt" | "tags" | "noteType" | "filePath" | "content"
>;
export type WorkspaceToolSession = {
    tools: ToolSet;
    reset: () => void;
    getWorkspaceData: () => AIWorkspaceData;
};

const MAX_LIST_RESULTS = 60;
const MAX_QUERY_RESULTS = 120;
const MIN_LIMIT = 1;
const MAX_LIMIT = 200;
const SNIPPET_LENGTH = 420;

function truncate(value: string, length: number): string {
    if (value.length <= length) return value;
    return `${value.slice(0, length).trimEnd()}…`;
}

function toSafeDateString(value: Date): string {
    return value.toISOString();
}

function toSafeNoteSummary(note: WorkspaceNote): Record<string, unknown> {
    return {
        id: note.id,
        title: note.title,
        noteType: note.noteType,
        tags: [...note.tags],
        createdAt: toSafeDateString(note.createdAt),
        updatedAt: toSafeDateString(note.updatedAt),
        excerpt: truncate(note.content || "", SNIPPET_LENGTH),
    };
}

function toSerializedValue(value: unknown): unknown {
    if (value instanceof Date) return value.toISOString();
    if (value == null) return null;
    if (Array.isArray(value)) return value.map((item) => toSerializedValue(item));
    if (typeof value === "object") {
        const out: Record<string, unknown> = {};
        for (const [key, nested] of Object.entries(value as Record<string, unknown>)) out[key] = toSerializedValue(nested);
        return out;
    }
    return value;
}

function toQueryRows(rows: Record<string, unknown>[]) {
    return rows.slice(0, MAX_QUERY_RESULTS).map((row) => {
        const transformed: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(row)) transformed[key] = toSerializedValue(value);
        return transformed;
    });
}

function toQueryableNote(note: WorkspaceNote): Omit<WorkspaceNote, "filePath"> {
    const queryNote = { ...note };
    Reflect.deleteProperty(queryNote, "filePath");
    return queryNote;
}

function withLimits(limit: number | undefined): number {
    const parsedLimit = Math.trunc(limit ?? MAX_LIST_RESULTS);
    if (Number.isNaN(parsedLimit)) return MAX_LIST_RESULTS;
    if (parsedLimit < MIN_LIMIT) return MIN_LIMIT;
    if (parsedLimit > MAX_LIMIT) return MAX_LIMIT;
    return parsedLimit;
}

function buildListError(error: unknown): ToolExecutionError {
    return { success: false, message: error instanceof Error ? error.message : "Unexpected error" };
}

function createTools(onChange?: (snapshot: AIWorkspaceData) => void): WorkspaceToolSession {
    const activities: AIWorkspaceActivity[] = [];
    const sources: AIWorkspaceSource[] = [];
    const proposals: AINoteEditProposal[] = [];
    const snapshot = (): AIWorkspaceData => ({
        activities: activities.map((activity) => ({ ...activity })),
        sources: sources.map((source) => ({ ...source })),
        proposals: proposals.map((proposal) => ({ ...proposal })),
    });
    const notify = (): void => onChange?.(snapshot());
    const addSources = (notes: Array<{ id: string; title: string }>): void => {
        const known = new Set(sources.map((source) => source.noteId));
        for (const note of notes) {
            if (known.has(note.id)) continue;
            known.add(note.id);
            sources.push({ noteId: note.id, title: note.title });
        }
    };
    const run = async <T,>(toolName: WorkspaceToolName, label: string, operation: () => Promise<T>): Promise<T | ToolExecutionError> => {
        const activity: AIWorkspaceActivity = { id: uuid(), toolName, label, status: "running" };
        activities.push(activity);
        notify();
        try {
            const result = await operation();
            activity.status = typeof result === "object" && result !== null && "success" in result && result.success === false
                ? "error"
                : "complete";
            notify();
            return result;
        } catch (error) {
            activity.status = "error";
            notify();
            return buildListError(error);
        }
    };
    const getAllNotes = async (): Promise<WorkspaceNote[]> => repositories.notes.getAll();

    const getWorkspaceNote = async (id: string): Promise<WorkspaceNote | null> =>
        (await getAllNotes()).find((note) => note.id === id) ?? null;
    const tools = {
        listNotes: tool({
            description: "List workspace notes with lightweight metadata and optional filters.",
            inputSchema: z.object({
                query: z.string().optional(),
                noteType: z.nativeEnum(NoteType).optional(),
                tag: z.string().optional(),
                includeContent: z.boolean().default(false),
                limit: z.number().int().min(MIN_LIMIT).max(MAX_LIMIT).default(20),
            }),
            execute: async ({ query, noteType, tag, includeContent, limit }: {
                query?: string; noteType?: NoteType; tag?: string; includeContent: boolean; limit: number;
            }) => run("listNotes", "Listed workspace notes", async () => {
                const notes = await getAllNotes();
                const filtered = notes.filter((note) => (noteType ? note.noteType === noteType : true))
                    .filter((note) => (tag ? note.tags.includes(tag) : true))
                    .filter((note) => !query || note.title.toLowerCase().includes(query.toLowerCase()) ||
                        note.tags.some((value) => value.toLowerCase().includes(query.toLowerCase())) ||
                        note.content.toLowerCase().includes(query.toLowerCase()));
                const selected = filtered.slice(0, withLimits(limit));
                addSources(selected);
                return {
                    success: true as const,
                    result: {
                        totalMatches: filtered.length,
                        returned: selected.length,
                        notes: selected.map((note) => includeContent
                            ? { ...toSafeNoteSummary(note), content: truncate(note.content || "", SNIPPET_LENGTH) }
                            : toSafeNoteSummary(note)),
                    },
                };
            }),
        }),
        readNote: tool({
            description: "Read a workspace note by id. includeContent returns the full Markdown and exact updatedAt version.",
            inputSchema: z.object({ noteId: z.string(), includeContent: z.boolean().default(false) }),
            execute: async ({ noteId, includeContent }: { noteId: string; includeContent: boolean }) =>
                run("readNote", "Read a workspace note", async () => {
                    const note = await getWorkspaceNote(noteId);
                    if (!note) return { success: false as const, result: { noteId, found: false, message: "Note not found in current workspace." } };
                    addSources([note]);
                    return {
                        success: true as const,
                        result: {
                            note: {
                                ...toSafeNoteSummary(note),
                                content: includeContent ? note.content || "" : undefined,
                            }
                        },
                    };
                }),
        }),
        searchNotes: tool({
            description: "Search notes by title, tags, or content. Returns concise metadata plus optional excerpt.",
            inputSchema: z.object({ query: z.string().min(1), includeContent: z.boolean().default(false), limit: z.number().int().min(MIN_LIMIT).max(MAX_LIMIT).default(20) }),
            execute: async ({ query, includeContent, limit }: { query: string; includeContent: boolean; limit: number }) =>
                run("searchNotes", "Searched workspace notes", async () => {
                    const needle = query.toLowerCase();
                    const matches = (await getAllNotes()).filter((note) => note.title.toLowerCase().includes(needle) ||
                        note.tags.some((value) => value.toLowerCase().includes(needle)) || note.content.toLowerCase().includes(needle));
                    const selected = matches.slice(0, withLimits(limit));
                    addSources(selected);
                    return {
                        success: true as const, result: {
                            query, totalMatches: matches.length, returned: selected.length,
                            notes: selected.map((note) => includeContent
                                ? { ...toSafeNoteSummary(note), content: truncate(note.content || "", SNIPPET_LENGTH) }
                                : toSafeNoteSummary(note)),
                        }
                    };
                }),
        }),
        runNotesQuery: tool({
            description: "Run a read-only notes view query. Supports filtering, sorting, and projection with existing syntax.",
            inputSchema: z.object({ query: z.string().min(1), limit: z.number().int().min(MIN_LIMIT).max(MAX_LIMIT).default(50) }),
            execute: async ({ query, limit }: { query: string; limit: number }) => run("runNotesQuery", "Queried workspace notes", async () => {
                const parsed = parse(query);
                const targetTable = parsed.from ?? "notes";
                if (targetTable !== "notes") return { success: false as const, message: "Only `notes` dataset is currently supported." };
                if (parsed.joins.some((join) => join.table !== "notes")) {
                    return { success: false as const, message: "Joins are currently supported only for the notes dataset and notes aliases." };
                }
                const notes = await getAllNotes();
                const queryRows = executeQuery(parsed, { notes: notes.map(toQueryableNote) as Record<string, unknown>[] });
                const normalizedRows = toQueryRows(queryRows);
                const limited = normalizedRows.slice(0, withLimits(limit));
                const ids = new Set(limited.map((row) => row.id).filter((id): id is string => typeof id === "string"));
                if (ids.size) addSources(notes.filter((note) => ids.has(note.id)));
                return { success: true as const, result: { query, totalRows: normalizedRows.length, rows: limited, limit: withLimits(limit), rowCount: limited.length } };
            }),
        }),
        proposeNoteEdit: tool({
            description: "Stage a proposal to replace an existing note's full Markdown. Provide updatedAt from a full readNote; never writes the note.",
            inputSchema: z.object({
                noteId: z.string().min(1).max(1_024),
                rationale: z.string().min(1).max(10_000),
                proposedMarkdown: z.string().max(50_000_000),
                updatedAt: z.iso.datetime(),
            }),
            execute: async ({ noteId, rationale, proposedMarkdown, updatedAt }: { noteId: string; rationale: string; proposedMarkdown: string; updatedAt: string }) =>
                run("proposeNoteEdit", "Staged a note edit proposal", async () => {
                    const note = await getWorkspaceNote(noteId);
                    if (!note) return { success: false as const, message: "Note not found in current workspace; no proposal was staged." };
                    const currentUpdatedAt = toSafeDateString(note.updatedAt);
                    if (currentUpdatedAt !== updatedAt) return { success: false as const, message: "Note changed since it was read; read it again before proposing an edit." };
                    if ((note.content || "") === proposedMarkdown) return { success: false as const, message: "The proposed Markdown is unchanged; no proposal was staged." };
                    if (proposals.some((proposal) => proposal.noteId === noteId)) return { success: false as const, message: "A proposal for this note already exists in this tool session." };
                    const proposal: AINoteEditProposal = {
                        id: uuid(), noteId, title: note.title, rationale, baseUpdatedAt: currentUpdatedAt,
                        baseMarkdown: note.content || "", proposedMarkdown, status: "pending", createdAt: new Date().toISOString(),
                    };
                    proposals.push(proposal);
                    addSources([note]);
                    return { success: true as const, result: { proposal: { ...proposal } } };
                }),
        }),
    };

    return {
        tools,
        reset: (): void => { activities.length = 0; sources.length = 0; proposals.length = 0; notify(); },
        getWorkspaceData: snapshot,
    };
}

export function createWorkspaceTools(onChange?: (snapshot: AIWorkspaceData) => void): WorkspaceToolSession {
    return createTools(onChange);
}

export type WorkspaceTools = ToolSet;

export const workspaceToolsPromptNote = [
    "You can use listNotes, readNote, searchNotes, runNotesQuery, and proposeNoteEdit.",
    "Call workspace tools before recommendations about current note contents. For a proposal, first read the full note including content and updatedAt, then submit its exact updatedAt with the full proposed Markdown.",
    "Proposals only stage changes for user review; never claim a note was changed until the user explicitly approves it.",
].join("\n");
