import type { Editor } from "@tiptap/core";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NoteFooter } from "./note-footer";

const mocks = vi.hoisted(() => ({
    editorRef: { current: null as Editor | null },
    getMarkdown: vi.fn(),
    listeners: new Set<() => void>(),
    changed: null as (() => void) | null,
}));
vi.mock("@/app/editor-global-ref", () => ({
    editorGlobalRef: mocks.editorRef,
    editorSearchGlobalRef: { current: null },
    subscribeEditorSearchGlobalRef: (listener: () => void) => {
        mocks.changed = listener;
        return () => { mocks.changed = null; };
    },
}));
vi.mock("../extensions/neovim/status", () => ({ NeovimStatus: () => null }));
vi.mock("./note-save-status", () => ({ NoteSaveStatus: () => null }));

beforeEach(() => {
    vi.useFakeTimers();
    mocks.getMarkdown.mockReset().mockReturnValue("Initial text");
    mocks.listeners.clear();
    mocks.editorRef.current = {
        getMarkdown: mocks.getMarkdown,
        on: (_event: string, listener: () => void) => { mocks.listeners.add(listener); },
        off: (_event: string, listener: () => void) => { mocks.listeners.delete(listener); },
    } as unknown as Editor;
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("editor footer counts", () => {
    it("coalesces typing updates without changing immediate content reads", () => {
        render(<NoteFooter noteId="note" />);
        expect(mocks.getMarkdown).toHaveBeenCalledTimes(1);
        mocks.getMarkdown.mockReturnValue("Latest content here");
        act(() => {
            for (let index = 0; index < 20; index++) for (const listener of mocks.listeners) listener();
        });
        expect(mocks.getMarkdown).toHaveBeenCalledTimes(1);
        expect(mocks.editorRef.current?.getMarkdown()).toBe("Latest content here");
        act(() => vi.advanceTimersByTime(150));
        expect(mocks.getMarkdown).toHaveBeenCalledTimes(3);
        expect(screen.getByText("3 words")).toBeVisible();
        expect(screen.getByText("19 chars")).toBeVisible();
    });

    it("cancels a pending count on unmount", () => {
        const { unmount } = render(<NoteFooter noteId="note" />);
        act(() => { for (const listener of mocks.listeners) listener(); });
        unmount();
        act(() => vi.advanceTimersByTime(150));
        expect(mocks.getMarkdown).toHaveBeenCalledTimes(1);
        expect(mocks.listeners.size).toBe(0);
    });

    it("cancels the old editor's count when the active editor changes", () => {
        render(<NoteFooter noteId="note" />);
        act(() => { for (const listener of mocks.listeners) listener(); });
        mocks.editorRef.current = null;
        act(() => { mocks.changed?.(); });
        act(() => vi.advanceTimersByTime(150));
        expect(mocks.getMarkdown).toHaveBeenCalledTimes(1);
    });
});
