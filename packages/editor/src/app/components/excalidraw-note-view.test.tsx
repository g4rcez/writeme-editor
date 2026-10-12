import type { Excalidraw } from "@excalidraw/excalidraw";
import type { ComponentProps } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildExcalidrawNoteContent, parseExcalidrawNoteContent } from "@/lib/excalidraw-note";
import { Note, NoteType } from "@/store/note";
import { ExcalidrawNoteView } from "./excalidraw-note-view";

const { updateNoteContent } = vi.hoisted(() => ({ updateNoteContent: vi.fn() }));

vi.mock("@/store/global.store", () => ({
    useGlobalStore: () => [{ theme: "light" }, { updateNoteContent }],
}));

vi.mock("@excalidraw/excalidraw", () => ({
    restore: (data: unknown) => data,
    serializeAsJSON: (elements: unknown[], appState: { viewBackgroundColor: string }, files: unknown) =>
        JSON.stringify({ elements, appState: { viewBackgroundColor: appState.viewBackgroundColor }, files }),
    Excalidraw: ({ initialData, onChange }: ComponentProps<typeof Excalidraw>) => {
        const data = initialData as { appState: { scrollX: number; scrollY: number; zoom: { value: number } } };
        return (
            <>
                <output aria-label="Drawing viewport">
                    {JSON.stringify({
                        scrollX: data.appState.scrollX,
                        scrollY: data.appState.scrollY,
                        zoom: data.appState.zoom,
                    })}
                </output>
                <button
                    onClick={() =>
                        onChange?.(
                            [],
                            {
                                ...data.appState,
                                viewBackgroundColor: "#ffffff",
                                isLoading: true,
                            } as Parameters<NonNullable<typeof onChange>>[1],
                            {},
                        )
                    }
                >
                    Save drawing
                </button>
            </>
        );
    },
}));

afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
});

describe("ExcalidrawNoteView", () => {
    it.each([
        { scrollX: -800, scrollY: 600, zoom: { value: 0.8 } },
        { scrollX: 300, scrollY: -450, zoom: { value: 2 } },
    ])("preserves viewport $scrollX/$scrollY through save and reopen", (viewport) => {
        vi.useFakeTimers();
        const note = Note.new(
            "Drawing",
            buildExcalidrawNoteContent({
                elements: [],
                appState: viewport,
                files: {},
            }),
            NoteType.excalidraw,
        );
        const { unmount } = render(<ExcalidrawNoteView note={note} />);
        fireEvent.click(screen.getByRole("button", { name: "Save drawing" }));
        act(() => vi.advanceTimersByTime(500));
        expect(updateNoteContent).toHaveBeenCalledTimes(1);
        const [id, content] = updateNoteContent.mock.calls[0] as [string, string];
        expect(id).toBe(note.id);
        const { payload } = parseExcalidrawNoteContent(content);
        expect(payload.appState).toMatchObject(viewport);
        expect(payload.appState).not.toHaveProperty("isLoading");
        expect(payload.appState.viewBackgroundColor).toBe("#ffffff");
        unmount();
        render(<ExcalidrawNoteView note={Note.parse({ ...note, content })} />);
        expect(JSON.parse(screen.getByLabelText("Drawing viewport").textContent || "null")).toStrictEqual(viewport);
    });
});
