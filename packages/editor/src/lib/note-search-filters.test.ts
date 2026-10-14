import { describe, expect, it } from "vitest";
import { Note, NoteType } from "@/store/note";
import {
    buildNoteSearchFilterQuery,
    EMPTY_NOTE_SEARCH_FILTERS,
    filterNotesByStructuredFilters,
    getNoteSearchFolders,
    type NoteSearchFilters,
} from "./note-search-filters";
import { executeQuery } from "./views/engine";
import { parse } from "./views/parser";
import { astToFilterGroup, filterGroupToQueryString } from "./views/query-builder";

const filters = (patch: Partial<NoteSearchFilters>): NoteSearchFilters => ({ ...EMPTY_NOTE_SEARCH_FILTERS, ...patch });
const ids = (notes: Note[]): string[] => notes.map((note) => note.id);

describe("saved search filters", () => {
    it("combines filters using the same predicate as a persisted View", () => {
        const notes = [
            Note.parse({
                id: "match",
                tags: ["research", "reading"],
                noteType: NoteType["read-it-later"],
                filePath: "/notes/project/article.md",
                updatedAt: new Date(2026, 9, 14, 12),
            }),
            Note.parse({
                id: "other-tag",
                tags: ["research"],
                noteType: NoteType["read-it-later"],
                filePath: "/notes/project/other.md",
                updatedAt: new Date(2026, 9, 14, 12),
            }),
            Note.parse({
                id: "local",
                tags: ["research", "reading"],
                noteType: NoteType["read-it-later"],
                updatedAt: new Date(2026, 9, 14, 12),
            }),
        ];
        const selected = filters({
            tags: ["research", "reading"],
            noteType: "read-it-later",
            location: "folder:/notes/project",
            updatedAfter: "2026-10-14",
            updatedBefore: "2026-10-14",
        });
        const query = buildNoteSearchFilterQuery(selected);
        expect(ids(filterNotesByStructuredFilters(notes, selected))).toEqual(["match"]);
        expect(executeQuery(parse(query), { notes }).map((row) => row["notes.id"])).toEqual(["match"]);
        expect(ids(filterNotesByStructuredFilters(notes, filters({ tags: ["research"] })))).toEqual([
            "match",
            "other-tag",
            "local",
        ]);
        expect(filterNotesByStructuredFilters(notes, filters({}))).toEqual(notes);
    });

    it("round trips Unicode, quotes, backslashes and query-looking text", () => {
        const tag = "ação ' OR title = 'escaped\\tag";
        const notes = [Note.parse({ id: "match", tags: [tag] }), Note.parse({ id: "other", tags: ["ação"] })];
        expect(ids(filterNotesByStructuredFilters(notes, filters({ tags: [tag] })))).toEqual(["match"]);
    });

    it.each(["ação ' OR title = 'escaped\\tag", "null", "true", "123"])(
        "keeps tag %s intact when edited with Visual Filters",
        (tag) => {
            const selected = filters({ tags: [tag], location: "folder:C:\\vault\\ação's" });
            const group = astToFilterGroup(parse(buildNoteSearchFilterQuery(selected)).where);
            if (!group) throw new Error("Expected editable filters");
            const notes = [Note.parse({ id: "match", tags: [tag], filePath: "C:\\vault\\ação's\\a.md" })];
            expect(
                executeQuery(parse(filterGroupToQueryString(group)), { notes }).map((row) => row["notes.id"]),
            ).toEqual(["match"]);
        },
    );

    it.each([
        [2026, 2, 8],
        [2026, 10, 1],
        [2024, 1, 29],
        [2018, 10, 4],
    ])("uses calendar midnight boundaries across daylight saving and leap days", (year, month, day) => {
        const input = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const query = buildNoteSearchFilterQuery(filters({ updatedAfter: input, updatedBefore: input }));
        expect(query).toContain(new Date(year, month, day).toISOString());
        expect(query).toContain(new Date(year, month, day + 1).toISOString());
    });

    it("distinguishes database notes from files and respects folder boundaries on both platforms", () => {
        const notes = [
            Note.parse({ id: "local" }),
            Note.parse({ id: "unix", filePath: "/vault/ação's/a.md" }),
            Note.parse({ id: "sibling", filePath: "/vault/ação's-other/b.md" }),
            Note.parse({ id: "windows", filePath: "C:\\vault\\ação's\\nested\\a.md" }),
        ];
        expect(ids(filterNotesByStructuredFilters(notes, filters({ location: "local" })))).toEqual(["local"]);
        expect(ids(filterNotesByStructuredFilters(notes, filters({ location: "filesystem" })))).toEqual([
            "unix",
            "sibling",
            "windows",
        ]);
        expect(ids(filterNotesByStructuredFilters(notes, filters({ location: "folder:/vault/ação's" })))).toEqual([
            "unix",
        ]);
        expect(ids(filterNotesByStructuredFilters(notes, filters({ location: "folder:C:\\vault\\ação's" })))).toEqual([
            "windows",
        ]);
        expect(getNoteSearchFolders(notes.map((note) => note.filePath)).map((folder) => folder.path)).toContain(
            "C:\\vault\\ação's\\nested",
        );
        expect(getNoteSearchFolders(["/vault/project/a.md", "/vault/project/b.md"])).toEqual([
            { path: "/vault", label: "/vault" },
            { path: "/vault/project", label: "/vault/project" },
        ]);
        expect(getNoteSearchFolders(["\\\\server\\share\\a.md"]).map((option) => option.path)).toContain(
            "\\\\server\\share",
        );
        const escapedPath = "/vault/my\\folder";
        const escapedNote = Note.parse({ id: "escaped-path", filePath: `${escapedPath}/a.md` });
        expect(getNoteSearchFolders([escapedNote.filePath]).map((option) => option.path)).toContain(escapedPath);
        expect(
            ids(filterNotesByStructuredFilters([escapedNote], filters({ location: `folder:${escapedPath}` }))),
        ).toEqual(["escaped-path"]);
    });

    it("includes the full local day and excludes the next midnight", () => {
        const notes = [
            Note.parse({ id: "before", updatedAt: new Date(2026, 9, 13, 23, 59, 59, 999) }),
            Note.parse({ id: "start", updatedAt: new Date(2026, 9, 14) }),
            Note.parse({ id: "end", updatedAt: new Date(2026, 9, 14, 23, 59, 59, 999) }),
            Note.parse({ id: "next", updatedAt: new Date(2026, 9, 15) }),
        ];
        const selected = filters({ updatedAfter: "2026-10-14", updatedBefore: "2026-10-14" });
        expect(ids(filterNotesByStructuredFilters(notes, selected))).toEqual(["start", "end"]);
        expect(buildNoteSearchFilterQuery(selected)).toContain(new Date(2026, 9, 15).toISOString());
    });

    it("rejects invalid or reversed dates instead of dropping criteria", () => {
        expect(() => buildNoteSearchFilterQuery(filters({ updatedAfter: "2026-02-30" }))).toThrow();
        expect(() =>
            buildNoteSearchFilterQuery(filters({ updatedAfter: "2026-10-15", updatedBefore: "2026-10-14" })),
        ).toThrow();
    });
});
