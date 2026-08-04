import { ArrowsCounterClockwiseIcon } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
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

    return (
        <div className="container mx-auto flex h-full min-h-0 w-full max-w-safe flex-col">
            <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6" aria-live="polite">
                {isLoading ? (
                    <div className="flex h-full min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
                        <ArrowsCounterClockwiseIcon size={18} className="animate-spin" aria-hidden="true" />
                        <span>Loading chat history...</span>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="mx-auto flex h-full min-h-64 max-w-2xl flex-col items-center justify-center text-center">
                        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
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
                                    className="bg-secondary-background rounded-2xl border border-card-border p-4 text-left text-sm leading-5 text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>

                        {!config ? (
                            <button
                                type="button"
                                onClick={() => navigate("/settings/ai")}
                                className="mt-6 rounded-md bg-button-primary-bg px-3 py-1.5 text-sm font-medium text-button-primary-text transition-opacity hover:opacity-90"
                            >
                                Configure AI
                            </button>
                        ) : null}
                    </div>
                ) : (
                    <div className="mx-auto w-full max-w-safe">
                        <AIChatMessageList
                            messages={messages}
                            isStreaming={isStreaming}
                            maxWidthClass="max-w-safe"
                            loadingMessageIndex={loadingMessageIndex}
                        />
                    </div>
                )}
            </div>
            <div className="shrink-0 bg-background px-4 pt-6 pb-4 md:px-6">
                <div className="mx-auto w-full max-w-safe">
                    {isStreaming ? (
                        <div className="bg-secondary-background mb-2 flex items-center justify-between rounded-xl border border-card-border px-3 py-2 text-sm text-muted-foreground">
                            <span>{AI_CHAT_LOADING_MESSAGES[loadingMessageIndex]}</span>
                            <button
                                type="button"
                                onClick={cancel}
                                className="rounded-md px-2 py-1 text-danger transition-colors hover:bg-danger-subtle"
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
                    {!config ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                            Connect an AI provider in settings before starting a chat.
                        </p>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
