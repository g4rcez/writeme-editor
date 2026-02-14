import { css } from "@g4rcez/components";
import { Maximize2 } from "lucide-react";
import { Fragment, Suspense, useEffect } from "react";
import { Outlet, useNavigate, useLocation, matchPath } from "react-router-dom";
import { Dates } from "../lib/dates";
import { CursorPositionStore } from "../store/cursor-position.store";
import {
  globalDispatch,
  globalState,
  repositories,
  useGlobalStore,
} from "../store/global.store";
import { Note } from "../store/note";
import { useUIStore } from "../store/ui.store";
import { Commander } from "./commander";
import { CreateNoteDialog } from "./components/create-note-dialog";
import { DirectoryBrowserDialog } from "./components/directory-browser-dialog";
import { ReadItLaterDialog } from "./components/read-it-later-dialog";
import { RecentNotesDialog } from "./components/recent-notes-dialog";
import { Sidebar } from "./components/sidebar";
import { editorGlobalRef } from "./editor-global-ref";
import { PWAInstallButton } from "./elements/pwa-install-button";
import { Navbar } from "./navbar";
import { ShortcutsCommands } from "./tutorial/shortcuts-commands";

const noop = () => { };

const redirectOnEmptyTabs = (path: string, tabs: any[]) => {
  if (tabs.length === 0) {
    const match = matchPath("/note/:id", path);
    return match ? "/" : undefined;
  }
  return undefined;
};

export const RootLayout = () => {
  const [state] = useGlobalStore();
  const [uiState, uiDispatch] = useUIStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const pathToRedirect = redirectOnEmptyTabs(location.pathname, state.tabs);
    if (pathToRedirect) {
      return void navigate(pathToRedirect);
    }
  }, [location, state.tabs.length]);

  useEffect(
    function registerBindings() {
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "f") {
          e.preventDefault();
          uiDispatch.toggleFocusMode();
        }
      };

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
      const controller = new AbortController();
      const opts = { signal: controller.signal };
      const cleanup = !window.electronAPI?.onQuicknoteOpen
        ? noop
        : window.electronAPI.onQuicknoteOpen(async () => {
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

      window.addEventListener("keydown", handleKeyDown, opts);
      window.addEventListener("beforeunload", handleBeforeUnload, opts);
      return () => {
        cleanup();
        controller.abort();
      };
    },
    [navigate],
  );

  const isQuickNote = window.location.hash.includes("quicknote");

  return (
    <div className="flex flex-col flex-1 justify-center items-center isolate">
      {!isQuickNote ? (
        <Fragment>
          <Commander />
          <CreateNoteDialog />
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
          <div
            className={css("block", isQuickNote ? "py-8" : "mt-navbar mb-10")}
          >
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
