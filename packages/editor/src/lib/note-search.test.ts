import { describe, expect, it } from "vitest";
import { Note } from "@/store/note";
import { filterNotesByQuery, fzfScore, getNoteSearchSnippet } from "./note-search";

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

    it("shows a plain-text excerpt around matching note content", () => {
        expect(
            getNoteSearchSnippet(
                `# Notes

This page describes **deterministic local indexes** for search.`,
                "local indexes",
            ),
        ).toBe("This page describes deterministic local indexes for search.");
    });

    it("limits long excerpts and keeps an ellipsis when content continues", () => {
        const content = `Opening words. ${"details ".repeat(30)}important phrase ${"closing ".repeat(30)}`;
        const excerpt = getNoteSearchSnippet(content, "important phrase", 60);

        expect(excerpt).toContain("important phrase");
        expect(excerpt.length).toBeLessThanOrEqual(62);
        expect(excerpt.startsWith("…")).toBe(true);
        expect(excerpt.endsWith("…")).toBe(true);
    });

    it("does not treat scattered characters as a note match", () => {
        const note = createNote({
            id: "unrelated",
            title: "Banana ideas",
            content: "The renderer handles diagrams.",
        });

        expect(fzfScore("Nada", note.title)).not.toBeNull();
        expect(filterNotesByQuery([note], "Nada")).toEqual([]);
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

    it("orders compatible title matches before less compatible title matches", () => {
        const distantMatch = createNote({ id: "distant", title: "A note about project" });
        const prefixMatch = createNote({ id: "prefix", title: "Project plan" });
        const exactMatch = createNote({ id: "exact", title: "Project" });

        expect(filterNotesByQuery([distantMatch, prefixMatch, exactMatch], "project").map(({ id }) => id)).toEqual([
            "exact",
            "prefix",
            "distant",
        ]);
    });
});

describe("note search on very long content", () => {
    const base = { description: null, tags: [] as string[], url: null, filePath: null };

    it("still finds a term that only appears after the fuzzy scoring window", () => {
        const content = `${"filler text ".repeat(4_000)}needle in the haystack`;
        const note = { ...base, title: "Long", content };
        expect(filterNotesByQuery([note], "needle")).toEqual([note]);
    });

    it("rejects long notes that cannot match without scoring them", () => {
        const note = { ...base, title: "Long", content: "a".repeat(500_000) };
        expect(filterNotesByQuery([note], "zzz")).toEqual([]);
    });

    it("scores a long note quickly", () => {
        const note = { ...base, title: "Long", content: "lorem ipsum dolor sit amet ".repeat(80_000) };
        const started = performance.now();
        filterNotesByQuery([note], "dolor amet");
        expect(performance.now() - started).toBeLessThan(1_000);
    });

    it("builds the snippet from the start of a long note", () => {
        const content = `first line\n${"x ".repeat(100_000)}\nneedle`;
        expect(getNoteSearchSnippet(content, "missing")).toBe("first line");
    });
});
