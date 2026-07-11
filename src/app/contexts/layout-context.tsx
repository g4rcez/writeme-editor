import { createZustandCompatStore } from "@/store/zustand-compat";

export type ActivityType =
    | "ai"
    | "json"
    | "tags"
    | "trash"
    | "views"
    | "groups"
    | "search"
    | "calendar"
    | "explorer"
    | "settings"
    | "favorites"
    | "templates";

export type LayoutView =
    | { type: "ai" }
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

export const useLayoutStore = createZustandCompatStore(initialState, () => ({
    setSearch: (searchQuery: string) => ({ searchQuery }),
    setActivity: (activeActivity: ActivityType) => ({ activeActivity }),
    setView: (activeView: LayoutView) => ({ activeView, searchQuery: "" }),
}));
