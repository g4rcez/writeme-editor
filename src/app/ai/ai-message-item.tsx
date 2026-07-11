import type { ReactNode } from "react";
import { css } from "@g4rcez/components";
import { ChatCircleDotsIcon } from "@phosphor-icons/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AIMessage } from "@/store/repositories/electron/ai.repository";

const AI_MESSAGE_LOADING_MESSAGES = [
    "Thinking...",
    "Analyzing your notes...",
    "Preparing a markdown response...",
    "Checking the workspace context...",
];

export const AI_CHAT_LOADING_MESSAGES = AI_MESSAGE_LOADING_MESSAGES;

function getLoadingMessage(index: number): string {
    return AI_MESSAGE_LOADING_MESSAGES[index % AI_MESSAGE_LOADING_MESSAGES.length] ?? AI_MESSAGE_LOADING_MESSAGES[0]!;
}

function isErrorMessage(message: AIMessage): boolean {
    return message.content.trim().toLowerCase().startsWith("error:");
}

export function AIAssistantMarkdown({ content, tone = "default" }: { content: string; tone?: "default" | "inherit" }) {
    return (
        <div
            className={css(
                "ai-markdown space-y-4 text-base leading-relaxed text-foreground",
                tone === "inherit" && "ai-markdown--inherit",
            )}
        >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
    );
}

function AssistantRenderedBody({
    content,
    isStreaming,
    loadingIndex,
}: {
    content: string;
    isStreaming: boolean;
    loadingIndex: number;
}) {
    if (content.trim().length > 0) {
        return <AIAssistantMarkdown content={content} />;
    }
    if (isStreaming) {
        return <p className="text-sm italic text-muted-foreground">{getLoadingMessage(loadingIndex)}</p>;
    }
    return <p className="text-sm italic text-muted-foreground">No assistant response was returned.</p>;
}

export function AIChatMessageItem({
    message,
    isStreaming = false,
    loadingIndex,
    maxWidthClass = "max-w-safe",
}: {
    message: AIMessage;
    isStreaming?: boolean;
    loadingIndex: number;
    maxWidthClass?: string;
}) {
    if (message.role === "system") {
        const error = isErrorMessage(message);
        const content = error ? message.content.replace(/^error:\s*/i, "") : message.content;

        return (
            <aside
                role={error ? "alert" : "status"}
                className={css(
                    "rounded-xl border px-3 py-2 text-xs leading-5",
                    error
                        ? "border-danger/40 bg-danger-subtle text-danger"
                        : "border-card-border bg-muted text-muted-foreground",
                    maxWidthClass,
                )}
            >
                <p className="font-medium">{error ? "Chat error" : "Chat status"}</p>
                <p>{content}</p>
            </aside>
        );
    }

    if (message.role === "user") {
        return (
            <article
                aria-label="Your message"
                className={css(
                    "rounded-2xl items-end rounded-br-md bg-button-primary-bg px-4 py-3 text-sm text-button-primary-text max-w-72",
                    maxWidthClass,
                )}
            >
                <AIAssistantMarkdown content={message.content} tone="inherit" />
            </article>
        );
    }

    return (
        <div className="w-full flex" aria-label="Assistant message">
            <div className="w-full flex flex-col gap-3 px-4 py-3 text-foreground">
                <header className="flex items-center gap-1">
                    <ChatCircleDotsIcon className="size-4 text-muted-foreground" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assistant</p>
                </header>
                <AssistantRenderedBody
                    content={message.content}
                    isStreaming={isStreaming}
                    loadingIndex={loadingIndex}
                />
            </div>
        </div>
    );
}

export function AIChatMessageList({
    messages,
    isStreaming,
    loadingMessageIndex,
    renderActions,
    maxWidthClass = "max-w-3xl",
}: {
    messages: AIMessage[];
    isStreaming: boolean;
    loadingMessageIndex: number;
    renderActions?: (message: AIMessage) => ReactNode;
    maxWidthClass?: string;
}) {
    return (
        <div className="flex flex-col gap-4">
            {messages.map((message, index) => {
                const isLastAssistantStreaming =
                    isStreaming && index === messages.length - 1 && message.role === "assistant";
                const withAction = renderActions?.(message) ?? null;
                return (
                    <div
                        key={message.id}
                        className={css(
                            "flex flex-col w-full gap-2",
                            message.role === "user" && "items-end",
                            message.role === "assistant" && "items-start",
                            message.role === "system" && "items-center",
                        )}
                    >
                        <AIChatMessageItem
                            message={message}
                            maxWidthClass={maxWidthClass}
                            loadingIndex={loadingMessageIndex}
                            isStreaming={isLastAssistantStreaming}
                        />
                        {withAction ? <div className={css("mt-2", maxWidthClass)}>{withAction}</div> : null}
                    </div>
                );
            })}
            {isStreaming && messages.length > 0 && messages[messages.length - 1]?.role === "user" ? (
                <div className="flex justify-start">
                    <div
                        className={css(
                            "rounded-2xl rounded-bl-md border border-card-border bg-secondary-background px-4 py-3 text-sm text-muted-foreground",
                            maxWidthClass,
                        )}
                    >
                        {getLoadingMessage(loadingMessageIndex)}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
