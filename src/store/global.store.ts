import { uuid } from "@g4rcez/components";
import { createGlobalReducer } from "use-typed-reducer";
import { editorGlobalRef } from "../app/editor-global-ref";
import { CursorPositionStore } from "./cursor-position.store";
import { Note } from "./note";
import { repositories } from "./repositories";
import { Tab } from "./repositories/entities/tab";
import { uiDispatch } from "./ui.store";

type Toggle<T> = T | ((prev: T) => T);

export type NoteCreationType = "note" | "quick";

export enum CommanderType {
  All = "all",
  Notes = "Notes",
}

export type Commander = { enabled: boolean; type: CommanderType };

export type AiContext = {
  context: string;
  selection: string;
  selectionSlice: { from: number; to: number } | null;
};

export type Theme = "light" | "dark";

type State = {
  tabs: Tab[];
  theme: Theme;
  help: boolean;
  notes: Note[];
  note: Note | null;
  recentNotes: Note[];
  commander: Commander;
  activeTabId: string | null;
  readItLaterDialog: boolean;
  recentNotesDialog: boolean;
  aiContext: AiContext | null;
  directoryBrowserDialog: boolean;
  aiDrawer: { isOpen: boolean; chatId: string | null };
  createNoteDialog: { isOpen: boolean; type: NoteCreationType };
};

const initialState: State = {
  help: false,
  aiContext: null,
  tabs: [] as Tab[],
  notes: [] as Note[],
  readItLaterDialog: false,
  recentNotesDialog: false,
  note: null as Note | null,
  recentNotes: [] as Note[],
  directoryBrowserDialog: false,
  theme: "dark" as "light" | "dark",
  activeTabId: null as string | null,
  aiDrawer: { isOpen: false, chatId: null },
  commander: { enabled: false, type: CommanderType.All } as Commander,
  createNoteDialog: { isOpen: false, type: "note" as NoteCreationType },
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
          if (existing.updatedAt > note.updatedAt) return existing as Note;
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
        : state.notes.concat(note);
    };

    const createTab = (noteId: string): Tab => {
      const state = get.state();
      const now = new Date();
      return {
        noteId,
        project: "",
        type: "tab",
        createdAt: now,
        updatedAt: now,
        id: noteId, // Use noteId as the ID directly
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

    const selectOrAddTab = async (
      fullNote: Note,
      createTabIfMissing: boolean = true,
    ) => {
      const state = get.state();

      // Optimization: If this note is already active, just return current state
      // This prevents infinite loops if the router and store call each other
      if (state.activeTabId === fullNote.id && state.note?.id === fullNote.id) {
        return {};
      }

      const existingTab = state.tabs.find((t) => t.noteId === fullNote.id);
      const updatedNotes = updateNoteInList(fullNote);

      if (existingTab) {
        return {
          note: fullNote,
          notes: updatedNotes,
          activeTabId: existingTab.id,
        };
      }

      if (!createTabIfMissing) {
        return { note: fullNote, notes: updatedNotes };
      }

      const newTab = createTab(fullNote.id);
      await repositories.tabs.save(newTab);

      return {
        note: fullNote,
        notes: updatedNotes,
        activeTabId: newTab.id,
        tabs: state.tabs.concat(newTab),
      };
    };

    return {
      notes: setNotes,
      tabs: (tabs: Tab[]) => ({ tabs }),
      help: (help: boolean) => ({ help }),
      setNote: (note: Note | null) => ({ note }),
      syncNoteState: (note: Note) => {
        const state = get.state();
        const updatedNotes = state.notes.map((n) =>
          n.id === note.id ? note : n,
        );
        return {
          note,
          notes: updatedNotes,
        };
      },
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
      setAiDrawer: (
        aiDrawer: Toggle<{ isOpen: boolean; chatId: string | null }>,
      ) => {
        const result =
          typeof aiDrawer === "function"
            ? aiDrawer(get.state().aiDrawer)
            : aiDrawer;
        return { aiDrawer: result };
      },
      setAiContext: (aiContext: AiContext) => ({ aiContext }),
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
        return selectOrAddTab(note, createTabIfMissing);
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
        const currentTabs = Array.from(state.tabs);
        const index = currentTabs.findIndex((t) => t.id === tabId);
        if (index === -1) {
          return state;
        }
        const tab = currentTabs[index];
        if (state.activeTabId === tabId) {
          saveCursorPosition(tab.noteId);
        }
        const newTabs = currentTabs.filter((t) => t.id !== tabId);
        await repositories.tabs.delete(tabId);
        const orderedTabs = newTabs.map((t, i) => ({ ...t, order: i }));
        if (orderedTabs.length > 0) {
          await repositories.tabs.updateOrder(orderedTabs);
        }
        let nextActiveTabId = state.activeTabId;
        let nextNote = state.note;
        if (state.activeTabId === tabId) {
          if (newTabs.length === 0) {
            nextActiveTabId = null;
            nextNote = null;
          } else {
            const nextTab = newTabs[index] || newTabs[index - 1];
            nextActiveTabId = nextTab.id;
            if (nextTab) {
              nextNote =
                state.notes.find((n) => n.id === nextTab.noteId) || null;
            } else {
              nextActiveTabId = null;
              nextNote = null;
            }
          }
        }
        return {
          note: nextNote,
          tabs: orderedTabs,
          activeTabId: nextActiveTabId,
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
        return selectOrAddTab(fullNote);
      },
    } as const;
  },
);

export const globalState = useGlobalStore.getState;

export const globalDispatch = useGlobalStore.dispatchers;

export { repositories };
