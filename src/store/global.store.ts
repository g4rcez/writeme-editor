import { createGlobalReducer } from "use-typed-reducer";
import { NotesRepository } from "./repositories/dexie/notes.repository";
import { ProjectsRepository } from "./repositories/dexie/projects.repository";
import { Note } from "./note";
import { Project } from "./project";

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
  theme: state.theme || "dark",
  note: (state.note ? Note.parse(state.note) || null : null) as Note | null,
};

type Toggle<T> = T | ((prev: T) => T);

export const useGlobalStore = createGlobalReducer(
  initialState,
  (get) => ({
    note: async (note: Note) => {
      await repositories.notes.update(note.id, note);
      return { note: note };
    },
    setNote: (note: Note | null) => ({ note }),
    notes: (notes: Note[]) => ({ notes }),
    recentNotes: (recentNotes: Note[]) => ({ recentNotes }),
    loadRecentNotes: async (limit: number = 20) => {
      const recent = await repositories.notes.getRecentNotes(limit);
      return { recentNotes: recent };
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
};
