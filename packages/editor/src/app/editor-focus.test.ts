import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initializeEditorDocument } from "./editor-initialization";
import { createExtensions } from "./extensions";

const editors: Editor[] = [];
const touchEnd = Object.getOwnPropertyDescriptor(Document.prototype, "ontouchend");
const platforms = [
    { name: "Android", platform: "Linux armv8l", userAgent: "Mozilla/5.0 (Linux; Android 15) Chrome/140.0.0.0" },
    { name: "iOS", platform: "iPhone", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Safari/604.1" },
    { name: "Safari", platform: "MacIntel", userAgent: "Mozilla/5.0 (Macintosh) Version/18.0 Safari/605.1.15" },
    { name: "Chromium", platform: "Linux x86_64", userAgent: "Mozilla/5.0 (X11; Linux x86_64) Chrome/140.0.0.0" },
];

function create(content: string, autofocus = false, onUpdate = vi.fn()): Editor {
    const element = document.createElement("div");
    document.body.append(element);
    const editor = new Editor({
        element,
        extensions: [StarterKit],
        content,
        autofocus,
        onMount: initializeEditorDocument,
        onUpdate,
    });
    editors.push(editor);
    return editor;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
    editors.splice(0).forEach((editor) => editor.destroy());
    document.body.replaceChildren();
    vi.restoreAllMocks();
    if (touchEnd) Object.defineProperty(Document.prototype, "ontouchend", touchEnd);
    vi.useRealTimers();
});

describe.each(platforms)("$name editor focus", ({ platform, userAgent }) => {
    beforeEach(() => {
        vi.spyOn(navigator, "platform", "get").mockReturnValue(platform as typeof navigator.platform);
        vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
        if (platform === "MacIntel") {
            // jsdom exposes touch handlers even though this case exercises desktop Safari.
            Reflect.deleteProperty(Document.prototype, "ontouchend");
            expect("ontouchend" in document).toBe(false);
        }
    });

    it.each(["<pre><code>[]</code></pre>", "<h1>Drawing</h1>", "<hr>"])(
        "normalizes %s before autofocus and completes initialization",
        (content) => {
            const onUpdate = vi.fn();
            const editor = create(content, true, onUpdate);
            const initial = editor.getJSON();
            expect(editor.state.doc.lastChild?.type.name).toBe("paragraph");
            expect(() => vi.runOnlyPendingTimers()).not.toThrow();
            expect(editor.isInitialized).toBe(true);
            expect(() => vi.runOnlyPendingTimers()).not.toThrow();
            expect(editor.view.hasFocus()).toBe(true);
            expect(editor.getJSON()).toEqual(initial);
            expect(editor.can().undo()).toBe(false);
            expect(onUpdate).not.toHaveBeenCalled();
        },
    );

    it("preserves command chains, repeated focus, and undo after initialization", () => {
        const editor = create("<pre><code>[]</code></pre>");
        const initial = editor.getJSON();
        expect(() => editor.chain().focus("end").insertContent("After drawing").run()).not.toThrow();
        vi.runOnlyPendingTimers();
        expect(editor.state.doc.lastChild?.textContent).toBe("After drawing");
        for (let index = 0; index < 3; index++) {
            editor.view.dom.blur();
            expect(() => editor.commands.focus()).not.toThrow();
            vi.runOnlyPendingTimers();
            expect(editor.view.hasFocus()).toBe(true);
            expect(editor.state.doc.childCount).toBe(2);
        }
        expect(editor.commands.undo()).toBe(true);
        expect(editor.getJSON()).toEqual(initial);
        expect(editor.can().undo()).toBe(false);
    });
});

it("does not append duplicate paragraphs or emit persistence updates on mount/remount", () => {
    const onUpdate = vi.fn();
    const editor = create("<pre><code>[]</code></pre><p></p>", false, onUpdate);
    const initial = editor.getJSON();
    expect(editor.state.doc.childCount).toBe(2);
    const element = document.createElement("div");
    document.body.append(element);
    editor.unmount();
    editor.mount(element);
    vi.runOnlyPendingTimers();
    expect(editor.getJSON()).toEqual(initial);
    expect(editor.can().undo()).toBe(false);
    expect(onUpdate).not.toHaveBeenCalled();
});

it("preserves embedded drawing Markdown with the production extensions", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Linux; Android 15)");
    const content = '# Embedded drawing\n\n```excalidraw\n[{"id":"saved-shape","type":"rectangle"}]\n```';
    const onUpdate = vi.fn();
    const editor = new Editor({
        extensions: createExtensions(() => "github-dark", true),
        content,
        autofocus: true,
        onMount: initializeEditorDocument,
        onUpdate,
    });
    editors.push(editor);
    expect(onUpdate).not.toHaveBeenCalled();
    expect(() => vi.runOnlyPendingTimers()).not.toThrow();
    expect(editor.isInitialized).toBe(true);
    expect(editor.storage.markdown.getMarkdown?.()).toBe(content);
    expect(editor.state.doc.lastChild?.type.name).toBe("paragraph");
    expect(editor.can().undo()).toBe(false);
});
