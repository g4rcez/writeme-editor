import type { Note } from "@/store/note";
import { executeQuery } from "./views/engine";
import { parse } from "./views/parser";
import { quoteQueryString } from "./views/query-builder";

export type NoteSearchFilters = {
    tags: string[];
    noteType: string;
    location: string;
    updatedAfter: string;
    updatedBefore: string;
};

export const EMPTY_NOTE_SEARCH_FILTERS: NoteSearchFilters = {
    tags: [],
    noteType: "",
    location: "",
    updatedAfter: "",
    updatedBefore: "",
};

export type NoteSearchFolder = { path: string; label: string };

function localDateBoundary(value: string, nextDay = false): string | null {
    if (!value) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) throw new Error("Choose a valid date.");
    const [yearText, monthText, dayText] = value.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const date = new Date(0);
    date.setFullYear(year, month - 1, day);
    date.setHours(0, 0, 0, 0);
    if (
        !Number.isInteger(year) ||
        !Number.isInteger(month) ||
        !Number.isInteger(day) ||
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        throw new Error("Choose a valid date.");
    }
    if (nextDay) {
        date.setDate(date.getDate() + 1);
        date.setHours(0, 0, 0, 0);
    }
    return date.toISOString();
}

export function getNoteSearchFolders(filePaths: readonly (string | null | undefined)[]): NoteSearchFolder[] {
    const folders = new Set<string>();
    for (const filePath of filePaths) {
        if (!filePath) continue;
        const separator = !filePath.startsWith("/") && filePath.includes("\\") ? "\\" : "/";
        const parts = (filePath.startsWith("/") ? filePath.split("/") : filePath.split(/[\\/]/)).filter(Boolean);
        const root = filePath.startsWith("\\\\") ? "\\\\" : filePath.startsWith(separator) ? separator : "";
        let current = root;
        for (const part of parts.slice(0, -1)) {
            current = current
                ? `${current.endsWith(separator) ? current.slice(0, -1) : current}${separator}${part}`
                : /^[A-Za-z]:$/u.test(part)
                  ? `${part}${separator}`
                  : part;
            folders.add(current);
        }
    }
    return Array.from(folders)
        .sort((a, b) => a.localeCompare(b))
        .map((path) => ({ path, label: path }));
}

export function buildNoteSearchFilterQuery(filters: NoteSearchFilters): string {
    const conditions: string[] = [];
    for (const tag of filters.tags) conditions.push(`tags CONTAINS ${quoteQueryString(tag)}`);
    if (filters.noteType) conditions.push(`noteType = ${quoteQueryString(filters.noteType)}`);
    if (filters.location === "local") conditions.push("filePath = null");
    if (filters.location === "filesystem") conditions.push("filePath != null");
    if (filters.location.startsWith("folder:")) {
        const path = filters.location.slice("folder:".length);
        const separator = !path.startsWith("/") && path.includes("\\") ? "\\" : "/";
        const prefix = path.endsWith(separator) ? path : `${path}${separator}`;
        conditions.push(`filePath STARTS_WITH ${quoteQueryString(prefix)}`);
    }

    const start = localDateBoundary(filters.updatedAfter);
    const end = localDateBoundary(filters.updatedBefore, true);
    if (start && end && new Date(start) >= new Date(end))
        throw new Error("The start date must be on or before the end date.");
    if (start) conditions.push(`updatedAt >= ${quoteQueryString(start)}`);
    if (end) conditions.push(`updatedAt < ${quoteQueryString(end)}`);

    return conditions.length === 0 ? "" : `WHERE ${conditions.join(" AND ")}`;
}

export function filterNotesByStructuredFilters<
    T extends Pick<Note, "id" | "tags" | "noteType" | "filePath" | "updatedAt">,
>(notes: readonly T[], filters: NoteSearchFilters): T[] {
    const query = buildNoteSearchFilterQuery(filters);
    if (!query) return [...notes];
    const matchingIds = new Set(
        executeQuery(parse(query), { notes: [...notes] })
            .map((row) => row["notes.id"])
            .filter((id): id is string => typeof id === "string"),
    );
    return notes.filter((note) => matchingIds.has(note.id));
}

export function getActiveNoteSearchFilterCount(filters: NoteSearchFilters): number {
    return (
        filters.tags.length +
        Number(Boolean(filters.noteType)) +
        Number(Boolean(filters.location)) +
        Number(Boolean(filters.updatedAfter)) +
        Number(Boolean(filters.updatedBefore))
    );
}
