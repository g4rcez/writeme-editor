import { CornersOutIcon } from "@phosphor-icons/react/dist/csr/CornersOut";
import { Fragment, Suspense, useCallback, useEffect, useRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useNotification } from "@g4rcez/components";
import { isElectron } from "@/lib/is-electron";
import { isCommanderShortcut } from "@/lib/keyboard-shortcuts";
import { printDocument } from "@/lib/print-document";
import { getPreviousTabAfterClose } from "@/lib/tab-closing";
import { getCycledTabNoteId, type TabCycleDirection } from "@/lib/tab-cycling";
import { useGlobalStore } from "@/store/global.store";
import { repositories } from "@/store/repositories";
import { Note } from "@/store/note";
import { useUIStore } from "@/store/ui.store";
import { useLayoutStore } from "@/app/contexts/layout-context";
import { FindReplaceBar } from "@/app/components/find-replace-bar";
import { Commander } from "@/app/commander";
import { Alert } from "@/app/components/alert";
import { Prompt } from "@/app/components/prompt";
import { CreateNoteDialog } from "@/app/components/create-note-dialog";
import { CreateVariableDialog } from "@/app/components/create-variable-dialog";
import { CreateTemplateDialog } from "@/app/components/create-template-dialog";
import { ReadItLaterDialog } from "@/app/components/read-it-later-dialog";
import { AddToGroupDialog } from "@/app/components/add-to-group-dialog";
import { DirectoryBrowserDialog } from "@/app/components/directory-browser-dialog";
import { RecentNotesDialog } from "@/app/components/recent-notes-dialog";
import { InspectJsonDialog } from "@/app/components/inspect-json-dialog";
import { MediaPreview } from "@/app/components/media-preview";
import { TasksDialog } from "@/app/components/tasks-dialog";
import { GitSyncDialog } from "@/app/components/git-sync-dialog";
import { KeyboardClickHints } from "@/app/components/keyboard-click-hints";
import { editorGlobalRef } from "@/app/editor-global-ref";
import { notificationRef } from "@/app/notification-ref";
import { MainLayout } from "@/app/layouts/main.layout";
import { AIDrawer } from "@/app/ai/ai-drawer";
import { usePwaUpdate } from "@/app/hooks/use-pwa-update";
import { migrateWebOnlyNotesToDirectory } from "@/app/lib/open-directory-as-workspace";

const waitMap = new Map<string, string>();

function getEditorNoteId(): string | null {
  const editor = editorGlobalRef.current;
  if (!editor || editor.isDestroyed) return null;
  const storedNote = (editor.storage as { note?: { id?: string } }).note;
  return storedNote?.id ?? null;
}

export const RootLayout = () => {
  const [state, dispatch] = useGlobalStore();
  const [uiState, uiDispatch] = useUIStore();
  const [, layoutDispatch] = useLayoutStore();
  notificationRef.current = useNotification();
  usePwaUpdate();
  const navigate = useNavigate();
  const location = useLocation();
  const prevTabsRef = useRef(state.tabs);

  useEffect(() => {
    if (!isElectron()) return;
    return window.electronAPI.onOpenFile(
      async ({ filePath, wait, requestId }) => {
        try {
          const existing =
            await window.electronAPI.db.notes.getByFilePath(filePath);
          let noteId: string;
          if (existing) {
            noteId = existing.id;
          } else {
            const content = await window.electronAPI.fs
              .readFile(filePath)
              .catch(() => "");
            const basename = filePath.split(/[\\/]/).pop() ?? filePath;
            const title = basename.replace(/\.[^.]+$/, "");
            const note = Note.new(
              title,
              typeof content === "string" ? content : "",
            );
            note.setFilePath(filePath, new Date());
            await repositories.notes.save(note);
            noteId = note.id;
          }
          if (wait) {
            waitMap.set(noteId, requestId);
          }
          await dispatch.selectNoteById(noteId);
          navigate(`/note/${noteId}`);
        } catch (err) {
          console.error("Failed to open file from CLI:", err);
        }
      },
    );
  }, []);

  useEffect(() => {
    if (!isElectron()) return;
    return window.electronAPI.onOpenFolder(({ folderPath }) => {
      if (state.directory === folderPath) return;
      void (async () => {
        try {
          await migrateWebOnlyNotesToDirectory(folderPath);
          await dispatch.switchWorkspace(folderPath);
        } catch (err) {
          console.error("Failed to open folder from CLI:", err);
        }
      })();
    });
  }, [dispatch, state.directory]);

  useEffect(() => {
    if (!isElectron()) return;
    return window.electronAPI.onNavigate((pathname) => {
      navigate(pathname);
    });
  }, [navigate]);

  useEffect(() => {
    if (!isElectron()) return;
    void window.electronAPI.app.rendererReady(state.directory);
  }, [state.directory]);

  useEffect(() => {
    if (!isElectron()) return;
    const prevTabs = prevTabsRef.current;
    const removedTabs = prevTabs.filter(
      (pt) => !state.tabs.find((ct) => ct.id === pt.id),
    );
    for (const tab of removedTabs) {
      const requestId = waitMap.get(tab.noteId);
      if (requestId) {
        window.electronAPI.app.notifyFileClosed(requestId);
        waitMap.delete(tab.noteId);
      }
    }
    prevTabsRef.current = state.tabs;
  }, [state.tabs]);

  useEffect(() => {
    if (location.pathname === "/" && state.activeTabId !== null) {
      navigate(`/note/${state.activeTabId}`, { replace: true });
    }
  }, []);

  useEffect(() => {
    if (!location.pathname.startsWith("/settings")) return;

    layoutDispatch.setActivity("settings");
    if (window.matchMedia("(min-width: 768px)").matches) {
      uiDispatch.setSidebarOpen(true);
    }
  }, [location.pathname]);

  const cycleEditorTab = useCallback(
    async (direction: TabCycleDirection): Promise<void> => {
      const currentNoteId = location.pathname.startsWith("/note/")
        ? (location.pathname.slice("/note/".length).split("/")[0] ?? null)
        : null;
      const nextNoteId = getCycledTabNoteId({
        tabs: state.tabs,
        currentNoteId,
        activeTabId: state.activeTabId,
        direction,
      });
      if (!nextNoteId) return;
      await dispatch.selectNoteById(nextNoteId);
      navigate(`/note/${nextNoteId}`);
    },
    [dispatch, location.pathname, navigate, state.activeTabId, state.tabs],
  );

  const closeCurrentTabOrHide = useCallback(async (): Promise<void> => {
    if (state.tabs.length === 0) {
      if (isElectron()) await window.electronAPI.app.hideToTray();
      return;
    }

    const currentNoteId = location.pathname.startsWith("/note/")
      ? (location.pathname.slice("/note/".length).split("/")[0] ?? null)
      : null;
    const currentTab =
      state.tabs.find((tab) => tab.noteId === currentNoteId) ??
      state.tabs.find((tab) => tab.id === state.activeTabId);
    if (!currentTab) return;

    const nextTab = getPreviousTabAfterClose(state.tabs, currentTab.id);
    await dispatch.removeTab(currentTab.id);

    if (nextTab) {
      await dispatch.selectNoteById(nextTab.noteId);
      navigate(`/note/${nextTab.noteId}`);
      return;
    }

    dispatch.setNote(null);
    navigate("/");
  }, [dispatch, location.pathname, navigate, state.activeTabId, state.tabs]);

  useEffect(() => {
    if (!state.note || !location.pathname.startsWith("/note/")) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Enter" && event.key !== " ") return;
    };
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [location.pathname, state.note?.id]);

  useEffect(
    function registerBindings() {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.ctrlKey && e.key === "Tab") {
          e.preventDefault();
          e.stopPropagation();
          void cycleEditorTab(e.shiftKey ? "backward" : "forward");
          return;
        }

        if (
          (e.metaKey || e.ctrlKey) &&
          !e.shiftKey &&
          e.key.toLowerCase() === "w"
        ) {
          e.preventDefault();
          e.stopPropagation();
          void closeCurrentTabOrHide();
          return;
        }

        if (isCommanderShortcut(e)) {
          e.preventDefault();
          dispatch.commander(true);
        }
        if ((e.metaKey || e.ctrlKey) && e.key === "n") {
          e.preventDefault();
          dispatch.setCreateNoteDialog({ isOpen: true, type: "note" });
        }
        if ((e.metaKey || e.ctrlKey) && e.key === ",") {
          e.preventDefault();
          navigate("/settings");
        }
        if (
          (e.metaKey || e.ctrlKey) &&
          !e.shiftKey &&
          e.key.toLowerCase() === "p" &&
          state.note &&
          location.pathname.startsWith("/note/")
        ) {
          e.preventDefault();
          printDocument({ title: state.note.title });
        }
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "f") {
          e.preventDefault();
          uiDispatch.toggleFocusMode();
        }
        if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "f") {
          e.preventDefault();
          uiDispatch.toggleFindReplace();
        }
        if ((e.metaKey || e.ctrlKey) && e.key === "b") {
          e.preventDefault();
          uiDispatch.toggleSidebar();
        }
      };

      const handleBeforeUnload = (): void => {
        const editor = editorGlobalRef.current;
        if (!state.note || !editor || editor.isDestroyed) return;
        if (!location.pathname.startsWith("/note/")) return;
        if (getEditorNoteId() !== state.note.id) return;
      };
      const controller = new AbortController();
      const opts = { signal: controller.signal };
      window.addEventListener("keydown", handleKeyDown, opts);
      window.addEventListener("beforeunload", handleBeforeUnload, opts);
      return () => {
        controller.abort();
      };
    },
    [
      closeCurrentTabOrHide,
      cycleEditorTab,
      dispatch,
      location.pathname,
      navigate,
      state.note,
      uiDispatch,
    ],
  );

  const isFloatingPanel =
    window.location.hash.includes("quicknote") ||
    window.location.hash.includes("mathnote");

  useEffect(() => {
    if (!isFloatingPanel) return;
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
  }, [isFloatingPanel]);

  if (isFloatingPanel) {
    return (
      <div className="relative flex overflow-hidden flex-col h-screen rounded-xl bg-background/[0.92] ring-1 ring-white/[0.06] p-4">
        <div className="quicknote-window-drag-strip" />
        <Suspense fallback={null}>
          <div className="flex flex-col flex-1 min-h-0 h-full">
            <Outlet />
          </div>
        </Suspense>
      </div>
    );
  }

  return (
    <div className="flex overflow-hidden flex-col flex-1 justify-center items-center h-screen isolate print:block print:h-auto print:overflow-visible">
      <Fragment>
        <Commander />
        <FindReplaceBar />
        <CreateNoteDialog />
        <CreateTemplateDialog />
        <CreateVariableDialog />
        <RecentNotesDialog />
        <ReadItLaterDialog />
        <AddToGroupDialog />
        <DirectoryBrowserDialog />
        <InspectJsonDialog />
        <TasksDialog />
        <GitSyncDialog />
        <MediaPreview />
        <AIDrawer />
        <KeyboardClickHints />
      </Fragment>
      <MainLayout />
      {uiState.focusMode && (
        <button
          title="Exit focus mode (⌘⇧F)"
          onClick={() => uiDispatch.toggleFocusMode()}
          className="flex fixed right-6 bottom-6 z-50 gap-2 items-center py-2 px-4 text-sm rounded-lg border shadow-lg transition-[transform,color,background-color,border-color] hover:scale-105 bg-background/80 border-border backdrop-blur-md text-foreground/70 animate-fade-in hover:text-foreground"
        >
          <CornersOutIcon className="size-4" />
          <span>Exit Focus</span>
        </button>
      )}
      {uiState.alert && (
        <Alert
          open={uiState.alert.open}
          title={uiState.alert.title}
          message={uiState.alert.message}
          type={uiState.alert.type}
          onClose={() => uiDispatch.clearAlert()}
        />
      )}
      {uiState.prompt && (
        <Prompt
          open={uiState.prompt.open}
          title={uiState.prompt.title}
          message={uiState.prompt.message}
          initialValue={uiState.prompt.initialValue}
          placeholder={uiState.prompt.placeholder}
          onConfirm={(val) => {
            uiState.prompt?.onConfirm(val);
            uiDispatch.clearPrompt();
          }}
          onCancel={() => {
            uiState.prompt?.onCancel?.();
            uiDispatch.clearPrompt();
          }}
        />
      )}
    </div>
  );
};
