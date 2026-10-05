import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { AIConfig } from "@/store/repositories/electron/ai.repository";
import { repositories } from "@/store/global.store";
import type {
    WritingEditorAdapter,
    WritingScope,
    WritingSelectionRange,
    WritingSnapshot,
    WritingSuggestion,
} from "./types";
import { reviewWriting } from "./review";

type ReviewState = {
    phase: "idle" | "reviewing" | "complete" | "empty" | "stopped";
    statusMessage: string | null;
    errorMessage: string | null;
    batchProgress: { current: number; total: number } | null;
};

type AdapterState = {
    suggestions: readonly WritingSuggestion[];
    activeSuggestionId: string | null;
    statusMessage: string | null;
};

type PendingReviewRequest = {
    scope: WritingScope;
    selection?: WritingSelectionRange;
    snapshot: WritingSnapshot;
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
    const [adapterState, setAdapterState] = useState(() => readAdapterState(adapter));

    const mountedRef = useRef(false);
    const disabledRef = useRef(disabled);
    const adapterRef = useRef(adapter);
    const activeRequestRef = useRef<ActiveRequest | null>(null);
    const pendingReviewRequestRef = useRef<PendingReviewRequest | null>(null);
    const lastReviewRequestRef = useRef<Omit<PendingReviewRequest, "snapshot"> | null>(null);
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
            pendingReviewRequestRef.current = null;
            adapter.clear();
            setReviewState(IDLE_REVIEW);
            isOpenRef.current = false;
            setIsOpen(false);
            if (returnFocusToEditor) adapter.focus();
        },
        [adapter, invalidateReview],
    );

    const open = useCallback((): void => {
        if (disabledRef.current || !adapter.isEditable()) return;
        isOpenRef.current = true;
        setReviewState(IDLE_REVIEW);
        setIsOpen(true);
        void loadConfigurations();
    }, [adapter, loadConfigurations]);

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
        async (request: PendingReviewRequest): Promise<void> => {
            if (
                disabledRef.current ||
                !adapter.isEditable() ||
                !selectedConfiguration ||
                activeRequestRef.current ||
                reviewState.phase === "reviewing"
            ) {
                return;
            }

            const { snapshot } = request;
            if (adapter.snapshot("note").revision !== snapshot.revision) {
                setReviewState({
                    phase: "idle",
                    statusMessage: "Text changed before the review started. Run the command again.",
                    errorMessage: null,
                    batchProgress: null,
                });
                return;
            }
            if (snapshot.segments.length === 0) {
                setReviewState({
                    phase: "idle",
                    statusMessage: "No prose to review in this scope.",
                    errorMessage: null,
                    batchProgress: null,
                });
                return;
            }

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
                    phase: suggestions.length === 0 ? "empty" : "complete",
                    statusMessage:
                        suggestions.length === 0
                            ? "No meaningful changes suggested."
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

    const requestReview = useCallback(
        (scope: WritingScope, selection?: WritingSelectionRange): void => {
            if (disabledRef.current || !adapter.isEditable() || activeRequestRef.current) return;
            const request: PendingReviewRequest = {
                scope,
                ...(selection ? { selection } : {}),
                snapshot: adapter.snapshot(scope, selection),
            };
            pendingReviewRequestRef.current = request;
            lastReviewRequestRef.current = { scope, ...(selection ? { selection } : {}) };
            open();

            if (selectedConfiguration && !configurationsLoadingRef.current) {
                pendingReviewRequestRef.current = null;
                void review(request);
            }
        },
        [adapter, open, review, selectedConfiguration],
    );

    useEffect(() => {
        if (!isOpen || configurationsLoading || !selectedConfiguration) return;
        const pendingRequest = pendingReviewRequestRef.current;
        if (!pendingRequest) return;
        pendingReviewRequestRef.current = null;
        void review(pendingRequest);
    }, [configurationsLoading, isOpen, review, selectedConfiguration]);

    const stop = useCallback((): void => {
        invalidateReview("Review stopped.", "stopped");
    }, [invalidateReview]);
    const retry = useCallback((): void => {
        const lastRequest = lastReviewRequestRef.current;
        if (lastRequest) requestReview(lastRequest.scope, lastRequest.selection);
    }, [requestReview]);

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
        return adapter.subscribeDocument(() => {
            invalidateReview("Text changed while reviewing. Review the updated text again.");
        });
    }, [adapter, invalidateReview, isOpen]);

    useLayoutEffect(() => {
        if (!disabled) return;
        invalidateReview("Writing review is unavailable while this editor is read-only or parsing.");
    }, [disabled, invalidateReview]);

    return {
        adapterState,
        close,
        configurations,
        configurationsError,
        configurationsLoading,
        isOpen,
        isReviewing: reviewState.phase === "reviewing",
        loadConfigurations,
        phase: reviewState.phase,
        requestReview,
        retry,
        reviewError: reviewState.errorMessage,
        reviewStatus: adapterState.statusMessage ?? reviewState.statusMessage,
        selectConfiguration,
        selectedConfiguration,
        selectedConfigurationId: selectedConfigId,
        batchProgress: reviewState.batchProgress,
        stop,
    };
}
