import { describe, expect, it } from "vitest";
import { Note } from "@/store/note";
import { filterNotesByQuery, fzfScore } from "./note-search";

const createNote = (overrides: Partial<Note>): Note =>
    Note.parse({
        id: overrides.id,
        title: overrides.title ?? "Untitled",
        content: overrides.content ?? "",
        description: overrides.description,
        tags: overrides.tags ?? [],
        url: overrides.url,
        filePath: overrides.filePath,
    });

describe("fzf note search", () => {
    it.each([
        ["nt", "Notes", true],
        ["wme", "Write me", true],
        ["xyz", "Notes", false],
    ])("matches %s against %s: %s", (query, candidate, expected) => {
        expect(fzfScore(query, candidate) !== null).toBe(expected);
    });

    it("matches title, content, description, tags, URL, and path", () => {
        const note = createNote({
            id: "searchable",
            title: "A quiet title",
            content: "The renderer handles diagrams.",
            description: "A note about planning.",
            tags: ["productivity"],
            url: "example.com/guide",
            filePath: "/workspace/reference.md",
        });

        expect(filterNotesByQuery([note], "quiet").map(({ id }) => id)).toEqual(["searchable"]);
        expect(filterNotesByQuery([note], "renderer").map(({ id }) => id)).toEqual(["searchable"]);
        expect(filterNotesByQuery([note], "planning").map(({ id }) => id)).toEqual(["searchable"]);
        expect(filterNotesByQuery([note], "productivity").map(({ id }) => id)).toEqual(["searchable"]);
        expect(filterNotesByQuery([note], "guide").map(({ id }) => id)).toEqual(["searchable"]);
        expect(filterNotesByQuery([note], "reference").map(({ id }) => id)).toEqual(["searchable"]);
    });

    it("returns every note for an empty query and ranks stronger matches first", () => {
        const titleMatch = createNote({ id: "title", title: "Project plan" });
        const contentMatch = createNote({ id: "content", title: "Other note", content: "A project plan" });

        expect(filterNotesByQuery([titleMatch, contentMatch], "").map(({ id }) => id)).toEqual(["title", "content"]);
        expect(filterNotesByQuery([contentMatch, titleMatch], "project").map(({ id }) => id)).toEqual([
            "title",
            "content",
        ]);
    });
});
