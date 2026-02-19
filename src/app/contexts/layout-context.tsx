import {
  createContext,
  useContext,
  useReducer,
  Dispatch,
  ReactNode,
} from "react";

export type ActivityType =
  | "explorer"
  | "search"
  | "favorites"
  | "tags"
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

type LayoutAction =
  | { type: "SET_VIEW"; view: LayoutView }
  | { type: "SET_ACTIVITY"; activity: ActivityType }
  | { type: "SET_SEARCH"; query: string };

const initialState: LayoutState = {
  activeView: { type: "all" },
  activeActivity: "explorer",
  searchQuery: "",
};

const layoutReducer = (
  state: LayoutState,
  action: LayoutAction,
): LayoutState => {
  switch (action.type) {
    case "SET_VIEW":
      return { ...state, activeView: action.view, searchQuery: "" };
    case "SET_ACTIVITY":
      return { ...state, activeActivity: action.activity };
    case "SET_SEARCH":
      return { ...state, searchQuery: action.query };
    default:
      return state;
  }
};

const LayoutContext = createContext<
  | {
      state: LayoutState;
      dispatch: Dispatch<LayoutAction>;
    }
  | undefined
>(undefined);

export const LayoutProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(layoutReducer, initialState);
  return (
    <LayoutContext.Provider value={{ state, dispatch }}>
      {children}
    </LayoutContext.Provider>
  );
};

export const useLayoutContext = () => {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error("useLayoutContext must be used within a LayoutProvider");
  }
  return context;
};
