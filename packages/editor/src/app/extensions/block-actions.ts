import { Extension } from "@tiptap/core";
import { Fragment, type Node as ProseMirrorNode } from "@tiptap/pm/model";
import { closeHistory } from "@tiptap/pm/history";
import {
    NodeSelection,
    Plugin,
    PluginKey,
    Selection,
    TextSelection,
    type Transaction,
} from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

const blockTypes: Record<string, true> = {
    paragraph: true,
    heading: true,
    codeBlock: true,
    blockquote: true,
    table: true,
    image: true,
    video: true,
    pdf: true,
    bulletList: true,
    orderedList: true,
    taskList: true,
    horizontalRule: true,
};
export type Conversion = { label: string; node: ProseMirrorNode };

export type BlockTarget = { node: ProseMirrorNode; pos: number; depth: number };
const pluginKey = new PluginKey("writemeBlockActions");
export function targetAt(view: EditorView, position: number): BlockTarget | null {
    const $pos = view.state.doc.resolve(Math.max(0, Math.min(position, view.state.doc.content.size)));
    for (let depth = $pos.depth; depth >= 1; depth--) {
        const node = $pos.node(depth);
        if (node.type.name === "listItem" || node.type.name === "taskItem")
            return { node, pos: $pos.before(depth), depth };
    }
    if ($pos.depth === 0) {
        const node = $pos.nodeAfter;
        return node && blockTypes[node.type.name] ? { node, pos: $pos.pos, depth: 1 } : null;
    }
    const node = $pos.node(1);
    if (blockTypes[node.type.name]) return { node, pos: $pos.before(1), depth: 1 };
    for (let depth = $pos.depth; depth >= 1; depth--) {
        const nested = $pos.node(depth);
        if (nested.isBlock && blockTypes[nested.type.name])
            return { node: nested, pos: $pos.before(depth), depth };
    }
    return null;
}

export function currentTarget(view: EditorView): BlockTarget | null {
    const selected = view.state.selection;
    if (
        selected instanceof NodeSelection &&
        (blockTypes[selected.node.type.name] || ["listItem", "taskItem"].includes(selected.node.type.name))
    )
        return {
            node: selected.node,
            pos: selected.from,
            depth: selected.$from.depth + 1,
        };
    const target = targetAt(view, selected.from);
    if (!target || selected.to > target.pos + target.node.nodeSize - 1) return null;
    return target;
}

function synchronizePointerSelection(view: EditorView): void {
    const mode = view.dom.getAttribute("data-neovim-mode");
    const selection = view.dom.ownerDocument.getSelection();
    if (
        view.hasFocus() &&
        (!mode || mode === "disabled" || mode === "insert" || mode === "replace") &&
        !(view.state.selection instanceof NodeSelection) &&
        selection?.anchorNode &&
        selection.focusNode &&
        view.dom.contains(selection.anchorNode) &&
        view.dom.contains(selection.focusNode)
    ) {
        const anchor = view.posAtDOM(selection.anchorNode, selection.anchorOffset);
        const head = view.posAtDOM(selection.focusNode, selection.focusOffset);
        const next = TextSelection.between(view.state.doc.resolve(anchor), view.state.doc.resolve(head));
        if (!next.eq(view.state.selection)) view.dispatch(view.state.tr.setSelection(next));
    }
}

function clearCopiedHeadingIds(node: ProseMirrorNode): ProseMirrorNode {
    if (node.isText) return node;
    const attrs = node.type.name === "heading" ? { ...node.attrs, id: null } : node.attrs;
    const content = node.content.content.map(clearCopiedHeadingIds);
    return node.type.create(attrs, Fragment.fromArray(content), node.marks);
}

function dispatchAction(view: EditorView, tr: Transaction, position: number): void {
    const node = tr.doc.nodeAt(position);
    const selection =
        node?.isAtom && NodeSelection.isSelectable(node)
            ? NodeSelection.create(tr.doc, position)
            : Selection.near(tr.doc.resolve(Math.min(position + 1, tr.doc.content.size)));
    view.dispatch(closeHistory(tr).setSelection(selection).scrollIntoView());
    view.focus();
}

function validTarget(view: EditorView, target: BlockTarget): boolean {
    return view.editable && view.state.doc.nodeAt(target.pos) === target.node;
}

export function duplicate(view: EditorView, target: BlockTarget): boolean {
    if (!validTarget(view, target)) return false;
    const copy = clearCopiedHeadingIds(target.node);
    const insertion = target.pos + target.node.nodeSize;
    dispatchAction(view, view.state.tr.insert(insertion, copy), insertion);
    return true;
}

export function move(view: EditorView, target: BlockTarget, delta: -1 | 1): boolean {
    if (!validTarget(view, target)) return false;
    const $from = view.state.doc.resolve(target.pos);
    const parentDepth = target.depth - 1;
    const parent = $from.node(parentDepth);
    const index = $from.index(parentDepth);
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= parent.childCount) return false;

    const firstIndex = Math.min(index, nextIndex);
    const first = parent.child(firstIndex);
    const second = parent.child(firstIndex + 1);
    const reordered = Fragment.fromArray([second, first]);
    if (!parent.canReplace(firstIndex, firstIndex + 2, reordered)) return false;
    const start = delta > 0 ? target.pos : target.pos - first.nodeSize;
    const tr = view.state.tr.replaceWith(start, start + first.nodeSize + second.nodeSize, reordered);
    const newTargetPos = target.pos + (delta > 0 ? second.nodeSize : -first.nodeSize);
    dispatchAction(view, tr, newTargetPos);
    return true;
}

export function conversionOptions(view: EditorView, target: BlockTarget): Conversion[] {
    const { node } = target;
    const { schema } = view.state;
    const options: Conversion[] = [];
    const $pos = view.state.doc.resolve(target.pos);
    const parent = $pos.node(target.depth - 1);
    const index = $pos.index(target.depth - 1);
    const add = (label: string, replacement: ProseMirrorNode | null): void => {
        if (
            replacement &&
            !replacement.eq(node) &&
            parent.canReplace(index, index + 1, Fragment.from(replacement))
        )
            options.push({ label, node: replacement });
    };
    const create = (
        type: string,
        content: Fragment,
        attrs?: Record<string, unknown>,
    ): ProseMirrorNode | null => {
        const nodeType = schema.nodes[type];
        return nodeType?.validContent(content) ? nodeType.create(attrs, content, node.marks) : null;
    };
    if (node.type.name === "paragraph" || node.type.name === "heading") {
        add("Paragraph", create("paragraph", node.content, node.attrs));
        for (let level = 1; level <= 6; level++) {
            add(`Heading ${level}`, create("heading", node.content, { ...node.attrs, level }));
        }
        const paragraph = create("paragraph", node.content, node.attrs);
        if (paragraph) {
            for (const [label, type, itemType] of [
                ["Bulleted list", "bulletList", "listItem"],
                ["Numbered list", "orderedList", "listItem"],
                ["Checklist", "taskList", "taskItem"],
            ] as const) {
                const item = create(itemType, Fragment.from(paragraph));
                if (item) add(label, create(type, Fragment.from(item)));
            }
        }
        add("Quote", create("blockquote", Fragment.from(node)));
    } else if (node.type.name === "blockquote" && node.childCount === 1) {
        const child = node.firstChild;
        if (child?.type.name === "paragraph") add("Paragraph", child);
        if (child?.type.name === "heading") add(`Heading ${String(child.attrs.level)}`, child);
    }
    return options;
}

export function convert(view: EditorView, target: BlockTarget, option: Conversion): boolean {
    if (!validTarget(view, target)) return false;
    if (!conversionOptions(view, target).some((candidate) => candidate.node.eq(option.node))) return false;
    dispatchAction(
        view,
        view.state.tr.replaceWith(target.pos, target.pos + target.node.nodeSize, option.node),
        target.pos,
    );
    return true;
}

function button(
    label: string,
    action: () => void,
    disabled = false,
    explanation?: string,
): HTMLButtonElement {
    const element = document.createElement("button");
    element.type = "button";
    element.textContent = label;
    element.setAttribute("role", "menuitem");
    element.disabled = disabled;
    if (explanation) element.title = explanation;
    element.addEventListener("click", action);
    return element;
}

function createPlugin(): Plugin {
    let openForKeyboard: (() => void) | null = null;
    return new Plugin({
        key: pluginKey,
        props: {
            handleKeyDown: (view, event) => {
                if (
                    !view.editable ||
                    view.composing ||
                    event.isComposing ||
                    event.ctrlKey ||
                    event.metaKey ||
                    !event.altKey ||
                    !event.shiftKey ||
                    event.code !== "KeyM" ||
                    !openForKeyboard
                )
                    return false;
                event.preventDefault();
                event.stopPropagation();
                openForKeyboard();
                return true;
            },
        },
        view: (view) => {
            const container = view.dom.parentElement;
            if (!container) return {};
            const handle = container.querySelector<HTMLElement>(".drag-handle");
            if (!handle) return {};

            handle.tabIndex = 0;
            handle.hidden = !view.editable;
            handle.setAttribute("role", "button");
            handle.setAttribute("aria-label", "Block actions");
            handle.setAttribute("aria-haspopup", "menu");
            handle.setAttribute("aria-expanded", "false");
            handle.title = "Block actions · Alt+Shift+M";
            const menu = document.createElement("div");
            menu.className = "writeme-block-actions-menu";
            menu.setAttribute("role", "menu");
            menu.setAttribute("aria-label", "Block actions");
            menu.id = `block-actions-${crypto.randomUUID()}`;
            handle.setAttribute("aria-controls", menu.id);
            menu.hidden = true;
            document.body.append(menu);

            let target: BlockTarget | null = null;
            let open = false;
            let returnToEditor = false;
            let dragged = false;
            let pointerActivation = false;

            const positionHandle = (candidate: BlockTarget): void => {
                const nodeDOM = view.nodeDOM(candidate.pos);
                if (!(nodeDOM instanceof HTMLElement)) return;
                const rect = nodeDOM.getBoundingClientRect();
                handle.style.left = `${Math.max(4, rect.left - handle.offsetWidth)}px`;
                handle.style.top = `${rect.top}px`;
            };

            const close = (restoreFocus: boolean): void => {
                if (!open) return;
                open = false;
                menu.hidden = true;
                handle.setAttribute("aria-expanded", "false");
                handle.classList.remove("block-actions-open");
                if (restoreFocus) {
                    if (returnToEditor) view.focus();
                    else handle.focus();
                }
            };

            const show = (candidate: BlockTarget | null, focusMenu: boolean): void => {
                if (!view.editable) return;
                target = candidate;
                if (candidate) positionHandle(candidate);
                returnToEditor = view.hasFocus();
                const bounds = handle.getBoundingClientRect();
                menu.replaceChildren();

                const add = (
                    label: string,
                    command: (editorView: EditorView, block: BlockTarget) => boolean,
                    disabled: boolean,
                ): void => {
                    menu.append(
                        button(
                            label,
                            () => {
                                const block = target;
                                close(false);
                                if (block) command(view, block);
                            },
                            disabled,
                        ),
                    );
                };
                if (candidate) {
                    const $pos = view.state.doc.resolve(candidate.pos);
                    const parent = $pos.node(candidate.depth - 1);
                    const index = $pos.index(candidate.depth - 1);
                    add("Duplicate", duplicate, false);
                    add("Move up", (editorView, block) => move(editorView, block, -1), index === 0);
                    add(
                        "Move down",
                        (editorView, block) => move(editorView, block, 1),
                        index === parent.childCount - 1,
                    );

                    const divider = document.createElement("div");
                    divider.className = "writeme-block-actions-divider";
                    divider.setAttribute("role", "separator");
                    menu.append(divider);
                    const heading = document.createElement("div");
                    heading.className = "writeme-block-actions-heading";
                    heading.textContent = "Convert to";
                    menu.append(heading);
                    const conversions = conversionOptions(view, candidate);
                    if (conversions.length === 0) {
                        const unsupported = document.createElement("div");
                        unsupported.className = "writeme-block-actions-help";
                        unsupported.textContent = "This block cannot be converted without losing content.";
                        menu.append(unsupported);
                    } else {
                        for (const option of conversions) {
                            menu.append(
                                button(option.label, () => {
                                    const block = target;
                                    close(false);
                                    if (block) convert(view, block, option);
                                }),
                            );
                        }
                    }
                } else {
                    const help = document.createElement("p");
                    help.className = "writeme-block-actions-help";
                    help.textContent = "Place the cursor in a single block to use block actions.";
                    menu.append(
                        help,
                        button("Close", () => close(true)),
                    );
                }

                open = true;
                menu.hidden = false;
                handle.classList.add("block-actions-open");
                handle.setAttribute("aria-expanded", "true");
                menu.style.left = `${Math.max(8, Math.min(bounds.left, window.innerWidth - menu.offsetWidth - 8))}px`;
                menu.style.top = `${Math.max(8, Math.min(bounds.top, window.innerHeight - menu.offsetHeight - 8))}px`;
                if (focusMenu) menu.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
            };

            const pointerTarget = (event: MouseEvent | TouchEvent): BlockTarget | null => {
                const point = "touches" in event ? event.touches[0] : event;
                if (!point) return null;
                const position = view.posAtCoords({
                    left: point.clientX,
                    top: point.clientY,
                });
                return position ? targetAt(view, position.pos) : null;
            };
            const openFromHandle = (event: MouseEvent): void => {
                pointerActivation = false;
                event.preventDefault();
                event.stopPropagation();
                if (dragged) {
                    dragged = false;
                    return;
                }
                if (open) close(true);
                else show(target ?? currentTarget(view), true);
            };
            const openFromKeyboard = (event: KeyboardEvent): void => {
                if (event.altKey && event.shiftKey && event.code === "KeyM") {
                    event.preventDefault();
                    event.stopPropagation();
                    show(currentTarget(view), true);
                } else if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    show(target ?? currentTarget(view), true);
                } else if (event.key === "Escape" && open) {
                    event.preventDefault();
                    event.stopPropagation();
                    close(true);
                }
            };
            const updateTarget = (event: MouseEvent): void => {
                if (open || !view.editable) return;
                target = pointerTarget(event);
                handle.classList.toggle("block-actions-hover", !!target);
                if (target) positionHandle(target);
            };
            const touchTarget = (event: TouchEvent): void => {
                target = pointerTarget(event);
                if (!target || open || !view.editable) return;
                positionHandle(target);
                handle.classList.add("block-actions-touch");
            };
            const menuKeydown = (event: KeyboardEvent): void => {
                const items = Array.from(
                    menu.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)'),
                );
                const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
                if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    close(true);
                } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    const next =
                        (currentIndex + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length;
                    items[next]?.focus();
                } else if (event.key === "Home" || event.key === "End") {
                    event.preventDefault();
                    items[event.key === "Home" ? 0 : items.length - 1]?.focus();
                } else if (event.key === "Tab") {
                    event.preventDefault();
                    close(true);
                } else if (event.key.length === 1 && !event.altKey && !event.metaKey && !event.ctrlKey) {
                    const next = [...items.slice(currentIndex + 1), ...items.slice(0, currentIndex + 1)].find(
                        (item) => item.textContent?.toLowerCase().startsWith(event.key.toLowerCase()),
                    );
                    if (next) {
                        event.preventDefault();
                        next.focus();
                    }
                }
            };
            const onOutsideClick = (event: MouseEvent): void => {
                if (!menu.contains(event.target as Node) && event.target !== handle) {
                    close(false);
                    handle.classList.remove("block-actions-touch");
                }
            };
            const onEditorKeydown = (): void => {
                handle.classList.remove("block-actions-touch");
            };
            openForKeyboard = () => show(currentTarget(view), true);
            const onPointerSelection = (): void => synchronizePointerSelection(view);
            const onHandleFocus = (): void => {
                if (pointerActivation) return;
                target = currentTarget(view);
                if (target) positionHandle(target);
            };
            const onDragStart = (): void => {
                dragged = true;
                close(false);
            };
            const onHandlePointerDown = (): void => {
                dragged = false;
                pointerActivation = true;
            };
            const onViewportChange = (event: Event): void => {
                if (!(event.target instanceof Node) || !menu.contains(event.target)) close(false);
            };
            const onPointerLeave = (): void => handle.classList.remove("block-actions-hover");

            handle.addEventListener("click", openFromHandle);
            handle.addEventListener("pointerdown", onHandlePointerDown);
            handle.addEventListener("keydown", openFromKeyboard);
            handle.addEventListener("focus", onHandleFocus);
            handle.addEventListener("dragstart", onDragStart);
            container.addEventListener("mouseleave", onPointerLeave);
            menu.addEventListener("keydown", menuKeydown);
            view.dom.addEventListener("mousemove", updateTarget);
            view.dom.addEventListener("mouseup", onPointerSelection);
            view.dom.addEventListener("touchstart", touchTarget, { passive: true });
            view.dom.addEventListener("keydown", onEditorKeydown);
            document.addEventListener("pointerdown", onOutsideClick, true);
            window.addEventListener("resize", onViewportChange);
            window.addEventListener("scroll", onViewportChange, true);

            return {
                update: (_view, previousState) => {
                    handle.hidden = !view.editable;
                    if (!view.state.doc.eq(previousState.doc)) {
                        target = null;
                        close(false);
                    }
                    if (!view.editable) close(false);
                },
                destroy: () => {
                    openForKeyboard = null;
                    close(false);
                    handle.removeEventListener("click", openFromHandle);
                    handle.removeEventListener("pointerdown", onHandlePointerDown);
                    handle.removeEventListener("keydown", openFromKeyboard);
                    handle.removeEventListener("focus", onHandleFocus);
                    handle.removeEventListener("dragstart", onDragStart);
                    container.removeEventListener("mouseleave", onPointerLeave);
                    menu.removeEventListener("keydown", menuKeydown);
                    view.dom.removeEventListener("mousemove", updateTarget);
                    view.dom.removeEventListener("mouseup", onPointerSelection);
                    view.dom.removeEventListener("touchstart", touchTarget);
                    view.dom.removeEventListener("keydown", onEditorKeydown);
                    document.removeEventListener("pointerdown", onOutsideClick, true);
                    window.removeEventListener("resize", onViewportChange);
                    window.removeEventListener("scroll", onViewportChange, true);
                    menu.remove();
                    handle.removeAttribute("aria-expanded");
                    handle.removeAttribute("hidden");
                    handle.removeAttribute("role");
                    handle.removeAttribute("aria-label");
                    handle.removeAttribute("tabindex");
                    handle.removeAttribute("title");
                    handle.removeAttribute("aria-haspopup");
                    handle.removeAttribute("aria-controls");
                    handle.classList.remove(
                        "block-actions-open",
                        "block-actions-touch",
                        "block-actions-hover",
                    );
                },
            };
        },
    });
}

export const BlockActions = Extension.create({
    name: "blockActions",
    priority: 90,
    addProseMirrorPlugins() {
        return [createPlugin()];
    },
});
