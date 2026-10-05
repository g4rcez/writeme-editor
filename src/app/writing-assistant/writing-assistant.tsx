import { Button } from "@g4rcez/components";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { type Editor } from "@tiptap/core";
import { type KeyboardEvent, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { adapterRegistry } from "@/app/ai/adapters/registry";
import type { WritingEditorAdapter, WritingScope, WritingSelectionRange, WritingSuggestion } from "./types";
import { registerWritingReviewHandler } from "./review-requests";
import { useWritingAssistant } from "./use-writing-assistant";

type WritingAssistantAnchor = {
    left: number;
    top: number;
    bottom: number;
};

type WritingSelectionContext = {
    target: HTMLElement;
    readSelection(): WritingSelectionRange | null;
    readAnchor(selection?: WritingSelectionRange): WritingAssistantAnchor | null;
};

type WritingAssistantProps = {
    adapter: WritingEditorAdapter;
    editor?: Editor;
    selectionContext?: WritingSelectionContext | null;
    disabled?: boolean;
};

const CATEGORY_LABELS: Record<WritingSuggestion["category"], string> = {
    spelling: "Spelling",
    grammar: "Grammar",
    clarity: "Clarity",
    enhancement: "Enhancement",
};

export function WritingAssistant({ adapter, editor, selectionContext, disabled = false }: WritingAssistantProps) {
    const assistant = useWritingAssistant(adapter, disabled);
    const requestReviewFromAssistant = assistant.requestReview;
    const panelId = useId();
    const configurationId = useId();
    const cardRefs = useRef(new Map<string, HTMLElement>());
    const statusRef = useRef<HTMLDivElement>(null);
    const dialogRef = useRef<HTMLDialogElement>(null);
    const pendingNativeSelectionRef = useRef<WritingSelectionRange | null>(null);
    const reviewSelectionRef = useRef<WritingSelectionRange | undefined>(undefined);
    const panelAnchorRef = useRef<WritingAssistantAnchor | null>(null);
    const pendingFocusAfterRemovalRef = useRef<string | null | undefined>(undefined);
    const [panelPosition, setPanelPosition] = useState<{ left: number; top: number } | null>(null);
    const [reviewScope, setReviewScope] = useState<WritingScope | null>(null);
    const [panelAnchorRevision, setPanelAnchorRevision] = useState(0);
    const activeSuggestionId = assistant.adapterState.activeSuggestionId;
    const suggestions = assistant.adapterState.suggestions;
    const canReview =
        !disabled &&
        adapter.isEditable() &&
        !assistant.isReviewing &&
        !assistant.configurationsLoading &&
        assistant.selectedConfiguration !== null;

    const requestReview = useCallback(
        (scope: WritingScope, selection?: WritingSelectionRange): void => {
            setReviewScope(scope);
            reviewSelectionRef.current = selection;
            panelAnchorRef.current = selectionContext?.readAnchor(selection) ?? null;
            setPanelPosition(null);
            setPanelAnchorRevision((revision) => revision + 1);
            requestReviewFromAssistant(scope, selection);
        },
        [requestReviewFromAssistant, selectionContext],
    );

    useEffect(() => {
        if (!editor || disabled || !adapter.isEditable()) return;
        return registerWritingReviewHandler(editor, ({ scope, selection }) => {
            requestReview(scope, selection);
        });
    }, [adapter, disabled, editor, requestReview]);

    useEffect(() => {
        const target = selectionContext?.target;
        if (!target || disabled || !adapter.isEditable() || typeof window.electronAPI === "undefined") return;

        const captureNativeSelection = (event: globalThis.MouseEvent): void => {
            const eventTarget = event.target;
            if (!(eventTarget instanceof Node) || !target.contains(eventTarget)) {
                pendingNativeSelectionRef.current = null;
                return;
            }
            const selection = selectionContext.readSelection();
            pendingNativeSelectionRef.current = selection && selection.to > selection.from ? selection : null;
        };
        const unsubscribe = window.electronAPI.writingAssistant.onImproveSelectedText(() => {
            const selection = pendingNativeSelectionRef.current;
            pendingNativeSelectionRef.current = null;
            if (!selection || disabled || !adapter.isEditable()) return;
            adapter.focus();
            requestReview("selection", selection);
        });

        document.addEventListener("contextmenu", captureNativeSelection);
        return () => {
            document.removeEventListener("contextmenu", captureNativeSelection);
            unsubscribe();
        };
    }, [adapter, disabled, requestReview, selectionContext]);

    useLayoutEffect(() => {
        if (!assistant.isOpen) return;

        const dialog = dialogRef.current;
        if (!dialog) return;

        const updatePosition = (): void => {
            const anchor = selectionContext?.readAnchor(reviewSelectionRef.current) ?? panelAnchorRef.current;
            if (!anchor) return;
            panelAnchorRef.current = anchor;

            const { width, height } = dialog.getBoundingClientRect();
            const margin = 16;
            const gap = 12;
            const left = Math.max(margin, Math.min(anchor.left, window.innerWidth - width - margin));
            const availableAbove = anchor.top - margin;
            const availableBelow = window.innerHeight - anchor.bottom - margin;
            let top = anchor.bottom + gap;
            if (availableAbove >= height + gap || availableAbove > availableBelow) {
                top = anchor.top - height - gap;
            }
            top = Math.max(margin, Math.min(top, window.innerHeight - height - margin));
            setPanelPosition((current) => (current?.left === left && current.top === top ? current : { left, top }));
        };

        updatePosition();
        window.addEventListener("resize", updatePosition);
        document.addEventListener("scroll", updatePosition, true);
        const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updatePosition);
        resizeObserver?.observe(dialog);
        return () => {
            window.removeEventListener("resize", updatePosition);
            document.removeEventListener("scroll", updatePosition, true);
            resizeObserver?.disconnect();
        };
    }, [assistant.isOpen, panelAnchorRevision, selectionContext]);

    useEffect(() => {
        if (!assistant.isOpen || !activeSuggestionId) return;
        cardRefs.current.get(activeSuggestionId)?.focus();
    }, [activeSuggestionId, assistant.isOpen]);

    useEffect(() => {
        if (pendingFocusAfterRemovalRef.current === undefined) return;
        const targetId = pendingFocusAfterRemovalRef.current;
        pendingFocusAfterRemovalRef.current = undefined;
        if (targetId) cardRefs.current.get(targetId)?.focus();
        else statusRef.current?.focus();
    }, [suggestions]);

    const focusTargetAfterRemoval = (suggestionId: string, remove: () => boolean): void => {
        const suggestionIndex = suggestions.findIndex((suggestion) => suggestion.id === suggestionId);
        const fallbackSuggestionId =
            suggestions[suggestionIndex + 1]?.id ?? suggestions[suggestionIndex - 1]?.id ?? null;
        const removed = remove();
        if (removed || !adapter.getSuggestions().some((suggestion) => suggestion.id === suggestionId)) {
            pendingFocusAfterRemovalRef.current = fallbackSuggestionId;
        }
    };

    const handleEscape = (event: KeyboardEvent<HTMLElement>): void => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        assistant.close(true);
    };

    return (
        <>
            {assistant.isOpen &&
                createPortal(
                    <dialog
                        open
                        ref={dialogRef}
                        id={panelId}
                        aria-labelledby={`${panelId}-title`}
                        onKeyDown={handleEscape}
                        className="fixed z-[100] m-0 flex max-h-[min(70vh,42rem)] w-[min(42rem,calc(100vw-2rem))] min-w-0 flex-col overflow-hidden rounded-md border border-card-border bg-background p-0 text-foreground shadow-xl"
                        style={{
                            left: panelPosition?.left ?? 0,
                            top: panelPosition?.top ?? 0,
                            visibility: panelPosition ? "visible" : "hidden",
                        }}
                    >
                        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-card-border px-3 py-2">
                            <div className="min-w-0">
                                <h2 id={`${panelId}-title`} className="text-sm font-semibold">
                                    Writing suggestions
                                </h2>
                                {suggestions.length > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                        {suggestions.length} {suggestions.length === 1 ? "suggestion" : "suggestions"}
                                    </p>
                                )}
                            </div>
                            <Button type="button" theme="ghost-muted" onClick={() => assistant.close(true)}>
                                Close
                            </Button>
                        </div>

                        <div className="min-h-0 overflow-y-auto px-3 py-3">
                            {assistant.configurationsLoading ? (
                                <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
                                    Loading saved AI configurations…
                                </p>
                            ) : assistant.configurationsError ? (
                                <div className="flex flex-wrap items-center gap-2 text-sm">
                                    <p role="alert" className="text-foreground">
                                        {assistant.configurationsError}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => void assistant.loadConfigurations()}
                                        className="inline-flex min-h-10 items-center rounded-md border border-card-border bg-secondary-background px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        Retry
                                    </button>
                                    <Link
                                        to="/settings/ai"
                                        className="inline-flex min-h-10 items-center rounded-md px-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        AI settings
                                    </Link>
                                </div>
                            ) : assistant.configurations.length === 0 ? (
                                <div className="space-y-2 text-sm">
                                    <p>No saved AI configuration is available for writing review.</p>
                                    <Link
                                        to="/settings/ai"
                                        className="inline-flex min-h-10 items-center rounded-md bg-button-primary-bg px-3 text-sm font-medium text-button-primary-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        Configure AI
                                    </Link>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="grid min-w-0 gap-1">
                                        <label
                                            htmlFor={configurationId}
                                            className="text-xs font-medium text-foreground"
                                        >
                                            Saved AI configuration
                                        </label>
                                        <select
                                            id={configurationId}
                                            value={assistant.selectedConfigurationId}
                                            onChange={(event) =>
                                                assistant.selectConfiguration(event.currentTarget.value)
                                            }
                                            className="min-h-10 w-full min-w-0 rounded-md border border-card-border bg-secondary-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            {assistant.configurations.map((configuration) => {
                                                const configuredAdapter = adapterRegistry.get(configuration.adapterId);
                                                const providerName = configuredAdapter?.name ?? configuration.adapterId;
                                                const label = [
                                                    configuration.name,
                                                    ...(!configuration.name
                                                        .toLowerCase()
                                                        .includes(providerName.toLowerCase())
                                                        ? [providerName]
                                                        : []),
                                                    configuration.model ?? configuredAdapter?.defaultModel,
                                                ]
                                                    .filter(Boolean)
                                                    .join(" · ");
                                                return (
                                                    <option key={configuration.id} value={configuration.id}>
                                                        {label}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>

                                    {assistant.isReviewing && (
                                        <button
                                            type="button"
                                            onClick={assistant.stop}
                                            className="inline-flex min-h-10 items-center justify-center rounded-md border border-card-border bg-secondary-background px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            Stop review
                                        </button>
                                    )}
                                </div>
                            )}

                            {assistant.reviewError && (
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <p role="alert" className="text-sm text-destructive">
                                        {assistant.reviewError}
                                    </p>
                                    <button
                                        type="button"
                                        disabled={!canReview}
                                        onClick={assistant.retry}
                                        className="inline-flex min-h-10 items-center rounded-md border border-card-border bg-secondary-background px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        Retry review
                                    </button>
                                </div>
                            )}
                            {assistant.phase === "empty" ? (
                                <div className="mt-3 rounded-md border border-card-border bg-secondary-background text-sm">
                                    <div
                                        ref={statusRef}
                                        role="status"
                                        aria-live="polite"
                                        aria-atomic="true"
                                        tabIndex={-1}
                                        className="flex min-w-0 items-start gap-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-success">
                                            <CheckCircleIcon size={20} aria-hidden="true" />
                                        </span>
                                        <div className="min-w-0">
                                            <h3 className="font-semibold text-foreground">Looks good</h3>
                                            <p className="mt-1 text-muted-foreground">{assistant.reviewStatus}</p>
                                        </div>
                                    </div>
                                    {reviewScope !== "note" && (
                                        <div className="px-4 pb-4 pl-16">
                                            <button
                                                type="button"
                                                onClick={() => requestReview("note")}
                                                className="inline-flex min-h-10 items-center rounded-md border border-card-border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            >
                                                Review entire note
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                (assistant.reviewStatus || assistant.batchProgress) && (
                                    <div
                                        ref={statusRef}
                                        role="status"
                                        aria-live="polite"
                                        aria-atomic="true"
                                        tabIndex={-1}
                                        className="mt-3 text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        {assistant.batchProgress
                                            ? `Reviewing batch ${assistant.batchProgress.current} of ${assistant.batchProgress.total}.`
                                            : assistant.reviewStatus}
                                    </div>
                                )
                            )}

                            {suggestions.length > 0 ? (
                                <ol className="mt-2 max-h-48 divide-y divide-card-border overflow-y-auto">
                                    {suggestions.map((suggestion, index) => (
                                        <li key={suggestion.id} className="min-w-0 py-3 first:pt-1 last:pb-1">
                                            <article
                                                ref={(element) => {
                                                    if (element) cardRefs.current.set(suggestion.id, element);
                                                    else cardRefs.current.delete(suggestion.id);
                                                }}
                                                tabIndex={0}
                                                aria-current={activeSuggestionId === suggestion.id ? "true" : undefined}
                                                aria-label={`${CATEGORY_LABELS[suggestion.category]} suggestion ${index + 1} for ${suggestion.original}`}
                                                className="min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            >
                                                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                                                    <span className="text-xs font-semibold text-foreground">
                                                        {CATEGORY_LABELS[suggestion.category]}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        aria-label={`Show suggestion ${index + 1} in note`}
                                                        onClick={() => adapter.reveal(suggestion.id)}
                                                        className="inline-flex min-h-10 items-center rounded-md px-2 text-xs font-medium text-primary underline-offset-4 hover:bg-muted hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                    >
                                                        Show in note
                                                    </button>
                                                </div>
                                                <p className="mt-1 break-words text-sm leading-relaxed">
                                                    <span className="sr-only">Original: </span>
                                                    <del>{suggestion.original}</del>
                                                    <span aria-hidden="true" className="px-1 text-muted-foreground">
                                                        →
                                                    </span>
                                                    <span className="sr-only">Suggested: </span>
                                                    <ins className="no-underline">
                                                        {suggestion.replacement || "Delete this text"}
                                                    </ins>
                                                </p>
                                                <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
                                                    {suggestion.explanation}
                                                </p>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    <button
                                                        type="button"
                                                        aria-label={`Accept ${CATEGORY_LABELS[suggestion.category].toLowerCase()} suggestion ${index + 1} for ${suggestion.original}`}
                                                        onClick={() =>
                                                            focusTargetAfterRemoval(suggestion.id, () =>
                                                                adapter.accept(suggestion.id),
                                                            )
                                                        }
                                                        className="inline-flex min-h-10 items-center justify-center rounded-md bg-button-primary-bg px-3 text-sm font-medium text-button-primary-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                    >
                                                        Accept
                                                    </button>
                                                    <button
                                                        type="button"
                                                        aria-label={`Dismiss ${CATEGORY_LABELS[suggestion.category].toLowerCase()} suggestion ${index + 1} for ${suggestion.original}`}
                                                        onClick={() =>
                                                            focusTargetAfterRemoval(suggestion.id, () => {
                                                                adapter.dismiss(suggestion.id);
                                                                return true;
                                                            })
                                                        }
                                                        className="inline-flex min-h-10 items-center justify-center rounded-md border border-card-border bg-secondary-background px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                    >
                                                        Dismiss
                                                    </button>
                                                </div>
                                            </article>
                                        </li>
                                    ))}
                                </ol>
                            ) : null}
                        </div>
                    </dialog>,
                    document.body,
                )}
        </>
    );
}
