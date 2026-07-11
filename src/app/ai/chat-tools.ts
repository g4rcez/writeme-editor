import { tool } from "ai";
import { z } from "zod";
import { executeQuery } from "@/lib/views/engine";
import { parse } from "@/lib/views/parser";
import { NoteType } from "@/store/note";
import { repositories } from "@/store/repositories";

type WorkspaceChatToolResult = {
    success: true;
    result: Record<string, unknown>;
};

type ToolExecutionError = {
    success: false;
    message: string;
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

function toSafeNoteSummary(note: {
    id: string;
    title: string;
    updatedAt: Date;
    createdAt: Date;
    tags: string[];
    noteType: NoteType;
    content: string;
}): Record<string, unknown> {
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
        for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
            out[key] = toSerializedValue(nested);
        }
        return out;
    }
    return value;
}

function toQueryRows(rows: Record<string, unknown>[]) {
    return rows.slice(0, MAX_QUERY_RESULTS).map((row) => {
        const transformed: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(row)) {
            transformed[key] = toSerializedValue(value);
        }
        return transformed;
    });
}

function withLimits(limit: number | undefined): number {
    const parsedLimit = Math.trunc(limit ?? MAX_LIST_RESULTS);
    if (Number.isNaN(parsedLimit)) return MAX_LIST_RESULTS;
    if (parsedLimit < MIN_LIMIT) return MIN_LIMIT;
    if (parsedLimit > MAX_LIMIT) return MAX_LIMIT;
    return parsedLimit;
}

function buildListError(error: unknown): ToolExecutionError {
    return {
        success: false,
        message: error instanceof Error ? error.message : "Unexpected error",
    };
}

async function getAllNotesForTool(): Promise<WorkspaceChatToolResult> {
    const notes = await repositories.notes.getAll();
    return {
        success: true,
        result: {
            noteCount: notes.length,
            notes,
        },
    };
}

export function createWorkspaceTools() {
    return {
        listNotes: tool({
            description: "List workspace notes with lightweight metadata and optional filters.",
            inputSchema: z.object({
                query: z.string().optional(),
                noteType: z.nativeEnum(NoteType).optional(),
                tag: z.string().optional(),
                includeContent: z.boolean().default(false),
                limit: z.number().int().min(MIN_LIMIT).max(MAX_LIMIT).default(20),
            }),
            execute: async ({
                query,
                noteType,
                tag,
                includeContent,
                limit,
            }: {
                query?: string;
                noteType?: NoteType;
                tag?: string;
                includeContent: boolean;
                limit: number;
            }): Promise<WorkspaceChatToolResult | ToolExecutionError> => {
                try {
                    const notesResult = await getAllNotesForTool();
                    const allNotes = notesResult.result.notes as Array<{
                        id: string;
                        title: string;
                        updatedAt: Date;
                        createdAt: Date;
                        tags: string[];
                        noteType: NoteType;
                        content: string;
                    }>;

                    const normalized = withLimits(limit);
                    const filtered = allNotes
                        .filter((note) => (noteType ? note.noteType === noteType : true))
                        .filter((note) => (tag ? note.tags.includes(tag) : true))
                        .filter((note) => {
                            if (!query) return true;
                            const needle = query.toLowerCase();
                            return (
                                note.title.toLowerCase().includes(needle) ||
                                note.tags.some((value) => value.toLowerCase().includes(needle)) ||
                                note.content.toLowerCase().includes(needle)
                            );
                        });

                    const safeNotes = filtered.slice(0, normalized).map((note) =>
                        includeContent
                            ? {
                                  ...toSafeNoteSummary(note),
                                  content: truncate(note.content || "", SNIPPET_LENGTH),
                              }
                            : toSafeNoteSummary(note),
                    );

                    return {
                        success: true,
                        result: {
                            totalMatches: filtered.length,
                            returned: safeNotes.length,
                            notes: safeNotes,
                        },
                    };
                } catch (error) {
                    return buildListError(error);
                }
            },
        }),

        readNote: tool({
            description: "Read a workspace note by id.",
            inputSchema: z.object({
                noteId: z.string(),
                includeContent: z.boolean().default(false),
            }),
            execute: async ({ noteId, includeContent }: { noteId: string; includeContent: boolean }) => {
                try {
                    const note = await repositories.notes.getOne(noteId);
                    if (!note) {
                        return {
                            success: false,
                            result: {
                                noteId,
                                found: false,
                                message: "Note not found in current workspace.",
                            },
                        };
                    }

                    const summary = toSafeNoteSummary(note);
                    return {
                        success: true,
                        result: {
                            note: {
                                ...summary,
                                content: includeContent ? truncate(note.content || "", SNIPPET_LENGTH * 3) : undefined,
                                filePath: note.filePath,
                            },
                        },
                    };
                } catch (error) {
                    return buildListError(error);
                }
            },
        }),

        searchNotes: tool({
            description: "Search notes by title, tags, or content. Returns concise metadata plus optional excerpt.",
            inputSchema: z.object({
                query: z.string().min(1),
                includeContent: z.boolean().default(false),
                limit: z.number().int().min(MIN_LIMIT).max(MAX_LIMIT).default(20),
            }),
            execute: async ({
                query,
                includeContent,
                limit,
            }: {
                query: string;
                includeContent: boolean;
                limit: number;
            }) => {
                try {
                    const notesResult = await getAllNotesForTool();
                    const allNotes = notesResult.result.notes as Array<{
                        id: string;
                        title: string;
                        updatedAt: Date;
                        createdAt: Date;
                        tags: string[];
                        noteType: NoteType;
                        content: string;
                    }>;
                    const normalized = withLimits(limit);
                    const needle = query.toLowerCase();
                    const matches = allNotes.filter(
                        (note) =>
                            note.title.toLowerCase().includes(needle) ||
                            note.tags.some((value) => value.toLowerCase().includes(needle)) ||
                            note.content.toLowerCase().includes(needle),
                    );

                    const items = matches.slice(0, normalized).map((note) =>
                        includeContent
                            ? {
                                  ...toSafeNoteSummary(note),
                                  content: truncate(note.content || "", SNIPPET_LENGTH),
                              }
                            : toSafeNoteSummary(note),
                    );

                    return {
                        success: true,
                        result: {
                            query,
                            totalMatches: matches.length,
                            returned: items.length,
                            notes: items,
                        },
                    };
                } catch (error) {
                    return buildListError(error);
                }
            },
        }),

        runNotesQuery: tool({
            description:
                "Run a read-only notes view query. Supports filtering, sorting, and projection with existing syntax.",
            inputSchema: z.object({
                query: z.string().min(1),
                limit: z.number().int().min(MIN_LIMIT).max(MAX_LIMIT).default(50),
            }),
            execute: async ({
                query,
                limit,
            }: {
                query: string;
                limit: number;
            }): Promise<WorkspaceChatToolResult | ToolExecutionError> => {
                try {
                    const parsed = parse(query);
                    const targetTable = parsed.from ?? "notes";
                    if (targetTable !== "notes") {
                        return {
                            success: false,
                            message: "Only `notes` dataset is currently supported.",
                        };
                    }
                    if (parsed.joins.some((join) => join.table !== "notes")) {
                        return {
                            success: false,
                            message: "Joins are currently supported only for the notes dataset and notes aliases.",
                        };
                    }

                    const baseNotesResult = await getAllNotesForTool();
                    const queryRows = executeQuery(parsed, {
                        notes: baseNotesResult.result.notes as Array<{
                            id: string;
                            title: string;
                            createdAt: Date;
                            updatedAt: Date;
                        }> as Record<string, unknown>[],
                    });
                    const normalizedRows = toQueryRows(queryRows);
                    const limited = normalizedRows.slice(0, withLimits(limit));

                    return {
                        success: true,
                        result: {
                            query,
                            totalRows: normalizedRows.length,
                            rows: limited,
                            limit: withLimits(limit),
                            rowCount: limited.length,
                        },
                    };
                } catch (error) {
                    if (error instanceof Error) {
                        return {
                            success: false,
                            message: error.message,
                        };
                    }
                    return buildListError(error);
                }
            },
        }),
    };
}

export type WorkspaceTools = ReturnType<typeof createWorkspaceTools>;

export const workspaceToolsPromptNote = [
    "You can use listNotes, readNote, searchNotes, and runNotesQuery.",
    "Call tools before giving recommendations when user asks for filters or charts.",
].join("\n");
