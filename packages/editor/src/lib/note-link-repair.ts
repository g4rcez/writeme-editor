import type { Editor } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import { DOMParser, type Node as ProseMirrorNode } from "@tiptap/pm/model";
import { getEditorMarkdown } from "./editor-storage";

export type NoteLinkRepairResult = "applied" | "conflict" | "unavailable";

export type NoteLinkRepairRequest = {
    noteId: string;
    expectedContent: string;
    from: number;
    to: number;
    replacement: string;
    result: NoteLinkRepairResult | null;
    checkOnly?: boolean;
};

export const NOTE_LINK_REPAIR_EVENT = "writeme:repair-note-link";

export function requestNoteLinkRepair(
    request: Omit<NoteLinkRepairRequest, "result" | "checkOnly">,
): NoteLinkRepairResult | null {
    const detail: NoteLinkRepairRequest = { ...request, result: null, checkOnly: true };
    window.dispatchEvent(new CustomEvent<NoteLinkRepairRequest>(NOTE_LINK_REPAIR_EVENT, { detail }));
    if (detail.result !== "applied") return detail.result;
    detail.result = null;
    detail.checkOnly = false;
    window.dispatchEvent(new CustomEvent<NoteLinkRepairRequest>(NOTE_LINK_REPAIR_EVENT, { detail }));
    return detail.result;
}

export function registerNoteLinkRepairHandler(handler: {
    noteId: () => string | undefined;
    getContent: () => string;
    isEditable: () => boolean;
    apply: (request: NoteLinkRepairRequest) => NoteLinkRepairResult;
}): () => void {
    const listener = (event: Event): void => {
        const request = (event as CustomEvent<NoteLinkRepairRequest>).detail;
        if (request.noteId !== handler.noteId()) return;
        if (request.checkOnly) {
            if (request.result === "conflict" || request.result === "unavailable") return;
            request.result = !handler.isEditable()
                ? "unavailable"
                : repairedMarkdown(handler.getContent(), request) === null
                  ? "conflict"
                  : "applied";
        } else if (request.result === null) {
            request.result = handler.apply(request);
        }
    };
    window.addEventListener(NOTE_LINK_REPAIR_EVENT, listener);
    return () => window.removeEventListener(NOTE_LINK_REPAIR_EVENT, listener);
}

export function repairedMarkdown(
    content: string,
    request: Omit<NoteLinkRepairRequest, "noteId" | "result">,
): string | null {
    if (
        content !== request.expectedContent ||
        request.from < 0 ||
        request.to <= request.from ||
        request.to > content.length
    )
        return null;
    return content.slice(0, request.from) + request.replacement + content.slice(request.to);
}

function sameDocumentShape(left: ProseMirrorNode, right: ProseMirrorNode): boolean {
    if (left.type !== right.type || left.text !== right.text || left.childCount < right.childCount) return false;
    for (let index = 0; index < left.childCount; index++) {
        const child = left.child(index);
        if (index < right.childCount) {
            if (!sameDocumentShape(child, right.child(index))) return false;
            // The trailing-node extension may append empty paragraphs that Markdown does not serialize.
        } else if (left.type.name !== "doc" || child.type.name !== "paragraph" || child.content.size !== 0) {
            return false;
        }
    }
    return true;
}

export function repairTiptapLink(editor: Editor, request: NoteLinkRepairRequest): NoteLinkRepairResult {
    if (!editor.isEditable || editor.isDestroyed) return "unavailable";
    const updated = repairedMarkdown(getEditorMarkdown(editor), request);
    if (updated === null) return "conflict";
    const parser = editor.storage.markdown.parser;
    if (!parser) return "unavailable";
    const parse = (content: string): ProseMirrorNode => {
        const container = document.createElement("div");
        container.innerHTML = parser.parse(content);
        return DOMParser.fromSchema(editor.schema).parse(container, { preserveWhitespace: "full" });
    };
    const previous = editor.state.doc;
    const baseline = parse(request.expectedContent);
    const nextDoc = parse(updated);
    if (!sameDocumentShape(previous, baseline)) return "unavailable";
    // Compare equivalent serializations so unrelated live node attributes are not roundtripped.
    const start = baseline.content.findDiffStart(nextDoc.content);
    const end = baseline.content.findDiffEnd(nextDoc.content);
    if (start === null || end === null) return "unavailable";
    const overlap = Math.max(0, start - Math.min(end.a, end.b));
    const transaction = closeHistory(editor.state.tr).replace(
        start,
        end.a + overlap,
        nextDoc.slice(start, end.b + overlap),
    );
    editor.view.dispatch(transaction);
    editor.view.dispatch(closeHistory(editor.state.tr));
    return "applied";
}
