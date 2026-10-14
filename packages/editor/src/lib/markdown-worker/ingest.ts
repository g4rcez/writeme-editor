import type { Editor } from "@tiptap/core";
import { DOMParser } from "@tiptap/pm/model";

export function applyMarkdownWorkerChunk(editor: Editor, html: string, firstChunk: boolean): void {
    const container = document.createElement("div");
    container.innerHTML = html;
    // Worker output is already HTML. Bypass the Markdown string-command overrides.
    const doc = DOMParser.fromSchema(editor.schema).parse(container);
    const transaction = editor.state.tr;
    if (firstChunk) {
        transaction.replaceWith(0, transaction.doc.content.size, doc.content).setMeta("preventUpdate", true);
    } else {
        transaction.insert(transaction.doc.content.size, doc.content);
    }
    editor.view.dispatch(transaction);
}
