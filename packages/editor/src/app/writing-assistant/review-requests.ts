import type { Editor } from "@tiptap/core";
import type { WritingScope, WritingSelectionRange } from "./types";

export type WritingReviewRequest = {
    scope: WritingScope;
    selection?: WritingSelectionRange;
};

type WritingReviewHandler = (request: WritingReviewRequest) => void;

const handlers = new WeakMap<Editor, WritingReviewHandler>();

export function registerWritingReviewHandler(editor: Editor, handler: WritingReviewHandler): () => void {
    handlers.set(editor, handler);
    return () => {
        if (handlers.get(editor) === handler) handlers.delete(editor);
    };
}

export function hasWritingReviewHandler(editor: Editor): boolean {
    return handlers.has(editor);
}

export function requestWritingReview(editor: Editor, request: WritingReviewRequest): boolean {
    const handler = handlers.get(editor);
    if (!handler) return false;
    handler(request);
    return true;
}
