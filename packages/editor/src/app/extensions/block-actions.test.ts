import { Editor, Node } from "@tiptap/core";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { UniqueID } from "@tiptap/extension-unique-id";
import { NodeSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import GlobalDragHandle from "tiptap-extension-global-drag-handle";

import {
    BlockActions,
    type BlockTarget,
    conversionOptions,
    convert,
    currentTarget,
    duplicate,
    move,
    targetAt,
} from "./block-actions";
import { Neovim } from "./neovim";

const editors: Editor[] = [];
const Media = Node.create({
    name: "image",
    group: "block",
    atom: true,
    addAttributes: () => ({
        src: { default: null },
        alt: { default: null },
        width: { default: null },
    }),
    parseHTML: () => [{ tag: "img" }],
    renderHTML: ({ HTMLAttributes }) => ["img", HTMLAttributes],
});

function create(content: string): Editor {
    const element = document.createElement("div");
    document.body.append(element);
    const editor = new Editor({
        element,
        extensions: [
            StarterKit.configure({ trailingNode: false }),
            TaskList,
            TaskItem.configure({ nested: true }),
            TableKit,
            Media,
            UniqueID.configure({ types: ["heading"] }),
            GlobalDragHandle,
            Neovim,
            BlockActions,
        ],
        content,
    });
    editors.push(editor);
    return editor;
}

function target(editor: Editor, text: string): BlockTarget {
    let position = -1;
    editor.state.doc.descendants((node, pos) => {
        if (node.isText && node.text === text) position = pos;
    });
    const block = targetAt(editor.view, position);
    if (!block) throw new Error(`No block for ${text}`);
    return block;
}

afterEach(() => {
    editors.splice(0).forEach((editor) => editor.destroy());
    document.body.replaceChildren();
});

describe("block actions", () => {
    it("targets document boundaries and selected atoms without resolving a missing depth", () => {
        const editor = create('<p>first</p><img src="asset.png" alt="sample" width="140">');
        expect(targetAt(editor.view, 0)?.node.type.name).toBe("paragraph");
        expect(targetAt(editor.view, editor.state.doc.content.size)).toBeNull();
        editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, 7)));
        expect(currentTarget(editor.view)?.node.type.name).toBe("image");
    });

    it("moves only adjacent siblings, preserves ordered-list attributes and supports undo", () => {
        const editor = create(
            '<ol start="4"><li><p>one</p><ul><li><p>nested</p></li></ul></li><li><p>two</p></li></ol><p>end</p>',
        );
        const before = editor.getJSON();
        expect(move(editor.view, target(editor, "one"), -1)).toBe(false);
        expect(move(editor.view, target(editor, "one"), 1)).toBe(true);
        editor.state.doc.check();
        expect(editor.state.doc.firstChild?.attrs.start).toBe(4);
        expect(editor.state.doc.firstChild?.firstChild?.textContent).toBe("two");
        expect(editor.getText()).toContain("nested");
        expect(editor.commands.undo()).toBe(true);
        expect(editor.getJSON()).toEqual(before);
        expect(move(editor.view, target(editor, "two"), 1)).toBe(false);
    });

    it("moves and duplicates nested checklist items without changing completion or children", () => {
        const editor = create(
            '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>parent</p><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>one</p></li><li data-type="taskItem" data-checked="false"><p>two</p></li></ul></li></ul>',
        );
        const block = target(editor, "one");
        expect(block.depth).toBe(4);
        expect(move(editor.view, block, 1)).toBe(true);
        expect(target(editor, "one").node.attrs.checked).toBe(true);
        expect(duplicate(editor.view, target(editor, "one"))).toBe(true);
        editor.state.doc.check();
        expect(editor.getText().match(/one/g)).toHaveLength(2);
        expect(target(editor, "parent").node.attrs.checked).toBe(true);
    });

    it("duplicates heading identities uniquely and retains them when reordering", () => {
        const editor = create('<h2 data-id="original"><strong>section</strong></h2><p>end</p>');
        const original = target(editor, "section").node;
        expect(duplicate(editor.view, target(editor, "section"))).toBe(true);
        const copied = editor.state.doc.child(1);
        expect(copied.content.eq(original.content)).toBe(true);
        expect(copied.attrs.id).toBeTruthy();
        expect(copied.attrs.id).not.toBe(original.attrs.id);
        expect(move(editor.view, { node: copied, pos: original.nodeSize, depth: 1 }, 1)).toBe(true);
        expect(editor.state.doc.lastChild?.attrs.id).toBe(copied.attrs.id);
        expect(editor.state.doc.firstChild?.attrs.id).toBe(original.attrs.id);
        expect(editor.commands.undo()).toBe(true);
        expect(editor.state.doc.child(1).attrs.id).toBe(copied.attrs.id);
        expect(editor.commands.undo()).toBe(true);
        expect(editor.state.doc.childCount).toBe(2);
    });

    it.each([
        '<pre><code class="language-typescript">const value = 42;</code></pre>',
        '<img src="asset.png" alt="sample" width="140">',
        "<table><tbody><tr><td><p>cell</p></td></tr></tbody></table>",
    ])("preserves complex block metadata and rejects conversion: %s", (content) => {
        const editor = create(`${content}<p>end</p>`);
        const original = editor.state.doc.firstChild!;
        const block = { node: original, pos: 0, depth: 1 };
        expect(conversionOptions(editor.view, block)).toEqual([]);
        expect(duplicate(editor.view, block)).toBe(true);
        expect(editor.state.doc.child(1).eq(original)).toBe(true);
        expect(move(editor.view, { node: original, pos: 0, depth: 1 }, 1)).toBe(true);
        editor.state.doc.check();
    });

    it.each(["Heading 2", "Bulleted list", "Numbered list", "Checklist", "Quote"])(
        "converts a paragraph to %s without losing inline marks and undoes it",
        (label) => {
            const editor = create(
                '<p><strong>bold</strong> <a href="https://example.com">link</a></p><p>end</p>',
            );
            const original = editor.getJSON();
            const block = targetAt(editor.view, 1)!;
            const option = conversionOptions(editor.view, block).find((item) => item.label === label)!;
            expect(convert(editor.view, block, option)).toBe(true);
            editor.state.doc.check();
            expect(editor.getHTML()).toContain("<strong>bold</strong>");
            expect(editor.getHTML()).toContain('href="https://example.com"');
            expect(editor.commands.undo()).toBe(true);
            expect(editor.getJSON()).toEqual(original);
        },
    );

    it("converts headings to schema-valid lists and refuses destructive wrapper conversion", () => {
        const editor = create("<h2>section</h2><blockquote><p>first</p><p>second</p></blockquote>");
        const block = target(editor, "section");
        const list = conversionOptions(editor.view, block).find((item) => item.label === "Bulleted list")!;
        expect(convert(editor.view, block, list)).toBe(true);
        editor.state.doc.check();
        expect(editor.state.doc.firstChild?.firstChild?.firstChild?.type.name).toBe("paragraph");
        expect(conversionOptions(editor.view, target(editor, "first"))).toEqual([]);
    });

    it("does not mutate a multi-block selection, stale target or read-only editor", () => {
        const editor = create("<p>first</p><p>second</p>");
        const original = editor.getJSON();
        editor.commands.setTextSelection({ from: 2, to: 11 });
        expect(currentTarget(editor.view)).toBeNull();
        const stale = target(editor, "first");
        editor.commands.insertContent("new");
        expect(duplicate(editor.view, stale)).toBe(false);
        editor.commands.setContent(original);
        editor.setEditable(false);
        expect(duplicate(editor.view, target(editor, "first"))).toBe(false);
        expect(editor.getJSON()).toEqual(original);
    });

    it("attaches to the existing handle, supports keyboard opening and cleans up its menu", () => {
        const editor = create("<p>first</p><p>last</p>");
        editor.view.dom.dispatchEvent(
            new KeyboardEvent("keydown", {
                code: "KeyM",
                key: "M",
                altKey: true,
                shiftKey: true,
                bubbles: true,
                cancelable: true,
            }),
        );
        const menu = document.querySelector<HTMLElement>('[role="menu"][aria-label="Block actions"]')!;
        expect(menu.hidden).toBe(false);
        expect(document.activeElement?.textContent).toBe("Duplicate");
        expect(menu.querySelectorAll("button")[1]?.disabled).toBe(true);
        editor.destroy();
        editors.splice(editors.indexOf(editor), 1);
        expect(menu.isConnected).toBe(false);
    });

    it("keeps Vim's cursor authoritative when a native selection change is pending", () => {
        const editor = create("<p>first</p><p>last</p>");
        editor.commands.setNeovimEnabled(true);
        editor.view.focus();
        editor.storage.neovim.feedKeys("gg0");
        const paragraph = editor.view.dom.querySelectorAll("p")[1]!;
        const range = document.createRange();
        range.selectNodeContents(paragraph);
        range.collapse(false);
        const selection = window.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
        editor.view.dom.dispatchEvent(
            new KeyboardEvent("keydown", {
                code: "KeyM",
                key: "M",
                keyCode: 77,
                altKey: true,
                shiftKey: true,
                bubbles: true,
                cancelable: true,
            }),
        );
        const menu = document.querySelector<HTMLElement>('[role="menu"][aria-label="Block actions"]')!;
        expect(menu.hidden).toBe(false);
        expect(menu.querySelectorAll("button")[1]?.disabled).toBe(true);
    });

    it("uses the native cursor's latest block when the shortcut immediately follows a mouse selection", () => {
        const editor = create("<p>first</p><p>last</p>");
        editor.view.focus();
        const paragraph = editor.view.dom.querySelectorAll("p")[1]!;
        const range = document.createRange();
        range.selectNodeContents(paragraph);
        range.collapse(false);
        const selection = window.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
        editor.view.dom.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        editor.view.dom.dispatchEvent(
            new KeyboardEvent("keydown", {
                code: "KeyM",
                key: "M",
                keyCode: 77,
                altKey: true,
                shiftKey: true,
                bubbles: true,
                cancelable: true,
            }),
        );
        const menu = document.querySelector<HTMLElement>('[role="menu"][aria-label="Block actions"]')!;
        expect(menu.hidden).toBe(false);
        expect(menu.querySelectorAll("button")[2]?.disabled).toBe(true);
    });

    it("opens block actions on the first click after a drag ends", () => {
        const editor = create("<p>first</p><p>last</p>");
        const handle = editor.view.dom.parentElement!.querySelector<HTMLElement>(".drag-handle")!;
        handle.dispatchEvent(new Event("dragstart"));
        handle.dispatchEvent(new Event("dragend"));
        handle.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
        handle.click();
        const menu = document.querySelector<HTMLElement>('[role="menu"][aria-label="Block actions"]')!;
        expect(menu.hidden).toBe(false);
    });

    it("refreshes a block target after the document changes", () => {
        const editor = create("<p>first</p><p>last</p>");
        const handle = editor.view.dom.parentElement!.querySelector<HTMLElement>(".drag-handle")!;
        handle.click();
        editor.commands.setContent("<p>replacement</p>");
        handle.click();
        const menu = document.querySelector<HTMLElement>('[role="menu"][aria-label="Block actions"]')!;
        menu.querySelector<HTMLButtonElement>("button")!.click();
        expect(editor.getText().match(/replacement/g)).toHaveLength(2);
    });

    it("keeps a keyboard-selected code block when its native cursor update is pending", () => {
        const editor = create("<pre><code>const value = 42;</code></pre><p>last</p>");
        editor.commands.setTextSelection(1);
        editor.view.focus();
        const range = document.createRange();
        range.selectNodeContents(editor.view.dom.querySelector("p")!);
        range.collapse(false);
        const selection = window.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
        editor.view.dom.dispatchEvent(
            new KeyboardEvent("keydown", {
                code: "KeyM",
                key: "M",
                keyCode: 77,
                altKey: true,
                shiftKey: true,
                bubbles: true,
                cancelable: true,
            }),
        );
        const menu = document.querySelector<HTMLElement>('[role="menu"][aria-label="Block actions"]')!;
        expect(menu.hidden).toBe(false);
        expect(menu.textContent).toContain("cannot be converted without losing content");
    });
});
