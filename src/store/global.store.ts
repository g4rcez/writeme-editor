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
      note: async (note: Note, createTab: boolean = true) => {
        try {
          await repositories.notes.update(note.id, note);
        } catch (error: any) {
          uiDispatch.setError(error.message || "Failed to update note");
          return {};
        }
        const state = get.state();
        const existingTab = state.tabs.find((t) => t.noteId === note.id);
        const existsInNotes = state.notes.some((n) => n.id === note.id);
        const updatedNotes = existsInNotes
          ? state.notes.map((n) => (n.id === note.id ? note : n))
          : [...state.notes, note];
        if (existingTab) {
          return {
            note: note,
            notes: updatedNotes,
            activeTabId: existingTab.id,
          };
        }
        const newTab: Tab = {
          id: note.id,
          noteId: note.id,
          project: "",
          createdAt: new Date(),
          order: state.tabs.length,
        };
        if (createTab) await repositories.tabs.save(newTab);
        return {
          note: note,
          notes: updatedNotes,
          activeTabId: createTab ? newTab.id : state.activeTabId,
          tabs: createTab ? [...state.tabs, newTab] : state.tabs,
        };
      },
      addTab: async (noteId: string) => {
        const currentTabs = get.state().tabs;
        const existingTab = currentTabs.find((t) => t.noteId === noteId);
        if (existingTab) {
          return { activeTabId: existingTab.id };
        }
        const newTab: Tab = {
          id: crypto.randomUUID(),
          noteId,
          project: "",
          order: currentTabs.length,
          createdAt: new Date(),
        };
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
        if (tab && state.activeTabId === tabId && editorGlobalRef.current) {
          CursorPositionStore.save(
            tab.noteId,
            editorGlobalRef.current.state.selection.anchor,
            window.scrollY,
          );
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
        if (currentState.note && editorGlobalRef.current) {
          CursorPositionStore.save(
            currentState.note.id,
            editorGlobalRef.current.state.selection.anchor,
            window.scrollY,
          );
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
        const existsInNotes = state.notes.some((n) => n.id === fullNote.id);
        const updatedNotes = existsInNotes
          ? state.notes.map((n) => (n.id === fullNote.id ? fullNote : n))
          : [...state.notes, fullNote];
        if (existingTab) {
          return {
            note: fullNote,
            notes: updatedNotes,
            activeTabId: existingTab.id,
          };
        }
        const newTab: Tab = {
          id: fullNote.id,
          noteId: fullNote.id,
          project: "",
          createdAt: new Date(),
          order: state.tabs.length,
        };
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
