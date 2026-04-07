import {
  type AIConfig,
  type AIChat,
  type AIMessage,
} from "../electron/ai.repository";

export type AICredentials = {
  adapterId: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  apiKey?: string;
};

export interface IAIRepository {
  getConfigs(): Promise<AIConfig[]>;
  saveConfig(config: AIConfig): Promise<void>;
  deleteConfig(id: string): Promise<void>;
  getChats(noteId?: string): Promise<AIChat[]>;
  saveChat(chat: AIChat): Promise<void>;
  getMessages(chatId: string): Promise<AIMessage[]>;
  saveMessage(message: AIMessage): Promise<void>;
  clearMessages(chatId: string): Promise<void>;
  saveCredentials(creds: AICredentials): Promise<void>;
  loadCredentials(adapterId: string): Promise<AICredentials | null>;
  clearCredentials(adapterId: string): Promise<void>;
}
