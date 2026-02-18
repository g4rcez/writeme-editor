import { contextBridge, ipcRenderer } from "electron";
import { Note } from "./store/note";
import type { ReadDirResult } from "./types/tree";

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
    },
    tabs: {
      updateOrder: (tabs: any[]) =>
        ipcRenderer.invoke("db:tabs:updateOrder", tabs),
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
          getRecentNotes(limit: number): Promise<any[]>;
        };
        tabs: {
          updateOrder(tabs: any[]): Promise<void>;
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
    };
  }
}
