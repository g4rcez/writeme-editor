import { createGlobalReducer } from "use-typed-reducer";

export type ContentWidth = "narrow" | "medium" | "wide";

export type UISettings = {
  contentWidth: ContentWidth;
  focusMode: boolean;
  sidebarOpen: boolean;
  sidebarWidth: number;
  error: string | null;
};

const STORAGE_KEY = "WRITEME_UI_SETTINGS";

const loadPersistedState = (): Partial<UISettings> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const persistedState = loadPersistedState();

const initialState: UISettings = {
  contentWidth: persistedState.contentWidth || "medium",
  focusMode: persistedState.focusMode || false,
  sidebarOpen: persistedState.sidebarOpen ?? true,
  sidebarWidth: persistedState.sidebarWidth || 240,
  error: null,
};

type Toggle<T> = T | ((prev: T) => T);

export const useUIStore = createGlobalReducer(
  initialState,
  (get) => ({
    setContentWidth: (width: ContentWidth) => ({ contentWidth: width }),
    toggleFocusMode: () => ({ focusMode: !get.state().focusMode }),
    setFocusMode: (focusMode: boolean) => ({ focusMode }),
    toggleSidebar: () => ({ sidebarOpen: !get.state().sidebarOpen }),
    setSidebarOpen: (open: Toggle<boolean>) => ({
      sidebarOpen: typeof open === "function" ? open(get.state().sidebarOpen) : open,
    }),
    setSidebarWidth: (width: number) => ({
      sidebarWidth: Math.max(180, Math.min(400, width)),
    }),
    setError: (error: string | null) => ({ error }),
    clearError: () => ({ error: null }),
  }),
  {
    interceptor: [
      (state) => {
        const { error, ...toPersist } = state;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersist));
        return state;
      },
    ],
  }
);

export const uiState = useUIStore.getState;
export const uiDispatch = useUIStore.dispatchers;

export const contentWidthClasses: Record<ContentWidth, string> = {
  narrow: "max-w-xl",
  medium: "max-w-3xl",
  wide: "max-w-5xl",
};
