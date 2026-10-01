import type { Editor } from "@tiptap/core";
import { Fragment, type Mark as ProseMirrorMark } from "@tiptap/pm/model";
import { closeHistory } from "@tiptap/pm/history";
import type { Transaction } from "@tiptap/pm/state";
import {
    activateTiptapWritingIssue,
    clearTiptapWritingIssues,
    dismissTiptapWritingIssue,
    getTiptapWritingAssistantState,
    markTiptapWritingIssueStale,
    markTiptapWritingIssueAccepted,
    showTiptapWritingIssues,
    type TiptapWritingIssue,
} from "@/app/extensions/writing-assistant";
import { createWritingSegments } from "./segments";
import {
    getTiptapWritingTextRanges,
    sameTiptapMarks,
    type TiptapWritingSelection,
} from "./tiptap-prose";
import type { WritingEditorAdapter, WritingScope, WritingSegment, WritingSnapshot, WritingSuggestion } from "./types";

type EditorRange = TiptapWritingSelection;

type AdapterListener = () => void;

function subscribeListener(listeners: Set<AdapterListener>, listener: AdapterListener, disposed: boolean): () => void {
    if (!disposed) listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
function sameSuggestionIssues(
    previous: readonly TiptapWritingIssue[],
    current: readonly TiptapWritingIssue[],
): boolean {
    return (
        previous.length === current.length &&
        previous.every((issue, index) => issue.suggestion === current[index]?.suggestion)
    );
}

export function extractTiptapWritingSegments(editor: Editor, selection?: EditorRange): WritingSegment[] {
    return createWritingSegments(getTiptapWritingTextRanges(editor.state.doc, selection));
}

export function createTiptapWritingEditorAdapter(editor: Editor): WritingEditorAdapter {
    let disposed = false;
    let lastPluginState = editor.isDestroyed ? undefined : getTiptapWritingAssistantState(editor.state);
    const listeners = new Set<AdapterListener>();
    const documentListeners = new Set<AdapterListener>();
    const selectionListeners = new Set<AdapterListener>();

    const notify = (targets: Set<AdapterListener>): void => {
        for (const listener of targets) listener();
    };
    const onTransaction = ({ transaction }: { transaction: Transaction }): void => {
        if (disposed || editor.isDestroyed) return;
        const current = getTiptapWritingAssistantState(editor.state);
        if (current !== lastPluginState) {
            const previous = lastPluginState;
            lastPluginState = current;
            if (
                !previous ||
                !current ||
                !sameSuggestionIssues(previous.issues, current.issues) ||
                previous.activeId !== current.activeId ||
                previous.statusMessage !== current.statusMessage
            ) {
                notify(listeners);
            }
        }
        if (transaction.docChanged) notify(documentListeners);
    };
    const onSelectionUpdate = (): void => {
        if (!disposed && !editor.isDestroyed) notify(selectionListeners);
    };
    const detachHandlers = (): void => {
        editor.off("transaction", onTransaction);
        editor.off("selectionUpdate", onSelectionUpdate);
        editor.off("destroy", onDestroy);
    };
    const onDestroy = (): void => {
        detachHandlers();
        disposed = true;
        listeners.clear();
        documentListeners.clear();
        selectionListeners.clear();
    };

    if (!editor.isDestroyed) {
        editor.on("transaction", onTransaction);
        editor.on("selectionUpdate", onSelectionUpdate);
        editor.on("destroy", onDestroy);
    }

    const isEditable = (): boolean =>
        !disposed && !editor.isDestroyed && !editor.view.isDestroyed && editor.isEditable && editor.view.editable;

    return {
        snapshot(scope: WritingScope): WritingSnapshot {
            if (disposed || editor.isDestroyed) return { revision: lastPluginState?.revision ?? 0, segments: [] };
            const selection = editor.state.selection;
            const segments =
                scope === "selection"
                    ? selection.empty
                        ? []
                        : extractTiptapWritingSegments(editor, { from: selection.from, to: selection.to })
                    : extractTiptapWritingSegments(editor);
            return {
                revision: getTiptapWritingAssistantState(editor.state)?.revision ?? 0,
                segments,
            };
        },
        show(suggestions: WritingSuggestion[], snapshot: WritingSnapshot): void {
            if (disposed || editor.isDestroyed) return;
            const state = getTiptapWritingAssistantState(editor.state);
            if (!state || snapshot.revision !== state.revision) return;

            const segments = new Map(snapshot.segments.map((segment) => [segment.id, segment]));
            const issues: TiptapWritingIssue[] = [];
            for (const suggestion of suggestions) {
                const segment = segments.get(suggestion.segmentId);
                if (
                    !segment ||
                    !Number.isInteger(suggestion.from) ||
                    !Number.isInteger(suggestion.to) ||
                    suggestion.from < 0 ||
                    suggestion.to <= suggestion.from ||
                    suggestion.to > segment.text.length ||
                    segment.to - segment.from !== segment.text.length ||
                    segment.text.slice(suggestion.from, suggestion.to) !== suggestion.original
                ) {
                    continue;
                }
                issues.push({
                    suggestion,
                    from: segment.from + suggestion.from,
                    to: segment.from + suggestion.to,
                    segmentFrom: segment.from,
                    segmentTo: segment.to,
                });
            }
            showTiptapWritingIssues(editor, issues, snapshot.revision);
        },
        clear(): void {
            if (!disposed) clearTiptapWritingIssues(editor);
        },
        reveal(id: string): void {
            if (disposed || editor.isDestroyed) return;
            const state = getTiptapWritingAssistantState(editor.state);
            const issue = state?.issues.find((candidate) => candidate.suggestion.id === id);
            if (!issue) return;

            activateTiptapWritingIssue(editor, id);
            for (const element of editor.view.dom.querySelectorAll<HTMLElement>("[data-writing-suggestion-id]")) {
                if (element.dataset.writingSuggestionId !== id) continue;
                if (typeof element.scrollIntoView === "function") element.scrollIntoView({ block: "center" });
                break;
            }
        },
        focus(): void {
            if (!disposed && !editor.isDestroyed && !editor.view.isDestroyed) editor.commands.focus();
        },
        accept(id: string): boolean {
            if (!isEditable()) return false;
            const assistantState = getTiptapWritingAssistantState(editor.state);
            const issue = assistantState?.issues.find((candidate) => candidate.suggestion.id === id);
            if (!assistantState || !issue) return false;

            const state = editor.state;
            const source = state.doc.textBetween(issue.from, issue.to, "", "");
            const eligible = extractTiptapWritingSegments(editor).some(
                (segment) =>
                    segment.from <= issue.from &&
                    segment.to >= issue.to &&
                    segment.text.slice(issue.from - segment.from, issue.to - segment.from) === issue.suggestion.original,
            );
            let marks: readonly ProseMirrorMark[] | null = null;
            let safeText = "";
            let matchingMarks = true;
            state.doc.nodesBetween(issue.from, issue.to, (node, position) => {
                if (!node.isText || !node.text) return;
                const from = Math.max(issue.from, position);
                const to = Math.min(issue.to, position + node.nodeSize);
                if (from >= to) return;
                safeText += node.text.slice(from - position, to - position);
                if (!marks) marks = node.marks;
                else if (!sameTiptapMarks(marks, node.marks)) matchingMarks = false;
            });

            if (
                !eligible ||
                source !== issue.suggestion.original ||
                safeText !== issue.suggestion.original ||
                !marks ||
                !matchingMarks
            ) {
                markTiptapWritingIssueStale(editor, id);
                return false;
            }

            const replacement = issue.suggestion.replacement
                ? state.schema.text(issue.suggestion.replacement, marks)
                : Fragment.empty;
            const transaction = markTiptapWritingIssueAccepted(
                closeHistory(state.tr).replaceWith(issue.from, issue.to, replacement),
                issue.suggestion.segmentId,
            );
            editor.view.dispatch(transaction);
            if (!editor.isDestroyed && !editor.view.isDestroyed) editor.view.dispatch(closeHistory(editor.state.tr));
            return true;
        },
        dismiss(id: string): void {
            if (!disposed) dismissTiptapWritingIssue(editor, id);
        },
        getSuggestions(): readonly WritingSuggestion[] {
            if (disposed || editor.isDestroyed) return [];
            return getTiptapWritingAssistantState(editor.state)?.issues.map((issue) => issue.suggestion) ?? [];
        },
        getActiveSuggestionId(): string | null {
            if (disposed || editor.isDestroyed) return null;
            return getTiptapWritingAssistantState(editor.state)?.activeId ?? null;
        },
        getStatusMessage(): string | null {
            if (disposed || editor.isDestroyed) return null;
            return getTiptapWritingAssistantState(editor.state)?.statusMessage ?? null;
        },
        isEditable,
        subscribe(listener: AdapterListener): () => void {
            return subscribeListener(listeners, listener, disposed);
        },
        subscribeDocument(listener: AdapterListener): () => void {
            return subscribeListener(documentListeners, listener, disposed);
        },
        subscribeSelection(listener: AdapterListener): () => void {
            return subscribeListener(selectionListeners, listener, disposed);
        },
        dispose(): void {
            if (disposed) return;
            detachHandlers();
            if (!editor.isDestroyed) clearTiptapWritingIssues(editor);
            disposed = true;
            listeners.clear();
            documentListeners.clear();
            selectionListeners.clear();
        },
    };
}

