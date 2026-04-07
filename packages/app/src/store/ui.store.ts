import { createGlobalReducer } from "use-typed-reducer";
import { type Toggle } from "./types";

export type ContentWidth = "narrow" | "medium" | "wide";

export type AlertType = "info" | "success" | "error";

export type MediaSource = {
  src: string;
  type: "image" | "video" | "pdf";
  title?: string;
};

export type MediaPreviewState = {
  open: boolean;
  sources: MediaSource[];
  index: number;
};

export type UIStateAlert = {
  open: boolean;
  title?: string;
  message: string;
  type?: AlertType;
};

export type UIStatePrompt = {
  open: boolean;
  title: string;
  message?: string;
  initialValue?: string;
  placeholder?: string;
  onConfirm: (value: string) => void;
  onCancel?: () => void;
};

export type UISettings = {
  contentWidth: ContentWidth;
  focusMode: boolean;
  sidebarOpen: boolean;
  error: string | null;
  alert: UIStateAlert | null;
  prompt: UIStatePrompt | null;
  findReplace: { isOpen: boolean };
  mediaPreview: MediaPreviewState;
  tasksDialog: { isOpen: boolean };
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
  error: null,
  alert: persistedState.alert || null,
  prompt: persistedState.prompt || null,
  focusMode: persistedState.focusMode || false,
  sidebarOpen: persistedState.sidebarOpen ?? true,
  mediaPreview: { open: false, sources: [], index: 0 },
  tasksDialog: { isOpen: false },
  contentWidth: persistedState.contentWidth || "medium",
  findReplace: persistedState.findReplace || { isOpen: false },
};

export const useUIStore = createGlobalReducer(
  initialState,
  (get: { state: () => UISettings }) => ({
    setContentWidth: (width: ContentWidth) => ({ contentWidth: width }),
    toggleFocusMode: () => ({ focusMode: !get.state().focusMode }),
    setFocusMode: (focusMode: boolean) => ({ focusMode }),
    toggleSidebar: () => ({ sidebarOpen: !get.state().sidebarOpen }),
    setSidebarOpen: (open: Toggle<boolean>) => ({
      sidebarOpen:
        typeof open === "function" ? open(get.state().sidebarOpen) : open,
    }),
    setError: (error: string | null) => ({ error }),
    clearError: () => ({ error: null }),
    setAlert: (alert: UIStateAlert | null) => ({ alert }),
    clearAlert: () => ({ alert: null }),
    setPrompt: (prompt: UIStatePrompt | null) => ({ prompt }),
    clearPrompt: () => ({ prompt: null }),
    openFindReplace: () => ({ findReplace: { isOpen: true } }),
    closeFindReplace: () => ({ findReplace: { isOpen: false } }),
    toggleFindReplace: () => ({
      findReplace: { isOpen: !get.state().findReplace.isOpen },
    }),
    setMediaPreview: (state: Partial<MediaPreviewState>) => ({
      mediaPreview: { ...get.state().mediaPreview, ...state },
    }),
    openMediaPreview: (sources: MediaSource[], index = 0) => ({
      mediaPreview: { open: true, sources, index },
    }),
    closeMediaPreview: () => ({
      mediaPreview: { ...get.state().mediaPreview, open: false },
    }),
    openTasksDialog: () => ({ tasksDialog: { isOpen: true } }),
    closeTasksDialog: () => ({ tasksDialog: { isOpen: false } }),
  }),
  {
    interceptor: [
      (state: UISettings) => {
        const {
          error: _error,
          alert: _alert,
          prompt: _prompt,
          findReplace: _findReplace,
          mediaPreview: _mediaPreview,
          tasksDialog: _tasksDialog,
          ...toPersist
        } = state;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersist));
        return state;
      },
    ],
  },
);

export const uiDispatch = useUIStore.dispatchers;

export const contentWidthClasses: Record<ContentWidth, string> = {
  narrow: "max-w-xl",
  medium: "max-w-3xl",
  wide: "max-w-5xl",
};
