import { createGlobalReducer } from "use-typed-reducer";
import { editorGlobalRef } from "../app/editor-global-ref";
import { CursorPositionStore } from "./cursor-position.store";
import { repositories } from "./repositories";
import { Note } from "./note";
import { Tab } from "./repositories/entities/tab";
import { uiDispatch } from "./ui.store";

export type NoteCreationType = "note" | "quick";

export enum CommanderType {
  All = "all",
  Notes = "Notes",
}

export type Commander = {
  enabled: boolean;
  type: CommanderType;
};

type Toggle<T> = T | ((prev: T) => T);

type State = {
  help: boolean;
  tabs: Tab[];
  notes: Note[];
  readItLaterDialog: boolean;
  recentNotesDialog: boolean;
  recentNotes: Note[];
  directoryBrowserDialog: boolean;
  theme: "light" | "dark";
  activeTabId: string | null;
  commander: Commander;
  createNoteDialog: { isOpen: boolean; type: NoteCreationType };
  note: Note | null;
};

const initialState: State = {
  help: false,
  tabs: [] as Tab[],
  notes: [] as Note[],
  readItLaterDialog: false,
  recentNotesDialog: false,
  recentNotes: [] as Note[],
  directoryBrowserDialog: false,
  theme: "dark" as "light" | "dark",
  activeTabId: null as string | null,
  commander: { enabled: false, type: CommanderType.All } as Commander,
  createNoteDialog: { isOpen: false, type: "note" as NoteCreationType },
  note: null as Note | null,
};

type Getter = { state: () => State };

export const useGlobalStore = createGlobalReducer(
  initialState,
  (get: Getter) => {
    const setNotes = (notes: Note[]) => {
      const state = get.state();
      const existingNotesMap = new Map<string, Note>(
        state.notes.map((n) => [n.id, n]),
      );
      const mergedNotes = notes.map((note): Note => {
        const existing = existingNotesMap.get(note.id);
        if (existing) {
          if (existing.updatedAt > note.updatedAt) {
            return existing as Note;
          }
        }
        return note;
      });
      return { notes: mergedNotes as Note[] };
    };

    const updateNoteInList = (note: Note) => {
      const state = get.state();
      const existsInNotes = state.notes.some((n) => n.id === note.id);
      return existsInNotes
        ? state.notes.map((n) => (n.id === note.id ? note : n))
        : [...state.notes, note];
    };

    const createTab = (noteId: string, id?: string): Tab => {
      const state = get.state();
      const now = new Date();
      return {
        id: id || crypto.randomUUID(),
        noteId,
        project: "",
        type: "tab",
        createdAt: now,
        updatedAt: now,
        order: state.tabs.length,
      };
    };

    const saveCursorPosition = (noteId: string) => {
      if (editorGlobalRef.current) {
        CursorPositionStore.save(
          noteId,
          editorGlobalRef.current.state.selection.anchor,
          window.scrollY,
        );
      }
    };

    return {
      notes: setNotes,
      tabs: (tabs: Tab[]) => ({ tabs }),
      help: (help: boolean) => ({ help }),
      setNote: (note: Note | null) => ({ note }),
      recentNotes: (recentNotes: Note[]) => ({ recentNotes }),
      activeTabId: (activeTabId: string | null) => ({ activeTabId }),
      commander: (enabled: boolean, type?: CommanderType) => ({
        commander: { enabled, type: type || CommanderType.All },
      }),
      init: (notes: Note[], tabs: Tab[]) => ({
        notes: setNotes(notes).notes,
        tabs,
      }),
      recentNotesDialog: (recentNotesDialog: boolean) => ({
        recentNotesDialog,
      }),
      readItLaterDialog: (readItLaterDialog: boolean) => ({
        readItLaterDialog,
      }),
      setCreateNoteDialog: (createNoteDialog: {
        isOpen: boolean;
        type: NoteCreationType;
      }) => ({ createNoteDialog }),
      loadRecentNotes: async (limit = 20) => {
        const recent = await repositories.notes.getAll({ limit });
        return { recentNotes: recent };
      },
      reorderTabs: async (tabs: Tab[]) => {
        const updatedTabs = tabs.map((t, i) => ({ ...t, order: i }));
        await repositories.tabs.updateOrder(updatedTabs);
        return { tabs: updatedTabs };
      },
      directoryBrowserDialog: (directoryBrowserDialog: boolean) => ({
        directoryBrowserDialog,
      }),
      note: async (note: Note, createTabIfMissing: boolean = true) => {
        try {
          await repositories.notes.update(note.id, note);
        } catch (error: any) {
          uiDispatch.setError(error.message || "Failed to update note");
          return {};
        }
        const state = get.state();
        const existingTab = state.tabs.find((t) => t.noteId === note.id);
        const updatedNotes = updateNoteInList(note);

        if (existingTab) {
          return {
            note: note,
            notes: updatedNotes,
            activeTabId: existingTab.id,
          };
        }

        if (!createTabIfMissing) {
          return {
            note: note,
            notes: updatedNotes,
          };
        }

        const newTab = createTab(note.id, note.id);
        await repositories.tabs.save(newTab);
        return {
          note: note,
          notes: updatedNotes,
          activeTabId: newTab.id,
          tabs: [...state.tabs, newTab],
        };
      },
      addTab: async (noteId: string) => {
        const currentTabs = get.state().tabs;
        const existingTab = currentTabs.find((t) => t.noteId === noteId);
        if (existingTab) {
          return { activeTabId: existingTab.id };
        }
        const newTab = createTab(noteId);
        await repositories.tabs.save(newTab);
        return {
          tabs: [...currentTabs, newTab],
          activeTabId: newTab.id,
        };
      },
      removeTab: async (tabId: string) => {
        const state = get.state();
        const currentTabs = state.tabs;
        const tab = currentTabs.find((t) => t.id === tabId);
        if (tab && state.activeTabId === tabId) {
          saveCursorPosition(tab.noteId);
        }
        const newTabs = currentTabs.filter((t) => t.id !== tabId);
        await repositories.tabs.delete(tabId);
        let nextActiveTabId = get.state().activeTabId;
        if (newTabs.length === 0) {
          nextActiveTabId = null;
        } else if (nextActiveTabId === tabId) {
          const index = currentTabs.findIndex((t) => t.id === tabId);
          if (index < newTabs.length) {
            nextActiveTabId = newTabs[index].id;
          } else {
            nextActiveTabId = newTabs[newTabs.length - 1].id;
          }
        }
        return {
          tabs: newTabs,
          activeTabId: nextActiveTabId,
          note: newTabs.length === 0 ? null : get.state().note,
        };
      },
      theme: (theme: Toggle<string>) => {
        const result =
          typeof theme === "function" ? theme(get.state().theme) : theme;
        if (result === "dark") document.documentElement.classList.add("dark");
        if (result === "light")
          document.documentElement.classList.remove("dark");
        return { theme: result as "light" | "dark" };
      },
      selectNoteById: async (noteId: string) => {
        const currentState = get.state();
        if (currentState.note) {
          saveCursorPosition(currentState.note.id);
        }
        let fullNote: Note | null = null;
        try {
          fullNote = await repositories.notes.getOne(noteId);
        } catch (error: any) {
          uiDispatch.setError(error.message || "Failed to load note");
          return {};
        }
        if (!fullNote) return {};
        const state = get.state();
        const existingTab = state.tabs.find((t) => t.noteId === fullNote.id);
        const updatedNotes = updateNoteInList(fullNote);

        if (existingTab) {
          return {
            note: fullNote,
            notes: updatedNotes,
            activeTabId: existingTab.id,
          };
        }
        const newTab = createTab(fullNote.id, fullNote.id);
        await repositories.tabs.save(newTab);
        return {
          note: fullNote,
          notes: updatedNotes,
          activeTabId: newTab.id,
          tabs: [...state.tabs, newTab],
        };
      },
    } as const;
  },
);


export const globalState = useGlobalStore.getState;

export const globalDispatch = useGlobalStore.dispatchers;

export { repositories };
