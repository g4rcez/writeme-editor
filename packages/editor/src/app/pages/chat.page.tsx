import { adapterRegistry } from "@/app/ai/adapters/registry";
import type { AIFile } from "@/app/ai/adapters/types";
import { AI_CHAT_LOADING_MESSAGES, AIChatMessageList } from "@/app/ai/ai-message-item";
import { createWorkspaceMentionItems, type WorkspaceMentionFile } from "@/app/ai/chat-mentions";
import { createWorkspaceTools } from "@/app/ai/chat-tools";
import { MarkdownChatComposer } from "@/app/ai/markdown-chat-composer";
import { useAIChat } from "@/app/ai/use-ai-chat";
import { WorkspaceChatDetails, WorkspaceProposalReview } from "@/app/ai/workspace-chat-details";
import { buildWorkspaceContextSummary, getWorkspaceChatScope } from "@/app/ai/workspace-context";
import { isElectron } from "@/lib/is-electron";
import { getStorageMode } from "@/lib/storage-mode";
import { repositories, useGlobalStore } from "@/store/global.store";
import type { AIMessage, AINoteEditProposal, AIWorkspaceData } from "@/store/repositories/electron/ai.repository";
import { ArrowDownIcon, ArrowsCounterClockwiseIcon, PencilSimpleIcon } from "@phosphor-icons/react";
import { GearIcon } from "@phosphor-icons/react/dist/csr/Gear";
import { SparkleIcon } from "@phosphor-icons/react/dist/csr/Sparkle";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const FILESYSTEM_APPROVAL_UNAVAILABLE_REASON =
    "Automatic approval is disabled for filesystem-backed notes. An external editor could change the file between review and commit, so this app leaves the proposal review-only.";

const PROMPT_EXAMPLES = [
    "Summarize this workspace and call out the most active topics.",
    "Find notes that mention open decisions and group them by project.",
    "List recent writing drafts with tags and next suggested actions.",
];

const CHAT_FOLLOW_DISTANCE = 80;

function getComposerDraft(chatId: string): string {
    try {
        return sessionStorage.getItem(`writeme:ai-chat-draft:${chatId}`) ?? "";
    } catch {
        return "";
    }
}

function saveComposerDraft(chatId: string, value: string): void {
    try {
        if (value) sessionStorage.setItem(`writeme:ai-chat-draft:${chatId}`, value);
        else sessionStorage.removeItem(`writeme:ai-chat-draft:${chatId}`);
    } catch {
        // Keep the active draft in component state when storage is unavailable.
    }
}

type RenderChatContentProps = {
    isLoading: boolean;
    messages: AIMessage[];
    isReviewing: boolean;
    reviewData?: AIWorkspaceData;
    reviewMessage?: AIMessage;
    approveProposal: (reviewMessage: AIMessage, proposal: AINoteEditProposal) => Promise<void>;
    rejectProposal: (reviewMessage: AIMessage, proposal: AINoteEditProposal) => Promise<void>;
    isFilesystemStorage: boolean;
    isStreaming: boolean;
    isConfigured: boolean;
    loadingMessageIndex: number;
    sourceError: string | null;
    onBack: () => void;
    onExamplePrompt: (prompt: string) => void;
    onConfigureAI: () => void;
    workspaceDataForMessage: (message: AIMessage) => AIWorkspaceData | undefined;
    openSourceNote: (noteId: string) => Promise<void>;
    onReviewMessage: (messageId: string) => void;
};

const RenderChatContent = ({
    isLoading,
    messages,
    isReviewing,
    reviewData,
    reviewMessage,
    approveProposal,
    isFilesystemStorage,
    isStreaming,
    isConfigured,
    loadingMessageIndex,
    sourceError,
    onBack,
    onExamplePrompt,
    onConfigureAI,
    workspaceDataForMessage,
    openSourceNote,
    onReviewMessage,
    rejectProposal,
}: RenderChatContentProps) => {
    if (isLoading) {
        return (
            <div className="flex h-full min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
                <ArrowsCounterClockwiseIcon size={18} className="animate-spin" aria-hidden="true" />
                <span>Loading chat history...</span>
            </div>
        );
    }

    if (isReviewing && reviewMessage && reviewData) {
        return (
            <div className="mx-auto w-full max-w-5xl">
                <WorkspaceProposalReview
                    data={reviewData}
                    onApprove={(proposal) => approveProposal(reviewMessage, proposal)}
                    onReject={(proposal) => rejectProposal(reviewMessage, proposal)}
                    onBack={onBack}
                    approvalUnavailableReason={isFilesystemStorage ? FILESYSTEM_APPROVAL_UNAVAILABLE_REASON : undefined}
                />
            </div>
        );
    }

    if (messages.length === 0) {
        return (
            <div className="mx-auto flex h-full min-h-64 max-w-3xl flex-col items-center justify-center py-8 text-center">
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <SparkleIcon size={22} aria-hidden="true" />
                </span>
                <h2 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">
                    What should we work through?
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                    Ask about notes, trends, drafts, or decisions in this workspace. Responses stay as readable
                    markdown.
                </p>
                <div className="mt-8 grid w-full gap-2 text-left sm:grid-cols-3">
                    {PROMPT_EXAMPLES.map((prompt) => (
                        <button
                            key={prompt}
                            type="button"
                            onClick={() => onExamplePrompt(prompt)}
                            disabled={!isConfigured || isLoading || isStreaming}
                            className="rounded-xl border border-border/45 bg-card-background p-4 text-left text-sm leading-5 text-foreground transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {prompt}
                        </button>
                    ))}
                </div>
                {isConfigured ? null : (
                    <button
                        type="button"
                        onClick={onConfigureAI}
                        className="mt-6 rounded-md bg-button-primary-bg px-3 py-1.5 text-sm font-medium text-button-primary-text transition-opacity hover:opacity-90"
                    >
                        Configure AI
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-3xl">
            {sourceError ? (
                <p
                    role="alert"
                    className="mb-3 rounded-md border border-danger/40 bg-danger-subtle px-3 py-2 text-sm text-danger"
                >
                    {sourceError}
                </p>
            ) : null}
            <AIChatMessageList
                messages={messages}
                isStreaming={isStreaming}
                maxWidthClass="max-w-safe"
                loadingMessageIndex={loadingMessageIndex}
                renderActions={(message) => {
                    if (message.role !== "assistant") return null;
                    const workspaceData = workspaceDataForMessage(message);
                    if (!workspaceData) return null;
                    const isLiveMessage = isStreaming && message.id === messages.at(-1)?.id;
                    const summaryData = isLiveMessage ? { ...workspaceData, proposals: [] } : workspaceData;
                    if (
                        summaryData.activities.length === 0 &&
                        summaryData.sources.length === 0 &&
                        summaryData.proposals.length === 0
                    ) {
                        return null;
                    }
                    return (
                        <WorkspaceChatDetails
                            data={summaryData}
                            messageId={message.id}
                            onOpenSource={openSourceNote}
                            onReview={() => onReviewMessage(message.id)}
                        />
                    );
                }}
            />
        </div>
    );
};

export default function ChatPage() {
    const navigate = useNavigate();
    const listRef = useRef<HTMLDivElement | null>(null);
    const reviewFocusTargetIdRef = useRef<string | null>(null);
    const shouldFollowMessagesRef = useRef(true);
    const [searchParams, setSearchParams] = useSearchParams();
    const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [titleDraft, setTitleDraft] = useState("");
    const [messageScrollState, setMessageScrollState] = useState<{ chatId: string | null; isAtLatest: boolean }>({
        chatId: null,
        isAtLatest: true,
    });
    const [composerDrafts, setComposerDrafts] = useState<Record<string, string>>({});
    const [state, dispatch] = useGlobalStore((s) => ({
        notes: s.notes,
        theme: s.theme,
        directory: s.directory,
        note: s.note,
    }));

    const isFilesystemStorage = getStorageMode(state.directory) === "filesystem";

    const [liveWorkspaceData, setLiveWorkspaceData] = useState<AIWorkspaceData | null>(null);
    const [workspaceDataOverrides, setWorkspaceDataOverrides] = useState<Record<string, AIWorkspaceData>>({});
    const [reviewMessageId, setReviewMessageId] = useState<string | null>(null);
    const [sourceError, setSourceError] = useState<string | null>(null);

    const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceMentionFile[]>([]);

    useEffect(() => {
        setWorkspaceFiles([]);
        const directory = state.directory;
        if (!isElectron() || !directory) {
            setWorkspaceFiles([]);
            return;
        }

        let isCurrentRequest = true;
        void window.electronAPI.fs
            .readDirRecursive(directory, undefined, true)
            .then((result) => {
                if (isCurrentRequest) setWorkspaceFiles(result.success ? result.files : []);
            })
            .catch(() => {
                if (isCurrentRequest) setWorkspaceFiles([]);
            });

        return () => {
            isCurrentRequest = false;
        };
    }, [state.directory]);

    const selectedChatId = searchParams.get("chatId");
    const isAtLatestMessage = messageScrollState.chatId !== selectedChatId || messageScrollState.isAtLatest;
    const chatScopeId = useMemo(() => getWorkspaceChatScope(state.directory), [state.directory]);
    const { chat, messages, isStreaming, isLoading, send, cancel, config, renameChat } = useAIChat(
        undefined,
        chatScopeId,
        selectedChatId,
    );
    const supportsWorkspaceTools = config?.adapterId !== "cli";
    const workspaceContext = useMemo(
        () => buildWorkspaceContextSummary(state.directory, state.notes, supportsWorkspaceTools),
        [state.directory, state.notes, supportsWorkspaceTools],
    );
    const workspaceToolSession = useMemo(() => createWorkspaceTools((data) => setLiveWorkspaceData(data)), []);

    const latestMessageContent = messages.at(-1)?.content ?? "";
    const adapter = config ? adapterRegistry.get(config.adapterId) : undefined;
    const workspaceDataForMessage = useCallback(
        (message: AIMessage): AIWorkspaceData | undefined => {
            if (workspaceDataOverrides[message.id]) return workspaceDataOverrides[message.id];
            if (message.workspaceData) return message.workspaceData;
            if (isStreaming && message.id === messages.at(-1)?.id) return liveWorkspaceData ?? undefined;
            return undefined;
        },
        [isStreaming, liveWorkspaceData, messages, workspaceDataOverrides],
    );
    const reviewMessage = reviewMessageId ? messages.find((message) => message.id === reviewMessageId) : undefined;
    const reviewData = reviewMessage ? workspaceDataForMessage(reviewMessage) : undefined;
    const isReviewing = Boolean(reviewMessage && reviewData);

    const mentionItems = useMemo(
        () => createWorkspaceMentionItems(state.notes, workspaceFiles, state.directory),
        [state.directory, state.notes, workspaceFiles],
    );

    const composerDraftKey = selectedChatId ?? chat?.id ?? "";
    const composerDraft = composerDrafts[composerDraftKey] ?? getComposerDraft(composerDraftKey);

    const updateComposerDraft = (value: string): void => {
        if (!composerDraftKey) return;
        setComposerDrafts((current) => ({ ...current, [composerDraftKey]: value }));
        saveComposerDraft(composerDraftKey, value);
    };

    const renameConversation = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        const title = titleDraft.trim();
        if (!title || !chat) return;
        await renameChat(title);
        setIsEditingTitle(false);
    };

    useEffect(() => {
        setReviewMessageId(null);
        setLiveWorkspaceData(null);
        reviewFocusTargetIdRef.current = null;
        shouldFollowMessagesRef.current = true;
    }, [selectedChatId]);

    useEffect(() => {
        if (isReviewing) return;
        const messageId = reviewFocusTargetIdRef.current;
        if (!messageId) return;
        document.getElementById(`review-changes-${messageId}`)?.focus();
        reviewFocusTargetIdRef.current = null;
    }, [isReviewing]);

    useEffect(() => {
        if (!chat) return;
        void dispatch.addAiChatTab(chat.id);
        if (selectedChatId === chat.id) return;
        setSearchParams({ chatId: chat.id }, { replace: true });
    }, [chat, dispatch, selectedChatId, setSearchParams]);

    useEffect(() => {
        setTitleDraft(chat?.title ?? "");
        setIsEditingTitle(false);
    }, [chat?.id, chat?.title]);

    useEffect(() => {
        const container = listRef.current;
        if (!container || !shouldFollowMessagesRef.current) return;
        const behavior =
            isStreaming || window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
        container.scrollTo({ top: container.scrollHeight, behavior });
    }, [messages.length, latestMessageContent, isStreaming, selectedChatId, isAtLatestMessage]);

    useEffect(() => {
        if (!isStreaming) {
            setLoadingMessageIndex(0);
            return;
        }
        const intervalId = window.setInterval(() => {
            setLoadingMessageIndex((current) => (current + 1) % AI_CHAT_LOADING_MESSAGES.length);
        }, 4000);
        return () => window.clearInterval(intervalId);
    }, [isStreaming]);

    const updateMessageFollowState = useCallback(
        (isAtLatest: boolean): void => {
            setMessageScrollState((current) => {
                if (current.chatId === selectedChatId && current.isAtLatest === isAtLatest) return current;
                return { chatId: selectedChatId, isAtLatest };
            });
        },
        [selectedChatId],
    );

    const handleMessageListScroll = (): void => {
        const container = listRef.current;
        if (!container) return;
        const isAtLatest =
            container.scrollHeight - container.scrollTop - container.clientHeight <= CHAT_FOLLOW_DISTANCE;
        shouldFollowMessagesRef.current = isAtLatest;
        updateMessageFollowState(isAtLatest);
    };

    const scrollToLatestMessage = (): void => {
        const container = listRef.current;
        if (!container) return;
        shouldFollowMessagesRef.current = true;
        updateMessageFollowState(true);
        const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
        container.scrollTo({ top: container.scrollHeight, behavior });
    };

    const handleJumpToLatest = (): void => {
        scrollToLatestMessage();
        listRef.current?.focus({ preventScroll: true });
    };

    const submitPrompt = useCallback(
        async (value: string, files: AIFile[] = []): Promise<boolean> => {
            const prompt = value.trim();
            if ((!prompt && files.length === 0) || !config || isLoading || isStreaming) return false;
            workspaceToolSession.reset();
            shouldFollowMessagesRef.current = true;
            updateMessageFollowState(true);
            setLiveWorkspaceData(null);
            const sent = await send(
                prompt,
                { selection: "", context: workspaceContext },
                files,
                supportsWorkspaceTools ? workspaceToolSession.tools : undefined,
                undefined,
                supportsWorkspaceTools ? workspaceToolSession.getWorkspaceData : undefined,
            );
            if (sent && composerDraftKey) {
                setComposerDrafts((current) => {
                    const next = { ...current };
                    delete next[composerDraftKey];
                    return next;
                });
                saveComposerDraft(composerDraftKey, "");
            }
            return sent;
        },
        [
            composerDraftKey,
            config,
            isLoading,
            isStreaming,
            send,
            supportsWorkspaceTools,
            updateMessageFollowState,
            workspaceContext,
            workspaceToolSession,
        ],
    );

    const openSourceNote = useCallback(
        async (noteId: string): Promise<void> => {
            try {
                setSourceError(null);
                await dispatch.selectNoteById(noteId);
                navigate(`/note/${noteId}`);
            } catch {
                setSourceError("Could not open that source note.");
            }
        },
        [dispatch, navigate],
    );

    const persistProposalStatus = useCallback(
        async (message: AIMessage, proposalId: string, status: "approved" | "rejected" | "stale"): Promise<void> => {
            const persistedMessage = (await repositories.ai.getMessages(message.chatId)).find(
                (candidate) => candidate.id === message.id,
            );
            if (!persistedMessage) throw new Error("This review is no longer available.");
            const currentData =
                workspaceDataOverrides[message.id] ?? persistedMessage.workspaceData ?? message.workspaceData;
            if (!currentData) throw new Error("This review is no longer available.");
            const proposal = currentData.proposals.find((candidate) => candidate.id === proposalId);
            if (!proposal) throw new Error("This proposed change is no longer available.");
            if (proposal.status !== "pending") return;

            const workspaceData: AIWorkspaceData = {
                ...currentData,
                proposals: currentData.proposals.map((candidate) =>
                    candidate.id === proposalId
                        ? { ...candidate, status, updatedAt: new Date().toISOString() }
                        : candidate,
                ),
            };
            await repositories.ai.saveMessage({ ...persistedMessage, workspaceData });
            setWorkspaceDataOverrides((current) => ({ ...current, [message.id]: workspaceData }));
        },
        [workspaceDataOverrides],
    );

    const approveProposal = useCallback(
        async (message: AIMessage, proposal: AINoteEditProposal): Promise<void> => {
            if (isFilesystemStorage) {
                throw new Error(FILESYSTEM_APPROVAL_UNAVAILABLE_REASON);
            }

            const inMemoryNote =
                state.note?.id === proposal.noteId
                    ? state.note
                    : state.notes.find((candidate) => candidate.id === proposal.noteId);
            const isStaleInMemory =
                inMemoryNote !== undefined &&
                (inMemoryNote.title !== proposal.title ||
                    inMemoryNote.updatedAt.toISOString() !== proposal.baseUpdatedAt ||
                    inMemoryNote.content !== proposal.baseMarkdown);
            if (isStaleInMemory) {
                await persistProposalStatus(message, proposal.id, "stale");
                return;
            }

            const savedNote = await repositories.notes.updateContentIfUnchanged(
                proposal.noteId,
                {
                    title: proposal.title,
                    updatedAt: new Date(proposal.baseUpdatedAt),
                    content: proposal.baseMarkdown,
                },
                proposal.proposedMarkdown,
            );
            if (!savedNote) {
                await persistProposalStatus(message, proposal.id, "stale");
                return;
            }

            await dispatch.syncNoteFromRepository(savedNote);
            await persistProposalStatus(message, proposal.id, "approved");
        },
        [dispatch, isFilesystemStorage, persistProposalStatus, state.note, state.notes],
    );

    const rejectProposal = useCallback(
        async (message: AIMessage, proposal: AINoteEditProposal): Promise<void> => {
            if (proposal.status !== "pending") return;
            await persistProposalStatus(message, proposal.id, "rejected");
        },
        [persistProposalStatus],
    );

    const handleReviewMessage = useCallback((messageId: string): void => {
        reviewFocusTargetIdRef.current = messageId;
        setReviewMessageId(messageId);
    }, []);
    const handleExamplePrompt = useCallback(
        (prompt: string): void => {
            if (isStreaming || isLoading || !config) return;
            void submitPrompt(prompt, []);
        },
        [config, isLoading, isStreaming, submitPrompt],
    );
    const handleReviewBack = useCallback((): void => setReviewMessageId(null), []);
    const handleConfigureAI = useCallback((): void => {
        void navigate("/settings/ai");
    }, [navigate]);

    return (
        <section className="writeme-chat-page flex h-full min-h-0 w-full flex-col bg-background">
            <header className="shrink-0 border-b border-border/45 px-4 py-3 sm:px-6">
                <div
                    className={`mx-auto flex w-full items-center justify-between gap-4 ${isReviewing ? "max-w-5xl" : "max-w-3xl"
                        }`}
                >
                    <div className="min-w-0">
                        <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
                            <SparkleIcon size={13} aria-hidden="true" />
                            Workspace assistant
                        </p>
                        {isEditingTitle ? (
                            <form
                                className="mt-1 flex items-center gap-2"
                                onSubmit={(event) => void renameConversation(event)}
                            >
                                <input
                                    aria-label="Conversation title"
                                    autoFocus
                                    value={titleDraft}
                                    onChange={(event) => setTitleDraft(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Escape") {
                                            setTitleDraft(chat?.title ?? "");
                                            setIsEditingTitle(false);
                                        }
                                    }}
                                    className="min-w-0 rounded border border-border bg-card-background px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                />
                                <button
                                    type="submit"
                                    disabled={!titleDraft.trim()}
                                    className="rounded px-2 py-1 text-xs font-medium text-primary hover:bg-muted disabled:opacity-50"
                                >
                                    Save
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTitleDraft(chat?.title ?? "");
                                        setIsEditingTitle(false);
                                    }}
                                    className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                                >
                                    Cancel
                                </button>
                            </form>
                        ) : (
                            <div className="mt-1 flex items-center gap-2">
                                <h1 className="truncate text-base font-semibold text-foreground">
                                    {isReviewing ? "Review suggested edits" : chat?.title || "New Chat"}
                                </h1>
                                {!isReviewing && chat ? (
                                    <button
                                        type="button"
                                        aria-label="Rename conversation"
                                        onClick={() => {
                                            setTitleDraft(chat.title ?? "");
                                            setIsEditingTitle(true);
                                        }}
                                        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <PencilSimpleIcon size={14} aria-hidden="true" />
                                    </button>
                                ) : null}
                            </div>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate("/settings/ai")}
                        className="flex shrink-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <GearIcon size={15} aria-hidden="true" />
                        AI settings
                    </button>
                </div>
            </header>
            <div className="flex min-h-0 flex-1 flex-col">
                <div
                    ref={listRef}
                    tabIndex={-1}
                    onScroll={handleMessageListScroll}
                    role={isReviewing ? undefined : "log"}
                    aria-live={isReviewing ? undefined : "polite"}
                    className="min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-6 sm:py-6"
                    aria-label={isReviewing ? "Suggested edits review" : "Chat messages"}
                >
                    <RenderChatContent
                        messages={messages}
                        isLoading={isLoading}
                        reviewData={reviewData}
                        isReviewing={isReviewing}
                        isStreaming={isStreaming}
                        onBack={handleReviewBack}
                        sourceError={sourceError}
                        reviewMessage={reviewMessage}
                        isConfigured={Boolean(config)}
                        openSourceNote={openSourceNote}
                        rejectProposal={rejectProposal}
                        approveProposal={approveProposal}
                        onConfigureAI={handleConfigureAI}
                        onExamplePrompt={handleExamplePrompt}
                        onReviewMessage={handleReviewMessage}
                        isFilesystemStorage={isFilesystemStorage}
                        loadingMessageIndex={loadingMessageIndex}
                        workspaceDataForMessage={workspaceDataForMessage}
                    />
                </div>
                {!isReviewing && messages.length > 0 && !isAtLatestMessage ? (
                    <div className="flex shrink-0 justify-center py-2">
                        <button
                            type="button"
                            onClick={handleJumpToLatest}
                            aria-label="Jump to latest message"
                            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-card-border bg-card-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <ArrowDownIcon size={16} aria-hidden="true" />
                            Jump to latest
                        </button>
                    </div>
                ) : null}
            </div>
            {isReviewing ? null : (
                <div className="shrink-0 border-t border-border/45 bg-background px-3 pt-3 pb-3 sm:px-6 sm:pt-4 sm:pb-4">
                    <div className="mx-auto w-full max-w-3xl">
                        {isStreaming ? (
                            <div className="mb-2 flex items-center justify-between rounded-lg border border-border/45 bg-card-background px-3 py-2 text-sm text-muted-foreground">
                                <span>{AI_CHAT_LOADING_MESSAGES[loadingMessageIndex]}</span>
                                <button
                                    type="button"
                                    onClick={cancel}
                                    className="rounded-md px-2 py-1 text-danger transition-colors hover:bg-danger-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    Stop
                                </button>
                            </div>
                        ) : null}
                        <MarkdownChatComposer
                            adapter={adapter}
                            onCancel={cancel}
                            theme={state.theme}
                            onSend={submitPrompt}
                            allNotes={state.notes}
                            key={composerDraftKey}
                            content={composerDraft}
                            isStreaming={isStreaming}
                            mentionItems={mentionItems}
                            disabled={!config || isLoading}
                            onContentChange={updateComposerDraft}
                        />
                        {config ? null : (
                            <p className="mt-2 text-xs text-muted-foreground">
                                Connect an AI provider in settings before starting a chat.
                            </p>
                        )}
                        {config?.adapterId === "cli" ? (
                            <p role="status" className="mt-2 text-xs text-muted-foreground">
                                Workspace research and reviewable edits require a provider that exposes Writeme’s
                                workspace tools. This local CLI adapter does not support those actions.
                            </p>
                        ) : null}
                    </div>
                </div>
            )}
        </section>
    );
}
