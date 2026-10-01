import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { repositories } from "@/store/global.store";
import type { AIConfig } from "@/store/repositories/electron/ai.repository";
import { reviewWriting } from "./review";
import type { WritingEditorAdapter, WritingScope, WritingSnapshot, WritingSuggestion } from "./types";

type ReviewState = {
    phase: "idle" | "reviewing" | "complete" | "stopped";
    statusMessage: string | null;
    errorMessage: string | null;
    batchProgress: { current: number; total: number } | null;
};

type AdapterState = {
    suggestions: readonly WritingSuggestion[];
    activeSuggestionId: string | null;
    statusMessage: string | null;
};

type ScopeCounts = {
    noteCharacters: number;
    selectionCharacters: number;
};

type ActiveRequest = {
    id: number;
    adapter: WritingEditorAdapter;
    controller: AbortController;
};

const IDLE_REVIEW: ReviewState = {
    phase: "idle",
    statusMessage: null,
    errorMessage: null,
    batchProgress: null,
};

function readAdapterState(adapter: WritingEditorAdapter): AdapterState {
    return {
        suggestions: adapter.getSuggestions(),
        activeSuggestionId: adapter.getActiveSuggestionId(),
        statusMessage: adapter.getStatusMessage(),
    };
}

function countCharacters(snapshot: WritingSnapshot): number {
    return snapshot.segments.reduce((total, segment) => total + segment.text.length, 0);
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) return error.message;
    return "Writing review failed. Check the selected AI configuration and try again.";
}

export function useWritingAssistant(adapter: WritingEditorAdapter, disabled = false) {
    const [isOpen, setIsOpen] = useState(false);
    const [configurations, setConfigurations] = useState<AIConfig[]>([]);
    const [selectedConfigId, setSelectedConfigId] = useState("");
    const [configurationsLoading, setConfigurationsLoading] = useState(false);
    const [configurationsError, setConfigurationsError] = useState<string | null>(null);
    const [reviewState, setReviewState] = useState<ReviewState>(IDLE_REVIEW);
    const [scopeCounts, setScopeCounts] = useState<ScopeCounts>({ noteCharacters: 0, selectionCharacters: 0 });
    const [adapterState, setAdapterState] = useState(() => readAdapterState(adapter));

    const mountedRef = useRef(false);
    const disabledRef = useRef(disabled);
    const adapterRef = useRef(adapter);
    const selectionSnapshotRef = useRef<WritingSnapshot | null>(null);
    const activeRequestRef = useRef<ActiveRequest | null>(null);
    const lastReviewScopeRef = useRef<WritingScope | null>(null);
    const requestIdRef = useRef(0);
    const configurationRequestIdRef = useRef(0);
    const configurationsLoadedRef = useRef(false);
    const configurationsLoadingRef = useRef(false);
    const selectedConfigIdRef = useRef(selectedConfigId);
    const userSelectedConfigurationRef = useRef(false);

    disabledRef.current = disabled;
    adapterRef.current = adapter;
    selectedConfigIdRef.current = selectedConfigId;
    const isOpenRef = useRef(isOpen);
    isOpenRef.current = isOpen;

    const selectedConfiguration = useMemo(
        () => configurations.find((configuration) => configuration.id === selectedConfigId) ?? null,
        [configurations, selectedConfigId],
    );

    const invalidateReview = useCallback((message: string | null, phase: ReviewState["phase"] = "idle"): void => {
        const activeRequest = activeRequestRef.current;
        if (!activeRequest) return;

        activeRequestRef.current = null;
        requestIdRef.current += 1;
        activeRequest.controller.abort();
        if (mountedRef.current) {
            setReviewState({ phase, statusMessage: message, errorMessage: null, batchProgress: null });
        }
    }, []);

    const refreshNoteScope = useCallback((): void => {
        const characterCount = countCharacters(adapter.snapshot("note"));
        setScopeCounts((current) => {
            if (current.noteCharacters === characterCount) return current;
            return { ...current, noteCharacters: characterCount };
        });
    }, [adapter]);

    const refreshSelectionScope = useCallback((): void => {
        const snapshot = adapter.snapshot("selection");
        selectionSnapshotRef.current = snapshot;
        const characterCount = countCharacters(snapshot);
        setScopeCounts((current) => {
            if (current.selectionCharacters === characterCount) return current;
            return { ...current, selectionCharacters: characterCount };
        });
    }, [adapter]);

    const refreshScopes = useCallback((): void => {
        refreshNoteScope();
        refreshSelectionScope();
    }, [refreshNoteScope, refreshSelectionScope]);

    const loadConfigurations = useCallback(async (): Promise<void> => {
        if (configurationsLoadedRef.current || configurationsLoadingRef.current) return;

        const requestId = ++configurationRequestIdRef.current;
        configurationsLoadingRef.current = true;
        setConfigurationsLoading(true);
        setConfigurationsError(null);
        try {
            const loadedConfigurations = await repositories.ai.getConfigs();
            if (!mountedRef.current || requestId !== configurationRequestIdRef.current) return;

            setConfigurations(loadedConfigurations);
            configurationsLoadedRef.current = true;
            if (!userSelectedConfigurationRef.current) {
                const defaultConfiguration =
                    loadedConfigurations.find((configuration) => configuration.isDefault) ?? loadedConfigurations[0];
                const nextId = defaultConfiguration?.id ?? "";
                selectedConfigIdRef.current = nextId;
                setSelectedConfigId(nextId);
            }
        } catch {
            if (!mountedRef.current || requestId !== configurationRequestIdRef.current) return;
            setConfigurationsError("Could not load saved AI configurations. Retry or open AI settings.");
        } finally {
            if (mountedRef.current && requestId === configurationRequestIdRef.current) {
                configurationsLoadingRef.current = false;
                setConfigurationsLoading(false);
            }
        }
    }, []);

    const close = useCallback(
        (returnFocusToEditor = true): void => {
            invalidateReview(null);
            adapter.clear();
            setReviewState(IDLE_REVIEW);
            isOpenRef.current = false;
            setIsOpen(false);
            if (returnFocusToEditor) adapter.focus();
            selectionSnapshotRef.current = null;
            setScopeCounts({ noteCharacters: 0, selectionCharacters: 0 });
        },
        [adapter, invalidateReview],
    );

    const open = useCallback((): void => {
        if (disabledRef.current || !adapter.isEditable()) return;
        isOpenRef.current = true;
        refreshScopes();
        setReviewState(IDLE_REVIEW);
        setIsOpen(true);
        void loadConfigurations();
    }, [adapter, loadConfigurations, refreshScopes]);

    const toggle = useCallback((): void => {
        if (isOpen) close(true);
        else open();
    }, [close, isOpen, open]);

    const selectConfiguration = useCallback(
        (configurationId: string): void => {
            if (configurationId === selectedConfigIdRef.current) return;
            invalidateReview("AI configuration changed. Run the review again.");
            adapter.clear();
            userSelectedConfigurationRef.current = true;
            selectedConfigIdRef.current = configurationId;
            setSelectedConfigId(configurationId);
            setReviewState({
                phase: "idle",
                statusMessage: "AI configuration changed. Run the review again.",
                errorMessage: null,
                batchProgress: null,
            });
        },
        [adapter, invalidateReview],
    );

    const review = useCallback(
        async (scope: WritingScope): Promise<void> => {
            if (
                disabledRef.current ||
                !adapter.isEditable() ||
                !selectedConfiguration ||
                activeRequestRef.current ||
                reviewState.phase === "reviewing"
            ) {
                return;
            }

            const snapshot =
                scope === "note" ? adapter.snapshot("note") : (selectionSnapshotRef.current ?? adapter.snapshot("selection"));
            if (snapshot.segments.length === 0) {
                setReviewState({
                    phase: "idle",
                    statusMessage: "No prose to review in this scope.",
                    errorMessage: null,
                    batchProgress: null,
                });
                return;
            }
            lastReviewScopeRef.current = scope;

            adapter.clear();
            const controller = new AbortController();
            const requestId = ++requestIdRef.current;
            const activeRequest: ActiveRequest = { id: requestId, adapter, controller };
            activeRequestRef.current = activeRequest;
            setReviewState({
                phase: "reviewing",
                statusMessage: "Preparing writing review…",
                errorMessage: null,
                batchProgress: null,
            });

            const isCurrentRequest = (): boolean =>
                mountedRef.current &&
                activeRequestRef.current === activeRequest &&
                requestIdRef.current === requestId &&
                adapterRef.current === adapter &&
                selectedConfigIdRef.current === selectedConfiguration.id &&
                !disabledRef.current &&
                adapter.isEditable() &&
                !controller.signal.aborted;

            try {
                const suggestions = await reviewWriting(
                    selectedConfiguration,
                    snapshot.segments,
                    controller.signal,
                    (current, total) => {
                        if (!isCurrentRequest()) return;
                        setReviewState({
                            phase: "reviewing",
                            statusMessage: `Reviewing batch ${current} of ${total}.`,
                            errorMessage: null,
                            batchProgress: { current, total },
                        });
                    },
                );
                if (!isCurrentRequest()) return;

                if (adapter.snapshot("note").revision !== snapshot.revision) {
                    setReviewState({
                        phase: "idle",
                        statusMessage: "Text changed while reviewing. Review the updated text again.",
                        errorMessage: null,
                        batchProgress: null,
                    });
                    return;
                }

                adapter.show(suggestions, snapshot);
                setReviewState({
                    phase: "complete",
                    statusMessage:
                        suggestions.length === 0
                            ? "No suggestions found in the reviewed text."
                            : `${suggestions.length} ${suggestions.length === 1 ? "suggestion" : "suggestions"} found.`,
                    errorMessage: null,
                    batchProgress: null,
                });
            } catch (error: unknown) {
                if (!isCurrentRequest()) return;
                setReviewState({
                    phase: "idle",
                    statusMessage: null,
                    errorMessage: getErrorMessage(error),
                    batchProgress: null,
                });
            } finally {
                if (activeRequestRef.current === activeRequest) activeRequestRef.current = null;
            }
        },
        [adapter, reviewState.phase, selectedConfiguration],
    );

    const stop = useCallback((): void => {
        invalidateReview("Review stopped.", "stopped");
    }, [invalidateReview]);
    const retry = useCallback((): void => {
        const scope = lastReviewScopeRef.current;
        if (scope) void review(scope);
    }, [review]);

    useLayoutEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            configurationRequestIdRef.current += 1;
            const activeRequest = activeRequestRef.current;
            activeRequestRef.current = null;
            requestIdRef.current += 1;
            activeRequest?.controller.abort();
        };
    }, []);

    useEffect(() => {
        const update = (): void => {
            const nextState = readAdapterState(adapter);
            setAdapterState(nextState);
            if (nextState.activeSuggestionId && !isOpenRef.current) open();
        };
        update();
        return adapter.subscribe(update);
    }, [adapter, open]);

    useEffect(() => {
        if (!isOpen) return;

        refreshScopes();
        const unsubscribeDocument = adapter.subscribeDocument(() => {
            invalidateReview("Text changed while reviewing. Review the updated text again.");
            refreshScopes();
        });
        const unsubscribeSelection = adapter.subscribeSelection(refreshSelectionScope);
        return () => {
            unsubscribeDocument();
            unsubscribeSelection();
        };
    }, [adapter, invalidateReview, isOpen, refreshScopes, refreshSelectionScope]);

    useLayoutEffect(() => {
        if (!disabled) return;
        invalidateReview("Writing review is unavailable while this editor is read-only or parsing.");
    }, [disabled, invalidateReview]);

    return {
        adapterState,
        captureSelection: refreshSelectionScope,
        close,
        configurations,
        configurationsError,
        configurationsLoading,
        isOpen,
        isReviewing: reviewState.phase === "reviewing",
        loadConfigurations,
        noteCharacters: scopeCounts.noteCharacters,
        open,
        phase: reviewState.phase,
        review,
        retry,
        reviewError: reviewState.errorMessage,
        reviewStatus: adapterState.statusMessage ?? reviewState.statusMessage,
        scopeCounts,
        selectConfiguration,
        selectedConfiguration,
        selectedConfigurationId: selectedConfigId,
        selectionCharacters: scopeCounts.selectionCharacters,
        batchProgress: reviewState.batchProgress,
        stop,
        toggle,
    };
}
