import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Note } from "@/store/note";
import { Editor } from "./editor";
import { editorGlobalRef } from "./editor-global-ref";
import { getEditorMarkdown } from "@/lib/editor-storage";
import type { MarkdownSerializer } from "./extensions/tiptap-markdown/serialize/MarkdownSerializer";

type Request = { text: string; gen: number };
const mocks = vi.hoisted(() => ({
    createWorker: vi.fn(),
    notes: [] as Note[],
    sync: vi.fn(),
    setSaveStatus: vi.fn(),
    readNote: vi.fn(),
    writeNote: vi.fn(),
    saves: new Map<string, () => void>(),
    settings: { theme: "dark", editorMode: "formatted", vimMode: false, autosave: true, autosaveDelay: 5000, editorFontSize: 16 },
    configuration: { options: { initialMode: "normal" } },
}));
vi.mock("@/lib/markdown-worker", () => ({
    createMarkdownWorker: mocks.createWorker, LARGE_MARKDOWN_THRESHOLD: 50, WARN_THRESHOLD: 2000, HARD_LIMIT: 10000,
}));
vi.mock("@/store/global.store", () => ({
    useGlobalStore: (selector: (state: unknown) => unknown) => [selector({ notes: mocks.notes, theme: "dark" }), { syncNoteFromRepository: mocks.sync }],
}));
vi.mock("@/store/settings", () => ({ SettingsService: { load: () => mocks.settings } }));
vi.mock("@/store/ui.store", () => ({ uiDispatch: { setEditorSaveStatus: mocks.setSaveStatus, setPrompt: vi.fn() } }));
vi.mock("@/store/repositories", () => ({ repositories: { notes: { getOne: mocks.readNote, updateContentIfUnchanged: mocks.writeNote } } }));
vi.mock("@/lib/platform", () => ({ supportsAI: () => false, isMobile: () => false }));
vi.mock("@/lib/is-electron", () => ({ isElectron: () => false }));
vi.mock("./vim/use-vim-settings", () => ({ useVimSettings: () => ({ enabled: false }) }));
vi.mock("./vim/use-vim-configuration", () => ({ useVimConfiguration: () => ({ configuration: mocks.configuration, loading: false, error: null }) }));
vi.mock("./vim/apply-tiptap-configuration", () => ({ applyTiptapVimConfiguration: () => () => {} }));
vi.mock("./elements/code-block", () => ({ getThemeForMode: () => "test" }));
vi.mock("./elements/raw-markdown-editor", () => ({ RawMarkdownEditor: () => null }));
vi.mock("./comments/note-comments", () => ({ NoteComments: () => null }));
vi.mock("./components/formatting-toolbar", () => ({ FormattingToolbar: () => null }));
vi.mock("./components/editor-table-controls", () => ({ EditorTableControls: () => null }));
vi.mock("./hooks/use-editor-scroll-memory", () => ({ useEditorScrollMemory: () => {} }));
vi.mock("./writing-assistant/tiptap-adapter", () => ({ createTiptapWritingEditorAdapter: () => ({ dispose: () => {} }) }));
vi.mock("./writing-assistant/writing-assistant", () => ({ WritingAssistant: () => null }));
vi.mock("./note-save-shortcut", () => ({ registerNoteSaveShortcut: (id: string, save: () => void) => {
    mocks.saves.set(id, save);
    return () => mocks.saves.delete(id);
} }));
vi.mock("./extensions", async () => {
    const { default: StarterKit } = await import("@tiptap/starter-kit");
    const { Extension } = await import("@tiptap/core");
    const { Markdown } = await import("./extensions/tiptap-markdown/Markdown");
    const vim = Extension.create({ name: "neovim", addStorage: () => ({
        getState: () => ({ enabled: false }), setEnabled: () => {},
    }) });
    return { createExtensions: () => [StarterKit, Markdown, vim], handlePasteImage: vi.fn() };
});

class TestWorker extends EventTarget {
    request: Request | null = null;
    postMessage = vi.fn((request: Request) => { this.request = request; });
    terminate = vi.fn();
    finish(text: string): void {
        this.send({ type: "start", totalChunks: 1 });
        this.send({ type: "chunk", html: `<p>${text}</p>`, chunkIndex: 0, totalChunks: 1 });
    }
    send(data: Record<string, unknown>): void {
        if (!this.request) throw new Error("Worker has no request.");
        this.dispatchEvent(new MessageEvent("message", { data: { ...data, gen: this.request.gen } }));
    }
}
const workers: TestWorker[] = [];

async function flush(): Promise<void> {
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
}
function note(id: string, content: string): Note {
    return Note.parse({ ...Note.new(id, content), id });
}
function view(notes: Note[]) {
    return <>{notes.map((note) => <Editor key={note.id} id={note.id} note={note} content={note.content} active={false} vimMode={false} />)}</>;
}
function worker(index: number): TestWorker {
    const value = workers[index];
    if (!value) throw new Error(`Missing worker ${index}`);
    return value;
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    workers.length = 0;
    mocks.saves.clear();
    mocks.readNote.mockImplementation(async (id: string) => mocks.notes.find((note) => note.id === id) ?? null);
    mocks.writeNote.mockImplementation(async (_id: string, expected: Note, content: string) => {
        const saved = Note.parse({ ...expected, content, updatedAt: new Date() });
        mocks.notes = mocks.notes.map((note) => note.id === saved.id ? saved : note);
        return saved;
    });
    mocks.createWorker.mockImplementation(() => { const worker = new TestWorker(); workers.push(worker); return worker; });
});
afterEach(async () => { cleanup(); await vi.advanceTimersByTimeAsync(0); vi.useRealTimers(); });

describe("editor-owned Markdown workers", () => {
    it("does not serialize on typing, but explicit save immediately reads the current document", async () => {
        const source = note("short", "Short");
        mocks.notes = [source];
        render(view(mocks.notes));
        await flush();
        const editor = editorGlobalRef.current;
        if (!editor) throw new Error("Missing active editor.");
        const storage = editor.storage as unknown as { markdown: { serializer: MarkdownSerializer } };
        const serialize = vi.spyOn(storage.markdown.serializer, "serialize");
        act(() => {
            editor.commands.setTextSelection(editor.state.doc.content.size - 1);
            editor.view.dispatch(editor.state.tr.insertText("!"));
        });
        expect(serialize).not.toHaveBeenCalled();
        expect(getEditorMarkdown(editor)).toBe("Short!");
        expect(getEditorMarkdown(editor)).toBe("Short!");
        expect(serialize).toHaveBeenCalledTimes(1);
        act(() => mocks.saves.get(source.id)?.());
        await flush();
        expect(mocks.writeNote).toHaveBeenCalledWith(source.id, expect.anything(), "Short!");
        serialize.mockRestore();
    });

    it("keeps simultaneous generation-one jobs and busy states isolated", async () => {
        const first = note("first", "A".repeat(100));
        const second = note("second", "B".repeat(100));
        mocks.notes = [first, second];
        const { container } = render(view(mocks.notes));
        await flush();
        expect(workers).toHaveLength(2);
        expect(worker(0).request?.gen).toBe(worker(1).request?.gen);
        act(() => worker(0).finish(first.content));
        await flush();
        expect(container.querySelector("#editor-container-first")).toHaveAttribute("aria-busy", "false");
        expect(container.querySelector("#editor-container-second")).toHaveAttribute("aria-busy", "true");
        expect(container.querySelector("#editor-container-first .ProseMirror")?.textContent).toBe(first.content);
        act(() => worker(1).finish(second.content));
        await flush();
        expect(container.querySelector("#editor-container-second .ProseMirror")?.textContent).toBe(second.content);
        expect(worker(0).terminate).toHaveBeenCalledTimes(1);
        expect(worker(1).terminate).toHaveBeenCalledTimes(1);
    });

    it("cancels replaced jobs and ignores their late messages", async () => {
        const first = note("note", "A".repeat(100));
        mocks.notes = [first];
        const { container, rerender } = render(view(mocks.notes));
        await flush();
        const replacement = note("note", "B".repeat(100));
        mocks.notes = [replacement];
        rerender(view(mocks.notes));
        await flush();
        expect(worker(0).terminate).toHaveBeenCalledTimes(1);
        act(() => { worker(0).finish(first.content); worker(1).finish(replacement.content); });
        await flush();
        expect(container.querySelector(".ProseMirror")?.textContent).toBe(replacement.content);
    });

    it("cancels queued worker chunks when a small replacement bypasses the worker", async () => {
        const first = note("note", "A".repeat(100));
        mocks.notes = [first];
        const { container, rerender } = render(view(mocks.notes));
        await flush();
        act(() => worker(0).finish(first.content));
        const replacement = note("note", "Replacement");
        mocks.notes = [replacement];
        rerender(view(mocks.notes));
        await flush();
        expect(workers).toHaveLength(1);
        expect(worker(0).terminate).toHaveBeenCalledTimes(1);
        expect(container.querySelector(".writeme-editor")).toHaveAttribute("aria-busy", "false");
        expect(container.querySelector(".ProseMirror")?.textContent).toBe(replacement.content);
    });

    it("cancels queued chunk insertion and terminates its worker on unmount", async () => {
        const first = note("note", "A".repeat(100));
        mocks.notes = [first];
        const { unmount } = render(view(mocks.notes));
        await flush();
        act(() => worker(0).finish(first.content));
        unmount();
        await flush();
        expect(worker(0).terminate).toHaveBeenCalledTimes(1);
        expect(mocks.sync).not.toHaveBeenCalled();
    });

    it("does not clear another editor's busy state when a worker fails", async () => {
        const first = note("first", "A".repeat(100));
        const second = note("second", "B".repeat(100));
        mocks.notes = [first, second];
        const { container } = render(view(mocks.notes));
        await flush();
        act(() => worker(0).send({ type: "error", error: "Parse failed" }));
        expect(container.querySelector("#editor-container-first")).toHaveAttribute("aria-busy", "false");
        expect(container.querySelector("#editor-container-second")).toHaveAttribute("aria-busy", "true");
        act(() => worker(1).finish(second.content));
        await flush();
        expect(container.querySelector("#editor-container-second .ProseMirror")?.textContent).toBe(second.content);
        expect(worker(0).terminate).toHaveBeenCalledTimes(1);
    });
});
