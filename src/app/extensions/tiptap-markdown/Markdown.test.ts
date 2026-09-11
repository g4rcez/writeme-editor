import type { EditorView } from "@tiptap/pm/view";
import type { BundledTheme } from "shiki";
import { Editor } from "@tiptap/core";
import { Mathematics } from "@tiptap/extension-mathematics";
import { Slice } from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { createExtensions } from "@/app/extensions";
import { Markdown } from "./Markdown";

describe("Markdown extension", () => {
    it("does not serialize a destroyed editor", () => {
        const element = document.createElement("div");
        document.body.append(element);
        const editor = new Editor({
            element,
            extensions: [StarterKit, Markdown],
            content: "Hello",
        });

        expect(editor.getMarkdown()).toBe("Hello");

        editor.destroy();

        expect(editor.getMarkdown()).toBe("");
    });

    it("parses and serializes inline and block LaTeX", () => {
        const element = document.createElement("div");
        document.body.append(element);
        const editor = new Editor({
            element,
            extensions: [StarterKit, Mathematics, Markdown],
            content: "Inline $x^2$ math.\n\n$$\n\\int_0^1 x\\,dx\n$$",
        });

        const nodeNames: string[] = [];
        editor.state.doc.descendants((node: { type: { name: string } }) => {
            nodeNames.push(node.type.name);
        });

        expect(nodeNames).toContain("inlineMath");
        expect(nodeNames).toContain("blockMath");
        expect(editor.getMarkdown()).toContain("Inline $x^2$ math.");
        expect(editor.getMarkdown()).toContain("$$\n\\int_0^1 x\\,dx\n$$");

        editor.destroy();
    });

    it("pastes Markdown as formatted content instead of a code block", () => {
        const element = document.createElement("div");
        document.body.append(element);
        const editor = new Editor({
            element,
            extensions: [StarterKit, Markdown],
            content: "Start",
        });
        const text = "## Heading\n\nThis is **formatted** text.";
        const event = {
            clipboardData: {
                getData: (type: string) => (type === "text/plain" ? text : ""),
                items: [],
                files: [],
            },
            preventDefault: () => undefined,
        } as unknown as ClipboardEvent;

        let handled = false;
        editor.view.someProp(
            "handlePaste",
            (handler: (view: EditorView, event: ClipboardEvent, slice: Slice) => boolean | void) => {
                handled = handler(editor.view, event, new Slice(editor.state.doc.content, 0, 0)) || handled;
                return false;
            },
        );

        expect(handled).toBe(true);
        expect(editor.state.doc.textContent).toContain("Heading");
        expect(editor.state.doc.firstChild?.type.name).toBe("heading");
        expect(editor.state.doc.firstChild?.type.name).not.toBe("codeBlock");

        editor.destroy();
    });

    it("parses Markdown syntax that was escaped by the source", () => {
        const element = document.createElement("div");
        document.body.append(element);
        const editor = new Editor({
            element,
            extensions: [StarterKit, Markdown],
            content: "Start",
        });
        const text = "\\## Heading\n\nThis is \\*\\*formatted\\*\\* text.\n\n&gt; quote";
        const event = {
            clipboardData: {
                getData: (type: string) => (type === "text/plain" ? text : ""),
                items: [],
                files: [],
            },
            preventDefault: () => undefined,
        } as unknown as ClipboardEvent;

        editor.view.someProp(
            "handlePaste",
            (handler: (view: EditorView, event: ClipboardEvent, slice: Slice) => boolean | void) => {
                handler(editor.view, event, new Slice(editor.state.doc.content, 0, 0));
                return false;
            },
        );

        expect(editor.state.doc.textContent).toContain("Heading");
        expect(editor.state.doc.firstChild?.type.name).toBe("heading");
        expect(
            editor.state.doc
                .child(1)
                .child(1)
                .marks.map((mark: { type: { name: string } }) => mark.type.name),
        ).toContain("bold");
        expect(editor.state.doc.child(2).type.name).toBe("blockquote");

        editor.destroy();
    });

    it("does not force Markdown paste into the active code block", () => {
        const element = document.createElement("div");
        document.body.append(element);
        const editor = new Editor({
            element,
            extensions: createExtensions(() => "github-dark" as BundledTheme),
            content: { type: "doc", content: [{ type: "codeBlock", content: [{ type: "text", text: "x" }] }] },
        });
        editor.commands.setTextSelection({ from: 1, to: 2 });
        const text = "\\## Heading\n\nThis is \\*\\*formatted\\*\\* text.";
        const event = {
            clipboardData: {
                getData: (type: string) => (type === "text/plain" ? text : ""),
                items: [],
                files: [],
            },
            preventDefault: () => undefined,
        } as unknown as ClipboardEvent;

        editor.view.someProp(
            "handlePaste",
            (handler: (view: EditorView, event: ClipboardEvent, slice: Slice) => boolean | void) => {
                handler(editor.view, event, new Slice(editor.state.doc.content, 0, 0));
                return false;
            },
        );

        expect(editor.state.doc.textContent).toContain("Heading");
        expect(editor.state.doc.firstChild?.type.name).toBe("heading");

        editor.destroy();
    });

    it("copies the raw LaTeX for math nodes", () => {
        const element = document.createElement("div");
        document.body.append(element);
        const editor = new Editor({
            element,
            extensions: createExtensions(() => "github-dark" as BundledTheme),
            content: {
                type: "doc",
                content: [
                    {
                        type: "paragraph",
                        content: [
                            { type: "text", text: "Inline " },
                            { type: "inlineMath", attrs: { latex: "x^2" } },
                            { type: "text", text: " math." },
                        ],
                    },
                    { type: "blockMath", attrs: { latex: "\\frac{1}{2}" } },
                ],
            },
        });

        expect(editor.state.doc.textBetween(0, editor.state.doc.content.size, "\n")).toBe(
            "Inline $x^2$ math.\n$$\n\\frac{1}{2}\n$$",
        );

        editor.destroy();
    });

    it("supports the math insertion commands", () => {
        const element = document.createElement("div");
        document.body.append(element);
        const editor = new Editor({
            element,
            extensions: [StarterKit, Mathematics, Markdown],
            content: "Text",
        });

        expect(editor.commands.insertInlineMath({ latex: "x + 1" })).toBe(true);
        expect(editor.commands.insertBlockMath({ latex: "x = 1" })).toBe(true);

        const nodeNames: string[] = [];
        editor.state.doc.descendants((node: { type: { name: string } }) => {
            nodeNames.push(node.type.name);
        });
        expect(nodeNames).toContain("inlineMath");
        expect(nodeNames).toContain("blockMath");

        editor.destroy();
    });
});
