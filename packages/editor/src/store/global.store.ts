import { v7 as uuid } from "uuid";
import { Dates } from "@/lib/dates";
import { isElectron } from "@/lib/is-electron";
import { getJournalDate } from "@/lib/journal-date";
import { rememberClosedTab } from "@/lib/recently-closed-tabs";
import { getPreviousTabAfterClose } from "@/lib/tab-closing";
import {
  AI_CHAT_TAB_TYPE,
  NOTE_TAB_TYPE,
  TERMINAL_TAB_TYPE,
  getTabTargetKeyForTab,
  isAiChatTab,
  isNoteTabForNoteId,
  isTerminalTab,
} from "@/lib/tab-target";
import { Note } from "./note";
import type { Tab } from "./repositories/entities/tab";
import type { Toggle } from "./types";
import { repositories } from "./repositories";
import { NoteGroup } from "./repositories/entities/note-group";
import { NoteGroupMember } from "./repositories/entities/note-group-member";
import { type TerminalSession, TERMINAL_SESSION_ENTITY_TYPE } from "./repositories/entities/terminal-session";
import { requireFeature } from "@/lib/build-features";
import { SettingsService } from "./settings";
import { uiDispatch } from "./ui.store";
import { createZustandCompatStore } from "./zustand-compat";
import { createTabPersistenceQueue } from "./tab-persistence";

export type NoteCreationType = "note" | "quick" | "freehand" | "excalidraw" | "meeting-note" | "pdf" | "task";

const LOCAL_WORKSPACE_KEY = "__local__";

const tabPersistence = createTabPersistenceQueue(() => {
  uiDispatch.setConfirm({
    open: true,
    type: "danger",
    title: "Tab changes not saved",
    message: "Tab changes are pending. Retry saving before closing or switching workspaces. Your note content is not affected.",
    confirmText: "Retry saving",
    cancelText: "Keep pending",
    onConfirm: () => {
      uiDispatch.clearConfirm();
      tabPersistence.retry();
    },
    onCancel: () => uiDispatch.clearConfirm(),
  });
});

export const flushTabPersistence = (): Promise<void> => tabPersistence.flush();
export const hasPendingTabPersistence = (): boolean => tabPersistence.hasPending();

export function getWorkspaceKey(directory: string | null): string {
  return directory && directory.trim().length > 0 ? directory : LOCAL_WORKSPACE_KEY;
}

const getTabCreatedTime = (tab: Tab): number =>
  tab.createdAt instanceof Date ? tab.createdAt.getTime() : new Date(tab.createdAt).getTime();

export function normalizeWorkspaceTabs(tabs: Tab[], workspaceKey: string): { tabs: Tab[]; duplicateTabs: Tab[] } {
  const sortedTabs = [...tabs].sort((a, b) => {
    const projectDifference = Number(b.project === workspaceKey) - Number(a.project === workspaceKey);
    if (projectDifference !== 0) return projectDifference;
    const orderDifference = a.order - b.order;
    if (orderDifference !== 0) return orderDifference;
    return getTabCreatedTime(a) - getTabCreatedTime(b);
  });
  const tabsByTarget = new Map<string, Tab>();
  const duplicateTabs: Tab[] = [];

  for (const tab of sortedTabs) {
    const normalizedTab = { ...tab, project: workspaceKey };
    const targetKey = getTabTargetKeyForTab(normalizedTab);
    const existingTab = tabsByTarget.get(targetKey);
    if (!existingTab) {
      tabsByTarget.set(targetKey, normalizedTab);
      continue;
    }

    duplicateTabs.push(tab);
  }

  const normalizedTabs = Array.from(tabsByTarget.values()).map((tab, order) =>
    tab.order === order ? tab : { ...tab, order },
  );

  return { tabs: normalizedTabs, duplicateTabs };
}

export enum CommanderType {
  All = "all",
  Notes = "Notes",
  OpenTabs = "OpenTabs",
}

export type CommanderState = { enabled: boolean; type: CommanderType };

export type AiContext = {
  context: string;
  selection: string;
  selectionSlice: { from: number; to: number } | null;
};

export type Theme = "light" | "dark" | "catppuccin-mocha" | "tokyonight-night" | "native";

const THEME_CLASSES = ["dark", "catppuccin-mocha", "tokyonight-night", "native"] as const;

type State = {
  tabs: Tab[];
  theme: Theme;
  help: boolean;
  notes: Note[];
  note: Note | null;
  recentNotes: Note[];
  trashOutcome: { deleted: number; failed: number };
  commander: CommanderState;
  sidebarWidth: number;
  editorFontSize: number;
  homedir: string | null;
  noteGroups: NoteGroup[];
  directory: string | null;
  terminalSessions: TerminalSession[];
  restoredTerminalSessionIds: string[];
  terminalVisible: boolean;
  addToGroupDialog: boolean;
  activeTabId: string | null;
  inspectJsonDialog: boolean;
  readItLaterDialog: boolean;
  recentNotesDialog: boolean;
  aiContext: AiContext | null;
  explorerRoot: string | null;
  directoryBrowserDialog: boolean;
  noteGroupMembers: NoteGroupMember[];
  inspectJsonInitialContent: string | null;
  createTemplateDialog: { isOpen: boolean };
  createVariableDialog: { isOpen: boolean };
  aiDrawer: { isOpen: boolean; chatId: string | null };
  createNoteDialog: {
    isOpen: boolean;
    templateId?: string;
    initialTitle?: string;
    type: NoteCreationType;
  };
};

const initialState: State = {
  help: false,
  homedir: null,
  aiContext: null,
  directory: null,
  sidebarWidth: 320,
  tabs: [] as Tab[],
  editorFontSize: 16,
  explorerRoot: null,
  notes: [] as Note[],
  terminalVisible: false,
  addToGroupDialog: false,
  inspectJsonDialog: false,
  readItLaterDialog: false,
  recentNotesDialog: false,
  note: null as Note | null,
  recentNotes: [] as Note[],
  trashOutcome: { deleted: 0, failed: 0 },
  directoryBrowserDialog: false,
  noteGroups: [] as NoteGroup[],
  terminalSessions: [] as TerminalSession[],
  restoredTerminalSessionIds: [] as string[],
  inspectJsonInitialContent: null,
  theme: "dark" as Theme,
  activeTabId: null as string | null,
  createTemplateDialog: { isOpen: false },
  createVariableDialog: { isOpen: false },
  aiDrawer: { isOpen: false, chatId: null },
  noteGroupMembers: [] as NoteGroupMember[],
  commander: { enabled: false, type: CommanderType.All } as CommanderState,
  createNoteDialog: { isOpen: false, type: "note" as NoteCreationType },
};

export const loadHomedir = async (): Promise<string | null> => {
  if (!isElectron() || typeof window === "undefined") return null;
  try {
    return (await window.electronAPI?.env?.getHome?.()) ?? null;
  } catch (error) {
    console.warn("Failed to load home directory:", error);
    return null;
  }
};
export const useGlobalStore = createZustandCompatStore(initialState, (get) => {
  let tabSelectionVersion = 0;

  const setNotes = (notes: Note[]) => {
    const existingNotesMap = new Map<string, Note>(get.state().notes.map((note) => [note.id, note]));
    const mergedNotesMap = new Map<string, Note>();
    for (const note of notes) {
      const existing = existingNotesMap.get(note.id);
      const current = mergedNotesMap.get(note.id);
      let freshest = note;
      if (existing && existing.updatedAt > freshest.updatedAt) freshest = existing;
      if (current && current.updatedAt > freshest.updatedAt) freshest = current;
      mergedNotesMap.set(note.id, freshest);
    }
    return { notes: Array.from(mergedNotesMap.values()) };
  };

  const updateNoteInList = (note: Note) => {
    const state = get.state();
    const existsInNotes = state.notes.some((n) => n.id === note.id);
    return existsInNotes ? state.notes.map((n) => (n.id === note.id ? note : n)) : state.notes.concat(note);
  };

  const createTab = (noteId: string, type = NOTE_TAB_TYPE): Tab => {
    const state = get.state();
    let order = 0;
    for (const tab of state.tabs) {
      order = Math.max(order, tab.order + 1);
    }
    const now = new Date();
    return {
      noteId,
      project: getWorkspaceKey(state.directory),
      type,
      createdAt: now,
      updatedAt: now,
      id: uuid(),
      order,
      scrollY: 0,
    };
  };

  const getNextTerminalTitle = (sessions: TerminalSession[]): string => {
    const titles = new Set(sessions.map((session) => session.title.trim()));
    if (!titles.has("Terminal")) return "Terminal";

    let suffix = 2;
    while (titles.has(`Terminal ${suffix}`)) {
      suffix += 1;
    }
    return `Terminal ${suffix}`;
  };

  const createTerminalSession = (sessionId: string): TerminalSession => {
    const state = get.state();
    const now = new Date();
    return {
      id: sessionId,
      title: getNextTerminalTitle(state.terminalSessions),
      project: getWorkspaceKey(state.directory),
      type: TERMINAL_SESSION_ENTITY_TYPE,
      createdAt: now,
      updatedAt: now,
    };
  };

  const selectTerminalTab = (session: TerminalSession, persistSession: boolean) => {
    const state = get.state();
    const terminalSessions = state.terminalSessions.some((item) => item.id === session.id)
      ? state.terminalSessions
      : state.terminalSessions.concat(session);
    const existingTab = state.tabs.find((tab) => isTerminalTab(tab) && tab.noteId === session.id);
    if (existingTab) {
      if (persistSession) tabPersistence.enqueue(() => repositories.terminalSessions.save(session));
      return { activeTabId: existingTab.id, terminalSessions };
    }
    const newTab = createTab(session.id, TERMINAL_TAB_TYPE);
    tabPersistence.enqueue(async () => {
      if (persistSession) await repositories.terminalSessions.save(session);
      await repositories.tabs.save(newTab);
    });
    return { activeTabId: newTab.id, tabs: state.tabs.concat(newTab), terminalSessions };
  };

  const selectOrAddTab = (note: Note, createTabIfMissing: boolean = true) => {
    tabSelectionVersion += 1;
    const state = get.state();
    const existingTab = state.tabs.find((t) => isNoteTabForNoteId(t, note.id));
    if (state.activeTabId === existingTab?.id && state.note === note) return {};
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
    tabPersistence.enqueue(() => repositories.tabs.save(newTab));
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
    recentNotes: (recentNotes: Note[]) => ({ recentNotes }),
    activeTabId: (activeTabId: string | null) => ({ activeTabId }),
    commander: (enabled: boolean, type?: CommanderType) => ({
      commander: { enabled, type: type || CommanderType.All },
    }),
    syncNoteState: (note: Note) => {
      const state = get.state();
      const updatedNotes = state.notes.map((n) => (n.id === note.id ? note : n));
      return {
        note,
        notes: updatedNotes,
      };
    },
    syncNoteFromRepository: (note: Note) => {
      const state = get.state();
      return {
        note: state.note?.id === note.id ? note : state.note,
        notes: updateNoteInList(note),
      };
    },
    init: async (
      theme: Theme,
      notes: Note[],
      tabs: Tab[],
      editorFontSize: number,
      sidebarWidth: number,
      directory: string | null,
      explorerRoot: string | null,
      terminalSessions: TerminalSession[],
    ) => {
      for (const className of THEME_CLASSES) {
        document.documentElement.classList.remove(className);
      }
      if (theme !== "light") document.documentElement.classList.add(theme);
      const homedir = await loadHomedir();
      return {
        tabs,
        theme,
        editorFontSize,
        sidebarWidth,
        homedir,
        directory,
        explorerRoot,
        terminalSessions,
        restoredTerminalSessionIds: terminalSessions.map((session) => session.id),
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
    recentNotesDialog: (recentNotesDialog: boolean) => ({
      recentNotesDialog,
    }),
    setInspectJsonDialog: (inspectJsonDialog: boolean, content?: string | null) => ({
      inspectJsonDialog,
      inspectJsonInitialContent: content ?? null,
    }),
    readItLaterDialog: (readItLaterDialog: boolean) => ({
      readItLaterDialog,
    }),
    setAddToGroupDialog: (addToGroupDialog: boolean) => ({
      addToGroupDialog,
    }),
    setCreateNoteDialog: (createNoteDialog: {
      isOpen: boolean;
      type: NoteCreationType;
      templateId?: string;
      initialTitle?: string;
    }) => {
      if (createNoteDialog.isOpen && createNoteDialog.type === "meeting-note") requireFeature("meetingNotes");
      return { createNoteDialog };
    },
    setCreateTemplateDialog: (isOpen: boolean) => ({
      createTemplateDialog: { isOpen },
    }),
    setCreateVariableDialog: (isOpen: boolean) => ({
      createVariableDialog: { isOpen },
    }),
    setAiDrawer: (aiDrawer: Toggle<{ isOpen: boolean; chatId: string | null }>) => {
      const result = typeof aiDrawer === "function" ? aiDrawer(get.state().aiDrawer) : aiDrawer;
      return { aiDrawer: result };
    },
    toggleTerminal: () => {
      return { terminalVisible: !get.state().terminalVisible };
    },
    setTerminalVisible: (terminalVisible: boolean) => ({ terminalVisible }),
    setAiContext: (aiContext: AiContext | null) => ({ aiContext }),
    loadRecentNotes: async (limit = 20) => {
      const recent = await repositories.notes.getAll({ limit });
      return { recentNotes: recent };
    },
    reorderTabs: (tabs: Tab[]) => {
      const current = get.state().tabs;
      const byId = new Map(current.map((tab) => [tab.id, tab]));
      const ordered: Tab[] = [];
      for (const tab of tabs) {
        const existing = byId.get(tab.id);
        if (!existing) continue;
        ordered.push(existing);
        byId.delete(tab.id);
      }
      const updatedTabs = [...ordered, ...byId.values()].map((t, i) => ({ ...t, order: i }));
      tabPersistence.enqueue(() => repositories.tabs.updateOrder(updatedTabs));
      return { tabs: updatedTabs };
    },
    clearTabs: () => {
      tabSelectionVersion += 1;
      const state = get.state();
      tabPersistence.enqueue(async () => {
        for (const tab of state.tabs) {
          await repositories.tabs.delete(tab.id);
          if (isTerminalTab(tab)) await repositories.terminalSessions.delete(tab.noteId);
        }
      });
      return {
        tabs: [],
        activeTabId: null,
        note: null,
        terminalSessions: state.terminalSessions.filter(
          (session) => !state.tabs.some((tab) => isTerminalTab(tab) && tab.noteId === session.id),
        ),
      };
    },
    switchWorkspace: async (directory: string | null) => {
      tabSelectionVersion += 1;
      await flushTabPersistence();
      await SettingsService.save({
        directory,
        explorerRoot: directory,
      });
      if (isElectron()) {
        await window.electronAPI.app.setLaunchWorkspace(directory);
      }
      if (isElectron() && directory) {
        await window.electronAPI.app.chdir(directory);
        await window.electronAPI.fs.startWatcher(directory);
      }
      await flushTabPersistence();
      window.location.reload();
      return get.state();
    },
    directoryBrowserDialog: (directoryBrowserDialog: boolean) => ({
      directoryBrowserDialog,
    }),
    note: async (note: Note, createTabIfMissing: boolean = true): Promise<void> => {
      try {
        await repositories.notes.update(note.id, note);
      } catch (error: any) {
        uiDispatch.setError(error.message || "Failed to update note");
        return;
      }
      get.patch(selectOrAddTab(note, createTabIfMissing));
    },
    addTab: (noteId: string) => {
      tabSelectionVersion += 1;
      const currentTabs = get.state().tabs;
      const existingTab = currentTabs.find((t) => isNoteTabForNoteId(t, noteId));
      if (existingTab) {
        return { activeTabId: existingTab.id };
      }
      const newTab = createTab(noteId);
      tabPersistence.enqueue(() => repositories.tabs.save(newTab));
      return { activeTabId: newTab.id, tabs: currentTabs.concat(newTab) };
    },
    addAiChatTab: (chatId: string) => {
      requireFeature("ai");
      tabSelectionVersion += 1;
      const currentTabs = get.state().tabs;
      const existingTab = currentTabs.find((tab) => isAiChatTab(tab) && tab.noteId === chatId);
      if (existingTab) {
        return { activeTabId: existingTab.id };
      }
      const newTab = createTab(chatId, AI_CHAT_TAB_TYPE);
      tabPersistence.enqueue(() => repositories.tabs.save(newTab));
      return { activeTabId: newTab.id, tabs: currentTabs.concat(newTab) };
    },
    ensureTerminalSession: async (sessionId: string): Promise<void> => {
      requireFeature("terminal");
      const state = get.state();
      if (state.terminalSessions.some((item) => item.id === sessionId)) return;
      const existingSession = await repositories.terminalSessions.getOne(sessionId);
      const current = get.state();
      if (current.directory !== state.directory ||
          !current.tabs.some((tab) => isTerminalTab(tab) && tab.noteId === sessionId) ||
          current.terminalSessions.some((item) => item.id === sessionId)) return;
      const session = existingSession ?? createTerminalSession(sessionId);
      if (!existingSession) tabPersistence.enqueue(() => repositories.terminalSessions.save(session));
      get.patch({ terminalSessions: current.terminalSessions.concat(session) });
    },
    addTerminalTab: (sessionId: string) => {
      requireFeature("terminal");
      const version = ++tabSelectionVersion;
      const state = get.state();
      const session = state.terminalSessions.find((item) => item.id === sessionId);
      if (session) return selectTerminalTab(session, false);
      return repositories.terminalSessions.getOne(sessionId).then((existing) => {
        if (version !== tabSelectionVersion || get.state().directory !== state.directory) return;
        get.patch(selectTerminalTab(existing ?? createTerminalSession(sessionId), !existing));
      });
    },
    renameTerminalSession: async (sessionId: string, title: string): Promise<void> => {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) return;

      const state = get.state();
      const version = tabSelectionVersion;
      const session =
        state.terminalSessions.find((item) => item.id === sessionId) ??
        (await repositories.terminalSessions.getOne(sessionId));
      if (!session) return;
      const current = get.state();
      if (current.directory !== state.directory || version !== tabSelectionVersion) return;
      const latest = current.terminalSessions.find((item) => item.id === sessionId) ?? session;
      const updatedSession = { ...latest, title: trimmedTitle, updatedAt: new Date() };
      tabPersistence.enqueue(() => repositories.terminalSessions.save(updatedSession));
      const terminalSessions = current.terminalSessions.some((item) => item.id === sessionId)
        ? current.terminalSessions.map((item) => item.id === sessionId ? updatedSession : item)
        : current.terminalSessions.concat(updatedSession);
      get.patch({ terminalSessions });
    },
    removeTab: (id: string) => {
      tabSelectionVersion += 1;
      const state = get.state();
      const closedTab = state.tabs.find((tab) => tab.id === id);
      tabPersistence.enqueue(async () => {
        await repositories.tabs.delete(id);
        if (closedTab && isTerminalTab(closedTab)) {
          await repositories.terminalSessions.delete(closedTab.noteId);
        }
      });
      if (closedTab) rememberClosedTab(closedTab);
      const tabs = state.tabs.filter((tab) => tab.id !== id);
      const terminalSessions = closedTab
        ? state.terminalSessions.filter(
          (session) => !isTerminalTab(closedTab) || session.id !== closedTab.noteId,
        )
        : state.terminalSessions;
      const isClosingActiveTab = (() => {
        if (!closedTab) return false;
        if (state.activeTabId === id) return true;
        if (isAiChatTab(closedTab) || isTerminalTab(closedTab)) {
          return state.activeTabId === closedTab.noteId;
        }
        return (
          state.activeTabId === closedTab.noteId ||
          (state.activeTabId === null && state.note?.id === closedTab.noteId)
        );
      })();
      if (!isClosingActiveTab) {
        return { tabs, activeTabId: state.activeTabId, terminalSessions };
      }
      const tab = getPreviousTabAfterClose(state.tabs, id);
      return {
        tabs,
        activeTabId: tab?.id ?? null,
        note: null,
        terminalSessions,
      };
    },
    removeTabByNoteId: (noteId: string) => {
      tabSelectionVersion += 1;
      const state = get.state();
      tabPersistence.enqueue(() => repositories.tabs.deleteByNoteId(noteId));
      const tabs = state.tabs.filter((tab) => !isNoteTabForNoteId(tab, noteId));
      const activeTabId =
        state.activeTabId &&
          state.tabs.find((tab) => tab.id === state.activeTabId && isNoteTabForNoteId(tab, noteId))
          ? (tabs[0]?.id ?? null)
          : state.activeTabId;
      const note = state.note?.id === noteId ? null : state.note;
      return { tabs, activeTabId, note };
    },
    deleteNote: async (id: string) => {
      await flushTabPersistence();
      await repositories.notes.delete(id);
      tabPersistence.enqueue(() => repositories.tabs.deleteByNoteId(id));
      tabSelectionVersion += 1;
      const state = get.state();
      const tabs = state.tabs.filter((tab) => !isNoteTabForNoteId(tab, id));
      const activeTabId =
        state.activeTabId &&
          state.tabs.find((tab) => tab.id === state.activeTabId && isNoteTabForNoteId(tab, id))
          ? (tabs[0]?.id ?? null)
          : state.activeTabId;
      const notes = state.notes.filter((n) => n.id !== id);
      const note = state.note?.id === id ? null : state.note;
      return { notes, tabs, activeTabId, note };
    },
    hardDeleteNote: async (id: string) => {
      await flushTabPersistence();
      if (!(await repositories.notes.hardDelete(id))) return {};
      tabPersistence.enqueue(() => repositories.tabs.deleteByNoteId(id));
      tabSelectionVersion += 1;
      const state = get.state();
      const tabs = state.tabs.filter((tab) => !isNoteTabForNoteId(tab, id));
      const activeTabId =
        state.activeTabId &&
          state.tabs.find((tab) => tab.id === state.activeTabId && isNoteTabForNoteId(tab, id))
          ? (tabs[0]?.id ?? null)
          : state.activeTabId;
      const notes = state.notes.filter((n) => n.id !== id);
      const note = state.note?.id === id ? null : state.note;
      const noteGroupMembers = state.noteGroupMembers.filter((m) => m.noteId !== id);
      return { notes, tabs, activeTabId, note, noteGroupMembers };
    },
    restoreNote: async (id: string) => {
      const state = get.state();
      const restored = await repositories.notes.restore(id);
      if (!restored) return state;
      return { notes: state.notes.concat(restored) };
    },
    emptyTrash: async () => {
      const trashOutcome = await repositories.notes.emptyTrash();
      return { trashOutcome };
    },
    updateNoteContent: async (id: string, content: string) => {
      try {
        await repositories.notes.updateContent(id, content);
        const state = get.state();
        const updatedAt = new Date();
        const patch = <T extends Note>(n: T): T =>
          Object.assign(Object.create(Object.getPrototypeOf(n)), n, {
            content,
            updatedAt,
          });
        const notes = state.notes.map((n) => (n.id === id ? patch(n) : n));
        const note = state.note?.id === id ? patch(state.note) : state.note;
        return { notes, note };
      } catch (error: unknown) {
        uiDispatch.setError(error instanceof Error ? error.message : "Failed to update note content");
        throw error;
      }
    },
    updateNoteMetadata: async (id: string, metadata: Record<string, unknown>) => {
      await repositories.notes.updateMetadata(id, metadata);
      const state = get.state();
      const patch = (note: Note): Note => Note.parse({ ...note, metadata, updatedAt: new Date() });
      return {
        notes: state.notes.map((note) => (note.id === id ? patch(note) : note)),
        note: state.note?.id === id ? patch(state.note) : state.note,
      };
    },
    updateNoteTitle: async (id: string, title: string) => {
      try {
        const state = get.state();
        const existing = state.notes.find((n) => n.id === id) ?? (state.note?.id === id ? state.note : null);
        if (!existing) return state;
        const journalDate = getJournalDate(existing);

        const updated = Object.assign(Object.create(Object.getPrototypeOf(existing)), existing, {
          title: title.trim() || "Untitled",
          updatedAt: new Date(),
          metadata: journalDate ? { ...existing.metadata, journalDate: Dates.isoDate(journalDate) } : existing.metadata,
        }) as Note;
        await repositories.notes.save(updated);
        const notes = state.notes.map((n) => (n.id === id ? updated : n));
        return { notes, note: state.note?.id === id ? updated : state.note };
      } catch (error: any) {
        uiDispatch.setError(error.message || "Failed to update note title");
        return get.state();
      }
    },
    theme: (theme: Toggle<string>) => {
      const result = typeof theme === "function" ? theme(get.state().theme) : theme;
      for (const className of THEME_CLASSES) {
        document.documentElement.classList.remove(className);
      }
      if (result !== "light") document.documentElement.classList.add(result);
      SettingsService.save({ theme: result as Theme });
      return { theme: result as Theme };
    },
    selectNoteById: (noteId: string) => {
      const state = get.state();
      const cached = state.note?.id === noteId ? state.note : state.notes.find((note) => note.id === noteId);
      if (cached) return selectOrAddTab(cached);
      const version = ++tabSelectionVersion;
      const workspace = state.directory;
      return repositories.notes.getOne(noteId).then((note) => {
        if (version !== tabSelectionVersion || get.state().directory !== workspace) return;
        if (!note) {
          uiDispatch.setError("Failed to load note");
          return;
        }
        get.patch(selectOrAddTab(note));
      });
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
      const group = new NoteGroup(uuid(), title, description ?? null, now, now);
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
        noteGroupMembers: state.noteGroupMembers.filter((m) => m.groupId !== id),
      };
    },
    updateGroup: async (id: string, partial: Partial<Pick<NoteGroup, "title" | "description">>) => {
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
      const alreadyMember = state.noteGroupMembers.some((m) => m.groupId === groupId && m.noteId === noteId);
      if (alreadyMember) return state;
      const existing = state.noteGroupMembers.filter((m) => m.groupId === groupId);
      const maxOrder = existing.reduce((max, m) => Math.max(max, m.order), -1);
      const now = new Date();
      const member = new NoteGroupMember(uuid(), groupId, noteId, maxOrder + 1, now, now);
      await repositories.noteGroupMembers.save(member);
      return { noteGroupMembers: state.noteGroupMembers.concat(member) };
    },
    removeNoteFromGroup: async (groupId: string, noteId: string) => {
      const state = get.state();
      const member = state.noteGroupMembers.find((m) => m.groupId === groupId && m.noteId === noteId);
      if (!member) return state;
      await repositories.noteGroupMembers.delete(member.id);
      return {
        noteGroupMembers: state.noteGroupMembers.filter((m) => !(m.groupId === groupId && m.noteId === noteId)),
      };
    },
    reorderGroupMembers: async (groupId: string, members: NoteGroupMember[]) => {
      const state = get.state();
      await repositories.noteGroupMembers.reorder(groupId, members);
      return {
        noteGroupMembers: state.noteGroupMembers.filter((m) => m.groupId !== groupId).concat(members),
      };
    },
  } as const;
});

export const globalState = useGlobalStore.getState;

export const globalDispatch = useGlobalStore.dispatchers;

export type GlobalDispatchers = typeof globalDispatch;

export { repositories };
