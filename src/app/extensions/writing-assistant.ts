import type { Editor as TiptapEditor } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import type { Fragment, Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { ReplaceStep } from "@tiptap/pm/transform";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { hasExcludedTiptapWritingMark, isEligibleTiptapWritingText } from "@/app/writing-assistant/tiptap-prose";
import type { WritingSuggestion } from "@/app/writing-assistant/types";

export type TiptapWritingIssue = {
    suggestion: WritingSuggestion;
    from: number;
    to: number;
    segmentFrom: number;
    segmentTo: number;
};

export type TiptapWritingAssistantState = {
    revision: number;
    issues: TiptapWritingIssue[];
    activeId: string | null;
    statusMessage: string | null;
    decorations: DecorationSet;
    spellcheckDecorations: DecorationSet;
};

type WritingAssistantMeta =
    | { type: "show"; revision: number; issues: TiptapWritingIssue[] }
    | { type: "clear" }
    | { type: "activate"; id: string }
    | { type: "dismiss"; id: string }
    | { type: "stale"; id: string }
    | { type: "accept"; segmentId: string };

const writingAssistantKey = new PluginKey<TiptapWritingAssistantState>("writingAssistant");

const SPELLCHECK_EXCLUDED_NODE_TYPES = new Set(["frontmatter", "codeBlock", "blockMath", "inlineMath"]);

function fragmentHasNonTextNodes(fragment: Fragment): boolean {
    for (let index = 0; index < fragment.childCount; index += 1) {
        if (!fragment.child(index).isText) return true;
    }
    return false;
}

function fragmentHasExcludedMarks(fragment: Fragment): boolean {
    for (let index = 0; index < fragment.childCount; index += 1) {
        const node = fragment.child(index);
        if (node.isText && hasExcludedTiptapWritingMark(node)) return true;
    }
    return false;
}

function shouldRebuildSpellcheckDecorations(
    transaction: Transaction,
    oldDoc: ProseMirrorNode,
    newDoc: ProseMirrorNode,
): boolean {
    if (transaction.steps.length !== 1) return true;
    const [step] = transaction.steps;
    if (!(step instanceof ReplaceStep)) return true;

    const replacedContent = oldDoc.slice(step.from, step.to).content;
    if (
        fragmentHasNonTextNodes(replacedContent) ||
        fragmentHasNonTextNodes(step.slice.content) ||
        fragmentHasExcludedMarks(replacedContent) ||
        fragmentHasExcludedMarks(step.slice.content)
    ) {
        return true;
    }

    const oldParent = oldDoc.resolve(step.from).parent;
    const newParent = newDoc.resolve(Math.min(step.from, newDoc.content.size)).parent;
    return oldParent.type !== newParent.type;
}

function buildSpellcheckDecorations(doc: ProseMirrorNode): DecorationSet {
    const decorations: Decoration[] = [];
    doc.descendants((node, position, parent) => {
        if (SPELLCHECK_EXCLUDED_NODE_TYPES.has(node.type.name)) {
            decorations.push(Decoration.node(position, position + node.nodeSize, { spellcheck: "false" }));
            return true;
        }
        if (node.isText && node.text && !isEligibleTiptapWritingText(node, parent)) {
            decorations.push(Decoration.inline(position, position + node.nodeSize, { spellcheck: "false" }));
        }
        return true;
    });
    return DecorationSet.create(doc, decorations);
}

function buildDecorations(
    doc: ProseMirrorNode,
    issues: readonly TiptapWritingIssue[],
    activeId: string | null,
    spellcheckDecorations: DecorationSet,
): DecorationSet {
    if (issues.length === 0) return spellcheckDecorations;

    const suggestions = issues.map((issue) =>
        Decoration.inline(
            issue.from,
            issue.to,
            {
                class: [
                    "writing-suggestion",
                    `writing-suggestion-${issue.suggestion.category}`,
                    ...(issue.suggestion.id === activeId ? ["writing-suggestion-active"] : []),
                ].join(" "),
                "data-writing-suggestion-id": issue.suggestion.id,
                "data-writing-category": issue.suggestion.category,
            },
            { inclusiveStart: false, inclusiveEnd: false },
        ),
    );
    return spellcheckDecorations.add(doc, suggestions);
}

function createState(
    doc: ProseMirrorNode,
    revision: number,
    issues: TiptapWritingIssue[],
    activeId: string | null,
    statusMessage: string | null,
    spellcheckDecorations: DecorationSet,
): TiptapWritingAssistantState {
    return {
        revision,
        issues,
        activeId,
        statusMessage,
        spellcheckDecorations,
        decorations: buildDecorations(doc, issues, activeId, spellcheckDecorations),
    };
}

function changeTouchesSegment(from: number, to: number, segmentFrom: number, segmentTo: number): boolean {
    if (from === to) return from >= segmentFrom && from <= segmentTo;
    return from <= segmentTo && to >= segmentFrom;
}

function mapIssue(issue: TiptapWritingIssue, transaction: Transaction): TiptapWritingIssue | null {
    let { from, to, segmentFrom, segmentTo } = issue;

    for (const stepMap of transaction.mapping.maps) {
        let touched = false;
        stepMap.forEach((oldStart, oldEnd) => {
            if (changeTouchesSegment(oldStart, oldEnd, segmentFrom, segmentTo)) touched = true;
        });
        if (touched) return null;

        from = stepMap.map(from, 1);
        to = stepMap.map(to, -1);
        segmentFrom = stepMap.map(segmentFrom, 1);
        segmentTo = stepMap.map(segmentTo, -1);
    }

    if (from >= to || segmentFrom > from || segmentTo < to) return null;
    return { ...issue, from, to, segmentFrom, segmentTo };
}

function mapIssues(
    issues: readonly TiptapWritingIssue[],
    transaction: Transaction,
    acceptedSegmentId: string | null,
): { issues: TiptapWritingIssue[]; stale: boolean } {
    const mapped: TiptapWritingIssue[] = [];
    const touchedSegments = new Set<string>();
    let stale = false;
    const candidates = issues.map((issue) => {
        const result = mapIssue(issue, transaction);
        if (!result) {
            touchedSegments.add(issue.suggestion.segmentId);
            if (issue.suggestion.segmentId !== acceptedSegmentId) stale = true;
        }
        return result;
    });

    for (let index = 0; index < issues.length; index += 1) {
        const issue = issues[index];
        const candidate = candidates[index];
        if (issue && candidate && !touchedSegments.has(issue.suggestion.segmentId)) mapped.push(candidate);
    }
    return { issues: mapped, stale };
}

function applyMeta(
    meta: WritingAssistantMeta,
    current: TiptapWritingAssistantState,
    doc: ProseMirrorNode,
): TiptapWritingAssistantState {
    switch (meta.type) {
        case "show":
            if (meta.revision !== current.revision) return current;
            return createState(doc, current.revision, meta.issues, null, null, current.spellcheckDecorations);
        case "clear":
            return createState(doc, current.revision, [], null, null, current.spellcheckDecorations);
        case "activate":
            if (!current.issues.some((issue) => issue.suggestion.id === meta.id) || current.activeId === meta.id) {
                return current;
            }
            return createState(
                doc,
                current.revision,
                current.issues,
                meta.id,
                current.statusMessage,
                current.spellcheckDecorations,
            );
        case "dismiss": {
            const issues = current.issues.filter((issue) => issue.suggestion.id !== meta.id);
            if (issues.length === current.issues.length) return current;
            return createState(
                doc,
                current.revision,
                issues,
                current.activeId === meta.id ? null : current.activeId,
                current.statusMessage,
                current.spellcheckDecorations,
            );
        }
        case "stale": {
            const issues = current.issues.filter((issue) => issue.suggestion.id !== meta.id);
            if (issues.length === current.issues.length) return current;
            return createState(
                doc,
                current.revision,
                issues,
                current.activeId === meta.id ? null : current.activeId,
                "Text changed. Review again.",
                current.spellcheckDecorations,
            );
        }
        case "accept":
            return current;
    }

}
export function getTiptapWritingAssistantState(state: EditorState): TiptapWritingAssistantState | undefined {
    return writingAssistantKey.getState(state);
}

export function showTiptapWritingIssues(editor: TiptapEditor, issues: TiptapWritingIssue[], revision: number): void {
    if (editor.isDestroyed || editor.view.isDestroyed) return;
    editor.view.dispatch(editor.state.tr.setMeta(writingAssistantKey, { type: "show", issues, revision } satisfies WritingAssistantMeta));
}

export function clearTiptapWritingIssues(editor: TiptapEditor): void {
    if (editor.isDestroyed || editor.view.isDestroyed) return;
    editor.view.dispatch(editor.state.tr.setMeta(writingAssistantKey, { type: "clear" } satisfies WritingAssistantMeta));
}

export function activateTiptapWritingIssue(editor: TiptapEditor, id: string): void {
    if (editor.isDestroyed || editor.view.isDestroyed) return;
    editor.view.dispatch(editor.state.tr.setMeta(writingAssistantKey, { type: "activate", id } satisfies WritingAssistantMeta));
}

export function dismissTiptapWritingIssue(editor: TiptapEditor, id: string): void {
    if (editor.isDestroyed || editor.view.isDestroyed) return;
    editor.view.dispatch(editor.state.tr.setMeta(writingAssistantKey, { type: "dismiss", id } satisfies WritingAssistantMeta));
}

export function markTiptapWritingIssueStale(editor: TiptapEditor, id: string): void {
    if (editor.isDestroyed || editor.view.isDestroyed) return;
    editor.view.dispatch(editor.state.tr.setMeta(writingAssistantKey, { type: "stale", id } satisfies WritingAssistantMeta));
}
export function markTiptapWritingIssueAccepted(transaction: Transaction, segmentId: string): Transaction {
    return transaction.setMeta(writingAssistantKey, { type: "accept", segmentId } satisfies WritingAssistantMeta);
}

function findClickedIssue(view: EditorView, event: Event): string | null {
    const target = event.target;
    if (!(target instanceof Element)) return null;
    const decoration = target.closest<HTMLElement>("[data-writing-suggestion-id]");
    if (!decoration || !view.dom.contains(decoration)) return null;
    return decoration.dataset.writingSuggestionId ?? null;
}

export const WritingAssistant = Extension.create({
    name: "writingAssistant",

    addProseMirrorPlugins() {
        return [
            new Plugin<TiptapWritingAssistantState>({
                key: writingAssistantKey,
                state: {
                    init(_config, state) {
                        return createState(state.doc, 0, [], null, null, buildSpellcheckDecorations(state.doc));
                    },
                    apply(transaction, previous, _oldState, newState) {
                        const meta = transaction.getMeta(writingAssistantKey) as WritingAssistantMeta | undefined;
                        let current = previous;
                        if (transaction.docChanged) {
                            const acceptedSegmentId = meta?.type === "accept" ? meta.segmentId : null;
                            const mapped = mapIssues(previous.issues, transaction, acceptedSegmentId);
                            const activeId = mapped.issues.some((issue) => issue.suggestion.id === previous.activeId)
                                ? previous.activeId
                                : null;
                            const statusMessage = mapped.stale ? "Text changed. Review again." : previous.statusMessage;
                            const spellcheckDecorations = shouldRebuildSpellcheckDecorations(
                                transaction,
                                _oldState.doc,
                                newState.doc,
                            )
                                ? buildSpellcheckDecorations(newState.doc)
                                : previous.spellcheckDecorations.map(transaction.mapping, newState.doc);
                            current = createState(
                                newState.doc,
                                previous.revision + 1,
                                mapped.issues,
                                activeId,
                                statusMessage,
                                spellcheckDecorations,
                            );
                        }

                        if (meta) return applyMeta(meta, current, newState.doc);
                        return current;
                    },
                },
                props: {
                    decorations(state) {
                        return writingAssistantKey.getState(state)?.decorations ?? null;
                    },
                    handleDOMEvents: {
                        click(view, event) {
                            const id = findClickedIssue(view, event);
                            if (!id) return false;
                            const state = writingAssistantKey.getState(view.state);
                            if (!state?.issues.some((issue) => issue.suggestion.id === id)) return false;
                            event.preventDefault();
                            view.dispatch(
                                view.state.tr.setMeta(writingAssistantKey, { type: "activate", id } satisfies WritingAssistantMeta),
                            );
                            return true;
                        },
                    },
                },
            }),
        ];
    },
});
