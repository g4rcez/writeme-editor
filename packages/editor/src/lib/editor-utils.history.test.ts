import type { Editor } from "@tiptap/core";
import { describe, expect, it, vi } from "vitest";
import { updateNodeContent } from "./editor-utils";

const fakeEditor = (overrides: Record<string, unknown> = {}) => {
    const node = { nodeSize: 10 };
    const tr = { delete: vi.fn(), insert: vi.fn(), setMeta: vi.fn() };
    const dispatch = vi.fn();
    const editor = {
        isDestroyed: false,
        state: {
            tr,
            schema: { text: (value: string) => ({ value }) },
            doc: { descendants: (visit: (child: unknown, pos: number) => void) => visit(node, 4) },
        },
        view: { dispatch },
        ...overrides,
    } as unknown as Editor;
    return { editor, node, tr, dispatch };
};

describe("updateNodeContent", () => {
    it("records the rewrite in the undo history by default", () => {
        const { editor, node, tr, dispatch } = fakeEditor();
        expect(updateNodeContent(editor, node, "text")).toBe(true);
        expect(tr.setMeta).not.toHaveBeenCalled();
        expect(dispatch).toHaveBeenCalledWith(tr);
    });

    it("can keep generated content out of the undo history", () => {
        const { editor, node, tr } = fakeEditor();
        updateNodeContent(editor, node, "text", { addToHistory: false });
        expect(tr.setMeta).toHaveBeenCalledWith("addToHistory", false);
    });

    it("does nothing once the editor is destroyed", () => {
        const { editor, node, dispatch } = fakeEditor({ isDestroyed: true });
        expect(updateNodeContent(editor, node, "text")).toBe(false);
        expect(dispatch).not.toHaveBeenCalled();
    });
});
