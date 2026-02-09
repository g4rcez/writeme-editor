import { createGlobalReducer } from "use-typed-reducer";
import { editorGlobalRef } from "../app/editor-global-ref";
import { CursorPositionStore } from "./cursor-position.store";
import { NotesRepository } from "./repositories/dexie/notes.repository";
import { TabsRepository } from "./repositories/dexie/tabs.repository";
import { Note } from "./note";
import { Tab } from "./repositories/dexie/dexie-db";

const state = JSON.parse(
  window.localStorage.getItem("EDITOR_PREFERENCES") || "{}",
);

const initialState = {
  help: false,
  commander: false,
  tabs: [] as Tab[],
  notes: [] as Note[],
  recentNotesDialog: false,
  recentNotes: [] as Note[],
  directoryBrowserDialog: false,
  theme: state.theme || ("dark" as "light" | "dark"),
  activeTabId: (state.activeTabId || null) as string | null,
  note: (state.note ? Note.parse(state.note) || null : null) as Note | null,
};

type Toggle<T> = T | ((prev: T) => T);

export const repositories = {
  notes: new NotesRepository(),
  tabs: new TabsRepository(),
};

export const useGlobalStore = createGlobalReducer(
  initialState,
  (get) => ({
    tabs: (tabs: Tab[]) => ({ tabs }),
    setNote: (note: Note | null) => ({ note }),
    recentNotes: (recentNotes: Note[]) => ({ recentNotes }),
    activeTabId: (activeTabId: string | null) => ({ activeTabId }),
    help: (help: boolean) => ({ help }),
    commander: (commander: boolean) => ({ commander }),
    recentNotesDialog: (recentNotesDialog: boolean) => ({ recentNotesDialog }),
    loadRecentNotes: async (limit = 20) => {
      const recent = await repositories.notes.getRecentNotes(limit);
      return { recentNotes: recent };
    },
    loadTabs: async () => {
      const tabs = await repositories.tabs.getAll();
      return { tabs };
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
      await repositories.notes.update(note.id, note);
      const state = get.state();
      const existingTab = state.tabs.find((t) => t.noteId === note.id);
      const existsInNotes = state.notes.some((n) => n.id === note.id);
      const updatedNotes = existsInNotes
        ? state.notes.map((n) => (n.id === note.id ? note : n))
        : [...state.notes, note];
      if (existingTab) {
        return { note: note, notes: updatedNotes, activeTabId: existingTab.id };
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
    notes: (notes: Note[]) => {
      const state = get.state();
      const existingNotesMap = new Map(state.notes.map((n) => [n.id, n]));
      const mergedNotes = notes.map((note) => {
        const existing = existingNotesMap.get(note.id);
        if (existing) {
          if (existing.updatedAt > note.updatedAt) {
            return existing;
          }
          if (existing.content && !note.content) {
            return { ...note, content: existing.content };
          }
        }
        return note;
      });
      return { notes: mergedNotes };
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
      if (currentTabs.length === 1) return state;
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
      if (nextActiveTabId === tabId) {
        const index = currentTabs.findIndex((t) => t.id === tabId);
        if (newTabs.length === 0) {
          nextActiveTabId = null;
        } else if (index < newTabs.length) {
          nextActiveTabId = newTabs[index].id;
        } else {
          nextActiveTabId = newTabs[newTabs.length - 1].id;
        }
      }
      return {
        tabs: newTabs,
        activeTabId: nextActiveTabId,
      };
    },
    theme: (theme: Toggle<string>) => {
      const result =
        typeof theme === "function" ? theme(get.state().theme) : theme;
      if (result === "dark") document.documentElement.classList.add("dark");
      if (result === "light") document.documentElement.classList.remove("dark");
      return { theme: result };
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
      const fullNote = await repositories.notes.getOne(noteId);
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
  }),
  {
    interceptor: [
      (state) => {
        window.localStorage.setItem(
          "EDITOR_PREFERENCES",
          JSON.stringify(state),
        );
        return state;
      },
    ],
  },
);

export const globalState = useGlobalStore.getState;

export const globalDispatch = useGlobalStore.dispatchers;
