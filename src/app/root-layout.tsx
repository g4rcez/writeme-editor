import { Outlet, useNavigate } from "react-router-dom";
import { Maximize2 } from "lucide-react";
import { Fragment, useEffect, Suspense } from "react";
import { CursorPositionStore } from "../store/cursor-position.store";
import {
  globalDispatch,
  globalState,
  repositories,
  useGlobalStore,
} from "../store/global.store";
import { Note } from "../store/note";
import { useUIStore } from "../store/ui.store";
import { editorGlobalRef } from "./editor-global-ref";
import { Commander } from "./commander";
import { DirectoryBrowserDialog } from "./components/directory-browser-dialog";
import { RecentNotesDialog } from "./components/recent-notes-dialog";
import { ReadItLaterDialog } from "./components/read-it-later-dialog";
import { Sidebar } from "./components/sidebar";
import { PWAInstallButton } from "./elements/pwa-install-button";
import { Navbar } from "./navbar";
import { ShortcutsCommands } from "./tutorial/shortcuts-commands";
import { Dates } from "../lib/dates";
import { css } from "@g4rcez/components";

export const RootLayout = () => {
  const [uiState, uiDispatch] = useUIStore();
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "f") {
        e.preventDefault();
        uiDispatch.toggleFocusMode();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [uiDispatch]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      const state = globalState();
      if (state.note && editorGlobalRef.current) {
        CursorPositionStore.save(
          state.note.id,
          editorGlobalRef.current.state.selection.anchor,
          window.scrollY,
        );
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    if (!window.electronAPI?.onQuicknoteOpen) return;
    const cleanup = window.electronAPI.onQuicknoteOpen(async () => {
      const today = new Date();
      const existing = await repositories.notes.getQuicknoteByDate(today);
      if (existing) {
        globalDispatch.selectNoteById(existing.id);
        navigate(`/quicknote/${existing.id}`);
      } else {
        const quicknote = Note.new(
          `${Dates.yearMonthDay(today)}_quick_note`,
          "",
          "quick",
        );
        await repositories.notes.save(quicknote);
        globalDispatch.selectNoteById(quicknote.id);
        navigate(`/quicknote/${quicknote.id}`);
      }
    });
    return cleanup;
  }, [navigate]);

  const isQuickNote = window.location.hash.includes("quicknote");

  return (
    <div className="flex flex-col flex-1 justify-center items-center isolate">
      {!isQuickNote ? (
        <Fragment>
          <Commander />
          <RecentNotesDialog />
          <ReadItLaterDialog />
          <Navbar />
        </Fragment>
      ) : null}
      <div className="flex flex-1 w-full min-h-0">
        {!uiState.focusMode && !isQuickNote && (
          <div className="hidden lg:block">
            <Sidebar />
          </div>
        )}
        <div className="flex flex-col flex-1 min-w-0">
          <ShortcutsCommands />
          <DirectoryBrowserDialog />
          <div className={css("block", isQuickNote ? "py-8" : "mt-24 mb-10")}>
            <Suspense
              fallback={
                <div className="flex justify-center p-10">Loading...</div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </div>
      </div>
      {isQuickNote ? null : <PWAInstallButton />}
      {uiState.focusMode && (
        <button
          title="Exit focus mode (⌘⇧F)"
          onClick={() => uiDispatch.toggleFocusMode()}
          className="flex fixed right-6 bottom-6 z-50 gap-2 items-center py-2 px-4 text-sm rounded-lg border shadow-lg transition-all hover:scale-105 bg-background/80 border-border backdrop-blur-md text-foreground/70 animate-fade-in hover:text-foreground"
        >
          <Maximize2 className="size-4" />
          <span>Exit Focus</span>
        </button>
      )}
      {/* <Footer /> */}
    </div>
  );
};
