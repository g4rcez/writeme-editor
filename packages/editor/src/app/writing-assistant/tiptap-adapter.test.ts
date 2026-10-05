import { fireEvent } from "@testing-library/dom";
import { Editor, Node, type JSONContent } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import type { WritingEditorAdapter, WritingSnapshot, WritingSuggestion } from "./types";
import { createExtensions } from "../extensions";
import { WritingAssistant } from "../extensions/writing-assistant";
import { createTiptapWritingEditorAdapter, extractTiptapWritingSegments } from "./tiptap-adapter";

const editors: Editor[] = [];
const adapters: WritingEditorAdapter[] = [];

function createEditor(content: JSONContent): Editor {
    const editor = new Editor({
        content,
        extensions: createExtensions(() => "github-dark"),
    });
    editors.push(editor);
    return editor;
}

function attachAdapter(editor: Editor): WritingEditorAdapter {
    const adapter = createTiptapWritingEditorAdapter(editor);
    adapters.push(adapter);
    return adapter;
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
    editors.splice(0).forEach((editor) => editor.destroy());
});

describe("formatted writing review extraction", () => {
    it("keeps formatting runs separate and excludes inline code, links, and math", () => {
        const editor = createEditor({
            type: "doc",
            content: [
                {
                    type: "paragraph",
                    content: [
                        { type: "text", text: "Intro " },
                        { type: "text", text: "bold", marks: [{ type: "bold" }] },
                        { type: "text", text: " regular" },
                        { type: "text", text: "code", marks: [{ type: "code" }] },
                        { type: "text", text: " tail" },
                        {
                            type: "text",
                            text: "link",
                            marks: [{ type: "link", attrs: { href: "https://example.com" } }],
                        },
                        { type: "text", text: " end" },
                        { type: "inlineMath", attrs: { latex: "x^2" } },
                        { type: "text", text: " after" },
                    ],
                },
                { type: "codeBlock", content: [{ type: "text", text: "code block" }] },
                { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "A heading" }] },
            ],
        });

        const segments = extractTiptapWritingSegments(editor);

        expect(segments.map((segment) => segment.text)).toEqual([
            "Intro ",
            "bold",
            " regular",
            " tail",
            " end",
            " after",
            "A heading",
        ]);
        expect(segments.every((segment) => segment.to - segment.from === segment.text.length)).toBe(true);
    });
    it("adds ephemeral spellcheck exclusions to code, frontmatter, and math", () => {
        const editor = new Editor({
            content: {
                type: "doc",
                content: [
                    {
                        type: "paragraph",
                        content: [
                            { type: "text", text: "Eligible prose " },
                            { type: "text", text: "inline code", marks: [{ type: "code" }] },
                        ],
                    },
                    { type: "codeBlock", content: [{ type: "text", text: "const hidden = 1;" }] },
                    { type: "frontmatter", content: [{ type: "text", text: "title: hidden metadata" }] },
                    { type: "inlineMath", attrs: { latex: "x^2" } },
                    { type: "blockMath", attrs: { latex: "y^2" } },
                ],
            },
            extensions: [
                StarterKit,
                Node.create({
                    name: "frontmatter",
                    group: "block",
                    content: "text*",
                    marks: "",
                    code: true,
                    renderHTML: () => ["div", 0],
                }),
                Node.create({
                    name: "inlineMath",
                    group: "inline",
                    inline: true,
                    atom: true,
                    addAttributes: () => ({ latex: { default: "" } }),
                    renderHTML: ({ node }) => [
                        "span",
                        { "data-math-source": node.attrs.latex },
                        String(node.attrs.latex),
                    ],
                }),
                Node.create({
                    name: "blockMath",
                    group: "block",
                    atom: true,
                    addAttributes: () => ({ latex: { default: "" } }),
                    renderHTML: ({ node }) => [
                        "div",
                        { "data-math-source": node.attrs.latex },
                        String(node.attrs.latex),
                    ],
                }),
                WritingAssistant,
            ],
        });
        editors.push(editor);
        const excludedText = Array.from(editor.view.dom.querySelectorAll<HTMLElement>('[spellcheck="false"]'))
            .map((element) => element.textContent ?? "")
            .join("");

        expect(excludedText).toContain("inline code");
        expect(excludedText).toContain("const hidden = 1;");
        expect(excludedText).toContain("title: hidden metadata");
        expect(excludedText).toContain("x^2");
        expect(excludedText).toContain("y^2");
        expect(editor.getHTML()).not.toContain('spellcheck="false"');
    });

    it("clips a selection to eligible prose without expanding it to the whole note", () => {
        const editor = createEditor({
            type: "doc",
            content: [
                {
                    type: "paragraph",
                    content: [
                        { type: "text", text: "Intro " },
                        { type: "text", text: "bold", marks: [{ type: "bold" }] },
                        { type: "text", text: " end" },
                    ],
                },
            ],
        });

        expect(extractTiptapWritingSegments(editor, { from: 3, to: 10 }).map((segment) => segment.text)).toEqual([
            "tro ",
            "bol",
        ]);
        expect(extractTiptapWritingSegments(editor, { from: 3, to: 3 })).toEqual([]);
    });
    it("scopes paragraph and manual-line reviews to the cursor's prose block", () => {
        const editor = createEditor({
            type: "doc",
            content: [
                {
                    type: "paragraph",
                    content: [
                        { type: "text", text: "First line" },
                        { type: "hardBreak" },
                        { type: "text", text: "Second line" },
                    ],
                },
                { type: "paragraph", content: [{ type: "text", text: "Other paragraph" }] },
            ],
        });
        const adapter = attachAdapter(editor);
        let secondLinePosition = 0;
        editor.state.doc.descendants((node, position) => {
            if (node.isText && node.text === "Second line") secondLinePosition = position + 3;
        });
        editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, secondLinePosition)));

        expect(adapter.snapshot("line").segments.map((segment) => segment.text)).toEqual(["Second line"]);
        expect(adapter.snapshot("paragraph").segments.map((segment) => segment.text)).toEqual([
            "First line",
            "Second line",
        ]);
        expect(adapter.snapshot("note").segments.map((segment) => segment.text)).toEqual([
            "First line",
            "Second line",
            "Other paragraph",
        ]);
    });
});

describe("formatted writing review adapter", () => {
    it("activates clicked findings, edits only the target, preserves marks, and isolates undo", () => {
        const editor = createEditor({
            type: "doc",
            content: [
                {
                    type: "paragraph",
                    content: [{ type: "text", text: "She go to school.", marks: [{ type: "bold" }] }],
                },
            ],
        });
        const adapter = attachAdapter(editor);
        editor.view.dispatch(editor.state.tr.insertText("!", editor.state.doc.content.size - 1));
        const snapshot = adapter.snapshot("note");
        adapter.show([createSuggestion(snapshot, 0, 4, 6, "go", "goes!", "issue-1")], snapshot);

        const decoration = editor.view.dom.querySelector('[data-writing-suggestion-id="issue-1"]');
        if (!decoration) throw new Error("Expected an inline suggestion decoration.");
        fireEvent.click(decoration);
        expect(adapter.getActiveSuggestionId()).toBe("issue-1");

        expect(adapter.accept("issue-1")).toBe(true);
        expect(editor.state.doc.textContent).toBe("She goes! to school.!");
        expect(editor.getHTML()).toContain("<strong>She goes! to school.!</strong>");

        editor.view.dispatch(editor.state.tr.insertText("?", editor.state.doc.content.size - 1));
        expect(editor.commands.undo()).toBe(true);
        expect(editor.state.doc.textContent).toBe("She goes! to school.!");
        expect(editor.commands.undo()).toBe(true);
        expect(editor.state.doc.textContent).toBe("She go to school.!");
        expect(editor.commands.undo()).toBe(true);
        expect(editor.state.doc.textContent).toBe("She go to school.");
    });

    it("maps untouched findings when an earlier prose segment changes", () => {
        const editor = createEditor({
            type: "doc",
            content: [
                { type: "paragraph", content: [{ type: "text", text: "First." }] },
                { type: "paragraph", content: [{ type: "text", text: "We go." }] },
            ],
        });
        const adapter = attachAdapter(editor);
        const snapshot = adapter.snapshot("note");
        adapter.show([createSuggestion(snapshot, 1, 3, 5, "go", "walk", "issue-2")], snapshot);

        editor.view.dispatch(editor.state.tr.insertText("Edited ", 1));

        expect(adapter.getSuggestions().map((suggestion) => suggestion.id)).toEqual(["issue-2"]);
        expect(adapter.accept("issue-2")).toBe(true);
        expect(editor.state.doc.child(1).textContent).toBe("We walk.");
    });

    it("invalidates changed segments and boundary insertions, and dismisses without editing", () => {
        const editor = createEditor({
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: "She go." }] }],
        });
        const adapter = attachAdapter(editor);
        let snapshot = adapter.snapshot("note");
        adapter.show([createSuggestion(snapshot, 0, 4, 6, "go", "goes", "issue-3")], snapshot);
        const segment = snapshot.segments[0];
        if (!segment) throw new Error("Expected an eligible prose segment.");

        editor.view.dispatch(editor.state.tr.insertText("x", segment.from + 4));
        expect(adapter.getSuggestions()).toEqual([]);
        expect(adapter.getStatusMessage()).toBe("Text changed. Review again.");

        snapshot = adapter.snapshot("note");
        adapter.show([createSuggestion(snapshot, 0, 4, 7, "xgo", "go", "issue-4")], snapshot);
        const revision = adapter.snapshot("note").revision;
        const content = editor.state.doc.textContent;
        adapter.dismiss("issue-4");
        expect(editor.state.doc.textContent).toBe(content);
        expect(adapter.snapshot("note").revision).toBe(revision);
        expect(adapter.getSuggestions()).toEqual([]);

        snapshot = adapter.snapshot("note");
        const boundarySegment = snapshot.segments[0];
        if (!boundarySegment) throw new Error("Expected an eligible prose segment.");
        adapter.show([createSuggestion(snapshot, 0, 0, 3, "She", "They", "issue-5")], snapshot);
        editor.view.dispatch(editor.state.tr.insertText("x", boundarySegment.from));
        expect(adapter.getSuggestions()).toEqual([]);
        expect(adapter.getStatusMessage()).toBe("Text changed. Review again.");
    });

    it("does not edit a read-only document", () => {
        const editor = createEditor({
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: "She go." }] }],
        });
        const adapter = attachAdapter(editor);
        const snapshot = adapter.snapshot("note");
        adapter.show([createSuggestion(snapshot, 0, 4, 6, "go", "goes", "issue-6")], snapshot);
        editor.setEditable(false);

        expect(adapter.isEditable()).toBe(false);
        expect(adapter.accept("issue-6")).toBe(false);
        expect(editor.state.doc.textContent).toBe("She go.");
    });
});
