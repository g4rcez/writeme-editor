import { CornersOutIcon } from "@phosphor-icons/react/dist/csr/CornersOut";
import { Fragment, Suspense, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { isElectron } from "@/lib/is-electron";
import { CursorPositionStore } from "@/store/cursor-position.store";
import { useGlobalStore } from "@/store/global.store";
import { useUIStore } from "@/store/ui.store";
import { AIDrawer } from "@/app/ai/ai-drawer";
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
import { editorGlobalRef } from "@/app/editor-global-ref";
import { PWAInstallButton } from "@/app/elements/pwa-install-button";
import { MainLayout } from "@/app/layouts/main.layout";

export const RootLayout = () => {
  const [state, dispatch] = useGlobalStore();
  const [uiState, uiDispatch] = useUIStore();
  const navigate = useNavigate();

  useEffect(
    function registerBindings() {
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "f") {
          e.preventDefault();
          uiDispatch.toggleFocusMode();
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
          <CreateNoteDialog />
          <CreateTemplateDialog />
          <CreateVariableDialog />
          <RecentNotesDialog />
          <ReadItLaterDialog />
          <DirectoryBrowserDialog />
          <InspectJsonDialog />
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
      {isElectron() && <AIDrawer />}
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
