import { contextBridge, ipcRenderer } from "electron";
import type { ReadDirResult } from "./types/tree";
import type { Note } from "./store/note";

contextBridge.exposeInMainWorld("electronAPI", {
  env: {
    getHome: () => ipcRenderer.invoke("env:getHome"),
  },
  app: {
    openQuickNote: () => ipcRenderer.invoke("app:openQuickNote"),
  },
  onQuicknoteOpen: (callback: () => void) => {
    ipcRenderer.on("quicknote:open", callback);
    return () => ipcRenderer.removeListener("quicknote:open", callback);
  },
  notes: {
    clipboard: async () => {
      return ipcRenderer.invoke("notes:clipboard");
    },
  },
  fs: {
    chooseDirectory: async (): Promise<string | null> => {
      return ipcRenderer.invoke("fs:chooseDirectory");
    },
    writeFile: async (filePath: string, content: string) => {
      return ipcRenderer.invoke("fs:writeFile", filePath, content);
    },
    writeImage: async (filePath: string, base64Data: string) => {
      return ipcRenderer.invoke("fs:writeImage", filePath, base64Data);
    },
    readFile: async (filePath: string) => {
      return ipcRenderer.invoke("fs:readFile", filePath);
    },
    statFile: async (filePath: string) => {
      return ipcRenderer.invoke("fs:statFile", filePath);
    },
    mkdir: async (dirPath: string) => {
      return ipcRenderer.invoke("fs:mkdir", dirPath);
    },
    deleteFile: async (filePath: string) => {
      return ipcRenderer.invoke("fs:deleteFile", filePath);
    },
    moveFile: async (oldPath: string, newPath: string) => {
      return ipcRenderer.invoke("fs:moveFile", oldPath, newPath);
    },
    readDir: async (dirPath: string): Promise<ReadDirResult> => {
      return ipcRenderer.invoke("fs:readDir", dirPath);
    },
    readDirRecursive: async (
      dirPath: string,
    ): Promise<{
      success: boolean;
      files: { name: string; path: string; relativePath: string }[];
      error?: string;
    }> => {
      return ipcRenderer.invoke("fs:readDirRecursive", dirPath);
    },
    openFileOrDirectory: async (): Promise<{
      path: string;
      isDirectory: boolean;
    } | null> => {
      return ipcRenderer.invoke("fs:openFileOrDirectory");
    },
  },
  db: {
    get: (table: string, id: string) => ipcRenderer.invoke("db:get", table, id),
    getAll: (table: string) => ipcRenderer.invoke("db:getAll", table),
    save: (table: string, item: any) =>
      ipcRenderer.invoke("db:save", table, item),
    delete: (table: string, id: string) =>
      ipcRenderer.invoke("db:delete", table, id),
    count: (table: string) => ipcRenderer.invoke("db:count", table),
    notes: {
      getLatestQuicknote: () =>
        ipcRenderer.invoke("db:notes:getLatestQuicknote"),
      getQuicknoteByDate: (start: string, end: string) =>
        ipcRenderer.invoke("db:notes:getQuicknoteByDate", start, end),
      getRecentNotes: (limit: number) =>
        ipcRenderer.invoke("db:notes:getRecentNotes", limit),
      getTemplates: () => ipcRenderer.invoke("db:notes:getTemplates"),
      updateContent: (
        id: string,
        content: string,
        fileSize: number,
        updatedAt: string,
        updatedBy: string,
      ) =>
        ipcRenderer.invoke(
          "db:notes:updateContent",
          id,
          content,
          fileSize,
          updatedAt,
          updatedBy,
        ),
    },
    tabs: {
      updateOrder: (tabs: any[]) =>
        ipcRenderer.invoke("db:tabs:updateOrder", tabs),
      deleteByNoteId: (noteId: string) =>
        ipcRenderer.invoke("db:tabs:deleteByNoteId", noteId),
    },
    hashtags: {
      sync: (filename: string, tags: string[]) =>
        ipcRenderer.invoke("db:hashtags:sync", filename, tags),
    },
  },
  execution: {
    resolve: (command: string) =>
      ipcRenderer.invoke("execution:resolve", command),
    run: (command: string, args: string[] = [], code: string) =>
      ipcRenderer.invoke("execution:run", command, args, code),
  },
  ai: {
    query: (params: {
      commandTemplate: string;
      prompt: string;
      selection: string;
      context: string;
    }) => ipcRenderer.send("ai:query", params),
    stop: () => ipcRenderer.send("ai:stop"),
    onChunk: (callback: (data: { chunk: string }) => void) => {
      ipcRenderer.on("ai:chunk", (_, data) => callback(data));
      return () => ipcRenderer.removeAllListeners("ai:chunk");
    },
    onDone: (callback: (data: { code: number | null }) => void) => {
      ipcRenderer.on("ai:done", (_, data) => callback(data));
      return () => ipcRenderer.removeAllListeners("ai:done");
    },
    onError: (callback: (data: { error: string }) => void) => {
      ipcRenderer.on("ai:error", (_, data) => callback(data));
      return () => ipcRenderer.removeAllListeners("ai:error");
    },
    getConfigs: () => ipcRenderer.invoke("ai:get-configs"),
    saveConfig: (config: any) => ipcRenderer.invoke("ai:save-config", config),
    deleteConfig: (id: string) => ipcRenderer.invoke("ai:delete-config", id),
    getChats: (noteId?: string) => ipcRenderer.invoke("ai:get-chats", noteId),
    saveChat: (chat: any) => ipcRenderer.invoke("ai:save-chat", chat),
    getMessages: (chatId: string) =>
      ipcRenderer.invoke("ai:get-messages", chatId),
    saveMessage: (message: any) =>
      ipcRenderer.invoke("ai:save-message", message),
    test: () => ipcRenderer.invoke("ai:test"),
  },
});

declare global {
  interface Window {
    electronAPI: {
      env: {
        getHome(): Promise<string>;
      };
      app: {
        openQuickNote(): Promise<void>;
      };
      onQuicknoteOpen(callback: () => void): () => void;
      notes: {
        clipboard(): Promise<string>;
      };
      fs: {
        chooseDirectory(): Promise<string | null>;
        writeFile(filePath: string, content: string): Promise<any>;
        readFile(filePath: string): Promise<any>;
        statFile(filePath: string): Promise<any>;
        mkdir(dirPath: string): Promise<any>;
        deleteFile(filePath: string): Promise<any>;
        moveFile(oldPath: string, newPath: string): Promise<any>;
        readDir(dirPath: string): Promise<ReadDirResult>;
        writeImage(
          filePath: string,
          base64Data: string,
        ): Promise<{ success: boolean; filePath?: string; error?: string }>;
        readDirRecursive(dirPath: string): Promise<{
          success: boolean;
          files: { name: string; path: string; relativePath: string }[];
          error?: string;
        }>;
        openFileOrDirectory(): Promise<{
          path: string;
          isDirectory: boolean;
        } | null>;
      };
      db: {
        get<T>(table: string, id: string): Promise<T | undefined>;
        getAll<T>(table: string): Promise<T[]>;
        save<T>(table: string, item: T): Promise<void>;
        delete(table: string, id: string): Promise<void>;
        count(table: string): Promise<number>;
        notes: {
          getLatestQuicknote(): Promise<any>;
          getQuicknoteByDate(start: string, end: string): Promise<any>;
          getRecentNotes(limit: number): Promise<Note[]>;
          getTemplates(): Promise<any[]>;
          updateContent(
            id: string,
            content: string,
            fileSize: number,
            updatedAt: string,
            updatedBy: string,
          ): Promise<void>;
        };
        tabs: {
          updateOrder(tabs: any[]): Promise<void>;
          deleteByNoteId(noteId: string): Promise<void>;
        };
        hashtags: {
          sync(filename: string, tags: string[]): Promise<void>;
        };
      };
      execution: {
        resolve(command: string): Promise<string | null>;
        run(
          command: string,
          args: string[] | undefined,
          code: string,
        ): Promise<{ stdout: string; stderr: string; exitCode: number | null }>;
      };
      ai: {
        query(params: {
          commandTemplate: string;
          prompt: string;
          selection: string;
          context: string;
          systemPrompt: string;
        }): void;
        stop(): void;
        onChunk(callback: (data: { chunk: string }) => void): () => void;
        onDone(callback: (data: { code: number | null }) => void): () => void;
        onError(callback: (data: { error: string }) => void): () => void;
        getConfigs(): Promise<any[]>;
        saveConfig(config: any): Promise<void>;
        deleteConfig(id: string): Promise<void>;
        getChats(noteId?: string): Promise<any[]>;
        saveChat(chat: any): Promise<void>;
        getMessages(chatId: string): Promise<any[]>;
        saveMessage(message: any): Promise<void>;
      };
    };
  }
}
