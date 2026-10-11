import type { Extension as CodeMirrorExtension } from "@codemirror/state";
import { isolateHistory } from "@codemirror/commands";
import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import { ViewPlugin, type EditorView } from "@codemirror/view";
import {
    completionMarkdown,
    createHeadingItems,
    createWordItems,
    createTagItems,
    extractCompletionTags,
    withoutActiveTag,
    findCompletionContext,
    markdownHeadingText,
    type CompletionContext,
    type CompletionItem,
} from "./editor-completion-data";
import { createCompletionMenu } from "./editor-completion-menu";

function context(view: EditorView, active?: CompletionContext): CompletionContext | null {
    const { state } = view;
    const selection = state.selection.main;
    if (state.readOnly || !selection.empty) return null;
    let node = syntaxTree(state).resolveInner(selection.head, -1);
    while (node.parent) {
        if (["FencedCode", "CodeBlock", "InlineCode", "Link", "URL", "HTMLBlock"].includes(node.name)) return null;
        node = node.parent;
    }
    const line = state.doc.lineAt(selection.head);
    return findCompletionContext(
        state.sliceDoc(line.from, selection.head),
        state.sliceDoc(selection.head, line.to),
        selection.head,
        active,
    );
}

function headings(view: EditorView): CompletionItem[] {
    const titles: string[] = [];
    (ensureSyntaxTree(view.state, view.state.doc.length, 100) ?? syntaxTree(view.state)).iterate({
        enter: (node) => {
            if (!/^(?:ATX|Setext)Heading[1-6]$/.test(node.name)) return;
            const text = view.state.sliceDoc(node.from, node.to);
            titles.push(
                markdownHeadingText(
                    text
                        .replace(/^#{1,6}\s+/, "")
                        .replace(/\n[=-]+\s*$/, "")
                        .replace(/\s+#+\s*$/, "")
                        .trim(),
                ),
            );
        },
    });
    return createHeadingItems(titles);
}

export function markdownCompletion(noteId?: string): CodeMirrorExtension {
    return ViewPlugin.define(
        (view) => {
            let updateQueued = false;
            let documentChanged = false;
            let destroyed = false;
            let tags: { doc: typeof view.state.doc; items: CompletionItem[] } | undefined;
            const menu = createCompletionMenu({
                noteId: () => noteId,
                target: view.contentDOM,
                context: (active) => context(view, active),
                headings: () => headings(view),
                tags: (range) => {
                    const doc = view.state.doc;
                    if (tags?.doc !== doc) tags = { doc, items: createTagItems(extractCompletionTags(doc.toString())) };
                    return withoutActiveTag(tags.items, range);
                },
                words: (range) =>
                    createWordItems(view.state.sliceDoc(0, range.from) + "\n" + view.state.sliceDoc(range.to)),
                rect: () => {
                    const rect = view.coordsAtPos(view.state.selection.main.head);
                    return rect
                        ? new DOMRect(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top)
                        : null;
                },
                insert: (item, range) => {
                    const insert = completionMarkdown(item);
                    view.dispatch({
                        changes: { from: range.from, to: range.to, insert },
                        annotations: isolateHistory.of("full"),
                        selection: { anchor: range.from + insert.length },
                    });
                    view.focus();
                },
            });
            return {
                update: (update) => {
                    documentChanged ||= update.docChanged;
                    if (updateQueued) return;
                    updateQueued = true;
                    queueMicrotask(() => {
                        updateQueued = false;
                        const changed = documentChanged;
                        documentChanged = false;
                        if (!destroyed) menu.update(changed);
                    });
                },
                destroy: () => {
                    destroyed = true;
                    menu.destroy();
                },
                handleKeyDown: (event: KeyboardEvent): boolean => menu.handleKeyDown(event),
            };
        },
        {
            eventHandlers: {
                keydown(event) {
                    return this.handleKeyDown(event);
                },
            },
        },
    ).extension;
}
