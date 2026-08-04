import type { ReactNode } from "react";
import { css } from "@g4rcez/components";
import { ChatCircleDotsIcon, PaperclipIcon } from "@phosphor-icons/react";
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

function formatFileSize(size: number): string {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KiB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MiB`;
}

function MessageAttachments({ message }: { message: AIMessage }) {
    if (!message.files?.length) return null;
    return (
        <ul aria-label="Attached files" className="mt-2 flex max-w-full flex-wrap gap-1.5">
            {message.files.map((file) => (
                <li
                    key={file.id}
                    className="flex max-w-full items-center gap-1 rounded-full border border-current/25 px-2 py-1 text-xs"
                >
                    <PaperclipIcon size={12} className="shrink-0" aria-hidden="true" />
                    <span className="max-w-40 truncate">{file.name}</span>
                    <span className="shrink-0 opacity-75">{formatFileSize(file.size)}</span>
                    <span className="sr-only">
                        Attachment metadata only; the original file is unavailable after reopening this chat.
                    </span>
                </li>
            ))}
        </ul>
    );
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
        return <p className="text-sm text-muted-foreground italic">{getLoadingMessage(loadingIndex)}</p>;
    }
    return <p className="text-sm text-muted-foreground italic">No assistant response was returned.</p>;
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
                    "max-w-72 items-end rounded-2xl rounded-br-md bg-button-primary-bg px-4 py-3 text-sm text-button-primary-text",
                    maxWidthClass,
                )}
            >
                {message.content ? <AIAssistantMarkdown content={message.content} tone="inherit" /> : null}
                <MessageAttachments message={message} />
            </article>
        );
    }

    return (
        <div className="flex w-full" aria-label="Assistant message">
            <div className="flex w-full flex-col gap-3 px-4 py-3 text-foreground">
                <header className="flex items-center gap-1">
                    <ChatCircleDotsIcon className="size-4 text-muted-foreground" />
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Assistant</p>
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
                            "flex w-full flex-col gap-2",
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
                            "bg-secondary-background rounded-2xl rounded-bl-md border border-card-border px-4 py-3 text-sm text-muted-foreground",
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
