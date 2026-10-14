import { Editor } from "@tiptap/core";
import UniqueID from "@tiptap/extension-unique-id";
import { TextSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CollapsibleHeadings, REVEAL_HEADING_EVENT } from "./collapsible-headings";
import { Neovim } from "./neovim";
import { Markdown } from "./tiptap-markdown/Markdown";

const editors: Editor[] = [];
const content = "<h1>Parent</h1><p>Intro</p><h2>Child</h2><p>Hidden words</p><h1>Next</h1><p>Visible</p>";

async function create(noteId = "one", html = content): Promise<Editor> {
    const editor = new Editor({
        extensions: [
            StarterKit,
            UniqueID.configure({ types: ["heading"] }),
            CollapsibleHeadings.configure({ noteId }),
            Markdown,
            Neovim,
        ],
        content: html,
    });
    editors.push(editor);
    await new Promise((resolve) => setTimeout(resolve, 5));
    return editor;
}

function toggle(editor: Editor, text: string): void {
    const button = editor.view.dom.querySelector<HTMLButtonElement>(`button[aria-label="Collapse ${text}"]`);
    if (!button) throw new Error(`Missing disclosure: ${text}`);
    button.click();
}

beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
    });
});

afterEach(() => {
    editors.splice(0).forEach((editor) => editor.destroy());
    vi.unstubAllGlobals();
});

it("restores a section after Markdown reparsing assigns new heading IDs", async () => {
    const first = await create();
    toggle(first, "Child");
    const second = await create();
    expect(second.view.dom.querySelector('button[aria-label="Expand Child"]')).not.toBeNull();
    expect(second.view.dom.querySelector(".writeme-heading-folded-block")?.textContent).toBe("Hidden words");
    expect((await create("two")).view.dom.querySelector(".writeme-heading-folded-block")).toBeNull();
});

it("reveals content when removing a heading changes a folded section boundary", async () => {
    const editor = await create();
    toggle(editor, "Parent");
    let nextPos = 0;
    editor.state.doc.forEach((node, pos) => {
        if (node.textContent === "Next") nextPos = pos;
    });
    editor.view.dispatch(editor.state.tr.setNodeMarkup(nextPos, editor.schema.nodes.paragraph));
    expect(editor.view.dom.querySelector(".writeme-heading-folded-block")).toBeNull();
    expect(editor.getText()).toContain("Hidden words");
});

it("keeps nested folds independent and folding out of Markdown and undo history", async () => {
    const editor = await create();
    const before = editor.getMarkdown();
    const doc = editor.getJSON();
    toggle(editor, "Child");
    toggle(editor, "Parent");
    editor.view.dom.querySelector<HTMLButtonElement>('button[aria-label="Expand Parent"]')!.click();
    expect(editor.view.dom.querySelectorAll(".writeme-heading-folded-block")).toHaveLength(1);
    expect(editor.view.dom.querySelector('button[aria-label="Expand Child"]')).not.toBeNull();
    expect(editor.getMarkdown()).toBe(before);
    expect(editor.getJSON()).toEqual(doc);
    expect(editor.commands.undo()).toBe(false);
});

it("reveals all ancestors when a range starts outside and ends inside a folded section", async () => {
    const editor = await create();
    toggle(editor, "Child");
    toggle(editor, "Parent");
    let target = 0;
    editor.state.doc.forEach((node, pos) => {
        if (node.textContent === "Hidden words") target = pos + 2;
    });
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 1, target)));
    expect(editor.view.dom.querySelector(".writeme-heading-folded-block")).toBeNull();
});

it("moves a hidden caret to its visible heading when collapsing all", async () => {
    const editor = await create();
    let target = 0;
    editor.state.doc.forEach((node, pos) => {
        if (node.textContent === "Hidden words") target = pos + 1;
    });
    editor.commands.setTextSelection(target);
    editor.commands.collapseAllSections();
    expect(editor.state.selection.$from.parent.textContent).toBe("Parent");
    expect(editor.view.dom.querySelectorAll(".writeme-heading-folded-block")).toHaveLength(4);
    editor.commands.expandAllSections();
    expect(editor.view.dom.querySelector(".writeme-heading-folded-block")).toBeNull();
});

it("reveals only the navigated branch of the outline", async () => {
    const editor = await create("one", content + "<h2>Other child</h2><p>Other body</p>");
    editor.commands.collapseAllSections();
    window.dispatchEvent(
        new CustomEvent(REVEAL_HEADING_EVENT, { detail: { element: editor.view.dom.querySelector("h2") } }),
    );
    expect(editor.view.dom.querySelector('button[aria-label="Collapse Child"]')).not.toBeNull();
    expect(editor.view.dom.querySelector('button[aria-label="Expand Next"]')).not.toBeNull();
    expect(editor.view.dom.querySelectorAll(".writeme-heading-folded-block")).toHaveLength(3);
});

it("distinguishes repeated headings after reload", async () => {
    const editor = await create("duplicates", "<h2>Same</h2><p>First</p><h2>Same</h2><p>Second</p>");
    editor.view.dom.querySelectorAll<HTMLButtonElement>("button")[1]!.click();
    const reloaded = await create("duplicates", editor.getMarkdown());
    expect(reloaded.view.dom.querySelectorAll(".writeme-heading-folded-block")).toHaveLength(1);
    expect(reloaded.view.dom.querySelector(".writeme-heading-folded-block")?.textContent).toBe("Second");
});

it("expands after a heading edit and undo without losing section text", async () => {
    const editor = await create();
    toggle(editor, "Parent");
    editor.view.dispatch(editor.state.tr.insertText("Revised ", 1));
    expect(editor.view.dom.querySelector(".writeme-heading-folded-block")).toBeNull();
    editor.commands.undo();
    expect(editor.getText()).toContain("Hidden words");
    expect(editor.view.dom.querySelector(".writeme-heading-folded-block")).toBeNull();
});

it("uses modified bracket commands without stealing Vim or composition keys", async () => {
    const editor = await create();
    editor.commands.setNeovimEnabled(true);
    editor.view.dom.dispatchEvent(
        new KeyboardEvent("keydown", {
            key: "[",
            code: "BracketLeft",
            metaKey: true,
            altKey: true,
            isComposing: true,
            bubbles: true,
            cancelable: true,
        }),
    );
    expect(editor.view.dom.querySelector(".writeme-heading-folded-block")).toBeNull();
    editor.view.dom.dispatchEvent(
        new KeyboardEvent("keydown", {
            key: "[",
            code: "BracketLeft",
            metaKey: true,
            altKey: true,
            bubbles: true,
            cancelable: true,
        }),
    );
    expect(editor.view.dom.querySelector('button[aria-label="Expand Parent"]')).not.toBeNull();
    editor.view.dom.dispatchEvent(
        new KeyboardEvent("keydown", {
            key: "]",
            code: "BracketRight",
            metaKey: true,
            altKey: true,
            bubbles: true,
            cancelable: true,
        }),
    );
    expect(editor.view.dom.querySelector('button[aria-label="Collapse Parent"]')).not.toBeNull();
    editor.storage.neovim.feedKeys("j");
    expect(editor.getText()).toContain("Hidden words");
    expect(editor.view.dom.querySelector(".writeme-heading-folded-block")).toBeNull();
});

it.each(["edit-first", "fold-first"])("retains undo for chained view commands (%s)", async (order) => {
    const editor = await create();
    const before = editor.getMarkdown();
    const chain = editor.chain();
    if (order === "edit-first") chain.insertContent("Changed ").collapseAllSections();
    else chain.collapseAllSections().insertContent("Changed ");
    chain.run();
    expect(editor.getMarkdown()).toContain("Changed");
    expect(editor.commands.undo()).toBe(true);
    expect(editor.getMarkdown()).toBe(before);
});

it("leaves AltGr bracket input available for international keyboards", async () => {
    const editor = await create();
    const event = new KeyboardEvent("keydown", {
        key: "[",
        code: "BracketLeft",
        ctrlKey: true,
        altKey: true,
        bubbles: true,
        cancelable: true,
    });
    vi.spyOn(event, "getModifierState").mockImplementation((modifier) => modifier === "AltGraph");
    editor.view.dom.dispatchEvent(event);
    expect(editor.view.dom.querySelector(".writeme-heading-folded-block")).toBeNull();
    expect(event.defaultPrevented).toBe(false);
});

it("works in read-only notes and when storage fails, and omits empty sections", async () => {
    vi.stubGlobal("localStorage", {
        getItem: () => {
            throw new Error("Blocked");
        },
        setItem: () => {
            throw new Error("Quota");
        },
        removeItem: () => {
            throw new Error("Blocked");
        },
    });
    const editor = await create("one", "<h1>Empty</h1><h1>Section</h1><p>Body</p><h1>Last</h1>");
    editor.setEditable(false);
    expect(editor.view.dom.querySelector('button[aria-label="Collapse Empty"]')).toBeNull();
    toggle(editor, "Section");
    expect(editor.view.dom.querySelector(".writeme-heading-folded-block")?.textContent).toBe("Body");
    expect(editor.getText()).toContain("Body");
});
