import type { ToolChoice, ToolSet } from "ai";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { v7 as uuid } from "uuid";
import type { AIChat, AIMessage, AttachedFile, AIConfig } from "../../store/repositories/electron/ai.repository";
import { repositories } from "../../store/global.store";
import { adapterRegistry } from "./adapters/registry";
import { AI_ATTACHMENT_LIMITS, validateAIFileBatch, type AIConversationMessage, type AIFile } from "./adapters/types";
import { authManager } from "./auth/auth-manager";
import { AI_CHATS_CHANGED_EVENT } from "./events";

export { AI_CHATS_CHANGED_EVENT } from "./events";

const MARKDOWN_CHAT_SYSTEM_PROMPT = [
    "You are Writeme Workspace AI, an assistant for the current notes workspace.",
    "Always reply in readable markdown. Following the Github Flavoured Markdown.",
    "Do not return JSON, JSONL, UI specs, or structured renderer payloads.",
    "Use tables, headings, bullets, and code fences when they make the answer clearer.",
    "Keep responses concise and practical for note and writing workflows.",
].join("\n");

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Unknown error";
}

function createSystemMessage(chatId: string, content: string): AIMessage {
    const now = new Date().toISOString();
    return {
        id: uuid(),
        chatId,
        role: "system",
        content,
        createdAt: now,
        updatedAt: now,
    };
}

function removeEmptyAssistantPlaceholder(messages: AIMessage[], assistantMessageId: string): AIMessage[] {
    return messages.filter((message) => message.id !== assistantMessageId || message.content.trim().length > 0);
}

function notifyChatsChanged(): void {
    window.dispatchEvent(new Event(AI_CHATS_CHANGED_EVENT));
}

function createChatTitle(prompt: string): string {
    const normalized = prompt.replace(/\s+/g, " ").trim();
    if (!normalized) return "New Chat";
    return normalized.length > 48 ? `${normalized.slice(0, 45)}...` : normalized;
}

type CachedAttachmentTurn = {
    filesById: Map<string, AIFile>;
    size: number;
};

type ActiveAbortController = {
    token: symbol;
    controller: AbortController;
};

function unavailableAttachmentMarker(message: AIMessage): string {
    const names = message.files?.map((file) => file.name).join(", ") ?? "unknown attachment";
    return `[Attachment metadata only: ${names}. Original bytes are unavailable in this session.]`;
}

export function useAIChat(noteId?: string, chatScopeId?: string | null, selectedChatId?: string | null) {
    const [chat, setChat] = useState<AIChat | null>(null);
    const [messages, setMessages] = useState<AIMessage[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [config, setConfig] = useState<AIConfig | null>(null);
    const abortControllerRef = useRef<ActiveAbortController | null>(null);
    const cancelledSendTokenRef = useRef<symbol | null>(null);
    const sendTokenRef = useRef<symbol | null>(null);
    const attachmentCacheRef = useRef(new Map<string, CachedAttachmentTurn>());
    const attachmentCacheSizeRef = useRef(0);
    const operationGenerationRef = useRef(0);
    const activeChatIdRef = useRef<string | null>(null);
    const activeConfigRef = useRef<AIConfig | null>(null);
    const activeRequestKeyRef = useRef("");
    const loadedChatRequestKeyRef = useRef<string | null>(null);
    const loadedConfigRequestKeyRef = useRef<string | null>(null);

    const effectiveChatScope = chatScopeId ?? noteId;
    const requestKey = JSON.stringify([effectiveChatScope ?? null, selectedChatId ?? null]);

    useLayoutEffect(() => {
        activeChatIdRef.current = chat?.id ?? null;
        activeConfigRef.current = config;
        activeRequestKeyRef.current = requestKey;
    }, [chat, config, requestKey]);

    const clearAttachmentCache = useCallback((): void => {
        attachmentCacheRef.current.clear();
        attachmentCacheSizeRef.current = 0;
    }, []);

    const cacheAttachmentFiles = useCallback((messageId: string, files: readonly AIFile[]): void => {
        if (files.length === 0) return;
        const size = files.reduce((total, file) => total + file.data.byteLength, 0);
        const existing = attachmentCacheRef.current.get(messageId);
        if (existing) {
            attachmentCacheSizeRef.current -= existing.size;
            attachmentCacheRef.current.delete(messageId);
        }
        while (
            (attachmentCacheSizeRef.current + size > AI_ATTACHMENT_LIMITS.maxCachedSize ||
                attachmentCacheRef.current.size >= AI_ATTACHMENT_LIMITS.maxCachedTurns) &&
            attachmentCacheRef.current.size > 0
        ) {
            const oldestKey = attachmentCacheRef.current.keys().next().value;
            if (oldestKey === undefined) break;
            const oldest = attachmentCacheRef.current.get(oldestKey);
            attachmentCacheRef.current.delete(oldestKey);
            attachmentCacheSizeRef.current -= oldest?.size ?? 0;
        }
        if (size > AI_ATTACHMENT_LIMITS.maxCachedSize) return;
        attachmentCacheRef.current.set(messageId, {
            filesById: new Map(files.map((file) => [file.id, file])),
            size,
        });
        attachmentCacheSizeRef.current += size;
    }, []);

    const invalidateActiveSend = useCallback((updateStreamingState = true): void => {
        abortControllerRef.current?.controller.abort();
        abortControllerRef.current = null;
        cancelledSendTokenRef.current = null;
        sendTokenRef.current = null;
        if (updateStreamingState) setIsStreaming(false);
    }, []);

    useEffect(() => {
        const generation = ++operationGenerationRef.current;
        loadedChatRequestKeyRef.current = null;
        loadedConfigRequestKeyRef.current = null;
        invalidateActiveSend();
        setIsLoading(true);
        clearAttachmentCache();

        const isCurrentLoad = (): boolean =>
            operationGenerationRef.current === generation && activeRequestKeyRef.current === requestKey;

        const loadChat = async (): Promise<void> => {
            if (!effectiveChatScope) {
                if (!isCurrentLoad()) return;
                loadedChatRequestKeyRef.current = requestKey;
                setChat(null);
                setMessages([]);
                return;
            }
            const chats = await repositories.ai.getChats(effectiveChatScope);
            if (!isCurrentLoad()) return;
            const selectedChat = selectedChatId ? (chats.find((item) => item.id === selectedChatId) ?? null) : null;
            const lastChat = selectedChat ?? chats[0] ?? null;
            if (lastChat) {
                const loadedMessages = await repositories.ai.getMessages(lastChat.id);
                if (!isCurrentLoad()) return;
                loadedChatRequestKeyRef.current = requestKey;
                setChat(lastChat);
                setMessages(loadedMessages);
                return;
            }

            const now = new Date().toISOString();
            const newChat: AIChat = {
                noteId: effectiveChatScope,
                id: uuid(),
                createdAt: now,
                updatedAt: now,
                title: "New Chat",
            };
            if (!isCurrentLoad()) return;
            await repositories.ai.saveChat(newChat);
            if (!isCurrentLoad()) return;
            loadedChatRequestKeyRef.current = requestKey;
            setChat(newChat);
            setMessages([]);
        };

        const loadConfig = async (): Promise<void> => {
            const configs = await repositories.ai.getConfigs();
            if (!isCurrentLoad()) return;
            const defaultConfig = configs.find((item) => item.isDefault) || configs[0] || null;
            loadedConfigRequestKeyRef.current = requestKey;
            setConfig(defaultConfig);
        };

        void Promise.all([loadChat(), loadConfig()]).finally(() => {
            if (isCurrentLoad()) setIsLoading(false);
        });

        return () => {
            operationGenerationRef.current += 1;
            invalidateActiveSend(false);
        };
    }, [clearAttachmentCache, effectiveChatScope, invalidateActiveSend, requestKey, selectedChatId]);

    const send = useCallback(
        async (
            prompt: string,
            options: {
                selection: string;
                context: string;
                selectionSlice?: { from: number; to: number };
            },
            files?: AIFile[],
            tools?: ToolSet,
            toolChoice?: ToolChoice<ToolSet>,
        ) => {
            if (!chat || !config || (!prompt.trim() && (files?.length ?? 0) === 0)) return false;
            if (
                loadedChatRequestKeyRef.current !== requestKey ||
                loadedConfigRequestKeyRef.current !== requestKey ||
                sendTokenRef.current
            ) {
                return false;
            }

            const sendToken = Symbol("ai-chat-send");
            sendTokenRef.current = sendToken;
            const capturedGeneration = operationGenerationRef.current;
            const capturedChat = chat;
            const capturedChatId = chat.id;
            const capturedConfig = config;
            const capturedRequestKey = requestKey;
            const isCurrentChat = (): boolean =>
                operationGenerationRef.current === capturedGeneration &&
                activeRequestKeyRef.current === capturedRequestKey &&
                loadedChatRequestKeyRef.current === capturedRequestKey &&
                loadedConfigRequestKeyRef.current === capturedRequestKey &&
                activeChatIdRef.current === capturedChatId &&
                activeConfigRef.current === capturedConfig;
            const isCurrentSend = (): boolean => isCurrentChat() && sendTokenRef.current === sendToken;

            try {
                const adapterId: string = capturedConfig.adapterId ?? "cli";
                const adapter = adapterRegistry.get(adapterId);
                if (!adapter || ((files?.length ?? 0) > 0 && !adapter.supportsFiles)) return false;
                const attachmentError = validateAIFileBatch(files ?? [], adapter.fileCapabilities);
                if (attachmentError) return false;

                let credentials = {};
                try {
                    credentials = await authManager.getCredentials(adapterId, adapter);
                } catch {
                    if (adapterId !== "cli") return false;
                }
                if (!isCurrentSend()) return false;

                const attachedFiles: AttachedFile[] = (files ?? []).map((file) => ({
                    id: file.id,
                    name: file.name,
                    mimeType: file.mimeType,
                    size: file.size,
                }));
                const now = new Date().toISOString();
                const userMsg: AIMessage = {
                    id: uuid(),
                    role: "user",
                    createdAt: now,
                    updatedAt: now,
                    chatId: capturedChatId,
                    content: prompt,
                    files: attachedFiles.length > 0 ? attachedFiles : undefined,
                };
                const assistantMsg: AIMessage = {
                    id: uuid(),
                    content: "",
                    createdAt: now,
                    updatedAt: now,
                    chatId: capturedChatId,
                    role: "assistant",
                    diffOriginal: options.selection,
                    selectionSlice: options.selectionSlice,
                };
                const assistantMessageId = assistantMsg.id;

                setMessages((current) => (isCurrentChat() ? [...current, userMsg, assistantMsg] : current));
                if (!isCurrentSend()) return false;
                setIsStreaming(true);
                await repositories.ai.saveMessage(userMsg);
                if (!isCurrentSend()) return false;
                cacheAttachmentFiles(userMsg.id, files ?? []);

                const updatedChat: AIChat = {
                    ...capturedChat,
                    title:
                        capturedChat.title === "New Chat"
                            ? createChatTitle(prompt.trim() || files?.[0]?.name || "New Chat")
                            : capturedChat.title,
                    updatedAt: now,
                };
                await repositories.ai.saveChat(updatedChat);
                if (!isCurrentSend()) return false;
                setChat(updatedChat);
                notifyChatsChanged();

                const history: AIConversationMessage[] = messages.flatMap((message) => {
                    if (message.role === "system") return [];
                    const cachedFiles = attachmentCacheRef.current.get(message.id);
                    const filesForTurn = cachedFiles ? Array.from(cachedFiles.filesById.values()) : [];
                    const text =
                        message.files?.length && filesForTurn.length === 0
                            ? [message.content, unavailableAttachmentMarker(message)].filter(Boolean).join("\n\n")
                            : message.content;
                    if (!text.trim() && filesForTurn.length === 0) return [];
                    return [
                        {
                            role: message.role as "user" | "assistant",
                            content: { text, files: filesForTurn.length > 0 ? filesForTurn : undefined },
                        },
                    ];
                });
                history.push({
                    role: "user",
                    content: {
                        text: prompt,
                        files: files ?? [],
                    },
                });

                const abortController = new AbortController();
                abortControllerRef.current = { token: sendToken, controller: abortController };
                cancelledSendTokenRef.current = null;

                const systemPromptParts: string[] = [MARKDOWN_CHAT_SYSTEM_PROMPT];
                if (capturedConfig.systemPrompt) systemPromptParts.push(capturedConfig.systemPrompt);
                if (options.context) {
                    systemPromptParts.push(`\n\nContext and constraints:\n\n---\n${options.context}\n---`);
                }
                if (options.selection) {
                    systemPromptParts.push(`\n\nThe user has selected the following text:\n\n> ${options.selection}`);
                }
                const systemPrompt = systemPromptParts.join("") || undefined;
                let assistantContent = "";
                let renderTimer: number | null = null;
                const scheduleAssistantRender = (): void => {
                    if (renderTimer !== null) return;
                    renderTimer = window.setTimeout(() => {
                        renderTimer = null;
                        const content = assistantContent;
                        const updatedAt = new Date().toISOString();
                        setMessages((current) =>
                            isCurrentChat()
                                ? current.map((message) =>
                                      message.id === assistantMessageId ? { ...message, content, updatedAt } : message,
                                  )
                                : current,
                        );
                    }, 16);
                };

                try {
                    const stream = adapter.sendMessage(
                        history,
                        {
                            model: capturedConfig.model,
                            systemPrompt,
                            baseUrl: capturedConfig.baseUrl,
                            credentials,
                            commandTemplate: capturedConfig.commandTemplate,
                            tools,
                            toolChoice,
                        },
                        abortController.signal,
                    );

                    for await (const event of stream) {
                        if (!isCurrentSend()) return false;
                        if (event.type === "text") {
                            assistantContent += event.delta;
                            scheduleAssistantRender();
                            continue;
                        }
                        if (event.type === "done") {
                            if (!isCurrentSend()) return false;
                            setIsStreaming(false);
                            if (cancelledSendTokenRef.current === sendToken) {
                                if (!assistantContent.trim()) {
                                    setMessages((current) =>
                                        isCurrentChat()
                                            ? removeEmptyAssistantPlaceholder(current, assistantMessageId)
                                            : current,
                                    );
                                    return true;
                                }
                                const partialAssistant: AIMessage = {
                                    ...assistantMsg,
                                    content: assistantContent,
                                    updatedAt: new Date().toISOString(),
                                };
                                setMessages((current) =>
                                    isCurrentChat()
                                        ? current.map((message) =>
                                              message.id === assistantMessageId ? partialAssistant : message,
                                          )
                                        : current,
                                );
                                if (!isCurrentSend()) return false;
                                await repositories.ai.saveMessage(partialAssistant);
                                return isCurrentSend();
                            }

                            const assistantToSave: AIMessage = {
                                ...assistantMsg,
                                content: assistantContent.trim()
                                    ? assistantContent
                                    : "No assistant response was returned.",
                                updatedAt: new Date().toISOString(),
                            };
                            setMessages((current) =>
                                isCurrentChat()
                                    ? current.map((message) =>
                                          message.id === assistantMessageId ? assistantToSave : message,
                                      )
                                    : current,
                            );
                            if (!isCurrentSend()) return false;
                            await repositories.ai.saveMessage(assistantToSave);
                            if (!isCurrentSend()) return false;
                            notifyChatsChanged();
                            return true;
                        }

                        if (!isCurrentSend()) return false;
                        setIsStreaming(false);
                        const errorMessage = createSystemMessage(capturedChatId, `Error: ${event.message}`);
                        setMessages((current) =>
                            isCurrentChat()
                                ? [...removeEmptyAssistantPlaceholder(current, assistantMessageId), errorMessage]
                                : current,
                        );
                        if (!isCurrentSend()) return false;
                        await repositories.ai.saveMessage(errorMessage);
                        return isCurrentSend();
                    }

                    if (!isCurrentSend()) return false;
                    setIsStreaming(false);
                    const fallbackMessage: AIMessage = {
                        ...assistantMsg,
                        content: "No assistant response was returned.",
                        updatedAt: new Date().toISOString(),
                    };
                    setMessages((current) =>
                        isCurrentChat()
                            ? current.map((message) => (message.id === assistantMessageId ? fallbackMessage : message))
                            : current,
                    );
                    if (!isCurrentSend()) return false;
                    await repositories.ai.saveMessage(fallbackMessage);
                    if (!isCurrentSend()) return false;
                    notifyChatsChanged();
                    return true;
                } catch (error: unknown) {
                    if (!isCurrentSend()) return false;
                    setIsStreaming(false);
                    if (cancelledSendTokenRef.current === sendToken) {
                        if (!assistantContent.trim()) {
                            setMessages((current) =>
                                isCurrentChat()
                                    ? removeEmptyAssistantPlaceholder(current, assistantMessageId)
                                    : current,
                            );
                            return true;
                        }
                        const partialAssistant: AIMessage = {
                            ...assistantMsg,
                            content: assistantContent,
                            updatedAt: new Date().toISOString(),
                        };
                        setMessages((current) =>
                            isCurrentChat()
                                ? current.map((message) =>
                                      message.id === assistantMessageId ? partialAssistant : message,
                                  )
                                : current,
                        );
                        if (!isCurrentSend()) return false;
                        await repositories.ai.saveMessage(partialAssistant);
                        return isCurrentSend();
                    }

                    const errorMessage = createSystemMessage(capturedChatId, `Error: ${getErrorMessage(error)}`);
                    setMessages((current) =>
                        isCurrentChat()
                            ? [...removeEmptyAssistantPlaceholder(current, assistantMessageId), errorMessage]
                            : current,
                    );
                    if (!isCurrentSend()) return false;
                    await repositories.ai.saveMessage(errorMessage);
                    return isCurrentSend();
                } finally {
                    if (renderTimer !== null) window.clearTimeout(renderTimer);
                    if (abortControllerRef.current?.token === sendToken) abortControllerRef.current = null;
                    if (cancelledSendTokenRef.current === sendToken) cancelledSendTokenRef.current = null;
                }
            } finally {
                if (sendTokenRef.current === sendToken) sendTokenRef.current = null;
            }
        },
        [cacheAttachmentFiles, chat, config, messages, requestKey],
    );

    const newChat = useCallback(async (): Promise<AIChat | null> => {
        if (!effectiveChatScope) return null;
        const generation = ++operationGenerationRef.current;
        invalidateActiveSend();
        const capturedRequestKey = requestKey;
        const freshChat: AIChat = {
            id: uuid(),
            noteId: effectiveChatScope,
            title: "New Chat",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        await repositories.ai.saveChat(freshChat);
        if (operationGenerationRef.current !== generation || activeRequestKeyRef.current !== capturedRequestKey) {
            return null;
        }
        clearAttachmentCache();
        loadedChatRequestKeyRef.current = capturedRequestKey;
        setChat(freshChat);
        setMessages([]);
        notifyChatsChanged();
        return freshChat;
    }, [clearAttachmentCache, effectiveChatScope, invalidateActiveSend, requestKey]);

    const clearChat = useCallback(async () => {
        if (!chat || loadedChatRequestKeyRef.current !== requestKey) return;
        const capturedChatId = chat.id;
        const capturedRequestKey = requestKey;
        const generation = ++operationGenerationRef.current;
        invalidateActiveSend();
        await repositories.ai.clearMessages(capturedChatId);
        if (
            operationGenerationRef.current !== generation ||
            activeRequestKeyRef.current !== capturedRequestKey ||
            activeChatIdRef.current !== capturedChatId
        ) {
            return;
        }
        clearAttachmentCache();
        setMessages([]);
        notifyChatsChanged();
    }, [chat, clearAttachmentCache, invalidateActiveSend, requestKey]);

    const cancel = useCallback(() => {
        const sendToken = sendTokenRef.current;
        if (!sendToken || !chat || loadedChatRequestKeyRef.current !== requestKey) return;
        const activeAbort = abortControllerRef.current;
        if (activeAbort?.token === sendToken) {
            cancelledSendTokenRef.current = sendToken;
            activeAbort.controller.abort();
        } else {
            sendTokenRef.current = null;
        }
        setIsStreaming(false);
        const systemMessage = createSystemMessage(chat.id, "Generation stopped.");
        setMessages((current) =>
            activeRequestKeyRef.current === requestKey && activeChatIdRef.current === chat.id
                ? [...current, systemMessage]
                : current,
        );
        if (activeRequestKeyRef.current === requestKey && activeChatIdRef.current === chat.id) {
            void repositories.ai.saveMessage(systemMessage);
        }
    }, [chat, requestKey]);

    return {
        chat,
        messages,
        isStreaming,
        isLoading,
        send,
        cancel,
        newChat,
        clearChat,
        config,
    };
}
