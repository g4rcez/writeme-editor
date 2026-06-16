import { Button } from "@g4rcez/components";
import { ChatCircleDotsIcon, PlusIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { createWorkspaceAiChat } from "@/app/ai/create-ai-chat";
import { AI_CHATS_CHANGED_EVENT } from "@/app/ai/events";
import { getWorkspaceChatScope } from "@/app/ai/workspace-context";
import { Dates } from "@/lib/dates";
import { useGlobalStore } from "@/store/global.store";
import { repositories } from "@/store/repositories";
import type { AIChat } from "@/store/repositories/electron/ai.repository";

function getSelectedChatId(search: string): string | null {
  return new URLSearchParams(search).get("chatId");
}

function formatChatDate(chat: AIChat): string {
  const value = chat.updatedAt ?? chat.createdAt;
  return Dates.yearMonthDay(new Date(value));
}

function getChatTitle(chat: AIChat): string {
  return chat.title?.trim() || "New Chat";
}

export function ChatSidebarContent() {
  const [state, dispatch] = useGlobalStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [chats, setChats] = useState<AIChat[]>([]);
  const [loading, setLoading] = useState(true);

  const chatScopeId = useMemo(
    () => getWorkspaceChatScope(state.directory),
    [state.directory],
  );
  const selectedChatId = getSelectedChatId(location.search);

  const loadChats = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const results = await repositories.ai.getChats(chatScopeId);
      setChats(results);
    } finally {
      setLoading(false);
    }
  }, [chatScopeId]);

  useEffect(() => {
    void loadChats();
  }, [loadChats, location.search]);

  useEffect(() => {
    const onChatsChanged = (): void => {
      void loadChats();
    };
    window.addEventListener(AI_CHATS_CHANGED_EVENT, onChatsChanged);
    return () => {
      window.removeEventListener(AI_CHATS_CHANGED_EVENT, onChatsChanged);
    };
  }, [loadChats]);

  const openChat = async (chatId: string): Promise<void> => {
    await dispatch.addAiChatTab(chatId);
    navigate(`/chat?chatId=${encodeURIComponent(chatId)}`);
  };

  const createChat = async (): Promise<void> => {
    const chat = await createWorkspaceAiChat(state.directory);
    await dispatch.addAiChatTab(chat.id);
    navigate(`/chat?chatId=${encodeURIComponent(chat.id)}`);
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="flex shrink-0 items-center justify-between px-2">
        <div>
          <p className="text-xs font-light text-muted-foreground">
            Workspace AI
          </p>
          <h2 className="text-sm font-semibold text-foreground">Chats</h2>
        </div>
        <Button size="tiny" theme="ghost-primary" onClick={createChat}>
          <PlusIcon size={14} />
          New
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
        {loading ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            Loading chats...
          </p>
        ) : chats.length === 0 ? (
          <div className="rounded-xl border border-card-border bg-card-background p-3 text-sm text-muted-foreground">
            <p>No chats yet.</p>
            <p className="mt-1 text-xs">
              Start a conversation from the chat page.
            </p>
          </div>
        ) : (
          <ol className="flex flex-col gap-1">
            {chats.map((chat) => {
              const selected = selectedChatId === chat.id;
              return (
                <li key={chat.id}>
                  <button
                    type="button"
                    onClick={() => void openChat(chat.id)}
                    className={
                      selected
                        ? "flex w-full items-start gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-left text-primary transition-colors"
                        : "flex w-full items-start gap-2 rounded-xl border border-transparent px-3 py-2 text-left text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                    }
                  >
                    <ChatCircleDotsIcon
                      size={16}
                      className="mt-0.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {getChatTitle(chat)}
                      </span>
                      <span className="mt-0.5 block text-xs opacity-70">
                        {formatChatDate(chat)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
