import { Editor } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";
import { createExtensions } from "../extensions";
import { navigateToDefinition, returnToReference } from "./footnotes";

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
        const editor = createEditor("[^missing] [^__proto__] [^same]\n\n[^same]: First\n\n[^same]: Second\n\nAfterwards.");
        try {
            const document = editor.getJSON();
            editor.commands.setContent(editor.getMarkdown());
            expect(editor.getJSON()).toEqual(document);
            expect(positions(editor, "footnoteDefinition").map(({ node }) => node.textContent)).toEqual(["First", "Second"]);
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
