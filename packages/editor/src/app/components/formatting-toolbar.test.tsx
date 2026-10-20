import type { Editor } from "@tiptap/core";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FormattingToolbar } from "./formatting-toolbar";

vi.mock("@/app/hooks/use-escape-layer", () => ({
    EscapeLevel: { popover: 1 },
    useEscapeLayer: vi.fn(),
}));

describe("FormattingToolbar", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

    it("coalesces positioning and ignores metadata-only transaction renders", () => {
        const frames = new Map<number, FrameRequestCallback>();
        let frameId = 0;
        vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; });
        vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
        const root = document.createElement("div");
        root.className = "writeme-editor";
        const dom = document.createElement("div");
        root.append(dom);
        document.body.append(root);
        const listeners = new Map<string, (event: unknown) => void>();
        const selectedText = vi.fn(() => "selected");
        const coords = vi.fn(() => ({ left: 20, right: 60, top: 40, bottom: 60 }));
        const editor = {
            isDestroyed: false, isEditable: true, isFocused: true,
            state: { selection: { empty: false, from: 1, to: 9 }, doc: { textBetween: selectedText } },
            view: { dom, coordsAtPos: coords },
            isActive: () => false,
            on: (name: string, listener: (event: unknown) => void) => listeners.set(name, listener),
            off: (name: string) => listeners.delete(name),
        } as unknown as Editor;
        const { unmount } = render(<FormattingToolbar editor={editor} />);
        const previousRenders = selectedText.mock.calls.length;
        act(() => {
            for (let index = 0; index < 10; index++) {
                listeners.get("transaction")?.({ transaction: { docChanged: false, storedMarksSet: false } });
                fireEvent.resize(window);
            }
        });
        expect(selectedText).toHaveBeenCalledTimes(previousRenders);
        expect(coords).not.toHaveBeenCalled();
        expect(frames.size).toBe(1);
        act(() => { const callbacks = [...frames.values()]; frames.clear(); for (const callback of callbacks) callback(0); });
        expect(coords).toHaveBeenCalledTimes(2);
        act(() => {
            Object.assign(editor.state, { doc: { textBetween: selectedText } });
            listeners.get("transaction")?.({ transaction: { docChanged: true, storedMarksSet: false } });
        });
        expect(frames.size).toBe(1);
        act(() => { const callbacks = [...frames.values()]; frames.clear(); for (const callback of callbacks) callback(0); });
        expect(coords).toHaveBeenCalledTimes(4);
        fireEvent.resize(window);
        unmount();
        expect(frames.size).toBe(0);
        root.remove();
    });

    it("applies a highlight mark to selected text", () => {
        const chain = {
            focus: vi.fn(),
            toggleHighlight: vi.fn(),
            run: vi.fn(),
        };
        chain.focus.mockReturnValue(chain);
        chain.toggleHighlight.mockReturnValue(chain);
        const editorRoot = document.createElement("div");
        editorRoot.className = "writeme-editor";
        const editorDom = document.createElement("div");
        editorRoot.append(editorDom);
        document.body.append(editorRoot);

        const editor = {
            isDestroyed: false,
            isEditable: true,
            isFocused: true,
            state: {
                selection: { empty: false, from: 1, to: 9 },
                doc: { textBetween: () => "selected" },
            },
            view: {
                dom: editorDom,
                coordsAtPos: () => ({ left: 20, right: 60, top: 40, bottom: 60 }),
            },
            chain: () => chain,
            isActive: () => false,
            on: vi.fn(),
            off: vi.fn(),
        } as unknown as Editor;

        render(<FormattingToolbar editor={editor} />);
        fireEvent.click(screen.getByRole("button", { name: "Highlight selected text" }));

        expect(chain.focus).toHaveBeenCalledOnce();
        expect(chain.toggleHighlight).toHaveBeenCalledOnce();
        expect(chain.run).toHaveBeenCalledOnce();
        editorRoot.remove();
    });
});
