import { Brouther, Outlet } from "brouther";
import { Maximize2 } from "lucide-react";
import { StrictMode, useEffect } from "react";
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
import { Sidebar } from "./components/sidebar";
import { PWAInstallButton } from "./elements/pwa-install-button";
import { Footer } from "./footer";
import { Navbar } from "./navbar";
import { router } from "./router";
import { ShortcutsCommands } from "./tutorial/shortcuts-commands";
import { Dates } from "../lib/dates";

export const App = () => {
  const [state] = useGlobalStore();
  const [uiState, uiDispatch] = useUIStore();

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
      const existing = await repositories.notes.getLatestQuicknote();
      if (existing) {
        globalDispatch.selectNoteById(existing.id);
      } else {
        const quicknote = Note.new(
          `Quick Note - ${Dates.yearMonthDay(new Date())}`,
          "",
          "quicknote",
        );
        await repositories.notes.save(quicknote);
        globalDispatch.selectNoteById(quicknote.id);
      }
    });
    return cleanup;
  }, []);

  const isQuickNote = window.location.hash.includes("quicknote");

  if (isQuickNote) {
    return (
      <StrictMode>
        <Brouther config={router.config}>
          <div className="flex flex-col flex-1 h-screen bg-background">
            <Outlet />
          </div>
        </Brouther>
      </StrictMode>
    );
  }

  return (
    <StrictMode>
      <Brouther config={router.config}>
        <div className="flex flex-col flex-1 justify-center items-center isolate">
          <Commander />
          <RecentNotesDialog />
          <Navbar />
          <div className="flex flex-1 w-full min-h-0">
            {!uiState.focusMode && (
              <div className="hidden lg:block">
                <Sidebar />
              </div>
            )}
            <div className="flex flex-col flex-1 min-w-0">
              <ShortcutsCommands />
              <DirectoryBrowserDialog />
              <div className="block py-28">
                <Outlet />
              </div>
            </div>
          </div>
          <PWAInstallButton />
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
          <Footer />
        </div>
      </Brouther>
    </StrictMode>
  );
};
