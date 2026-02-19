import { useChat } from "@tanstack/ai-react";
import { useEffect, useState, useCallback, useMemo } from "react";
import { repositories } from "../../store/global.store";
import {
  AIMessage,
  AIChat,
} from "../../store/repositories/electron/ai.repository";
import { v4 as uuidv4 } from "uuid";

export function useAIChat(noteId?: string) {
  const [chat, setChat] = useState<AIChat | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    const loadChat = async () => {
      if (!noteId) return;
      const chats = await repositories.ai.getChats(noteId);
      if (chats.length > 0) {
        setChat(chats[0]);
        const msgs = await repositories.ai.getMessages(chats[0].id);
        setMessages(msgs);
      } else {
        const newChat: AIChat = {
          id: uuidv4(),
          noteId,
          title: "New Chat",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
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

    loadChat();
    loadConfig();
  }, [noteId]);

  useEffect(() => {
    const unChunk = window.electronAPI.ai.onChunk(({ chunk }) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === "assistant") {
          return [
            ...prev.slice(0, -1),
            { ...last, content: last.content + chunk },
          ];
        }
        return prev;
      });
    });

    const unDone = window.electronAPI.ai.onDone(async () => {
      setIsStreaming(false);
      // Save the complete assistant message to the database
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === "assistant") {
          repositories.ai.saveMessage(last);
        }
        return prev;
      });
    });

    const unError = window.electronAPI.ai.onError(({ error }) => {
      setIsStreaming(false);
      setMessages((prev) => [
        ...prev,
        {
          id: uuidv4(),
          chatId: chat?.id || "",
          role: "system",
          content: `Error: ${error}`,
          createdAt: new Date().toISOString(),
        },
      ]);
    });

    return () => {
      unChunk();
      unDone();
      unError();
    };
  }, [chat?.id]);

  const send = useCallback(
    async (
      prompt: string,
      options: {
        selection: string;
        context: string;
        selectionSlice?: { from: number; to: number };
      },
    ) => {
      if (!chat || !config) return;

      const userMsg: AIMessage = {
        id: uuidv4(),
        chatId: chat.id,
        role: "user",
        content: prompt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const assistantMsg: AIMessage = {
        id: uuidv4(),
        chatId: chat.id,
        role: "assistant",
        content: "",
        diffOriginal: options.selection,
        selectionSlice: options.selectionSlice,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      await repositories.ai.saveMessage(userMsg);

      window.electronAPI.ai.query({
        commandTemplate: config.commandTemplate,
        prompt,
        selection: options.selection,
        context: options.context,
        systemPrompt: config.systemPrompt || "",
      });
    },
    [chat, config],
  );

  const stop = useCallback(() => {
    window.electronAPI.ai.stop();
    setIsStreaming(false);

    const systemMsg: AIMessage = {
      id: uuidv4(),
      chatId: chat?.id || "",
      role: "system",
      content: "--- Conversation finished ---",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, systemMsg]);
    if (chat) repositories.ai.saveMessage(systemMsg);
  }, [chat]);

  return {
    messages,
    isStreaming,
    send,
    stop,
    config,
  };
}
