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
    const handler = () => callback();
    ipcRenderer.on("quicknote:open", handler);
    return () => {
      ipcRenderer.removeListener("quicknote:open", handler);
    };
  },
  notes: {
    clipboard: async () => {
      return ipcRenderer.invoke("notes:clipboard");
    },
    findAll: async (): Promise<Note[]> => {
      try {
        const notesData = await ipcRenderer.invoke("notes:findAll");
        return notesData.map(() => {
          return {};
        });
      } catch (error) {
        console.error("Error in findAll:", error);
        throw error;
      }
    },

    findById: async (id: string): Promise<Note | null> => {
      try {
        const noteData = await ipcRenderer.invoke("notes:findById", id);
        return noteData ? Note.parse(noteData) : null;
      } catch (error) {
        console.error("Error in findById:", error);
        throw error;
      }
    },
    save: async (note: Note): Promise<Note> => {
      try {
        const noteData = {
          type: note.type,
          id: note.id,
          title: note.title,
          editor: note.editor,
          metadata: note.metadata,
        };
        const savedData = await ipcRenderer.invoke("notes:save", noteData);
        return Note.parse(savedData);
      } catch (error) {
        console.error("Error in save:", error);
        throw error;
      }
    },
    create: async (note: Note): Promise<Note> => {
      try {
        const noteData = {
          type: note.type,
          id: note.id,
          title: note.title,
          editor: note.editor,
          metadata: note.metadata,
        };
        const createdData = await ipcRenderer.invoke("notes:create", noteData);
        return Note.parse(createdData);
      } catch (error) {
        console.error("Error in create:", error);
        throw error;
      }
    },
    update: async (note: Note): Promise<Note> => {
      try {
        const noteData = {
          type: note.type,
          id: note.id,
          title: note.title,
          editor: note.editor,
          metadata: note.metadata,
        };
        const updatedData = await ipcRenderer.invoke("notes:update", noteData);
        return Note.parse(updatedData);
      } catch (error) {
        console.error("Error in update:", error);
        throw error;
      }
    },
    delete: async (id: string): Promise<boolean> => {
      try {
        return await ipcRenderer.invoke("notes:delete", id);
      } catch (error) {
        console.error("Error in delete:", error);
        throw error;
      }
    },

    search: async (query: string): Promise<Note[]> => {
      try {
        const notesData = await ipcRenderer.invoke("notes:search", query);
        return notesData.map((data: any) => Note.parse(data));
      } catch (error) {
        console.error("Error in search:", error);
        throw error;
      }
    },
  },

  // File system APIs for hybrid storage
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

    openFileOrDirectory: async (): Promise<{
      path: string;
      isDirectory: boolean;
    } | null> => {
      return ipcRenderer.invoke("fs:openFileOrDirectory");
    },
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
        findAll(): Promise<Note[]>;
        findById(id: string): Promise<Note | null>;
        save(note: Note): Promise<Note>;
        create(note: Note): Promise<Note>;
        update(note: Note): Promise<Note>;
        delete(id: string): Promise<boolean>;
        search(query: string): Promise<Note[]>;
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
        openFileOrDirectory(): Promise<{
          path: string;
          isDirectory: boolean;
        } | null>;
      };
    };
  }
}
