import { createGlobalReducer } from "use-typed-reducer";
import { NotesRepository } from "./repositories/dexie/notes.repository";
import { ProjectsRepository } from "./repositories/dexie/projects.repository";
import { Note } from "./note";

const state = JSON.parse(
  window.localStorage.getItem("EDITOR_PREFERENCES") || "{}",
);

const initialState = {
  help: false,
  commander: false,
  theme: state.theme || "dark",
  note: state.note ? Note.parse(state.note) || null : null,
};

type Toggle<T> = T | ((prev: T) => T);

export const useGlobalStore = createGlobalReducer(
  initialState,
  (get) => ({
    note: (note: Note) => ({ note }),
    help: (help: boolean) => ({ help }),
    commander: (commander: boolean) => ({ commander }),
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
