import { createGlobalReducer } from "use-typed-reducer";
import { editorGlobalRef } from "@/app/editor-global-ref";
import { CursorPositionStore } from "./cursor-position.store";
import { Note } from "./note";
import { repositories } from "./repositories";
import { Tab } from "./repositories/entities/tab";
import { uiDispatch } from "./ui.store";
import { SettingsService } from "./settings";

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
  editorFontSize: number;
  sidebarWidth: number;
  isSidebarCollapsed: boolean;
  recentNotes: Note[];
  commander: Commander;
  activeTabId: string | null;
  readItLaterDialog: boolean;
  recentNotesDialog: boolean;
  aiContext: AiContext | null;
  directoryBrowserDialog: boolean;
  createVariableDialog: { isOpen: boolean };
  createTemplateDialog: { isOpen: boolean };
  aiDrawer: { isOpen: boolean; chatId: string | null };
  createNoteDialog: {
    isOpen: boolean;
    type: NoteCreationType;
    templateId?: string;
  };
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
  editorFontSize: 16,
  sidebarWidth: 208,
  isSidebarCollapsed: false,
  activeTabId: null as string | null,
  aiDrawer: { isOpen: false, chatId: null },
  commander: { enabled: false, type: CommanderType.All } as Commander,
  createTemplateDialog: { isOpen: false },
  createVariableDialog: { isOpen: false },
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
      note: Note,
      createTabIfMissing: boolean = true,
    ) => {
      const state = get.state();
      if (state.activeTabId === note.id && state.note === note) {
        return state;
      }
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
        return { note: note, notes: updatedNotes };
      }
      const newTab = createTab(note.id);
      await repositories.tabs.save(newTab);
      return {
        note: note,
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
      init: (
        theme: Theme,
        notes: Note[],
        tabs: Tab[],
        editorFontSize: number,
        sidebarWidth: number,
        isSidebarCollapsed: boolean,
      ) => {
        if (theme === "dark") document.documentElement.classList.add("dark");
        if (theme === "light")
          document.documentElement.classList.remove("dark");
        return {
          tabs,
          theme,
          editorFontSize,
          sidebarWidth,
          isSidebarCollapsed,
          notes: setNotes(notes).notes,
        };
      },
      setEditorFontSize: (editorFontSize: number) => {
        SettingsService.save({ editorFontSize });
        return { editorFontSize };
      },
      setSidebarWidth: (sidebarWidth: number) => {
        SettingsService.save({ sidebarWidth });
        return { sidebarWidth };
      },
      setSidebarCollapsed: (isSidebarCollapsed: boolean) => {
        SettingsService.save({ isSidebarCollapsed });
        return { isSidebarCollapsed };
      },
      toggleSidebar: () => {
        const isSidebarCollapsed = !get.state().isSidebarCollapsed;
        SettingsService.save({ isSidebarCollapsed });
        return { isSidebarCollapsed };
      },
      recentNotesDialog: (recentNotesDialog: boolean) => ({
        recentNotesDialog,
      }),
      readItLaterDialog: (readItLaterDialog: boolean) => ({
        readItLaterDialog,
      }),
      setCreateNoteDialog: (createNoteDialog: {
        isOpen: boolean;
        type: NoteCreationType;
        templateId?: string;
      }) => ({ createNoteDialog }),
      setCreateTemplateDialog: (isOpen: boolean) => ({
        createTemplateDialog: { isOpen },
      }),
      setCreateVariableDialog: (isOpen: boolean) => ({
        createVariableDialog: { isOpen },
      }),
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
        return { activeTabId: newTab.id, tabs: currentTabs.concat(newTab) };
      },
      removeTab: async (id: string) => {
        const state = get.state();
        const indexToDelete = state.tabs.findIndex((x) => x.id === id);
        const tabs = state.tabs.filter((x) => x.id !== id);
        const tab: Tab | null = tabs.at(indexToDelete - 1) || tabs[0];
        return { tabs, activeTabId: tab?.id ?? null };
      },
      theme: (theme: Toggle<string>) => {
        const result =
          typeof theme === "function" ? theme(get.state().theme) : theme;
        if (result === "dark") document.documentElement.classList.add("dark");
        if (result === "light")
          document.documentElement.classList.remove("dark");
        SettingsService.save({ theme: result as "light" | "dark" });
        return { theme: result as "light" | "dark" };
      },
      selectNoteById: async (noteId: string) => {
        const state = get.state();
        if (state.note) {
          saveCursorPosition(state.note.id);
        }
        const note = await repositories.notes.getOne(noteId);
        if (!note) {
          uiDispatch.setError("Failed to load note");
          return state;
        }
        return selectOrAddTab(note);
      },
    } as const;
  },
);

export const globalState = useGlobalStore.getState;

export const globalDispatch = useGlobalStore.dispatchers;

export { repositories };
