import type { Root } from "mdast";
import { history, undo } from "@codemirror/commands";
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { fireEvent } from "@testing-library/dom";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { afterEach, describe, expect, it } from "vitest";
import type { WritingEditorAdapter, WritingSnapshot, WritingSuggestion } from "./types";
import { createMarkdownWritingAssistant, extractMarkdownWritingSegments } from "./markdown-adapter";

const views: EditorView[] = [];
const adapters: WritingEditorAdapter[] = [];

function createMarkdownEditor(source: string, readonly = false): { view: EditorView; adapter: WritingEditorAdapter } {
    const assistant = createMarkdownWritingAssistant();
    const view = new EditorView({
        parent: document.body,
        state: EditorState.create({
            doc: source,
            extensions: [assistant.extension, history(), EditorState.readOnly.of(readonly)],
        }),
    });
    views.push(view);
    const adapter = assistant.createAdapter(view);
    adapters.push(adapter);
    return { view, adapter };
}

function createSuggestion(
    snapshot: WritingSnapshot,
    segmentIndex: number,
    from: number,
    to: number,
    original: string,
    replacement: string,
    id: string,
): WritingSuggestion {
    const segment = snapshot.segments[segmentIndex];
    if (!segment) throw new Error("Expected an eligible prose segment.");
    return {
        id,
        segmentId: segment.id,
        from,
        to,
        original,
        replacement,
        category: "grammar",
        explanation: "A minimal correction.",
    };
}

afterEach(() => {
    adapters.splice(0).forEach((adapter) => adapter.dispose());
    views.splice(0).forEach((view) => view.destroy());
    document.body.replaceChildren();
});

describe("raw Markdown writing review extraction", () => {
    it("reviews positioned prose while excluding markup-only and non-prose content", () => {
        const source = [
            "---",
            "title: Hidden frontmatter",
            "---",
            "# Heading prose",
            "",
            "**Bold prose** and `inline code` with $x^2$.",
            "",
            "[linked label](https://destination.example) and https://source.example/path.",
            "",
            "[[Wiki|Alias]] and ![[embedded-image.png]].",
            "",
            "```ts",
            "const hidden = true;",
            "```",
            "",
            "> Quoted prose.",
            "",
            "- Listed prose.",
            "",
            "| Table prose | `table code` |",
            "| --- | --- |",
            "| Second cell | More table prose |",
        ].join("\n");

        const segments = extractMarkdownWritingSegments(source);
        const reviewed = segments.map(({ from, to }) => source.slice(from, to));

        expect(reviewed.some((text) => text.includes("Heading prose"))).toBe(true);
        expect(reviewed.some((text) => text.includes("Bold prose"))).toBe(true);
        expect(reviewed.some((text) => text.includes("Quoted prose"))).toBe(true);
        expect(reviewed.some((text) => text.includes("Listed prose"))).toBe(true);
        expect(reviewed.some((text) => text.includes("Table prose"))).toBe(true);
        expect(reviewed.some((text) => text.includes("Second cell"))).toBe(true);
        expect(reviewed.join(" ")).not.toContain("Hidden frontmatter");
        expect(reviewed.join(" ")).not.toContain("inline code");
        expect(reviewed.join(" ")).not.toContain("table code");
        expect(reviewed.join(" ")).not.toContain("x^2");
        expect(reviewed.join(" ")).not.toContain("linked label");
        expect(reviewed.join(" ")).not.toContain("destination.example");
        expect(reviewed.join(" ")).not.toContain("source.example");
        expect(reviewed.join(" ")).not.toContain("Wiki");
        expect(reviewed.join(" ")).not.toContain("embedded-image.png");
        expect(reviewed.join(" ")).not.toContain("const hidden");
        expect(segments.every(({ from, to, text }) => source.slice(from, to) === text)).toBe(true);
    });

    it("clips to a nonempty source selection and returns no prose for an empty selection", () => {
        const source = "First paragraph.\n\nQuoted prose here.";
        const from = source.indexOf("Quoted") + 2;
        const to = source.indexOf("Quoted") + 7;

        expect(extractMarkdownWritingSegments(source, { from, to }).map((segment) => segment.text)).toEqual(["oted "]);
        expect(extractMarkdownWritingSegments(source, { from, to: from })).toEqual([]);
        expect(extractMarkdownWritingSegments(source, { from: -1, to })).toEqual([]);
    });

    it("scopes paragraph and source-line reviews to the cursor's Markdown block", () => {
        const source = "First line\nsecond line\n\nOther paragraph";
        const { view, adapter } = createMarkdownEditor(source);
        view.dispatch({ selection: EditorSelection.cursor(source.indexOf("second line") + 3) });

        expect(adapter.snapshot("line").segments.map((segment) => segment.text)).toEqual(["second line"]);
        const paragraphText = adapter
            .snapshot("paragraph")
            .segments.map((segment) => segment.text)
            .join("");
        expect(paragraphText).toContain("First line");
        expect(paragraphText).toContain("second line");
        expect(paragraphText).not.toContain("Other paragraph");
    });
    it("skips parsed text whose Markdown escapes prevent exact source mapping", () => {
        const source = "\\*escaped emphasis*\n\nNormal prose.";

        expect(extractMarkdownWritingSegments(source).map((segment) => segment.text)).toEqual(["Normal prose."]);
    });
});

describe("raw Markdown writing review adapter", () => {
    it("activates clicked findings, escapes punctuation literally, and isolates acceptance in undo history", () => {
        const source = "**She go.**";
        const { view, adapter } = createMarkdownEditor(source);
        view.dispatch({ changes: { from: view.state.doc.length, insert: "!" } });
        const snapshot = adapter.snapshot("note");
        adapter.show([createSuggestion(snapshot, 0, 4, 6, "go", "goes!", "raw-issue-1")], snapshot);

        const decoration = view.contentDOM.querySelector('[data-writing-suggestion-id="raw-issue-1"]');
        if (!decoration) throw new Error("Expected an inline CodeMirror suggestion decoration.");
        fireEvent.click(decoration);
        expect(adapter.getActiveSuggestionId()).toBe("raw-issue-1");

        expect(adapter.accept("raw-issue-1")).toBe(true);
        expect(view.state.doc.toString()).toBe("**She goes\\!.**!");
        const parsed = unified().use(remarkParse).parse(view.state.doc.toString()) as Root;
        const paragraph = parsed.children[0];
        if (!paragraph || paragraph.type !== "paragraph") throw new Error("Expected a Markdown paragraph.");
        const strong = paragraph.children[0];
        if (!strong || strong.type !== "strong") throw new Error("Expected bold prose.");
        const text = strong.children[0];
        if (!text || text.type !== "text") throw new Error("Expected literal text inside bold prose.");
        expect(text.value).toBe("She goes!.");

        view.dispatch({ changes: { from: view.state.doc.length, insert: "?" } });
        expect(undo(view)).toBe(true);
        expect(view.state.doc.toString()).toBe("**She goes\\!.**!");
        expect(undo(view)).toBe(true);
        expect(view.state.doc.toString()).toBe(source + "!");
        expect(undo(view)).toBe(true);
        expect(view.state.doc.toString()).toBe(source);
    });

    it("maps untouched findings after earlier prose changes and applies to the original occurrence", () => {
        const { view, adapter } = createMarkdownEditor("First.\n\nWe go.");
        const snapshot = adapter.snapshot("note");
        adapter.show([createSuggestion(snapshot, 1, 3, 5, "go", "walk", "raw-issue-2")], snapshot);

        view.dispatch({ changes: { from: 0, insert: "Edited " } });

        expect(adapter.getSuggestions().map((suggestion) => suggestion.id)).toEqual(["raw-issue-2"]);
        expect(adapter.accept("raw-issue-2")).toBe(true);
        expect(view.state.doc.toString()).toBe("Edited First.\n\nWe walk.");
    });

    it("invalidates edits in and at a segment boundary, and dismisses without changing content", () => {
        const { view, adapter } = createMarkdownEditor("She go.");
        let snapshot = adapter.snapshot("note");
        adapter.show([createSuggestion(snapshot, 0, 4, 6, "go", "goes", "raw-issue-3")], snapshot);
        const segment = snapshot.segments[0];
        if (!segment) throw new Error("Expected an eligible prose segment.");

        view.dispatch({ changes: { from: segment.from + 4, insert: "x" } });
        expect(adapter.getSuggestions()).toEqual([]);
        expect(adapter.getStatusMessage()).toBe("Text changed. Review again.");

        snapshot = adapter.snapshot("note");
        adapter.show([createSuggestion(snapshot, 0, 0, 3, "She", "They", "raw-issue-4")], snapshot);
        const boundary = snapshot.segments[0];
        if (!boundary) throw new Error("Expected an eligible prose segment.");
        const beforeDismiss = view.state.doc.toString();
        const revision = snapshot.revision;
        adapter.dismiss("raw-issue-4");
        expect(view.state.doc.toString()).toBe(beforeDismiss);
        expect(adapter.snapshot("note").revision).toBe(revision);

        adapter.show([createSuggestion(snapshot, 0, 0, 3, "She", "They", "raw-issue-5")], snapshot);
        view.dispatch({ changes: { from: boundary.from, insert: "x" } });
        expect(adapter.getSuggestions()).toEqual([]);
        expect(adapter.getStatusMessage()).toBe("Text changed. Review again.");
    });

    it("does not accept suggestions in a read-only editor", () => {
        const { view, adapter } = createMarkdownEditor("She go.", true);
        const snapshot = adapter.snapshot("note");
        adapter.show([createSuggestion(snapshot, 0, 4, 6, "go", "goes", "raw-issue-6")], snapshot);

        expect(adapter.isEditable()).toBe(false);
        expect(adapter.accept("raw-issue-6")).toBe(false);
        expect(view.state.doc.toString()).toBe("She go.");
    });
});
