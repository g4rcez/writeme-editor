import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorGlobalRef } from "@/app/editor-global-ref";
import { buildPhoneToolbarActions, cycleHeading, PhoneKeyboardToolbar } from "./phone-keyboard-toolbar";

const mocks = vi.hoisted(() => ({ setPrompt: vi.fn() }));
vi.mock("@/store/ui.store", () => ({ uiDispatch: { setPrompt: mocks.setPrompt } }));

let editor: Editor;
const makeEditor = (content: string): Editor =>
    new Editor({
        element: document.body.appendChild(document.createElement("div")),
        extensions: [StarterKit],
        content,
    });

beforeEach(() => {
    editor = makeEditor("<p>hello world</p><p>plain</p>");
    // A text selection inside the first paragraph, like a user's; AllSelection behaves differently for block commands.
    editor.commands.setTextSelection({ from: 1, to: 6 });
    editorGlobalRef.current = editor;
    mocks.setPrompt.mockClear();
});
afterEach(() => {
    cleanup();
    editorGlobalRef.current = null;
    editor.destroy();
});

type Prompt = { title: string; onConfirm: (value: string) => void };
const promptAt = (index: number): Prompt => {
    const prompt = mocks.setPrompt.mock.calls[index]?.[0] as Prompt | undefined;
    if (!prompt) {throw new Error(`No prompt was opened at call ${index}`);}
    return prompt;
};

const action = (id: string) => {
    const found = buildPhoneToolbarActions(editor).find((candidate) => candidate.id === id);
    if (!found) {throw new Error(`Missing action ${id}`);}
    return found;
};

describe("phone toolbar actions", () => {
    it("toggles marks and lists on the live document and reports active state", () => {
        expect(action("bold").active).toBe(false);
        action("bold").run();
        expect(editor.isActive("bold")).toBe(true);
        expect(action("bold").active).toBe(true);
        action("bullet-list").run();
        expect(editor.isActive("bulletList")).toBe(true);
        action("bullet-list").run();
        expect(editor.isActive("bulletList")).toBe(false);
    });

    it("cycles heading levels back to a paragraph", () => {
        const seen: Array<string> = [];
        for (let step = 0; step < 4; step++) {
            cycleHeading(editor);
            seen.push(
                editor.isActive("heading", { level: 1 })
                    ? "h1"
                    : editor.isActive("heading", { level: 2 })
                      ? "h2"
                      : editor.isActive("heading", { level: 3 })
                        ? "h3"
                        : "p",
            );
        }
        expect(seen).toEqual(["h1", "h2", "h3", "p"]);
    });

    it("disables undo/redo until there is history and opens the slash menu from +", () => {
        expect(action("undo").disabled).toBe(true);
        action("bold").run();
        expect(action("undo").disabled).toBe(false);
        action("undo").run();
        expect(action("redo").disabled).toBe(false);
        editor.commands.setTextSelection(editor.state.doc.content.size - 1);
        action("insert").run();
        expect(editor.getText()).toContain("plain/");
    });

    it("asks for a URL and applies it to the selected text", () => {
        action("link").run();
        const prompt = promptAt(0);
        expect(prompt.title).toBe("Link");
        prompt.onConfirm(" https://writeme.dev ");
        expect(editor.getHTML()).toContain('href="https://writeme.dev"');
    });

    it("inserts the URL as linked text when nothing is selected", () => {
        editor.commands.setTextSelection(editor.state.doc.content.size - 1);
        action("link").run();
        promptAt(0).onConfirm("https://example.com");
        expect(editor.getHTML()).toMatch(/<a [^>]*href="https:\/\/example\.com"[^>]*>https:\/\/example\.com<\/a>/);
        expect(editor.getText()).toContain("https://example.com");
    });
});

describe("PhoneKeyboardToolbar", () => {
    it("renders accessible buttons and keeps editor focus when one is pressed", () => {
        render(<PhoneKeyboardToolbar />);
        expect(screen.getByRole("toolbar", { name: "Formatting" })).toBeTruthy();
        const bold = screen.getByRole("button", { name: "Bold" });
        // preventDefault on pointer/mouse down is what stops the tap from blurring the editor and closing the keyboard.
        expect(fireEvent.pointerDown(bold)).toBe(false);
        expect(fireEvent.mouseDown(bold)).toBe(false);
        fireEvent.click(bold);
        expect(editor.isActive("bold")).toBe(true);
        expect(screen.getByRole("button", { name: "Bold" }).getAttribute("aria-pressed")).toBe("true");
    });

    it("blurs the active element from the hide-keyboard button", () => {
        render(<PhoneKeyboardToolbar />);
        const input = document.body.appendChild(document.createElement("input"));
        input.focus();
        fireEvent.click(screen.getByRole("button", { name: "Hide keyboard" }));
        expect(document.activeElement).not.toBe(input);
        input.remove();
    });
});
