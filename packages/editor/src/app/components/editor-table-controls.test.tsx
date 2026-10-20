import type { Editor } from "@tiptap/core";
import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorTableControls } from "./editor-table-controls";
import { insertTableAction } from "../extensions/table-controls";

vi.mock("./note-tool-tooltip", () => ({ NoteToolTooltip: ({ children }: { children: ReactNode }) => children }));
vi.mock("../extensions/table-controls", () => ({ insertTableAction: vi.fn() }));
const frames = new Map<number, FrameRequestCallback>();
let nextFrame = 0;
beforeEach(() => {
    frames.clear();
    vi.clearAllMocks();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function flushFrames(): void {
    const callbacks = [...frames.values()];
    frames.clear();
    for (const callback of callbacks) callback(0);
}
function setup() {
    const root = document.createElement("div");
    root.className = "writeme-editor";
    root.innerHTML = '<div class="ProseMirror"><table><tbody><tr><td>Text</td></tr></tbody></table></div>';
    document.body.append(root);
    const dom = root.querySelector<HTMLElement>(".ProseMirror");
    const cell = root.querySelector("td");
    if (!dom || !cell) throw new Error("Missing table fixture.");
    const measure = vi.spyOn(cell, "getBoundingClientRect");
    const listeners = new Map<string, (event?: unknown) => void>();
    const editor = {
        isDestroyed: false, isEditable: true,
        state: { selection: { from: 1 } },
        view: { dom, domAtPos: () => ({ node: cell }) },
        on: (name: string, listener: (event?: unknown) => void) => listeners.set(name, listener),
        off: (name: string) => listeners.delete(name),
    } as unknown as Editor;
    const rendered = render(<EditorTableControls editor={editor} />);
    return { root, cell, measure, listeners, ...rendered };
}

describe("table control layout", () => {
    it("measures once per frame for typing, selection and pointer events", () => {
        const { root, cell, measure, listeners } = setup();
        act(() => {
            listeners.get("transaction")?.({ transaction: { docChanged: true } });
            listeners.get("selectionUpdate")?.();
            fireEvent.pointerOver(cell);
            fireEvent.scroll(root);
        });
        expect(measure).not.toHaveBeenCalled();
        expect(frames.size).toBe(1);
        act(flushFrames);
        expect(measure).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole("button", { name: "Insert row above" }));
        expect(insertTableAction).toHaveBeenCalledWith(expect.anything(), "addRowBefore", cell);
        root.remove();
    });

    it("ignores metadata-only transactions and cancels pending layout on unmount", () => {
        const { root, measure, listeners, unmount } = setup();
        act(() => listeners.get("transaction")?.({ transaction: { docChanged: false } }));
        expect(frames.size).toBe(0);
        act(() => listeners.get("transaction")?.({ transaction: { docChanged: true } }));
        expect(frames.size).toBe(1);
        unmount();
        act(flushFrames);
        expect(measure).not.toHaveBeenCalled();
        root.remove();
    });
});
