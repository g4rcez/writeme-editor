import { beforeEach, describe, expect, it, vi } from "vitest";
import { Note } from "@/store/note";
import {
    filterCompletionItems,
    completionMarkdown,
    createHeadingItems,
    createWordItems,
    extractCompletionTags,
    findCompletionContext,
    filterWordItems,
    loadWorkspaceCompletions,
    markdownHeadingText,
    completionInsertionContext,
    createTagItems,
    withoutActiveTag,
} from "./editor-completion-data";

const mocks = vi.hoisted(() => ({
    state: vi.fn(),
    tags: vi.fn(),
    electron: vi.fn(() => false),
}));

vi.mock("@/store/global.store", () => ({
    globalState: mocks.state,
    getWorkspaceKey: (directory: string | null) => directory || "__local__",
    repositories: { hashtags: { getAll: mocks.tags } },
}));
vi.mock("@/lib/is-electron", () => ({ isElectron: mocks.electron }));

beforeEach(() => {
    mocks.state.mockReturnValue({ notes: [], directory: null });
    mocks.tags.mockResolvedValue([]);
    mocks.electron.mockReturnValue(false);
});

describe("completion context", () => {
    it("supports empty queries, spaces and paths and replaces the suffix at the cursor", () => {
        expect(findCompletionContext("See #", "", 6)).toMatchObject({ trigger: "#", query: "", from: 5, to: 6 });
        expect(findCompletionContext("See @docs/My File", ".md rest", 17)).toMatchObject({
            trigger: "@",
            query: "docs/My File",
            to: 20,
        });
        expect(findCompletionContext("See #Loc", "al", 8)).toMatchObject({ from: 4, to: 10 });
    });

    it("ignores heading markers, emails, whitespace and link destinations", () => {
        for (const text of ["## ", "name@example.com", "Plain text ", "##", "[label](#section"]) {
            expect(findCompletionContext(text, "", text.length)).toBeNull();
        }
    });

    it("uses the word around the cursor, retaining punctuation and supporting Unicode", () => {
        expect(findCompletionContext("Try (pla", "nning)!", 8)).toEqual({
            trigger: "word",
            query: "pla",
            from: 5,
            to: 13,
            cursor: 8,
        });
        expect(findCompletionContext("Use ca", "fé.", 6)).toMatchObject({
            trigger: "word",
            query: "ca",
            from: 4,
            to: 8,
        });
        expect(findCompletionContext("Try ", "planning!", 4)).toMatchObject({
            trigger: "word",
            query: "",
            from: 4,
            to: 12,
        });
        expect(findCompletionContext("don't", "", 5)).toMatchObject({ trigger: "word", query: "don't" });
    });
});

describe("completion data", () => {
    it("deduplicates document words without losing spelling and matches prefixes rather than substrings", () => {
        const items = createWordItems("Planning planning planner plant explain café cafe\u0301 don't re-use 123");
        expect(filterWordItems(items, "PLAN").map((item) => item.label)).toEqual(["planner", "Planning", "plant"]);
        expect(filterWordItems(items, "planning")).toEqual([]);
        expect(filterWordItems(items, "ca").map((item) => item.label)).toEqual(["café"]);
        expect(items.map((item) => item.label)).toContain("don't");
        expect(items.map((item) => item.label)).toContain("re-use");
        expect(items.map((item) => item.label)).not.toContain("123");
        expect(completionMarkdown({ id: "word:planning", label: "Planning", path: "", kind: "word" })).toBe("Planning");
    });
    it("creates stable heading anchors including duplicates and accented text", () => {
        expect(createHeadingItems(["Plan", "Plan", "Plan-1", "Próximos passos"]).map((item) => item.path)).toEqual([
            "#plan",
            "#plan-1",
            "#plan-1-1",
            "#pr%C3%B3ximos-passos",
        ]);
    });

    it("reads body and frontmatter tags without suggesting code", () => {
        expect(
            extractCompletionTags(
                "---\ntags: [metadata, '#prefixed']\n---\n#shared-topic `#inline-code`\n\n```js\n#code-tag\n```\n\n#fff #shared-topic",
            ),
        ).toEqual(["metadata", "#prefixed", "shared-topic", "fff"]);
    });

    it("completes the current word after a finished tag but allows spaces inside an active heading query", () => {
        expect(findCompletionContext("Continue #work pla", "!", 18)).toMatchObject({
            trigger: "word",
            query: "pla",
            from: 15,
            to: 18,
        });
        const active = findCompletionContext("See #Work", "", 9);
        expect(active).not.toBeNull();
        expect(findCompletionContext("See #Work plan", "", 14, active ?? undefined)).toMatchObject({
            trigger: "#",
            query: "Work plan",
            from: 4,
        });
        expect(findCompletionContext("See #Wo", "rk!", 7)).toMatchObject({ to: 9 });
    });

    it("uses visible heading text for links, formatting, entities and code", () => {
        const title = markdownHeadingText("**[Plan](https://example.com)** &amp; `review` ![image](photo.png)");
        expect(title).toBe("Plan & review");
        expect(createHeadingItems([title])[0]?.path).toBe("#plan-review");
    });

    it("extends file replacement across spaces only when the actual suffix matches the selected filename", () => {
        const item = { id: "file", label: "My File.md", path: "docs/My File.md", kind: "file" as const };
        const context = findCompletionContext("See @My", " File.md then", 7);
        expect(context).not.toBeNull();
        if (!context) return;
        expect(completionInsertionContext(item, context).to).toBe(15);
        expect(completionInsertionContext(item, { ...context, textAfter: " ordinary prose" }).to).toBe(context.to);
        expect(completionMarkdown({ ...item, path: "docs/A#1?.md" })).toContain("docs/A%231%3F.md");
    });

    it("recognizes Unicode and nested tags and does not confuse URLs, escapes or numbers with tags", () => {
        expect(
            extractCompletionTags("#project/active #ação #abc #🌱 #123 #y1984 https://host/#fragment \\#escaped"),
        ).toEqual(["project/active", "ação", "abc", "🌱", "y1984"]);
    });

    it("offers a tag only once when both the live editor and workspace provide it", () => {
        const tags = createTagItems(["project/topic"]);
        const headings = createHeadingItems(["Plan", "Plan"]);
        expect(filterCompletionItems([...tags, ...tags], "proj")).toEqual(tags);
        expect(filterCompletionItems(headings, "Plan")).toHaveLength(2);
    });

    it("deduplicates workspace tags by normalized spelling and ignores stale stored tags for loaded notes", async () => {
        mocks.state.mockReturnValue({
            directory: null,
            notes: [
                Note.parse({
                    id: "one",
                    title: "One",
                    project: "",
                    content: "#Work #work #café #cafe\u0301 #project/active",
                }),
            ],
        });
        mocks.tags.mockResolvedValue([{ project: "__local__", filename: "One", hashtag: "project" }]);
        expect((await loadWorkspaceCompletions("#")).map((item) => item.label)).toEqual([
            "café",
            "project/active",
            "Work",
        ]);
    });

    it("does not use the active partial tag or its saved body as its own suggestion", async () => {
        const note = Note.parse({ id: "editing", project: "", content: "#unsa" });
        mocks.state.mockReturnValue({ directory: null, notes: [note], note });
        expect(await loadWorkspaceCompletions("#", note.id)).toEqual([]);
        const context = findCompletionContext("Use #unsa", "", 9);
        if (!context) throw new Error("Missing completion context");
        expect(withoutActiveTag(createTagItems(["unsa", "unsaved-topic"]), context).map((item) => item.label)).toEqual([
            "unsaved-topic",
        ]);
    });

    it("limits tags and local references to the current workspace and excludes deleted notes", async () => {
        mocks.state.mockReturnValue({
            directory: "/workspace",
            notes: [
                Note.parse({
                    id: "here",
                    title: "Here",
                    project: "/workspace",
                    filePath: "/workspace/notes/here.md",
                    tags: ["topic"],
                    content: "#body-tag",
                }),
                Note.parse({ id: "outside", title: "Outside", filePath: "/elsewhere/other.md", tags: ["outside"] }),
                Note.parse({
                    id: "deleted",
                    title: "Deleted",
                    project: "/workspace",
                    deletedAt: new Date(),
                    tags: ["deleted"],
                }),
            ],
        });
        mocks.tags.mockResolvedValue([
            { project: "default", filename: "/workspace/notes/here.md", hashtag: "#topic" },
            { project: "/elsewhere", filename: "Other", hashtag: "private" },
        ]);
        expect((await loadWorkspaceCompletions("#")).map((item) => item.label)).toEqual(["body-tag", "topic"]);
        expect((await loadWorkspaceCompletions("@")).map((item) => item.label)).toEqual(["Here"]);
    });

    it("escapes labels and paths for Markdown insertion", () => {
        expect(completionMarkdown({ id: "file", label: "A [file].md", path: "docs/A (file).md", kind: "file" })).toBe(
            "[A \\[file\\].md](docs/A%20%28file%29.md)",
        );
    });
});
