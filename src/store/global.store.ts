import { createGlobalReducer } from "use-typed-reducer";
import { NotesRepository } from "./repositories/dexie/notes.repository";
import { ProjectsRepository } from "./repositories/dexie/projects.repository";
import { TabsRepository } from "./repositories/dexie/tabs.repository";
import { Note } from "./note";
import { Project } from "./project";
import { Tab } from "./repositories/dexie/dexie-db";

const state = JSON.parse(
  window.localStorage.getItem("EDITOR_PREFERENCES") || "{}",
);

const initialState = {
  help: false,
  commander: false,
  recentNotesDialog: false,
  directoryBrowserDialog: false,
  openProjectDialog: false,
  notes: [] as Note[],
  recentNotes: [] as Note[],
  projects: [] as Project[],
  tabs: [] as Tab[],
  activeTabId: (state.activeTabId || null) as string | null,
  theme: state.theme || "dark",
  note: (state.note ? Note.parse(state.note) || null : null) as Note | null,
};

type Toggle<T> = T | ((prev: T) => T);

export const useGlobalStore = createGlobalReducer(
  initialState,
  (get) => ({
    note: async (note: Note) => {
      await repositories.notes.update(note.id, note);
      const storageDir = JSON.parse(window.localStorage.getItem("EDITOR_PREFERENCES") || "{}").storageDirectory || "default";
      // We need to trigger addTab but dispatchers are not directly available inside here 
      // without some trick or using the same logic.
      // Better: let's use the hook's dispatchers if we can, or just duplicate logic for now.
      
      const currentTabs = get.state().tabs;
      const existingTab = currentTabs.find((t) => t.noteId === note.id);
      if (existingTab) {
        return { note: note, activeTabId: existingTab.id };
      }
      const newTab: Tab = {
        id: crypto.randomUUID(),
        noteId: note.id,
        project: storageDir,
        order: currentTabs.length,
        createdAt: new Date(),
      };
      await repositories.tabs.save(newTab);
      return { 
        note: note, 
        tabs: [...currentTabs, newTab],
        activeTabId: newTab.id 
      };
    },
    setNote: (note: Note | null) => ({ note }),
    notes: (notes: Note[]) => ({ notes }),
    recentNotes: (recentNotes: Note[]) => ({ recentNotes }),
    loadRecentNotes: async (limit: number = 20) => {
      const recent = await repositories.notes.getRecentNotes(limit);
      return { recentNotes: recent };
    },
    tabs: (tabs: Tab[]) => ({ tabs }),
    activeTabId: (activeTabId: string | null) => ({ activeTabId }),
    loadTabs: async (project: string) => {
      const tabs = await repositories.tabs.getAll(project);
      return { tabs };
    },
    addTab: async (noteId: string, project: string) => {
      const currentTabs = get.state().tabs;
      const existingTab = currentTabs.find((t) => t.noteId === noteId);
      if (existingTab) {
        return { activeTabId: existingTab.id };
      }
      const newTab: Tab = {
        id: crypto.randomUUID(),
        noteId,
        project,
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
      const currentTabs = get.state().tabs;
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
    reorderTabs: async (tabs: Tab[]) => {
      const updatedTabs = tabs.map((t, i) => ({ ...t, order: i }));
      await repositories.tabs.updateOrder(updatedTabs);
      return { tabs: updatedTabs };
    },
    help: (help: boolean) => ({ help }),
    commander: (commander: boolean) => ({ commander }),
    recentNotesDialog: (recentNotesDialog: boolean) => ({ recentNotesDialog }),
    directoryBrowserDialog: (directoryBrowserDialog: boolean) => ({
      directoryBrowserDialog,
    }),
    openProjectDialog: (openProjectDialog: boolean) => ({ openProjectDialog }),
    projects: (projects: Project[]) => ({ projects }),
    loadProjects: async () => {
      const projects = await repositories.projects.getAll();
      return { projects };
    },
    theme: (theme: Toggle<string>) => {
      const result =
        typeof theme === "function" ? theme(get.state().theme) : theme;
      if (result === "dark") document.documentElement.classList.add("dark");
      if (result === "light") document.documentElement.classList.remove("dark");
      return { theme: result };
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

export const repositories = {
  notes: new NotesRepository(),
  projects: new ProjectsRepository(),
  tabs: new TabsRepository(),
};
