import type { Editor } from "@tiptap/core";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CursorPosition } from "@/store/repositories/entities/cursor-position";

const { cursorPositionStore, textSelectionCreate } = vi.hoisted(() => ({
    cursorPositionStore: {
        get: vi.fn(),
        save: vi.fn(),
    },
    textSelectionCreate: vi.fn((_doc: unknown, position: number) => ({
        position,
    })),
}));

vi.mock("@/store/cursor-position.store", () => ({
    CursorPositionStore: cursorPositionStore,
}));

vi.mock("@tiptap/pm/state", () => ({
    TextSelection: {
        create: textSelectionCreate,
    },
}));

import { useEditorScrollMemory } from "./use-editor-scroll-memory";

type EditorDouble = {
    isDestroyed: boolean;
    state: {
        doc: { content: { size: number } };
        selection: { $anchor: { pos: number } };
        tr: { setSelection: ReturnType<typeof vi.fn> };
    };
    view: {
        dispatch: ReturnType<typeof vi.fn>;
        dom: HTMLElement;
    };
    chain: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    emit: (event: string) => void;
};

const createEditor = ({
    docSize = 100,
    selectionAnchor = 1,
}: {
    docSize?: number;
    selectionAnchor?: number;
} = {}): EditorDouble => {
    const transaction = {
        setSelection: vi.fn((selection: unknown) => ({ selection })),
    };

    const listeners = new Map<string, Set<(...args: any[]) => void>>();
    const on = vi.fn((event: string, cb: (...args: any[]) => void) => {
        const set = listeners.get(event) ?? new Set();
        set.add(cb);
        listeners.set(event, set);
    });
    const off = vi.fn((event: string, cb: (...args: any[]) => void) => {
        const set = listeners.get(event);
        if (!set) return;
        set.delete(cb);
        if (set.size === 0) listeners.delete(event);
    });
    const viewDom = document.createElement("div");
    const editor: EditorDouble = {
        isDestroyed: false,
        state: {
            doc: { content: { size: docSize } },
            selection: { $anchor: { pos: selectionAnchor } },
            tr: transaction,
        },
        view: {
            dispatch: vi.fn(),
            dom: viewDom,
        },
        chain: vi.fn(),
        on,
        off,
        emit: (event: string): void => {
            const set = listeners.get(event);
            if (!set) return;
            for (const cb of set) {
                cb(editor);
            }
        },
    };

    return editor;
};

const createScrollContainer = (): {
    container: HTMLElement;
    scrollTo: ReturnType<typeof vi.fn>;
} => {
    const container = document.createElement("div");
    container.id = "main-scroll-container";
    const scrollTo = vi.fn((options: ScrollToOptions) => {
        container.scrollTop = Number(options.top ?? 0);
    });
    Object.defineProperty(container, "scrollTo", {
        configurable: true,
        value: scrollTo,
    });
    document.body.append(container);
    return { container, scrollTo };
};

const asEditor = (editor: EditorDouble): Editor => editor as unknown as Editor;

const savedPosition = (overrides: Partial<CursorPosition> = {}): CursorPosition => ({
    noteId: "note-1",
    anchor: 12,
    y: 200,
    ...overrides,
});

describe("useEditorScrollMemory", () => {
    beforeEach(() => {
        cursorPositionStore.get.mockResolvedValue(null);
        cursorPositionStore.save.mockResolvedValue(undefined);
        textSelectionCreate.mockClear();
        document.body.replaceChildren();
    });

    afterEach(() => {
        vi.clearAllMocks();
        document.body.replaceChildren();
    });

    it("does not load or save while the editor is not ready", () => {
        renderHook(() => useEditorScrollMemory("note-1", null));

        expect(cursorPositionStore.get).not.toHaveBeenCalled();
        expect(cursorPositionStore.save).not.toHaveBeenCalled();
    });

    it("restores saved scroll and clamps the saved cursor anchor", async () => {
        const { scrollTo } = createScrollContainer();
        const editor = createEditor({ docSize: 40 });
        cursorPositionStore.get.mockResolvedValue(savedPosition({ anchor: 80, y: 0 }));

        renderHook(() => useEditorScrollMemory("note-1", asEditor(editor)));

        await waitFor(() => expect(editor.view.dispatch).toHaveBeenCalledTimes(1));

        expect(textSelectionCreate).toHaveBeenCalledWith(editor.state.doc, 40);
        expect(editor.state.tr.setSelection).toHaveBeenCalledWith({ position: 40 });
        expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
        expect(editor.chain).not.toHaveBeenCalled();
    });

    it("saves the latest scroll offset and cursor anchor on cleanup", async () => {
        const { container } = createScrollContainer();
        const editor = createEditor();

        const { unmount } = renderHook(() => useEditorScrollMemory("note-1", asEditor(editor)));

        await waitFor(() => expect(cursorPositionStore.get).toHaveBeenCalled());

        editor.state.selection.$anchor.pos = 17;
        container.scrollTop = 123.6;
        container.dispatchEvent(new Event("scroll"));

        editor.state.selection.$anchor.pos = 21;
        container.scrollTop = 155.2;
        unmount();

        expect(cursorPositionStore.save).toHaveBeenCalledWith("note-1", 21, 155);
    });

    it("does not restore or save when the async load resolves after unmount", async () => {
        const { container } = createScrollContainer();
        const editor = createEditor();
        let resolveLoad: (position: CursorPosition) => void = () => undefined;
        cursorPositionStore.get.mockReturnValue(
            new Promise<CursorPosition>((resolve) => {
                resolveLoad = resolve;
            }),
        );

        const { unmount } = renderHook(() => useEditorScrollMemory("note-1", asEditor(editor)));

        unmount();

        await act(async () => {
            resolveLoad(savedPosition({ anchor: 9, y: 50 }));
            await Promise.resolve();
        });

        container.scrollTop = 75;
        container.dispatchEvent(new Event("scroll"));

        expect(textSelectionCreate).not.toHaveBeenCalled();
        expect(editor.view.dispatch).not.toHaveBeenCalled();
        expect(cursorPositionStore.save).not.toHaveBeenCalled();
    });

    it("skips restoring cursor memory when user interacts before memory resolves", async () => {
        const editor = createEditor();
        createScrollContainer();
        let resolveLoad: (position: CursorPosition) => void = () => undefined;
        cursorPositionStore.get.mockReturnValue(
            new Promise<CursorPosition>((resolve) => {
                resolveLoad = resolve;
            }),
        );

        renderHook(() => useEditorScrollMemory("note-1", asEditor(editor)));

        editor.view.dom.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));

        await waitFor(() => expect(cursorPositionStore.get).toHaveBeenCalled());

        await act(async () => {
            resolveLoad(savedPosition({ anchor: 40, y: 80 }));
            await Promise.resolve();
        });

        expect(editor.state.tr.setSelection).not.toHaveBeenCalled();
        expect(editor.view.dispatch).not.toHaveBeenCalled();
    });

    it("skips restoring cursor memory when editor emits a focus or selection event before memory resolves", async () => {
        const editor = createEditor();
        createScrollContainer();
        let resolveLoad: (position: CursorPosition) => void = () => undefined;
        cursorPositionStore.get.mockReturnValue(
            new Promise<CursorPosition>((resolve) => {
                resolveLoad = resolve;
            }),
        );

        renderHook(() => useEditorScrollMemory("note-1", asEditor(editor)));

        editor.emit("focus");
        editor.emit("selectionUpdate");

        await waitFor(() => expect(cursorPositionStore.get).toHaveBeenCalled());

        await act(async () => {
            resolveLoad(savedPosition({ anchor: 12, y: 40 }));
            await Promise.resolve();
        });

        expect(editor.state.tr.setSelection).not.toHaveBeenCalled();
        expect(editor.view.dispatch).not.toHaveBeenCalled();
    });
});
