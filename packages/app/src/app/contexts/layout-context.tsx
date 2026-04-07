import { createGlobalReducer } from "use-typed-reducer";

export type ActivityType =
  | "json"
  | "tags"
  | "groups"
  | "search"
  | "calendar"
  | "explorer"
  | "settings"
  | "favorites"
  | "templates"
  | "views";

export type LayoutView =
  | { type: "all" }
  | { type: "quick" }
  | { type: "trash" }
  | { type: "favorites" }
  | { type: "read-it-later" }
  | { type: "tag"; id: string }
  | { type: "json"; id: string }
  | { type: "folder"; id: string }
  | { type: "calendar"; id: string };

type LayoutState = {
  searchQuery: string;
  activeView: LayoutView;
  activeActivity: ActivityType;
};

const initialState: LayoutState = {
  searchQuery: "",
  activeActivity: "explorer",
  activeView: { type: "all" },
};

export const useLayoutStore = createGlobalReducer(initialState, () => ({
  setSearch: (searchQuery: string) => ({ searchQuery }),
  setActivity: (activeActivity: ActivityType) => ({ activeActivity }),
  setView: (activeView: LayoutView) => ({ activeView, searchQuery: "" }),
}));
