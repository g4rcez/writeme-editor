import { Editor } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { Node } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { describe, expect, it, vi } from "vitest";
import { applyMarkdownWorkerChunk } from "@/lib/markdown-worker/ingest";
import { processMarkdown, splitIntoChunks } from "@/lib/markdown-worker/markdown.worker";
import { createExtensions } from "../extensions";
import { FootnoteDefinition, FootnoteReference, Footnotes, navigateToDefinition, returnToReference } from "./footnotes";

function createEditor(content: string): Editor {
    return new Editor({ extensions: createExtensions(() => "github-dark"), content });
}

function positions(editor: Editor, name: string): { node: Node; position: number }[] {
    const result: { node: Node; position: number }[] = [];
    editor.state.doc.descendants((node, position) => {
        if (node.type.name === name) result.push({ node, position });
    });
    return result;
}

describe("Markdown footnotes", () => {
    it.each([false, true])("preserves literal code in first and later worker chunks (later: %s)", (later) => {
        const body =
            "Body [^a].\n\n[^a]: Source\n\n    ```text\n    first line\n    \n    **keep literal**\n    ```\n\nAfterwards.";
        const markdown = later ? "Context\n\n".repeat(220) + body : body + "\n\n" + "Context ".repeat(6500);
        const direct = createEditor(markdown);
        const editor = createEditor("");
        try {
            const chunks = splitIntoChunks(markdown);
            expect(chunks.length).toBe(later ? 2 : 1);
            chunks.forEach((chunk, index) => applyMarkdownWorkerChunk(editor, processMarkdown(chunk), index === 0));
            expect(positions(editor, "codeBlock")[0]?.node.textContent).toBe("first line\n\n**keep literal**");
            expect(editor.getJSON()).toEqual(direct.getJSON());
            const document = editor.getJSON();
            editor.commands.setContent(editor.getMarkdown());
            expect(editor.getJSON()).toEqual(document);
        } finally {
            editor.destroy();
            direct.destroy();
        }
    });

    it("preserves pipe IDs, full table cells and clipboard Markdown across reloads", () => {
        const editor = createEditor("| Claim |\n| --- |\n| A [^a\\|b]. |\n\n[^a|b]: **Source**\n\nAfterwards.");
        try {
            const document = editor.getJSON();
            for (let i = 0; i < 3; i++) {
                expect(positions(editor, "footnoteReference").map(({ node }) => node.attrs.id)).toEqual(["a|b"]);
                expect(positions(editor, "tableRow").map(({ node }) => node.childCount)).toEqual([1, 1]);
                expect(positions(editor, "tableCell")[0]?.node.textContent).toBe("A .");
                expect(editor.getMarkdown()).toContain("| A [^a\\|b]. |");
                let copied = "";
                editor.view.someProp("clipboardTextSerializer", (serialize) => {
                    copied = serialize(editor.state.doc.slice(0, editor.state.doc.content.size), editor.view);
                    return true;
                });
                expect(copied).toContain("[^a\\|b]");
                editor.commands.setContent(copied);
                expect(editor.getJSON()).toEqual(document);
            }
        } finally {
            editor.destroy();
        }
    });

    it("keeps caret-labelled inline and resolved links distinct from footnotes", () => {
        const editor = createEditor(
            "[^manual](https://example.com) [^guide][target] [^real](not a valid link) \\[^literal].\n\n[target]: https://example.org\n\n[^real]: Source\n\nAfterwards.",
        );
        try {
            const document = editor.getJSON();
            for (let i = 0; i < 3; i++) {
                expect(positions(editor, "footnoteReference").map(({ node }) => node.attrs.id)).toEqual(["real"]);
                expect(editor.getHTML()).toContain('href="https://example.com"');
                expect(editor.getHTML()).toContain(">^manual</a>");
                expect(editor.getHTML()).toContain(">^guide</a>");
                expect(editor.state.doc.textContent).toContain("(not a valid link) [^literal].");
                editor.commands.setContent(editor.getMarkdown());
                expect(editor.getJSON()).toEqual(document);
            }
        } finally {
            editor.destroy();
        }
    });

    it("bounds full-document discovery to one traversal per edit and none for selection or navigation", () => {
        const content = createEditor(
            Array.from({ length: 150 }, (_, i) => `Body [^a${i}].\n\n[^a${i}]: Source ${i}`).join("\n\n"),
        );
        const editor = new Editor({
            extensions: [Document, Paragraph, Text, FootnoteReference, FootnoteDefinition, Footnotes],
            content: content.getJSON(),
        });
        const original = Node.prototype.descendants;
        let traversals = 0;
        const spy = vi.spyOn(Node.prototype, "descendants").mockImplementation(function(this: Node, callback) {
            if (this.type.name === "doc") traversals++;
            return original.call(this, callback);
        });
        try {
            editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 2)));
            expect(traversals).toBe(0);
            expect(navigateToDefinition(editor, "a149", 6)).toBe(true);
            expect(returnToReference(editor)).toBe(true);
            expect(traversals).toBe(0);
            editor.view.dispatch(editor.state.tr.insertText("Updated ", 1));
            expect(traversals).toBe(1);
            editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 2)));
            expect(traversals).toBe(1);
            expect(editor.view.dom.querySelector("output")?.textContent).toBe("");
        } finally {
            spy.mockRestore();
            editor.destroy();
            content.destroy();
        }
    });

    it("returns to a newly inserted reference after authoring its definition", () => {
        const editor = createEditor("Body");
        try {
            editor.commands.setTextSelection(5);
            editor.commands.insertFootnote();
            editor.view.dispatch(editor.state.tr.insertText("Source details"));
            expect(returnToReference(editor)).toBe(true);
            expect(editor.state.selection.from).toBe(5);
            expect(editor.getMarkdown()).toContain("[^fn-1]: Source details");
        } finally {
            editor.destroy();
        }
    });
    it("inserts custom IDs and rejects invalid or already-used names", () => {
        const editor = createEditor("Body [^source]\n\n[^source]: Existing source");
        try {
            editor.commands.setTextSelection(1);
            expect(editor.commands.insertFootnote({ id: "source" })).toBe(false);
            expect(editor.commands.insertFootnote({ id: "not a valid id" })).toBe(false);
            expect(editor.commands.insertFootnote({ id: "new-source" })).toBe(true);
            expect(positions(editor, "footnoteReference").map(({ node }) => node.attrs.id)).toEqual([
                "new-source",
                "source",
            ]);
            expect(editor.getMarkdown()).toContain("[^new-source]");
            expect(editor.getMarkdown()).toContain("[^new-source]:");
        } finally {
            editor.destroy();
        }
    });
    it.each([
        "Body [^a].\n\n[^a]: First paragraph.\n\n    Second **bold** paragraph.\n\n    - Item\n        - Nested item\n\nAfterwards.",
        "Body [^a].\n\n[^a]: Paragraph\n\n    > Quote\n    > continued\n\n    ```ts\n    const code = 1;\n    ```\n\nAfterwards.",
        "Body [^a].\n\n[^a]: [A link][target]\n\nAfterwards.\n\n[target]: https://example.com",
        "Body [^a].\n\n[^a]: First\n\tSecond\n\n    Third\n\nAfterwards.",
        "Body [^a].\n\n[^a]:\n\nAfterwards.",
        "Body [^ação].\n\n[^ação]: Source.\n\nAfterwards.",
        "Body [^touch].\n\n[^touch]: " + "A long source with readable details. ".repeat(12) + "\n\nAfterwards.",
    ])("preserves block structure across repeated roundtrips: %s", (markdown) => {
        const editor = createEditor(markdown);
        try {
            const document = editor.getJSON();
            expect(positions(editor, "footnoteDefinition")).toHaveLength(1);
            for (let i = 0; i < 3; i++) {
                editor.commands.setContent(editor.getMarkdown());
                expect(editor.getJSON()).toEqual(document);
            }
        } finally {
            editor.destroy();
        }
    });

    it("keeps syntax inside code and escaped literals as text", () => {
        const editor = createEditor("`[^code]` and \\[^literal].\n\n```md\n[^code]: Code only.\n```\n\nAfterwards.");
        try {
            expect(positions(editor, "footnoteReference")).toHaveLength(0);
            expect(positions(editor, "footnoteDefinition")).toHaveLength(0);
            const document = editor.getJSON();
            editor.commands.setContent(editor.getMarkdown());
            expect(editor.getJSON()).toEqual(document);
        } finally {
            editor.destroy();
        }
    });

    it("preserves duplicate IDs, missing references and unusual valid IDs", () => {
        const editor = createEditor(
            "[^missing] [^__proto__] [^same]\n\n[^same]: First\n\n[^same]: Second\n\nAfterwards.",
        );
        try {
            const document = editor.getJSON();
            editor.commands.setContent(editor.getMarkdown());
            expect(editor.getJSON()).toEqual(document);
            expect(positions(editor, "footnoteDefinition").map(({ node }) => node.textContent)).toEqual([
                "First",
                "Second",
            ]);
        } finally {
            editor.destroy();
        }
    });

    it("reserves IDs used by missing references and orphan definitions", () => {
        const editor = createEditor("[^fn-1]\n\n[^fn-2]: Orphan");
        try {
            editor.commands.setTextSelection(1);
            editor.commands.insertFootnote();
            expect(positions(editor, "footnoteReference").map(({ node }) => node.attrs.id)).toEqual(["fn-3", "fn-1"]);
        } finally {
            editor.destroy();
        }
    });

    it("preserves selected text and undoes chained insertion as one edit", () => {
        const editor = createEditor("Quoted text /footnote");
        try {
            editor.commands.setTextSelection({ from: 1, to: 7 });
            editor.commands.insertFootnote();
            expect(editor.getMarkdown()).toContain("Quoted[^fn-1] text");
            editor.commands.undo();
            expect(editor.getMarkdown()).toBe("Quoted text /footnote");
            editor.chain().deleteRange({ from: 13, to: 22 }).insertFootnote().run();
            expect(editor.getMarkdown()).toContain("[^fn-1]:");
            editor.commands.undo();
            expect(editor.getMarkdown()).toBe("Quoted text /footnote");
        } finally {
            editor.destroy();
        }
    });

    it("does not offer insertion inside a code block", () => {
        const editor = createEditor("```ts\ncode\n```");
        try {
            editor.commands.setTextSelection(1);
            expect(editor.can().insertFootnote()).toBe(false);
            expect(editor.commands.insertFootnote()).toBe(false);
        } finally {
            editor.destroy();
        }
    });

    it("deletes one reference without deleting its shared definition", () => {
        const editor = createEditor("One [^a] and two [^a].\n\n[^a]: Shared source");
        try {
            const first = positions(editor, "footnoteReference")[0]!;
            editor.commands.deleteRange({ from: first.position, to: first.position + first.node.nodeSize });
            expect(positions(editor, "footnoteReference")).toHaveLength(1);
            expect(positions(editor, "footnoteDefinition")[0]?.node.textContent).toBe("Shared source");
            editor.commands.undo();
            expect(positions(editor, "footnoteReference")).toHaveLength(2);
        } finally {
            editor.destroy();
        }
    });

    it("navigates to the first duplicate definition and maps return through edits", () => {
        const editor = createEditor("Body [^a].\n\n[^a]: First\n\n[^a]: Second");
        try {
            const reference = positions(editor, "footnoteReference")[0]!;
            const definition = positions(editor, "footnoteDefinition")[0]!;
            expect(navigateToDefinition(editor, "a", reference.position)).toBe(true);
            expect(editor.state.selection.from).toBe(definition.position + 2);
            editor.view.dispatch(editor.state.tr.insertText("Prefix ", 1));
            expect(returnToReference(editor)).toBe(true);
            expect(editor.state.selection.from).toBe(reference.position + 7);
            expect(navigateToDefinition(editor, "missing", reference.position)).toBe(false);
        } finally {
            editor.destroy();
        }
    });

    it("drops return navigation when its reference has been removed", () => {
        const editor = createEditor("Body [^a].\n\n[^a]: First");
        try {
            const { position, node } = positions(editor, "footnoteReference")[0]!;
            navigateToDefinition(editor, "a", position);
            editor.commands.deleteRange({ from: position, to: position + node.nodeSize });
            expect(returnToReference(editor)).toBe(false);
        } finally {
            editor.destroy();
        }
    });

    it("serializes copied references and definitions as portable Markdown", () => {
        const editor = createEditor("Body [^a].\n\n[^a]: **Source**\n    continued\n\nAfterwards.");
        try {
            const slice = editor.state.doc.slice(0, editor.state.doc.content.size);
            let copied = "";
            editor.view.someProp("clipboardTextSerializer", (serialize) => {
                copied = serialize(slice, editor.view);
                return true;
            });
            expect(copied).toContain("[^a]: **Source**");
            const document = editor.getJSON();
            editor.commands.setContent(copied);
            expect(editor.getJSON()).toEqual(document);
        } finally {
            editor.destroy();
        }
    });
});
