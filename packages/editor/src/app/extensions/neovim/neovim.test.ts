import { Editor } from "@tiptap/core";
import { TableKit } from "@tiptap/extension-table";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Neovim } from "./index";

const editors: Editor[] = [];

function create(content = "<p>one two three four five six seven</p>"): Editor {
    const editor = new Editor({
        extensions: [StarterKit.configure({ trailingNode: false }), TableKit, Neovim.configure({ enabled: true })],
        content,
    });
    editors.push(editor);
    return editor;
}

function press(editor: Editor, keys: string): void {
    editor.storage.neovim.feedKeys(keys);
}

afterEach(() => {
    editors.splice(0).forEach((editor) => editor.destroy());
    vi.useRealTimers();
});

describe("neovim", () => {
    it("puts a deleted code line back inside its code block", () => {
        const editor = create("<pre><code>one\ntwo\nthree</code></pre>");
        press(editor, "jddP");
        expect(editor.getHTML()).toContain("<code>one\ntwo\nthree</code>");
    });

    it("changes a code line without joining its following line", () => {
        const editor = create("<pre><code>one\ntwo\nthree</code></pre>");
        press(editor, "jccNEW<Esc>");
        expect(editor.getHTML()).toContain("<code>one\nNEW\nthree</code>");
    });

    it("repeats Replace-mode edits by overwriting text", () => {
        const editor = create("<p>one two</p>");
        press(editor, "RXY<Esc>w.");
        expect(editor.getText()).toBe("XYe XYo");
    });
    it("deletes the previous word with Ctrl-W in Insert mode", () => {
        const editor = create("<p>one two</p>");
        press(editor, "A word");
        editor.storage.neovim.feed("<C-w>");
        expect(editor.getText()).toBe("one two ");
        expect(editor.storage.neovim.getState()?.mode).toBe("insert");
    });
    it("deletes a word with Ctrl-W in Normal mode while allowing custom mappings to override it", () => {
        const editor = create("<p>one two</p>");
        editor.storage.neovim.feed("<C-w>");
        expect(editor.getText()).toBe("two");

        const customized = create("<p>one two</p>");
        customized.storage.neovim.keymap.set("normal", "<C-w>", "x");
        customized.storage.neovim.feed("<C-w>");
        expect(customized.getText()).toBe("ne two");
    });
    it("repeats a Visual deletion using the previous selection size", () => {
        const editor = create("<p>abcdefghi</p>");
        press(editor, "vlld.");
        expect(editor.getText()).toBe("ghi");
    });

    it("repeats a Visual change with its inserted text", () => {
        const editor = create("<p>one two three</p>");
        press(editor, "vllcNEW<Esc>w.");
        expect(editor.getText()).toBe("NEW NEW three");
    });

    it("cancels pending timers and restores buffered text when disabled through a command", () => {
        vi.useFakeTimers();
        const editor = create("<p></p>");
        editor.storage.neovim.keymap.set("insert", "jk", "<Esc>");
        press(editor, "ij");
        editor.commands.setNeovimEnabled(false);
        vi.advanceTimersByTime(1000);
        expect(editor.getText()).toBe("j");
        expect(editor.storage.neovim.getState()?.enabled).toBe(false);
    });
    it("moves within code blocks and preserves the block after deleting a line", () => {
        const editor = create("<pre><code>one\ntwo\nthree</code></pre><p>end</p>");
        press(editor, "jdd");
        expect(editor.getHTML()).toContain("<code>one\nthree</code>");
    });

    it("treats hard breaks as logical lines", () => {
        const editor = create("<p>one<br>two<br>three</p>");
        press(editor, "j0x");
        expect(editor.getHTML()).toBe("<p>one<br>wo<br>three</p>");
    });

    it("deletes list-item text without removing neighbouring items", () => {
        const editor = create("<ul><li><p>one</p></li><li><p>two</p></li></ul>");
        press(editor, "dd");
        expect(editor.getText()).not.toContain("one");
        expect(editor.getText()).toContain("two");
        expect(editor.getHTML()).toContain("<ul>");
    });

    it("selects and deletes complete lines in Visual Line mode", () => {
        const editor = create("<p>one</p><p>two</p><p>three</p>");
        press(editor, "Vjd");
        expect(editor.getHTML()).toBe("<p>three</p>");
    });

    it("expands Operator-pending mappings while preserving both counts", () => {
        const editor = create();
        editor.storage.neovim.keymap.set("operator-pending", "z", "w");
        press(editor, "2d3z");
        expect(editor.getText()).toBe("seven");
    });

    it("expands a Command-mode mapping in the prompt", () => {
        const editor = create("<p>one two</p>");
        editor.storage.neovim.keymap.set("command", "Q", "two");
        press(editor, "/Q<CR>");
        expect(editor.state.selection.head).toBe(5);
    });

    it("flushes buffered Insert keys when leaving the editor", () => {
        const editor = create("<p></p>");
        editor.storage.neovim.keymap.set("insert", "jk", "<Esc>");
        press(editor, "ij");
        editor.view.dom.dispatchEvent(new FocusEvent("blur"));
        expect(editor.getText()).toBe("j");
    });

    it("flushes buffered Insert keys before Escape", () => {
        const editor = create("<p></p>");
        editor.storage.neovim.keymap.set("insert", "jk", "<Esc>");
        press(editor, "ij<Esc>");
        expect(editor.getText()).toBe("j");
        expect(editor.storage.neovim.getState()?.mode).toBe("normal");
    });

    it("executes a shorter mapping when a longer mapping stops matching", () => {
        const editor = create("<p>one two</p>");
        editor.storage.neovim.keymap.set("normal", "Q", "x");
        editor.storage.neovim.keymap.set("normal", "QQ", "dw");
        press(editor, "Qx");
        expect(editor.getText()).toBe("e two");
    });

    it("multiplies operator and motion counts", () => {
        const editor = create();
        press(editor, "2d3w");
        expect(editor.getText()).toBe("seven");
        expect(editor.storage.neovim.getState()?.mode).toBe("normal");
    });

    it("changes the inner word and repeats the semantic change at a new cursor", () => {
        const editor = create("<p>one two three</p>");
        press(editor, "ciwNEW<Esc>w.");
        expect(editor.getText()).toBe("NEW NEW three");
    });

    it("treats change-word as an inclusive end-of-word motion", () => {
        const editor = create("<p>one two</p>");
        press(editor, "cwNEW<Esc>");
        expect(editor.getText()).toBe("NEW two");
    });

    it("keeps Unicode graphemes intact when deleting characters", () => {
        const editor = create("<p>👨‍👩‍👧‍👦éZ</p>");
        press(editor, "x");
        expect(editor.getText()).toBe("éZ");
        press(editor, "x");
        expect(editor.getText()).toBe("Z");
    });

    it("preserves the desired column through a shorter line", () => {
        const editor = create("<p>abcdef</p><p>x</p><p>abcdef</p>");
        press(editor, "4ljj");
        expect(editor.state.selection.$head.parentOffset).toBe(4);
        expect(editor.state.selection.head).toBe(16);
    });

    it("includes the character under the visual cursor", () => {
        const editor = create("<p>abcdef</p>");
        press(editor, "vlld");
        expect(editor.getText()).toBe("def");
    });

    it("supports a reversed visual selection", () => {
        const editor = create("<p>abcdef</p>");
        press(editor, "3lvhhd");
        expect(editor.getText()).toBe("aef");
    });

    it("yanks and puts formatted text", () => {
        const editor = create("<p><strong>one</strong> two</p>");
        press(editor, "yiw$p");
        expect(editor.getHTML()).toContain("<strong>one</strong>");
        expect(editor.getText()).toBe("one twoone");
        expect(editor.getHTML().match(/<strong>one<\/strong>/gu)).toHaveLength(2);
    });

    it("deletes and restores full paragraphs with linewise registers", () => {
        const editor = create("<p>one</p><p>two</p><p>three</p>");
        press(editor, "ddP");
        expect(editor.getHTML()).toBe("<p>one</p><p>two</p><p>three</p>");
    });

    it("keeps an editable empty document after deleting its last line", () => {
        const editor = create("<p>one</p>");
        press(editor, "ddiNEW<Esc>");
        expect(editor.getText()).toBe("NEW");
    });

    it("changes a line while preserving its heading type", () => {
        const editor = create("<h2>Heading</h2><p>next</p>");
        press(editor, "ccNew<Esc>");
        expect(editor.getHTML()).toBe("<h2>New</h2><p>next</p>");
    });

    it("does not delete across isolated table cells", () => {
        const editor = create("<table><tbody><tr><td><p>one</p></td><td><p>two</p></td></tr></tbody></table>");
        const html = editor.getHTML();
        press(editor, "dG");
        expect(editor.getHTML()).toBe(html);
        expect(editor.storage.neovim.getState()?.message).toContain("boundary");
    });

    it("opens a new line in the same block container", () => {
        const editor = create("<blockquote><p>one</p></blockquote>");
        press(editor, "oNEW<Esc>");
        expect(editor.getHTML()).toBe("<blockquote><p>one</p><p>NEW</p></blockquote>");
    });

    it("appends after the last character of a line", () => {
        const editor = create("<p>one</p>");
        press(editor, "A!<Esc>");
        expect(editor.getText()).toBe("one!");
    });

    it("supports replace mode and single-character replacement", () => {
        const editor = create("<p>abcdef</p>");
        press(editor, "RXY<Esc>0rZ");
        expect(editor.getText()).toBe("ZYcdef");
    });

    it("searches through mark boundaries and wraps to earlier matches", () => {
        const editor = create("<p>one <strong>tw</strong>o one</p>");
        press(editor, "/two<CR>");
        expect(editor.state.selection.head).toBe(5);
        press(editor, "/one<CR>n");
        expect(editor.state.selection.head).toBe(1);
    });

    it("jumps to a counted logical line", () => {
        const editor = create("<p>one</p><p>two</p><p>three</p>");
        press(editor, "2G");
        expect(editor.state.selection.head).toBe(6);
        press(editor, "gg");
        expect(editor.state.selection.head).toBe(1);
    });

    it("cancels a pending operator without changing content", () => {
        const editor = create();
        press(editor, "d<Esc>");
        expect(editor.getText()).toBe("one two three four five six seven");
        expect(editor.storage.neovim.getState()?.mode).toBe("normal");
    });

    it("undoes a change-word operation including its inserted text", () => {
        const editor = create("<p>one two</p>");
        press(editor, "ciwNEW<Esc>u");
        expect(editor.getText()).toBe("one two");
    });

    it("undoes and redoes a deletion", () => {
        const editor = create("<p>one two</p>");
        press(editor, "dwu<C-r>");
        expect(editor.getText()).toBe("two");
    });

    it("keeps mappings and modal state local to each editor", () => {
        const first = create();
        const second = create();
        first.storage.neovim.keymap.set("normal", "Q", "dw");
        press(first, "Q");
        press(second, "Q");
        expect(first.getText()).toBe("two three four five six seven");
        expect(second.getText()).toBe("one two three four five six seven");
    });

    it("supports leader callbacks and removing mappings", () => {
        const editor = create("<p>one</p>");
        editor.storage.neovim.keymap.set("normal", "<leader>b", ({ editor: current }) => current.commands.toggleBold());
        press(editor, " biX<Esc>");
        expect(editor.getHTML()).toContain("<strong>X</strong>");
        editor.storage.neovim.keymap.del("normal", "<leader>b");
        expect(editor.storage.neovim.keymap.list()).toEqual([]);
    });

    it("waits for ambiguous mappings then executes the shorter mapping", () => {
        vi.useFakeTimers();
        const editor = create("<p>one two</p>");
        editor.storage.neovim.keymap.set("normal", "Q", "x");
        editor.storage.neovim.keymap.set("normal", "QQ", "dw");
        press(editor, "Q");
        expect(editor.getText()).toBe("one two");
        vi.advanceTimersByTime(600);
        expect(editor.getText()).toBe("ne two");
    });

    it("flushes unmatched insert mapping prefixes without losing text", () => {
        const editor = create("<p></p>");
        editor.storage.neovim.keymap.set("insert", "jk", "<Esc>");
        press(editor, "ijX<Esc>");
        expect(editor.getText()).toBe("jX");
    });

    it("stops recursive mappings at the expansion limit", () => {
        const editor = create();
        editor.storage.neovim.keymap.set("normal", "Q", "Q", { remap: true });
        press(editor, "Q");
        expect(editor.storage.neovim.getState()?.message).toContain("20");
    });

    it("composes a registered motion with a built-in operator", () => {
        const editor = create("<p>one two</p>");
        editor.storage.neovim.motions.register("z", ({ state }) => ({
            pos: state.selection.head + 3,
            inclusive: false,
            shape: "character",
        }));
        press(editor, "dz");
        expect(editor.getText()).toBe(" two");
    });

    it("composes a registered text object with a custom operator", () => {
        const editor = create("<p>one two</p>");
        editor.storage.neovim.textObjects.register("iz", () => ({ from: 1, to: 4, shape: "character" }));
        editor.storage.neovim.operators.register("q", ({ tr, range }) => {
            tr.insertText("NEW", range.from, range.to);
            return true;
        });
        press(editor, "qiz");
        expect(editor.getText()).toBe("NEW two");
    });

    it("ignores keys while disabled or read-only", () => {
        const editor = create();
        editor.storage.neovim.setEnabled(false);
        press(editor, "dd");
        editor.storage.neovim.setEnabled(true);
        editor.setEditable(false);
        press(editor, "dd");
        expect(editor.getText()).toBe("one two three four five six seven");
    });

    it("does not consume composition key events", () => {
        const editor = create();
        const event = new KeyboardEvent("keydown", { key: "x", isComposing: true, bubbles: true, cancelable: true });
        editor.view.dom.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
        expect(editor.getText()).toBe("one two three four five six seven");
    });
});
