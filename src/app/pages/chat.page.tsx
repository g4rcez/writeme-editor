import { ArrowsCounterClockwiseIcon } from "@phosphor-icons/react";
import { GearIcon } from "@phosphor-icons/react/dist/csr/Gear";
import { SparkleIcon } from "@phosphor-icons/react/dist/csr/Sparkle";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { AIFile } from "@/app/ai/adapters/types";
import { adapterRegistry } from "@/app/ai/adapters/registry";
import { AI_CHAT_LOADING_MESSAGES, AIChatMessageList } from "@/app/ai/ai-message-item";
import { createWorkspaceTools } from "@/app/ai/chat-tools";
import { MarkdownChatComposer } from "@/app/ai/markdown-chat-composer";
import { useAIChat } from "@/app/ai/use-ai-chat";
import { buildWorkspaceContextSummary, getWorkspaceChatScope } from "@/app/ai/workspace-context";
import { useGlobalStore } from "@/store/global.store";

const PROMPT_EXAMPLES = [
    "Summarize this workspace and call out the most active topics.",
    "Find notes that mention open decisions and group them by project.",
    "List recent writing drafts with tags and next suggested actions.",
];

export default function ChatPage() {
    const navigate = useNavigate();
    const listRef = useRef<HTMLDivElement | null>(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
    const [state, dispatch] = useGlobalStore((s) => ({
        notes: s.notes,
        theme: s.theme,
        directory: s.directory,
    }));

    const selectedChatId = searchParams.get("chatId");
    const chatScopeId = useMemo(() => getWorkspaceChatScope(state.directory), [state.directory]);
    const workspaceContext = useMemo(
        () => buildWorkspaceContextSummary(state.directory, state.notes),
        [state.directory, state.notes],
    );
    const workspaceTools = useMemo(() => createWorkspaceTools(), []);

    const { chat, messages, isStreaming, isLoading, send, cancel, config } = useAIChat(
        undefined,
        chatScopeId,
        selectedChatId,
    );

    const latestMessageContent = messages.at(-1)?.content ?? "";
    const adapter = config ? adapterRegistry.get(config.adapterId) : undefined;

    useEffect(() => {
        if (!chat) return;
        void dispatch.addAiChatTab(chat.id);
        if (selectedChatId === chat.id) return;
        setSearchParams({ chatId: chat.id }, { replace: true });
    }, [chat, dispatch, selectedChatId, setSearchParams]);

    useEffect(() => {
        const container = listRef.current;
        if (!container) return;
        const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
        container.scrollTo({ top: container.scrollHeight, behavior });
    }, [messages.length, latestMessageContent, isStreaming]);

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

    const submitPrompt = async (value: string, files: AIFile[] = []): Promise<boolean> => {
        const prompt = value.trim();
        if ((!prompt && files.length === 0) || !config || isLoading || isStreaming) return false;
        return send(prompt, { selection: "", context: workspaceContext }, files, workspaceTools);
    };

    const useExamplePrompt = (prompt: string): void => {
        if (isStreaming || isLoading || !config) return;
        void submitPrompt(prompt, []);
    };

    const renderChatContent = (): ReactNode => {
        if (isLoading) {
            return (
                <div className="flex h-full min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
                    <ArrowsCounterClockwiseIcon size={18} className="animate-spin" aria-hidden="true" />
                    <span>Loading chat history...</span>
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
                                onClick={() => useExamplePrompt(prompt)}
                                disabled={!config || isLoading || isStreaming}
                                className="rounded-xl border border-border/45 bg-card-background p-4 text-left text-sm leading-5 text-foreground transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {prompt}
                            </button>
                        ))}
                    </div>

                    {config ? null : (
                        <button
                            type="button"
                            onClick={() => navigate("/settings/ai")}
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
                <AIChatMessageList
                    messages={messages}
                    isStreaming={isStreaming}
                    maxWidthClass="max-w-safe"
                    loadingMessageIndex={loadingMessageIndex}
                />
            </div>
        );
    };

    return (
        <section className="writeme-chat-page flex h-full min-h-0 w-full flex-col bg-background">
            <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border/45 px-4 py-3 sm:px-6">
                <div className="min-w-0">
                    <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
                        <SparkleIcon size={13} aria-hidden="true" />
                        Workspace assistant
                    </p>
                    <h1 className="mt-1 truncate text-base font-semibold text-foreground">Ask your notes</h1>
                </div>
                <button
                    type="button"
                    onClick={() => navigate("/settings/ai")}
                    className="flex shrink-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <GearIcon size={15} aria-hidden="true" />
                    AI settings
                </button>
            </header>
            <div
                ref={listRef}
                className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6"
                role="log"
                aria-live="polite"
                aria-label="Chat messages"
            >
                {renderChatContent()}
            </div>
            <div className="shrink-0 border-t border-border/45 bg-background px-4 pt-4 pb-4 sm:px-6">
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
                        onCancel={cancel}
                        theme={state.theme}
                        adapter={adapter}
                        onSend={submitPrompt}
                        isStreaming={isStreaming}
                        disabled={!config || isLoading}
                    />
                    {config ? null : (
                        <p className="mt-2 text-xs text-muted-foreground">
                            Connect an AI provider in settings before starting a chat.
                        </p>
                    )}
                </div>
            </div>
        </section>
    );
}
