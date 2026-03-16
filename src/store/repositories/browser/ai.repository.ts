import { db } from "./dexie-db";
import type { IAIRepository, AICredentials } from "../entities/ai";
import type { AIChat, AIConfig, AIMessage } from "../electron/ai.repository";

export class BrowserAIRepository implements IAIRepository {
  async getConfigs(): Promise<AIConfig[]> {
    return db.aiConfigs.toArray();
  }

  async saveConfig(config: AIConfig): Promise<void> {
    await db.aiConfigs.put(config);
  }

  async deleteConfig(id: string): Promise<void> {
    await db.aiConfigs.delete(id);
  }

  async getChats(noteId?: string): Promise<AIChat[]> {
    if (noteId) {
      return db.aiChats.where("noteId").equals(noteId).reverse().sortBy("createdAt");
    }
    return db.aiChats.toArray();
  }

  async saveChat(chat: AIChat): Promise<void> {
    await db.aiChats.put(chat);
  }

  async getMessages(chatId: string): Promise<AIMessage[]> {
    return db.aiMessages.where("chatId").equals(chatId).sortBy("createdAt");
  }

  async saveMessage(message: AIMessage): Promise<void> {
    await db.aiMessages.put(message);
  }

  async saveCredentials(creds: AICredentials): Promise<void> {
    await db.aiCredentials.put(creds);
  }

  async loadCredentials(adapterId: string): Promise<AICredentials | null> {
    const result = await db.aiCredentials.get(adapterId);
    return result ?? null;
  }

  async clearCredentials(adapterId: string): Promise<void> {
    await db.aiCredentials.delete(adapterId);
  }
}
