import { CornersOutIcon } from "@phosphor-icons/react/dist/csr/CornersOut";
import { Fragment, Suspense, useEffect, useRef } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useNotification } from "@g4rcez/components";
import { isElectron } from "@/lib/is-electron";
import { CursorPositionStore } from "@/store/cursor-position.store";
import { useGlobalStore } from "@/store/global.store";
import { repositories } from "@/store/repositories";
import { Note } from "@/store/note";
import { useUIStore } from "@/store/ui.store";
import { FindReplaceBar } from "@/app/components/find-replace-bar";
import { Commander } from "@/app/commander";
import { Alert } from "@/app/components/alert";
import { Prompt } from "@/app/components/prompt";
import { CreateNoteDialog } from "@/app/components/create-note-dialog";
import { CreateVariableDialog } from "@/app/components/create-variable-dialog";
import { CreateTemplateDialog } from "@/app/components/create-template-dialog";
import { ReadItLaterDialog } from "@/app/components/read-it-later-dialog";
import { DirectoryBrowserDialog } from "@/app/components/directory-browser-dialog";
import { RecentNotesDialog } from "@/app/components/recent-notes-dialog";
import { InspectJsonDialog } from "@/app/components/inspect-json-dialog";
import { MediaPreview } from "@/app/components/media-preview";
import { TasksDialog } from "@/app/components/tasks-dialog";
import { editorGlobalRef } from "@/app/editor-global-ref";
import { notificationRef } from "@/app/notification-ref";
import { PWAInstallButton } from "@/app/elements/pwa-install-button";
import { MainLayout } from "@/app/layouts/main.layout";
import { AIDrawer } from "@/app/ai/ai-drawer";

// Maps noteId -> requestId for files opened with --wait
const waitMap = new Map<string, string>();

export const RootLayout = () => {
  const [state, dispatch] = useGlobalStore();
  const [uiState, uiDispatch] = useUIStore();
  notificationRef.current = useNotification();
  const navigate = useNavigate();
  const prevTabsRef = useRef(state.tabs);

  // Handle files opened from CLI via app:open-file IPC
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

  // Detect tab removal and signal --wait callers
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

  useEffect(
    function registerBindings() {
      const handleKeyDown = (e: KeyboardEvent) => {
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
          dispatch.toggleSidebar();
        }
      };

      const handleBeforeUnload = () => {
        if (state.note && editorGlobalRef.current) {
          const container = document.getElementById("main-scroll-container");
          const scrollY = container ? container.scrollTop : window.scrollY;
          CursorPositionStore.save(
            state.note.id,
            editorGlobalRef.current.state.selection.anchor,
            scrollY,
          );
        }
      };
      const controller = new AbortController();
      const opts = { signal: controller.signal };
      window.addEventListener("keydown", handleKeyDown, opts);
      window.addEventListener("beforeunload", handleBeforeUnload, opts);
      return () => {
        controller.abort();
      };
    },
    [navigate],
  );

  const isQuickNote = window.location.hash.includes("quicknote");

  return (
    <div className="flex overflow-hidden flex-col flex-1 justify-center items-center h-screen isolate print:block print:h-auto print:overflow-visible">
      {!isQuickNote ? (
        <Fragment>
          <Commander />
          <FindReplaceBar />
          <CreateNoteDialog />
          <CreateTemplateDialog />
          <CreateVariableDialog />
          <RecentNotesDialog />
          <ReadItLaterDialog />
          <DirectoryBrowserDialog />
          <InspectJsonDialog />
          <TasksDialog />
          <MediaPreview />
          <AIDrawer />
        </Fragment>
      ) : null}

      {/* Render 3-Pane Layout unless it's a QuickNote window (which usually stands alone) */}
      {isQuickNote ? (
        <div className="flex flex-col flex-1 py-8 w-full min-h-0">
          <Suspense fallback={<div>Loading...</div>}>
            <Outlet />
          </Suspense>
        </div>
      ) : (
        <MainLayout />
      )}

      {isQuickNote ? null : <PWAInstallButton />}
      {uiState.focusMode && (
        <button
          title="Exit focus mode (⌘⇧F)"
          onClick={() => uiDispatch.toggleFocusMode()}
          className="flex fixed right-6 bottom-6 z-50 gap-2 items-center py-2 px-4 text-sm rounded-lg border shadow-lg transition-all hover:scale-105 bg-background/80 border-border backdrop-blur-md text-foreground/70 animate-fade-in hover:text-foreground"
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
