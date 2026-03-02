import { createGlobalReducer } from "use-typed-reducer";

export type ActivityType =
  | "explorer"
  | "search"
  | "favorites"
  | "tags"
  | "templates"
  | "settings";

export type LayoutView =
  | { type: "all" }
  | { type: "folder"; id: string }
  | { type: "tag"; id: string }
  | { type: "quick" }
  | { type: "read-it-later" }
  | { type: "trash" }
  | { type: "favorites" };

type LayoutState = {
  activeView: LayoutView;
  activeActivity: ActivityType;
  searchQuery: string;
};

const initialState: LayoutState = {
  activeView: { type: "all" },
  activeActivity: "explorer",
  searchQuery: "",
};

export const useLayoutStore = createGlobalReducer(initialState, () => ({
  setSearch: (searchQuery: string) => ({ searchQuery }),
  setActivity: (activeActivity: ActivityType) => ({ activeActivity }),
  setView: (activeView: LayoutView) => ({ activeView, searchQuery: "" }),
}));
