import { AIConfig, AIChat, AIMessage } from "../electron/ai.repository";

export interface IAIRepository {
  getConfigs(): Promise<AIConfig[]>;
  saveConfig(config: AIConfig): Promise<void>;
  deleteConfig(id: string): Promise<void>;
  getChats(noteId?: string): Promise<AIChat[]>;
  saveChat(chat: AIChat): Promise<void>;
  getMessages(chatId: string): Promise<AIMessage[]>;
  saveMessage(message: AIMessage): Promise<void>;
}
