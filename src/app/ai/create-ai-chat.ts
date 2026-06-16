import { v7 as uuid } from "uuid";

import { getWorkspaceChatScope } from "@/app/ai/workspace-context";
import { repositories } from "@/store/repositories";
import type { AIChat } from "@/store/repositories/electron/ai.repository";
import { AI_CHATS_CHANGED_EVENT } from "./events";

export async function createWorkspaceAiChat(
  directory: string | null,
): Promise<AIChat> {
  const now = new Date().toISOString();
  const chat: AIChat = {
    id: uuid(),
    noteId: getWorkspaceChatScope(directory),
    title: "New Chat",
    createdAt: now,
    updatedAt: now,
  };

  await repositories.ai.saveChat(chat);
  window.dispatchEvent(new Event(AI_CHATS_CHANGED_EVENT));
  return chat;
}
