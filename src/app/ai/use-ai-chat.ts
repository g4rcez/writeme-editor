import { useCallback, useEffect, useRef, useState } from "react";
import { v7 as uuid } from "uuid";
import { repositories } from "../../store/global.store";
import type {
  AIChat,
  AIMessage,
  AttachedFile,
} from "../../store/repositories/electron/ai.repository";
import { adapterRegistry } from "./adapters/registry";
import { authManager } from "./auth/auth-manager";
import type { AIConversationMessage, AIFile } from "./adapters/types";

export function useAIChat(noteId?: string) {
  const [chat, setChat] = useState<AIChat | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setIsLoading(true);

    const loadChat = async () => {
      if (!noteId) return;
      const chats = await repositories.ai.getChats(noteId);
      if (chats.length > 0) {
        setChat(chats[0]!);
        const msgs = await repositories.ai.getMessages(chats[0]?.id!);
        setMessages(msgs);
      } else {
        const now = new Date().toISOString();
        const newChat: AIChat = {
          noteId,
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
      const def = configs.find((c) => c.isDefault) || configs[0];
      setConfig(def);
    };

    Promise.all([loadChat(), loadConfig()]).finally(() => setIsLoading(false));
  }, [noteId]);

  const send = useCallback(
    async (
      prompt: string,
      options: {
        selection: string;
        context: string;
        selectionSlice?: { from: number; to: number };
      },
      files?: AIFile[],
    ) => {
      if (!chat || !config) return;

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

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);
      await repositories.ai.saveMessage(userMsg);
      const adapterId: string = config.adapterId ?? "cli";
      const adapter = adapterRegistry.get(adapterId);
      if (!adapter) {
        const errMsg: AIMessage = {
          id: uuid(),
          createdAt: now,
          role: "system",
          updatedAt: now,
          chatId: chat.id,
          content: `Error: No adapter found for "${adapterId}". Please configure AI in Settings.`,
        };
        setMessages((prev) => [...prev, errMsg]);
        setIsStreaming(false);
        return;
      }

      let credentials = {};
      try {
        credentials = await authManager.getCredentials(adapterId, adapter);
      } catch {
        if (adapterId !== "cli") {
          const errMsg: AIMessage = {
            id: uuid(),
            chatId: chat.id,
            role: "system",
            content: "Error: Not authenticated. Connect in Settings.",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, errMsg]);
          setIsStreaming(false);
          return;
        }
      }

      // Build conversation history
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

      const systemPromptParts: string[] = [];
      if (config.systemPrompt) systemPromptParts.push(config.systemPrompt);
      if (options.context) {
        systemPromptParts.push(
          `\n\nThe user is currently editing a note. Here is the full content:\n\n---\n${options.context}\n---`,
        );
      }
      if (options.selection) {
        systemPromptParts.push(
          `\n\nThe user has selected the following text:\n\n> ${options.selection}`,
        );
      }
      const systemPrompt = systemPromptParts.join("") || undefined;

      try {
        const stream = adapter.sendMessage(
          history,
          {
            model: config.model,
            systemPrompt,
            baseUrl: config.baseUrl,
            credentials,
            commandTemplate: config.commandTemplate,
          } as any,
          abortController.signal,
        );

        for await (const event of stream) {
          if (event.type === "text") {
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === "assistant") {
                return [
                  ...prev.slice(0, -1),
                  { ...last, content: last.content + event.delta },
                ];
              }
              return prev;
            });
          } else if (event.type === "done") {
            setIsStreaming(false);
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === "assistant") {
                repositories.ai.saveMessage(last);
              }
              return prev;
            });
            break;
          } else if (event.type === "error") {
            setIsStreaming(false);
            setMessages((prev) => [
              ...prev,
              {
                id: uuid(),
                chatId: chat?.id || "",
                role: "system",
                content: `Error: ${event.message}`,
                createdAt: new Date().toISOString(),
              },
            ]);
            break;
          }
        }
      } catch (err: any) {
        setIsStreaming(false);
        setMessages((prev) => [
          ...prev,
          {
            id: uuid(),
            chatId: chat?.id || "",
            role: "system",
            content: `Error: ${err?.message ?? "Unknown error"}`,
            createdAt: new Date().toISOString(),
          },
        ]);
      } finally {
        abortControllerRef.current = null;
      }
    },
    [chat, config, messages],
  );

  const newChat = useCallback(async () => {
    if (!noteId) return;
    const freshChat: AIChat = {
      id: uuid(),
      noteId,
      title: "New Chat",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await repositories.ai.saveChat(freshChat);
    setChat(freshChat);
    setMessages([]);
  }, [noteId]);

  const clearChat = useCallback(async () => {
    if (!chat) return;
    await repositories.ai.clearMessages(chat.id);
    setMessages([]);
  }, [chat]);

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
    const now = new Date().toISOString();
    const systemMsg: AIMessage = {
      id: uuid(),
      createdAt: now,
      role: "system",
      updatedAt: now,
      chatId: chat?.id || "",
      content: "--- Conversation finished ---",
    };
    setMessages((prev) => [...prev, systemMsg]);
    if (chat) repositories.ai.saveMessage(systemMsg);
  }, [chat]);

  return {
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
