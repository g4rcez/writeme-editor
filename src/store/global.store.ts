import { createGlobalReducer } from "use-typed-reducer";
import { NotesRepository } from "./repositories/dexie/notes.repository";
import { ProjectsRepository } from "./repositories/dexie/projects.repository";
import { Note } from "./note";

const initialState = {
  theme: "dark",
  note: null as Note | null,
};

type Toggle<T> = T | ((prev: T) => T);

export const useGlobalStore = createGlobalReducer(initialState, (get) => ({
  note: (note: Note) => ({ note }),
  theme: (theme: Toggle<string>) => {
    const result =
      typeof theme === "function" ? theme(get.state().theme) : theme;
    if (result === "dark") document.documentElement.classList.add("dark");
    if (result === "light") document.documentElement.classList.remove("dark");
    return { theme: result };
  },
}));

export const globalDispatch = useGlobalStore.dispatchers;

export const repositories = {
  notes: new NotesRepository(),
  projects: new ProjectsRepository(),
};
