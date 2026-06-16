import { useCallback, useEffect, useRef, useState } from "react";
import { v7 as uuid } from "uuid";
import { repositories } from "../../store/global.store";
import type {
  AIChat,
  AIMessage,
  AttachedFile,
  AIConfig,
} from "../../store/repositories/electron/ai.repository";
import { adapterRegistry } from "./adapters/registry";
import { authManager } from "./auth/auth-manager";
import type { AIConversationMessage, AIFile } from "./adapters/types";
import type { ToolChoice, ToolSet } from "ai";
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

function removeEmptyAssistantPlaceholder(
  messages: AIMessage[],
  assistantMessageId: string,
): AIMessage[] {
  return messages.filter(
    (message) =>
      message.id !== assistantMessageId || message.content.trim().length > 0,
  );
}

function notifyChatsChanged(): void {
  window.dispatchEvent(new Event(AI_CHATS_CHANGED_EVENT));
}

function createChatTitle(prompt: string): string {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  if (!normalized) return "New Chat";
  return normalized.length > 48 ? `${normalized.slice(0, 45)}...` : normalized;
}

export function useAIChat(
  noteId?: string,
  chatScopeId?: string | null,
  selectedChatId?: string | null,
) {
  const [chat, setChat] = useState<AIChat | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState<AIConfig | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  const effectiveChatScope = chatScopeId ?? noteId;

  useEffect(() => {
    setIsLoading(true);

    const loadChat = async () => {
      if (!effectiveChatScope) {
        setChat(null);
        setMessages([]);
        return;
      }
      const chats = await repositories.ai.getChats(effectiveChatScope);
      const selectedChat = selectedChatId
        ? (chats.find((item) => item.id === selectedChatId) ?? null)
        : null;
      const lastChat = selectedChat ?? chats[0] ?? null;
      if (lastChat) {
        setChat(lastChat);
        const msgs = await repositories.ai.getMessages(lastChat.id);
        setMessages(msgs);
      } else {
        const now = new Date().toISOString();
        const newChat: AIChat = {
          noteId: effectiveChatScope,
          id: uuid(),
          createdAt: now,
          updatedAt: now,
          title: "New Chat",
        };
        await repositories.ai.saveChat(newChat);
        setChat(newChat);
        setMessages([]);
      }
    };

    const loadConfig = async () => {
      const configs = await repositories.ai.getConfigs();
      const def = configs.find((c) => c.isDefault) || configs[0] || null;
      setConfig(def);
    };

    Promise.all([loadChat(), loadConfig()]).finally(() => setIsLoading(false));
  }, [effectiveChatScope, selectedChatId]);

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
      if (!chat || !config) return false;

      const attachedFiles: AttachedFile[] = (files ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size,
      }));
      const now = new Date().toISOString();
      const userMsg: AIMessage = {
        id: uuid(),
        role: "user",
        createdAt: now,
        updatedAt: now,
        chatId: chat.id,
        content: prompt,
        files: attachedFiles.length > 0 ? attachedFiles : undefined,
      };

      const assistantMsg: AIMessage = {
        id: uuid(),
        content: "",
        createdAt: now,
        updatedAt: now,
        chatId: chat.id,
        role: "assistant",
        diffOriginal: options.selection,
        selectionSlice: options.selectionSlice,
      };
      const assistantMessageId = assistantMsg.id;

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);
      await repositories.ai.saveMessage(userMsg);
      const updatedChat: AIChat = {
        ...chat,
        title: chat.title === "New Chat" ? createChatTitle(prompt) : chat.title,
        updatedAt: now,
      };
      await repositories.ai.saveChat(updatedChat);
      setChat(updatedChat);
      notifyChatsChanged();
      const adapterId: string = config.adapterId ?? "cli";
      const adapter = adapterRegistry.get(adapterId);
      if (!adapter) {
        const errMsg = createSystemMessage(
          chat.id,
          `Error: No adapter found for "${adapterId}". Please configure AI in Settings.`,
        );
        setMessages((prev) => [
          ...removeEmptyAssistantPlaceholder(prev, assistantMessageId),
          errMsg,
        ]);
        await repositories.ai.saveMessage(errMsg);
        setIsStreaming(false);
        return true;
      }

      let credentials = {};
      try {
        credentials = await authManager.getCredentials(adapterId, adapter);
      } catch {
        if (adapterId !== "cli") {
          const errMsg = createSystemMessage(
            chat.id,
            "Error: Not authenticated. Connect in Settings.",
          );
          setMessages((prev) => [
            ...removeEmptyAssistantPlaceholder(prev, assistantMessageId),
            errMsg,
          ]);
          await repositories.ai.saveMessage(errMsg);
          setIsStreaming(false);
          return true;
        }
      }

      const history: AIConversationMessage[] = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: { text: m.content },
        }));

      history.push({
        role: "user",
        content: {
          text: prompt,
          files: files ?? [],
        },
      });

      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      cancelledRef.current = false;

      const systemPromptParts: string[] = [MARKDOWN_CHAT_SYSTEM_PROMPT];
      if (config.systemPrompt) systemPromptParts.push(config.systemPrompt);
      if (options.context) {
        systemPromptParts.push(
          `\n\nContext and constraints:\n\n---\n${options.context}\n---`,
        );
      }
      if (options.selection) {
        systemPromptParts.push(
          `\n\nThe user has selected the following text:\n\n> ${options.selection}`,
        );
      }
      const systemPrompt = systemPromptParts.join("") || undefined;

      let assistantContent = "";

      try {
        const stream = adapter.sendMessage(
          history,
          {
            model: config.model,
            systemPrompt,
            baseUrl: config.baseUrl,
            credentials,
            commandTemplate: config.commandTemplate,
            tools,
            toolChoice,
          },
          abortController.signal,
        );

        for await (const event of stream) {
          if (event.type === "text") {
            assistantContent += event.delta;
            const updatedAt = new Date().toISOString();
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantMessageId
                  ? {
                      ...message,
                      content: message.content + event.delta,
                      updatedAt,
                    }
                  : message,
              ),
            );
          } else if (event.type === "done") {
            setIsStreaming(false);
            if (cancelledRef.current) {
              if (!assistantContent.trim()) {
                setMessages((prev) =>
                  removeEmptyAssistantPlaceholder(prev, assistantMessageId),
                );
                return true;
              }

              const partialAssistant: AIMessage = {
                ...assistantMsg,
                content: assistantContent,
                updatedAt: new Date().toISOString(),
              };
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantMessageId
                    ? partialAssistant
                    : message,
                ),
              );
              await repositories.ai.saveMessage(partialAssistant);
              return true;
            }

            const assistantToSave: AIMessage = {
              ...assistantMsg,
              content: assistantContent.trim()
                ? assistantContent
                : "No assistant response was returned.",
              updatedAt: new Date().toISOString(),
            };
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantMessageId ? assistantToSave : message,
              ),
            );
            await repositories.ai.saveMessage(assistantToSave);
            notifyChatsChanged();
            return true;
          } else if (event.type === "error") {
            setIsStreaming(false);
            const errMsg = createSystemMessage(
              chat.id,
              `Error: ${event.message}`,
            );
            setMessages((prev) => [
              ...removeEmptyAssistantPlaceholder(prev, assistantMessageId),
              errMsg,
            ]);
            await repositories.ai.saveMessage(errMsg);
            return true;
          }
        }
        setIsStreaming(false);
        const fallbackMessage = {
          ...assistantMsg,
          content: "No assistant response was returned.",
          updatedAt: new Date().toISOString(),
        };
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantMessageId ? fallbackMessage : message,
          ),
        );
        await repositories.ai.saveMessage(fallbackMessage);
        notifyChatsChanged();
        return true;
      } catch (err: unknown) {
        setIsStreaming(false);
        const errMsg = createSystemMessage(
          chat?.id || "",
          `Error: ${getErrorMessage(err)}`,
        );
        setMessages((prev) => [
          ...removeEmptyAssistantPlaceholder(prev, assistantMessageId),
          errMsg,
        ]);
        if (chat) await repositories.ai.saveMessage(errMsg);
        return Boolean(chat);
      } finally {
        abortControllerRef.current = null;
        cancelledRef.current = false;
      }
    },
    [chat, config, messages],
  );

  const newChat = useCallback(async (): Promise<AIChat | null> => {
    if (!effectiveChatScope) return null;
    const freshChat: AIChat = {
      id: uuid(),
      noteId: effectiveChatScope,
      title: "New Chat",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await repositories.ai.saveChat(freshChat);
    setChat(freshChat);
    setMessages([]);
    notifyChatsChanged();
    return freshChat;
  }, [effectiveChatScope]);

  const clearChat = useCallback(async () => {
    if (!chat) return;
    await repositories.ai.clearMessages(chat.id);
    setMessages([]);
    notifyChatsChanged();
  }, [chat]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
    const systemMsg = createSystemMessage(
      chat?.id || "",
      "Generation stopped.",
    );
    setMessages((prev) => [...prev, systemMsg]);
    if (chat) void repositories.ai.saveMessage(systemMsg);
  }, [chat]);

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
