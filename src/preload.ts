import { contextBridge, ipcRenderer } from "electron";
import type { ReadDirResult } from "./types/tree";
import type { Note } from "./store/note";

contextBridge.exposeInMainWorld("electronAPI", {
  env: {
    getHome: () => ipcRenderer.invoke("env:getHome"),
  },
  app: {
    openQuickNote: () => ipcRenderer.invoke("app:openQuickNote"),
    chdir: (dir: string) => ipcRenderer.invoke("app:chdir", dir),
  },
  onQuicknoteOpen: (callback: () => void) => {
    ipcRenderer.on("quicknote:open", callback);
    return () => ipcRenderer.removeListener("quicknote:open", callback);
  },
  notes: {
    clipboard: async () => {
      return ipcRenderer.invoke("notes:clipboard");
    },
    clipboardImage: async () => {
      return ipcRenderer.invoke("notes:clipboardImage");
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
    readBinaryFile: async (filePath: string) => {
      return ipcRenderer.invoke("fs:readBinaryFile", filePath);
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
    onFileChanged: (callback: (data: { filePath: string }) => void) => {
      const handler = (
        _: Electron.IpcRendererEvent,
        data: { filePath: string },
      ) => callback(data);
      ipcRenderer.on("fs:file-changed", handler);
      return () => ipcRenderer.removeListener("fs:file-changed", handler);
    },
    onDirChanged: (callback: (data: { dirPath: string }) => void) => {
      const handler = (
        _: Electron.IpcRendererEvent,
        data: { dirPath: string },
      ) => callback(data);
      ipcRenderer.on("fs:dir-changed", handler);
      return () => ipcRenderer.removeListener("fs:dir-changed", handler);
    },
    startWatcher: (directory: string) =>
      ipcRenderer.invoke("fs:watcher:start", directory),
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
    noteGroups: {
      getByNoteId: (noteId: string) =>
        ipcRenderer.invoke("db:noteGroups:getByNoteId", noteId),
    },
    noteGroupMembers: {
      getByGroupId: (groupId: string) =>
        ipcRenderer.invoke("db:noteGroupMembers:getByGroupId", groupId),
      reorder: (members: { id: string; order: number }[]) =>
        ipcRenderer.invoke("db:noteGroupMembers:reorder", members),
      deleteByNoteId: (noteId: string) =>
        ipcRenderer.invoke("db:noteGroupMembers:deleteByNoteId", noteId),
      deleteByGroupId: (groupId: string) =>
        ipcRenderer.invoke("db:noteGroupMembers:deleteByGroupId", groupId),
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
    saveCredentials: (creds: any) =>
      ipcRenderer.invoke("ai:save-credentials", creds),
    loadCredentials: (adapterId: string) =>
      ipcRenderer.invoke("ai:load-credentials", adapterId),
    clearCredentials: (adapterId: string) =>
      ipcRenderer.invoke("ai:clear-credentials", adapterId),
    startOAuth: (authUrl: string) =>
      ipcRenderer.invoke("ai:oauth-start", authUrl),
  },
  terminal: {
    spawn: (id: string, cwd?: string) =>
      ipcRenderer.send("terminal:spawn", id, cwd),
    write: (id: string, data: string) =>
      ipcRenderer.send("terminal:write", id, data),
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.send("terminal:resize", id, cols, rows),
    kill: (id: string) => ipcRenderer.send("terminal:kill", id),
    onData: (callback: (data: { id: string; data: string }) => void) => {
      const handler = (_: any, data: { id: string; data: string }) =>
        callback(data);
      ipcRenderer.on("terminal:data", handler);
      return () => ipcRenderer.removeListener("terminal:data", handler);
    },
  },
  contextMenu: {
    showExplorer: (filePath: string, isDirectory: boolean) =>
      ipcRenderer.invoke("context-menu:explorer", filePath, isDirectory),
  },
  onContextMenuAction: (
    callback: (data: { action: string; filePath: string }) => void,
  ) => {
    const handler = (
      _: Electron.IpcRendererEvent,
      data: { action: string; filePath: string },
    ) => callback(data);
    ipcRenderer.on("context-menu:action", handler);
    return () => ipcRenderer.removeListener("context-menu:action", handler);
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
        chdir(dir: string): Promise<{ success: boolean; error?: string }>;
      };
      onQuicknoteOpen(callback: () => void): () => void;
      notes: {
        clipboard(): Promise<string>;
        clipboardImage(): Promise<string | null>;
      };
      fs: {
        chooseDirectory(): Promise<string | null>;
        writeFile(filePath: string, content: string): Promise<any>;
        readFile(filePath: string): Promise<any>;
        readBinaryFile(
          filePath: string,
        ): Promise<{ success: boolean; data?: Uint8Array; error?: string }>;
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
        onFileChanged(
          callback: (data: { filePath: string }) => void,
        ): () => void;
        onDirChanged(callback: (data: { dirPath: string }) => void): () => void;
        startWatcher(directory: string): Promise<void>;
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
        noteGroups: {
          getByNoteId(noteId: string): Promise<any[]>;
        };
        noteGroupMembers: {
          getByGroupId(groupId: string): Promise<any[]>;
          reorder(members: { id: string; order: number }[]): Promise<void>;
          deleteByNoteId(noteId: string): Promise<void>;
          deleteByGroupId(groupId: string): Promise<void>;
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
        saveCredentials(creds: any): Promise<void>;
        loadCredentials(adapterId: string): Promise<any | null>;
        clearCredentials(adapterId: string): Promise<void>;
        startOAuth(authUrl: string): Promise<{ code: string }>;
      };
      terminal: {
        spawn(id: string, cwd?: string): void;
        write(id: string, data: string): void;
        resize(id: string, cols: number, rows: number): void;
        kill(id: string): void;
        onData(
          callback: (data: { id: string; data: string }) => void,
        ): () => void;
      };
      contextMenu: {
        showExplorer(filePath: string, isDirectory: boolean): Promise<void>;
      };
      onContextMenuAction(
        callback: (data: { action: string; filePath: string }) => void,
      ): () => void;
    };
  }
}
