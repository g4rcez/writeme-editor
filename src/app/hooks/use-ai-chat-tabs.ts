import { useCallback, useEffect, useMemo, useState } from "react";

import { AI_CHATS_CHANGED_EVENT } from "@/app/ai/events";
import { getWorkspaceChatScope } from "@/app/ai/workspace-context";
import { isAiChatTab } from "@/lib/tab-target";
import { repositories } from "@/store/repositories";
import type { Tab } from "@/store/repositories/entities/tab";
import type { AIChat } from "@/store/repositories/electron/ai.repository";

export function useAiChatTabs(
  directory: string | null,
  tabs: Tab[],
): Map<string, AIChat> {
  const [chats, setChats] = useState<AIChat[]>([]);
  const chatScopeId = useMemo(
    () => getWorkspaceChatScope(directory),
    [directory],
  );
  const chatIds = useMemo(
    () => tabs.filter(isAiChatTab).map((tab) => tab.noteId),
    [tabs],
  );
  const chatIdsKey = chatIds.join("\u0000");

  const loadChats = useCallback(async (): Promise<void> => {
    if (chatIds.length === 0) {
      setChats([]);
      return;
    }

    const chatIdsSet = new Set(chatIds);
    const results = await repositories.ai.getChats(chatScopeId);
    setChats(results.filter((chat) => chatIdsSet.has(chat.id)));
  }, [chatIds, chatIdsKey, chatScopeId]);

  useEffect(() => {
    void loadChats();
  }, [loadChats]);

  useEffect(() => {
    const onChatsChanged = (): void => {
      void loadChats();
    };
    window.addEventListener(AI_CHATS_CHANGED_EVENT, onChatsChanged);
    return () => {
      window.removeEventListener(AI_CHATS_CHANGED_EVENT, onChatsChanged);
    };
  }, [loadChats]);

  return useMemo(() => new Map(chats.map((chat) => [chat.id, chat])), [chats]);
}
