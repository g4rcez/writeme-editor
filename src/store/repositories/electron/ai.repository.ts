import type { AICredentials } from "../entities/ai";

export type AttachedFile = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
};

export type AIConfig = {
  id: string;
  name: string;
  commandTemplate?: string;
  systemPrompt: string;
  isDefault: boolean;
  adapterId: string;
  model?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AIChat = {
  id: string;
  noteId?: string;
  title: string;
  createdAt: string;
  updatedAt?: string;
};

export type AIMessage = {
  id: string;
  chatId: string;
  role: "user" | "assistant" | "system";
  content: string;
  diffOriginal?: string;
  diffNew?: string;
  selectionSlice?: { from: number; to: number };
  files?: AttachedFile[];
  createdAt: string;
  updatedAt?: string;
};

export class AIRepository {
  public async getConfigs(): Promise<AIConfig[]> {
    return window.electronAPI.ai.getConfigs();
  }

  public async saveConfig(config: AIConfig): Promise<void> {
    return window.electronAPI.ai.saveConfig(config);
  }

  public async deleteConfig(id: string): Promise<void> {
    return window.electronAPI.ai.deleteConfig(id);
  }

  public async getChats(noteId?: string): Promise<AIChat[]> {
    return window.electronAPI.ai.getChats(noteId);
  }

  public async saveChat(chat: AIChat): Promise<void> {
    return window.electronAPI.ai.saveChat(chat);
  }

  public async getMessages(chatId: string): Promise<AIMessage[]> {
    return window.electronAPI.ai.getMessages(chatId);
  }

  public async saveMessage(message: AIMessage): Promise<void> {
    return window.electronAPI.ai.saveMessage(message);
  }

  public async saveCredentials(creds: AICredentials): Promise<void> {
    return window.electronAPI.ai.saveCredentials(creds);
  }

  public async loadCredentials(adapterId: string): Promise<AICredentials | null> {
    return window.electronAPI.ai.loadCredentials(adapterId);
  }

  public async clearCredentials(adapterId: string): Promise<void> {
    return window.electronAPI.ai.clearCredentials(adapterId);
  }
}
