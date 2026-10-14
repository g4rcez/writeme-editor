import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection, type EditorState, type Selection, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { CONTENT_LOAD_META, SELECTION_RELOCATED_META, type ContentLoadPhase } from "./transaction-meta";

type Heading = { key: string; level: number; pos: number; end: number; node: ProseMirrorNode };
type FoldAction = { collapsed: ReadonlySet<string> };
type FoldState = {
    headings: Heading[];
    collapsed: ReadonlySet<string>;
    decorations: DecorationSet;
    loadingOutline: Heading[] | null;
};
const pluginKey = new PluginKey<FoldState>("collapsibleHeadings");
const STORAGE_PREFIX = "writeme:collapsed-headings:";
export const FOLD_ALL_HEADINGS_EVENT = "writeme:fold-all-headings";
export const REVEAL_HEADING_EVENT = "writeme:reveal-heading";

declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        collapsibleHeadings: {
            toggleHeadingSection: () => ReturnType;
            collapseAllSections: () => ReturnType;
            expandAllSections: () => ReturnType;
        };
    }
}

const headingIndexes = new WeakMap<ProseMirrorNode, Heading[]>();

function getHeadings(doc: ProseMirrorNode): Heading[] {
    const cached = headingIndexes.get(doc);
    if (cached) return cached;
    const headings: Heading[] = [];
    const occurrences = new Map<string, number>();
    const open: Heading[] = [];
    doc.forEach((node, pos) => {
        if (node.type.name !== "heading") return;
        const level = Number(node.attrs.level);
        const label = JSON.stringify([level, node.textContent]);
        const occurrence = occurrences.get(label) ?? 0;
        occurrences.set(label, occurrence + 1);
        while (open.length && open[open.length - 1]!.level >= level) open.pop()!.end = pos;
        const heading: Heading = {
            key: JSON.stringify([level, node.textContent, occurrence]),
            level,
            pos,
            end: doc.content.size,
            node,
        };
        headings.push(heading);
        open.push(heading);
    });
    headingIndexes.set(doc, headings);
    return headings;
}

function readCollapsed(noteId: string): Set<string> {
    if (!noteId) return new Set();
    try {
        const value: unknown = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}${noteId}`) ?? "[]");
        return Array.isArray(value)
            ? new Set(value.filter((key): key is string => typeof key === "string"))
            : new Set();
    } catch {
        return new Set();
    }
}

function writeCollapsed(noteId: string, collapsed: ReadonlySet<string>): void {
    if (!noteId) return;
    try {
        if (collapsed.size) localStorage.setItem(`${STORAGE_PREFIX}${noteId}`, JSON.stringify([...collapsed]));
        else localStorage.removeItem(`${STORAGE_PREFIX}${noteId}`);
    } catch {
        return;
    }
}

function containsSelection(heading: Heading, selection: Selection): boolean {
    const start = heading.pos + heading.node.nodeSize;
    return selection.empty
        ? selection.from >= start && selection.from < heading.end
        : selection.from < heading.end && selection.to > start;
}

function setCollapsed(tr: Transaction, collapsed: ReadonlySet<string>): Transaction {
    const hidden = getHeadings(tr.doc).find(
        (heading) => collapsed.has(heading.key) && containsSelection(heading, tr.selection),
    );
    if (hidden) {
        tr.setSelection(TextSelection.near(tr.doc.resolve(hidden.pos + 1)));
        tr.setMeta(SELECTION_RELOCATED_META, true);
    }
    tr.setMeta(pluginKey, { collapsed } satisfies FoldAction);
    return tr;
}

function headingAtSelection(state: EditorState): Heading | undefined {
    return getHeadings(state.doc).find(
        (heading) => state.selection.from >= heading.pos && state.selection.from < heading.pos + heading.node.nodeSize,
    );
}

function buildDecorations(
    doc: ProseMirrorNode,
    headings: Heading[],
    collapsed: ReadonlySet<string>,
    view: () => EditorView,
): DecorationSet {
    const result: Decoration[] = [];
    const ranges: { from: number; to: number }[] = [];
    for (const heading of headings) {
        if (!collapsed.has(heading.key)) continue;
        const from = heading.pos + heading.node.nodeSize;
        if (from >= heading.end) continue;
        const last = ranges[ranges.length - 1];
        if (last && from <= last.to) last.to = Math.max(last.to, heading.end);
        else ranges.push({ from, to: heading.end });
    }
    for (const heading of headings) {
        if (heading.end <= heading.pos + heading.node.nodeSize) continue;
        const isCollapsed = collapsed.has(heading.key);
        const label = `${isCollapsed ? "Expand" : "Collapse"} ${heading.node.textContent || "Untitled section"}`;
        result.push(
            Decoration.widget(
                heading.pos + 1,
                () => {
                    const button = document.createElement("button");
                    button.type = "button";
                    button.className = "writeme-heading-fold-control";
                    button.dataset.foldPosition = String(heading.pos);
                    button.setAttribute("aria-expanded", String(!isCollapsed));
                    button.setAttribute("aria-label", label);
                    button.title = `${label} (Cmd/Ctrl+Alt+${isCollapsed ? "]" : "["})`;
                    button.contentEditable = "false";
                    button.addEventListener("mousedown", (event) => event.preventDefault());
                    button.addEventListener("click", (event) => {
                        event.preventDefault();
                        const editorView = view();
                        const restoreButtonFocus = document.activeElement === button;
                        const next = new Set(pluginKey.getState(editorView.state)?.collapsed);
                        if (next.has(heading.key)) next.delete(heading.key);
                        else next.add(heading.key);
                        editorView.dispatch(setCollapsed(editorView.state.tr, next));
                        if (restoreButtonFocus)
                            editorView.dom
                                .querySelector<HTMLButtonElement>(`[data-fold-position="${heading.pos}"]`)
                                ?.focus();
                    });
                    return button;
                },
                {
                    key: `fold:${heading.key}:${isCollapsed}:${heading.pos}`,
                    side: -1,
                    stopEvent: (event) => event.type !== "mousedown",
                    ignoreSelection: true,
                },
            ),
        );
    }
    let rangeIndex = 0;
    if (ranges.length) {
        doc.forEach((node, pos) => {
            while (rangeIndex < ranges.length && pos >= ranges[rangeIndex]!.to) rangeIndex++;
            const range = ranges[rangeIndex];
            if (range && pos >= range.from && pos < range.to) {
                result.push(
                    Decoration.node(pos, pos + node.nodeSize, {
                        class: "writeme-heading-folded-block",
                        "aria-hidden": "true",
                    }),
                );
            }
        });
    }
    return DecorationSet.create(doc, result);
}

export const CollapsibleHeadings = Extension.create<{ noteId: string }>({
    name: "collapsibleHeadings",
    priority: 1250,
    addOptions() {
        return { noteId: "" };
    },
    addCommands() {
        return {
            toggleHeadingSection:
                () =>
                ({ tr, state, dispatch }) => {
                    const heading = headingAtSelection(state);
                    if (!heading || heading.end <= heading.pos + heading.node.nodeSize) return false;
                    if (dispatch) {
                        const next = new Set(pluginKey.getState(state)?.collapsed);
                        if (next.has(heading.key)) next.delete(heading.key);
                        else next.add(heading.key);
                        setCollapsed(tr, next);
                    }
                    return true;
                },
            collapseAllSections:
                () =>
                ({ tr, dispatch }) => {
                    if (dispatch)
                        setCollapsed(
                            tr,
                            new Set(
                                getHeadings(tr.doc)
                                    .filter((heading) => heading.end > heading.pos + heading.node.nodeSize)
                                    .map(({ key }) => key),
                            ),
                        );
                    return true;
                },
            expandAllSections:
                () =>
                ({ tr, dispatch }) => {
                    if (dispatch) setCollapsed(tr, new Set());
                    return true;
                },
        };
    },
    addProseMirrorPlugins() {
        const { noteId } = this.options;
        let editorView: EditorView;
        return [
            new Plugin<FoldState>({
                key: pluginKey,
                state: {
                    init: (_, state) => {
                        const headings = getHeadings(state.doc);
                        const collapsed = readCollapsed(noteId);
                        return {
                            headings,
                            collapsed,
                            decorations: buildDecorations(state.doc, headings, collapsed, () => editorView),
                            loadingOutline: null,
                        };
                    },
                    apply: (transaction, previous, _oldState, nextState) => {
                        const action = transaction.getMeta(pluginKey) as FoldAction | undefined;
                        const phase = transaction.getMeta(CONTENT_LOAD_META) as ContentLoadPhase | undefined;
                        const headings = transaction.docChanged ? getHeadings(nextState.doc) : previous.headings;
                        const loadingOutline =
                            phase === "start"
                                ? (previous.loadingOutline ?? previous.headings)
                                : phase === "finish" || phase === "abort"
                                  ? null
                                  : previous.loadingOutline;
                        let collapsed = action?.collapsed ?? previous.collapsed;
                        if (!loadingOutline && phase !== "abort" && (transaction.docChanged || phase === "finish")) {
                            const oldHeadings = previous.loadingOutline ?? previous.headings;
                            const structureChanged =
                                oldHeadings.length > 0 &&
                                (oldHeadings.length !== headings.length ||
                                    oldHeadings.some((heading, i) => heading.key !== headings[i]?.key));
                            const keys = new Set(headings.map(({ key }) => key));
                            collapsed = structureChanged
                                ? new Set()
                                : new Set([...collapsed].filter((key) => keys.has(key)));
                        }
                        if (
                            !loadingOutline &&
                            !phase &&
                            (transaction.selectionSet || transaction.docChanged) &&
                            !action &&
                            collapsed.size
                        ) {
                            const revealed = headings.filter(
                                (heading) =>
                                    collapsed.has(heading.key) && containsSelection(heading, nextState.selection),
                            );
                            if (revealed.length) {
                                const next = new Set(collapsed);
                                for (const heading of revealed) next.delete(heading.key);
                                collapsed = next;
                            }
                        }
                        const foldsChanged =
                            collapsed !== previous.collapsed &&
                            (collapsed.size !== previous.collapsed.size ||
                                [...collapsed].some((key) => !previous.collapsed.has(key)));
                        if (!foldsChanged) collapsed = previous.collapsed;
                        if (foldsChanged && !loadingOutline && phase !== "abort") writeCollapsed(noteId, collapsed);
                        const loadingChanged = Boolean(loadingOutline) !== Boolean(previous.loadingOutline);
                        if (!transaction.docChanged && !foldsChanged && !loadingChanged) return previous;
                        return {
                            headings,
                            collapsed,
                            loadingOutline,
                            decorations: loadingOutline
                                ? DecorationSet.empty
                                : buildDecorations(nextState.doc, headings, collapsed, () => editorView),
                        };
                    },
                },
                props: {
                    decorations(state) {
                        return pluginKey.getState(state)?.decorations ?? DecorationSet.empty;
                    },
                    handleKeyDown(view, event) {
                        if (
                            event.isComposing ||
                            view.composing ||
                            !(event.metaKey || event.ctrlKey) ||
                            !event.altKey ||
                            event.shiftKey ||
                            event.getModifierState("AltGraph")
                        )
                            return false;
                        const collapse = event.code === "BracketLeft";
                        if (!collapse && event.code !== "BracketRight") return false;
                        const heading = headingAtSelection(view.state);
                        if (!heading || heading.end <= heading.pos + heading.node.nodeSize) return false;
                        const next = new Set(pluginKey.getState(view.state)?.collapsed);
                        if (collapse) next.add(heading.key);
                        else next.delete(heading.key);
                        event.preventDefault();
                        view.dispatch(setCollapsed(view.state.tr, next));
                        return true;
                    },
                },
                view: (view) => {
                    editorView = view;
                    const onFoldAll = (event: Event): void => {
                        const detail = (event as CustomEvent<{ collapsed: boolean; noteId: string }>).detail;
                        if (typeof detail?.collapsed !== "boolean" || detail.noteId !== noteId) return;
                        const next = detail.collapsed
                            ? new Set(
                                  getHeadings(view.state.doc)
                                      .filter((heading) => heading.end > heading.pos + heading.node.nodeSize)
                                      .map(({ key }) => key),
                              )
                            : new Set<string>();
                        view.dispatch(setCollapsed(view.state.tr, next));
                    };
                    const onReveal = (event: Event): void => {
                        const detail = (event as CustomEvent<{ element: HTMLElement }>).detail;
                        if (!(detail?.element instanceof HTMLElement) || !view.dom.contains(detail.element)) return;
                        const pos = view.posAtDOM(detail.element, 0);
                        const next = new Set(pluginKey.getState(view.state)?.collapsed);
                        for (const heading of getHeadings(view.state.doc)) {
                            if (heading.pos < pos && pos < heading.end) next.delete(heading.key);
                        }
                        view.dispatch(setCollapsed(view.state.tr, next));
                    };
                    window.addEventListener(FOLD_ALL_HEADINGS_EVENT, onFoldAll);
                    window.addEventListener(REVEAL_HEADING_EVENT, onReveal);
                    return {
                        destroy() {
                            window.removeEventListener(FOLD_ALL_HEADINGS_EVENT, onFoldAll);
                            window.removeEventListener(REVEAL_HEADING_EVENT, onReveal);
                        },
                    };
                },
            }),
        ];
    },
});
