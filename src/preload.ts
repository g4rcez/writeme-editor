import { contextBridge, ipcRenderer } from "electron";
import { Note } from "./store/note";

contextBridge.exposeInMainWorld("electronAPI", {
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
});

declare global {
  interface Window {
    electronAPI: {
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
    };
  }
}
