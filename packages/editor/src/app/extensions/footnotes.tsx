import { Extension, Node, mergeAttributes, type Editor } from "@tiptap/core";
import { Tooltip } from "@g4rcez/components";
import { NodeViewWrapper, ReactNodeViewRenderer, useEditorState, type NodeViewProps } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import { useRef, useState } from "react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { MarkdownSerializerState } from "prosemirror-markdown";

function scrollToPosition(editor: Editor, position: number): void {
    requestAnimationFrame(() => {
        const container = document.getElementById("main-scroll-container");
        if (!container || editor.isDestroyed) return;
        try {
            const coords = editor.view.coordsAtPos(position);
            const rect = container.getBoundingClientRect();
            container.scrollTop = Math.max(0, container.scrollTop + coords.top - rect.top - rect.height / 3);
        } catch {
            return;
        }
    });
}

function navigateToDefinition(editor: Editor, id: string, from: number): boolean {
    let target: number | null = null;
    editor.state.doc.descendants((node, position) => {
        if (target === null && node.type.name === "footnoteDefinition" && node.attrs.id === id) {
            target = position + 1;
            return false;
        }
        return target === null;
    });
    if (target === null) return false;
    const position = target;
    editor.storage.footnotes.returnPositions.push(from);
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(position))));
    editor.view.focus();
    scrollToPosition(editor, position);
    return true;
}

function returnToReference(editor: Editor): boolean {
    const position = editor.storage.footnotes.returnPositions.pop();
    if (position === undefined || position > editor.state.doc.content.size) return false;
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(position))));
    const reference = editor.view.nodeDOM(position) as HTMLElement | null;
    reference?.querySelector<HTMLButtonElement>("button")?.focus();
    scrollToPosition(editor, position);
    return true;
}

function FootnoteReferenceView({ node, editor, getPos }: NodeViewProps): React.JSX.Element {
    const [preview, setPreview] = useState(false);
    const trigger = useRef<HTMLButtonElement>(null);
    const navigation = useRef<HTMLButtonElement>(null);
    const previewContent = useRef<HTMLDivElement>(null);
    const id = String(node.attrs.id);
    const definitionText = useEditorState({ editor, selector: ({ editor: current }) => {
        let definition: string | null = null;
        current.state.doc.descendants((candidate) => {
            if (definition === null && candidate.type.name === "footnoteDefinition" && candidate.attrs.id === id) {
                definition = candidate.textBetween(0, candidate.content.size, "\n", "\n");
                return false;
            }
            return true;
        });
        return definition;
    } });
    const previewText = definitionText === null ? `Footnote definition “${id}” is missing.` : definitionText || "This footnote definition is empty.";

    return (
        <NodeViewWrapper as="span" className="inline" contentEditable={false} data-footnote-reference={id}>
            <Tooltip
                as="button"
                type="button"
                popover
                focus={false}
                ref={trigger}
                open={preview}
                onChange={(open) => {
                    if (!open && document.activeElement === navigation.current) trigger.current?.focus();
                    setPreview(open);
                }}
                title={id}
                aria-label={`Footnote ${id}`}
                aria-description="Preview footnote. Press ArrowDown to focus Go to definition."
                onFocus={() => setPreview(true)}
                onBlur={(event) => {
                    if (!previewContent.current?.contains(event.relatedTarget as globalThis.Node | null)) setPreview(false);
                }}
                onKeyDown={(event) => {
                    if (event.key !== "ArrowDown" || definitionText === null) return;
                    event.preventDefault();
                    setPreview(true);
                    requestAnimationFrame(() => navigation.current?.focus());
                }}
                className="min-w-6 align-super text-xs text-primary underline decoration-dotted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11"
            >
                <div ref={previewContent} className="flex max-h-64 max-w-[min(20rem,calc(100vw-2rem))] flex-col gap-2 overflow-auto break-words p-3 text-sm text-foreground" contentEditable={false} onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as globalThis.Node | null) && event.relatedTarget !== trigger.current) setPreview(false);
                }}>
                    <p className="whitespace-pre-wrap">{previewText}</p>
                    {definitionText !== null ? <button ref={navigation} type="button" className="min-h-11 text-primary underline focus-visible:outline focus-visible:outline-2" onClick={() => {
                        const position = getPos();
                        setPreview(false);
                        if (typeof position === "number") navigateToDefinition(editor, id, position);
                    }}>Go to definition</button> : null}
                </div>
            </Tooltip>
        </NodeViewWrapper>
    );
}

type FootnoteStorage = { returnPositions: number[] };

declare module "@tiptap/core" {
    interface Storage {
        footnotes: FootnoteStorage;
    }
    interface Commands<ReturnType> {
        footnotes: {
            insertFootnote: () => ReturnType;
        };
    }
}

export const FootnoteReference = Node.create({
    name: "footnoteReference",
    group: "inline",
    inline: true,
    atom: true,
    selectable: true,
    addAttributes() {
        return { id: { default: "", rendered: false } };
    },
    parseHTML() {
        return [{ tag: "span[data-footnote-reference]", getAttrs: (element) => ({ id: (element as HTMLElement).getAttribute("data-footnote-reference") }) }];
    },
    renderHTML({ node, HTMLAttributes }) {
        return ["span", mergeAttributes(HTMLAttributes, { "data-footnote-reference": node.attrs.id }), `[^${node.attrs.id}]`];
    },
    addNodeView() {
        return ReactNodeViewRenderer(FootnoteReferenceView);
    },
    addStorage() {
        return { markdown: { serialize(state: MarkdownSerializerState, node: { attrs: { id: string } }) { state.write(`[^${node.attrs.id}]`); } } };
    },
});

export const FootnoteDefinition = Node.create({
    name: "footnoteDefinition",
    group: "block",
    content: "block+",
    defining: true,
    isolating: true,
    addAttributes() {
        return { id: { default: "", rendered: false } };
    },
    parseHTML() {
        return [{ tag: "section[data-footnote-definition]", getAttrs: (element) => ({ id: (element as HTMLElement).getAttribute("data-footnote-definition") }) }];
    },
    renderHTML({ node, HTMLAttributes }) {
        return ["section", mergeAttributes(HTMLAttributes, { "data-footnote-definition": node.attrs.id }), 0];
    },
    addNodeView() {
        return ({ editor, node: initialNode }) => {
            let node = initialNode;
            const dom = document.createElement("section");
            dom.className = "my-3 border-l-2 border-border pl-3";
            const header = document.createElement("header");
            header.contentEditable = "false";
            header.className = "mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground";
            const label = document.createElement("span");
            const returnButton = document.createElement("button");
            returnButton.type = "button";
            returnButton.className = "min-h-11 px-2 underline focus-visible:outline focus-visible:outline-2 disabled:opacity-50 print:hidden";
            returnButton.textContent = "Return to reference";
            returnButton.onclick = () => { returnToReference(editor); };
            const status = document.createElement("output");
            const contentDOM = document.createElement("div");
            contentDOM.className = "min-w-0";
            header.append(label, returnButton, status);
            dom.append(header, contentDOM);
            const refresh = (): void => {
                const id = String(node.attrs.id);
                dom.dataset.footnoteDefinition = id;
                label.textContent = `Footnote ${id}`;
                let definitions = 0;
                let references = 0;
                editor.state.doc.descendants((candidate) => {
                    if (candidate.type.name === "footnoteDefinition" && candidate.attrs.id === id) definitions++;
                    if (candidate.type.name === "footnoteReference" && candidate.attrs.id === id) references++;
                });
                status.textContent = [
                    definitions > 1 ? "Duplicate ID; references open the first definition." : "",
                    references === 0 ? "No references to this footnote." : "",
                ].filter(Boolean).join(" ");
                returnButton.disabled = editor.storage.footnotes.returnPositions.length === 0;
            };
            refresh();
            editor.on("transaction", refresh);
            return {
                dom,
                contentDOM,
                update(nextNode) {
                    if (nextNode.type !== node.type) return false;
                    node = nextNode;
                    refresh();
                    return true;
                },
                stopEvent: (event) => header.contains(event.target as globalThis.Node | null),
                ignoreMutation: (mutation) => mutation.type !== "selection" && !contentDOM.contains(mutation.target),
                destroy: () => { editor.off("transaction", refresh); },
            };
        };
    },
    addStorage() {
        return {
            markdown: {
                serialize(state: MarkdownSerializerState, node: ProseMirrorNode) {
                    state.wrapBlock("    ", `[^${node.attrs.id}]: `, node, () => state.renderContent(node));
                },
            },
        };
    },
});

export const Footnotes = Extension.create<Record<string, never>, FootnoteStorage>({
    name: "footnotes",
    addStorage() {
        return { returnPositions: [] };
    },
    onTransaction({ transaction }) {
        if (!transaction.docChanged) return;
        this.storage.returnPositions = this.storage.returnPositions
            .map((position) => transaction.mapping.mapResult(position))
            .filter((result) => !result.deleted && transaction.doc.nodeAt(result.pos)?.type.name === "footnoteReference")
            .map((result) => result.pos);
    },
    addCommands() {
        return {
            insertFootnote:
                () =>
                ({ state, tr, dispatch }) => {
                    if (state.selection.$from.parent.type.spec.code) return false;
                    const used = new Set<string>();
                    state.doc.descendants((node) => {
                        if (node.type.name === "footnoteReference" || node.type.name === "footnoteDefinition") {
                            used.add(String(node.attrs.id));
                        }
                    });
                    let index = 1;
                    while (used.has(`fn-${index}`)) index++;
                    const id = `fn-${index}`;
                    const { to } = state.selection;
                    if (dispatch) {
                        const referenceType = state.schema.nodes.footnoteReference;
                        const paragraphType = state.schema.nodes.paragraph;
                        const definitionType = state.schema.nodes.footnoteDefinition;
                        if (!referenceType || !paragraphType || !definitionType) return false;
                        const reference = referenceType.create({ id });
                        const paragraph = paragraphType.create();
                        const definition = definitionType.create({ id }, paragraph);
                        tr.insert(to, reference);
                        const definitionPosition = tr.doc.content.size;
                        tr.insert(definitionPosition, definition);
                        tr.setSelection(TextSelection.create(tr.doc, definitionPosition + 2));
                        tr.scrollIntoView();
                    }
                    return true;
                },
        };
    },
});

export { navigateToDefinition, returnToReference };
