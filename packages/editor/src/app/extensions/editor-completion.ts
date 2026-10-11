import { Extension } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { getEditorNote } from "@/lib/editor-storage";
import {
    createHeadingItems,
    createWordItems,
    createTagItems,
    extractCompletionTags,
    withoutActiveTag,
    findCompletionContext,
    type CompletionContext,
    type CompletionItem,
} from "./editor-completion-data";
import { createCompletionMenu } from "./editor-completion-menu";

export const EditorCompletion = Extension.create({
    name: "editorCompletion",
    priority: 1100,
    addProseMirrorPlugins() {
        const editor = this.editor;
        let menu: ReturnType<typeof createCompletionMenu> | undefined;
        let tags: { doc: typeof editor.state.doc; items: CompletionItem[] } | undefined;
        const headings = (): CompletionItem[] => {
            const titles: string[] = [];
            editor.state.doc.descendants((node) => {
                if (node.type.name === "heading") titles.push(node.textContent);
            });
            return createHeadingItems(titles);
        };
        const context = (active?: CompletionContext): CompletionContext | null => {
            const { selection } = editor.state;
            const { $from } = selection;
            if (!editor.isEditable || !selection.empty || !$from.parent.isTextblock) return null;
            for (let depth = $from.depth; depth > 0; depth--) {
                if (["codeBlock", "frontmatter"].includes($from.node(depth).type.name)) return null;
            }
            if ($from.marks().some((mark) => ["code", "link"].includes(mark.type.name))) return null;
            return findCompletionContext(
                $from.parent.textBetween(0, $from.parentOffset, "\n", "\ufffc"),
                $from.parent.textBetween($from.parentOffset, $from.parent.content.size, "\n", "\ufffc"),
                $from.pos,
                active,
            );
        };
        return [
            new Plugin({
                key: new PluginKey("editorCompletion"),
                props: {
                    handleKeyDown: (view, event) => {
                        if (event.isComposing) return false;
                        if (event.ctrlKey && event.code === "Space") {
                            const selection = view.dom.ownerDocument.getSelection();
                            if (selection && !selection.isCollapsed) return false;
                            if (
                                selection?.isCollapsed &&
                                selection.anchorNode &&
                                view.dom.contains(selection.anchorNode)
                            ) {
                                const pos = view.posAtDOM(selection.anchorNode, selection.anchorOffset);
                                if (pos !== view.state.selection.from)
                                    view.dispatch(
                                        view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)),
                                    );
                            }
                        }
                        return menu?.handleKeyDown(event) ?? false;
                    },
                    handleClick: (view, _pos, event) => {
                        const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
                        const href = anchor?.getAttribute("href");
                        const index = headings().findIndex((item) => item.path === href);
                        if (index < 0) return false;
                        const positions: number[] = [];
                        view.state.doc.descendants((node, pos) => {
                            if (node.type.name === "heading" && node.textContent.trim()) positions.push(pos);
                        });
                        const pos = positions[index];
                        if (pos === undefined) return false;
                        event.preventDefault();
                        view.dispatch(
                            view.state.tr.setSelection(TextSelection.create(view.state.doc, pos + 1)).scrollIntoView(),
                        );
                        view.focus();
                        return true;
                    },
                },
                view: (view) => {
                    menu = createCompletionMenu({
                        noteId: () => getEditorNote(editor)?.id,
                        target: view.dom,
                        context,
                        headings,
                        tags: (range) => {
                            const doc = editor.state.doc;
                            if (tags?.doc !== doc)
                                tags = { doc, items: createTagItems(extractCompletionTags(editor.getMarkdown())) };
                            return withoutActiveTag(tags.items, range);
                        },
                        words: (range) =>
                            createWordItems(
                                view.state.doc.textBetween(0, range.from, "\n", "\ufffc") +
                                    "\n" +
                                    view.state.doc.textBetween(range.to, view.state.doc.content.size, "\n", "\ufffc"),
                            ),
                        rect: () => {
                            const rect = view.coordsAtPos(view.state.selection.from);
                            return new DOMRect(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top);
                        },
                        insert: (item, range) => {
                            const schema = view.state.schema;
                            const wordMarks =
                                item.kind === "word" ? view.state.doc.resolve(range.from + 1).marks() : undefined;
                            const node =
                                item.kind === "file"
                                    ? schema.nodes.mention?.create({ id: item.id, label: item.label, path: item.path })
                                    : schema.text(
                                          item.kind === "tag" ? `#${item.label}` : item.label,
                                          item.kind === "heading" && schema.marks.link
                                              ? [schema.marks.link.create({ href: item.path, title: item.label })]
                                              : wordMarks,
                                      );
                            if (!node) return;
                            const content = item.kind === "heading" ? [node, schema.text(" ")] : [node];
                            const tr = view.state.tr.replaceWith(range.from, range.to, content);
                            tr.setSelection(
                                TextSelection.create(
                                    tr.doc,
                                    range.from + node.nodeSize + (item.kind === "heading" ? 1 : 0),
                                ),
                            );
                            tr.setStoredMarks(wordMarks ?? []);
                            view.dispatch(closeHistory(tr.scrollIntoView()));
                            view.dispatch(closeHistory(view.state.tr));
                            view.focus();
                        },
                    });
                    return {
                        update: (_view, previous) => menu?.update(!previous.doc.eq(view.state.doc)),
                        destroy: () => menu?.destroy(),
                    };
                },
            }),
        ];
    },
});
