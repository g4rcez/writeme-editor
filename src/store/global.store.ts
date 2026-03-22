import { createGlobalReducer } from "use-typed-reducer";
import { uuid } from "@g4rcez/components";
import { editorGlobalRef } from "@/app/editor-global-ref";
import { isElectron } from "@/lib/is-electron";
import { CursorPositionStore } from "./cursor-position.store";
import { Note } from "./note";
import { repositories } from "./repositories";
import { Tab } from "./repositories/entities/tab";
import { NoteGroup } from "./repositories/entities/note-group";
import { NoteGroupMember } from "./repositories/entities/note-group-member";
import { uiDispatch } from "./ui.store";
import { SettingsService } from "./settings";
import { type Toggle } from "./types";

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

export type Theme = "light" | "dark" | "catppuccin-mocha" | "tokyonight-night";

const THEME_CLASSES = ["dark", "catppuccin-mocha", "tokyonight-night"] as const;

type State = {
  tabs: Tab[];
  noteGroups: NoteGroup[];
  noteGroupMembers: NoteGroupMember[];
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
  inspectJsonDialog: boolean;
  inspectJsonInitialContent: string | null;
  aiContext: AiContext | null;
  directoryBrowserDialog: boolean;
  directory: string | null;
  explorerRoot: string | null;
  createVariableDialog: { isOpen: boolean };
  createTemplateDialog: { isOpen: boolean };
  aiDrawer: { isOpen: boolean; chatId: string | null };
  terminalVisible: boolean;
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
  noteGroups: [] as NoteGroup[],
  noteGroupMembers: [] as NoteGroupMember[],
  notes: [] as Note[],
  readItLaterDialog: false,
  recentNotesDialog: false,
  inspectJsonDialog: false,
  inspectJsonInitialContent: null,
  note: null as Note | null,
  recentNotes: [] as Note[],
  directoryBrowserDialog: false,
  directory: null,
  explorerRoot: null,
  theme: "dark" as "light" | "dark",
  editorFontSize: 16,
  sidebarWidth: 208,
  isSidebarCollapsed: false,
  activeTabId: null as string | null,
  aiDrawer: { isOpen: false, chatId: null },
  terminalVisible: false,
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
        directory: string | null,
        explorerRoot: string | null,
      ) => {
        THEME_CLASSES.forEach((c) =>
          document.documentElement.classList.remove(c),
        );
        if (theme !== "light") document.documentElement.classList.add(theme);
        return {
          tabs,
          theme,
          editorFontSize,
          sidebarWidth,
          isSidebarCollapsed,
          directory,
          explorerRoot,
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
      hideSidebar: () => {
        SettingsService.save({ isSidebarCollapsed: false });
        return { isSidebarCollapsed: false };
      },
      recentNotesDialog: (recentNotesDialog: boolean) => ({
        recentNotesDialog,
      }),
      setInspectJsonDialog: (
        inspectJsonDialog: boolean,
        content?: string | null,
      ) => ({
        inspectJsonDialog,
        inspectJsonInitialContent: content ?? null,
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
      toggleTerminal: () => {
        return { terminalVisible: !get.state().terminalVisible };
      },
      setTerminalVisible: (terminalVisible: boolean) => ({ terminalVisible }),
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
      clearTabs: async () => {
        await repositories.tabs.clear();
        return { tabs: [], activeTabId: null, note: null };
      },
      switchWorkspace: async (directory: string | null) => {
        await repositories.tabs.clear();
        await SettingsService.save({
          directory,
          explorerRoot: directory,
        });
        if (isElectron() && directory) {
          await window.electronAPI.app.chdir(directory);
          await window.electronAPI.fs.startWatcher(directory);
        }
        window.location.reload();
        return get.state();
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
        await repositories.tabs.delete(id);
        const indexToDelete = state.tabs.findIndex((x) => x.id === id);
        const tabs = state.tabs.filter((x) => x.id !== id);
        const tab: Tab | null = tabs.at(indexToDelete - 1) ?? tabs[0] ?? null;
        return { tabs, activeTabId: tab?.id ?? null };
      },
      removeTabByNoteId: async (noteId: string) => {
        const state = get.state();
        await repositories.tabs.deleteByNoteId(noteId);
        const tabs = state.tabs.filter((x) => x.noteId !== noteId);
        const activeTabId =
          state.activeTabId === noteId
            ? (tabs[0]?.id ?? null)
            : state.activeTabId;
        return { tabs, activeTabId };
      },
      deleteNote: async (id: string) => {
        const state = get.state();
        await repositories.notes.delete(id);
        await repositories.noteGroupMembers.deleteByNoteId(id);
        const tabs = state.tabs.filter((x) => x.noteId !== id);
        const activeTabId =
          state.activeTabId === id ? (tabs[0]?.id ?? null) : state.activeTabId;
        const notes = state.notes.filter((n) => n.id !== id);
        const note = state.note?.id === id ? null : state.note;
        const noteGroupMembers = state.noteGroupMembers.filter(
          (m) => m.noteId !== id,
        );
        return { notes, tabs, activeTabId, note, noteGroupMembers };
      },
      updateNoteContent: async (id: string, content: string) => {
        try {
          await repositories.notes.updateContent(id, content);
          const state = get.state();
          const updatedAt = new Date();
          const notes = state.notes.map((n) =>
            n.id === id ? Note.parse({ ...n, content, updatedAt }) : n,
          );
          const note =
            state.note?.id === id
              ? Note.parse({ ...state.note, content, updatedAt })
              : state.note;
          return { notes: notes ?? [], note: note ?? null };
        } catch (error: any) {
          uiDispatch.setError(error.message || "Failed to update note content");
          return get.state();
        }
      },
      theme: (theme: Toggle<string>) => {
        const result =
          typeof theme === "function" ? theme(get.state().theme) : theme;
        THEME_CLASSES.forEach((c) =>
          document.documentElement.classList.remove(c),
        );
        if (result !== "light") document.documentElement.classList.add(result);
        SettingsService.save({ theme: result as Theme });
        return { theme: result as Theme };
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
      loadGroups: async () => {
        const [noteGroups, noteGroupMembers] = await Promise.all([
          repositories.noteGroups.getAll(),
          repositories.noteGroupMembers.getAll(),
        ]);
        return { noteGroups, noteGroupMembers };
      },
      createGroup: async (title: string, description?: string) => {
        const now = new Date();
        const group = new NoteGroup(
          uuid(),
          title,
          description ?? null,
          now,
          now,
        );
        await repositories.noteGroups.save(group);
        const state = get.state();
        return { noteGroups: state.noteGroups.concat(group) };
      },
      deleteGroup: async (id: string) => {
        await repositories.noteGroupMembers.deleteByGroupId(id);
        await repositories.noteGroups.delete(id);
        const state = get.state();
        return {
          noteGroups: state.noteGroups.filter((g) => g.id !== id),
          noteGroupMembers: state.noteGroupMembers.filter(
            (m) => m.groupId !== id,
          ),
        };
      },
      updateGroup: async (
        id: string,
        partial: Partial<Pick<NoteGroup, "title" | "description">>,
      ) => {
        const state = get.state();
        const existing = state.noteGroups.find((g) => g.id === id);
        if (!existing) return state;
        const updated = {
          ...existing,
          ...partial,
          updatedAt: new Date(),
        } as NoteGroup;
        await repositories.noteGroups.save(updated);
        return {
          noteGroups: state.noteGroups.map((g) => (g.id === id ? updated : g)),
        };
      },
      addNoteToGroup: async (groupId: string, noteId: string) => {
        const state = get.state();
        const alreadyMember = state.noteGroupMembers.some(
          (m) => m.groupId === groupId && m.noteId === noteId,
        );
        if (alreadyMember) return state;
        const existing = state.noteGroupMembers.filter(
          (m) => m.groupId === groupId,
        );
        const maxOrder = existing.reduce(
          (max, m) => Math.max(max, m.order),
          -1,
        );
        const now = new Date();
        const member = new NoteGroupMember(
          uuid(),
          groupId,
          noteId,
          maxOrder + 1,
          now,
          now,
        );
        await repositories.noteGroupMembers.save(member);
        return { noteGroupMembers: state.noteGroupMembers.concat(member) };
      },
      removeNoteFromGroup: async (groupId: string, noteId: string) => {
        const state = get.state();
        const member = state.noteGroupMembers.find(
          (m) => m.groupId === groupId && m.noteId === noteId,
        );
        if (!member) return state;
        await repositories.noteGroupMembers.delete(member.id);
        return {
          noteGroupMembers: state.noteGroupMembers.filter(
            (m) => !(m.groupId === groupId && m.noteId === noteId),
          ),
        };
      },
      reorderGroupMembers: async (
        groupId: string,
        members: NoteGroupMember[],
      ) => {
        const state = get.state();
        await repositories.noteGroupMembers.reorder(groupId, members);
        return {
          noteGroupMembers: state.noteGroupMembers
            .filter((m) => m.groupId !== groupId)
            .concat(members),
        };
      },
    } as const;
  },
);

export const globalState = useGlobalStore.getState;

export const globalDispatch = useGlobalStore.dispatchers;

export { repositories };
