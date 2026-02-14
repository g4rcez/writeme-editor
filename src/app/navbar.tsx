import { BookmarkCheckIcon, LogsIcon, Network } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useGlobalStore } from "../store/global.store";
import { Note } from "../store/note";
import { NewNoteButton } from "./components/new-note-button";
import { SettingsMenu } from "./components/settings-menu";
import { TabsBar } from "./components/tabs-bar";
import { ThemeToggle } from "./components/theme-toggle";

export const Navbar = () => {
  const [state, dispatch] = useGlobalStore();
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => setEditingTitle(null), [state.note?.id]);

  const isEditor =
    location.pathname.startsWith("/note/") || location.pathname === "/";

  return (
    <Fragment>
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md border-border/40">
        <div className="flex justify-between items-center mx-auto w-full h-16 max-w-safe">
          <div className="flex gap-6 items-center">
            <Link
              to="/"
              className="text-xl font-black transition-opacity hover:opacity-80 font-display"
            >
              <img width={32} src="/logo.png" />
            </Link>
            {state.note && isEditor && (
              <div className="hidden items-center pl-6 h-8 border-l md:flex border-border/30">
                <input
                  placeholder="Untitled Note"
                  value={editingTitle ?? state.note.title}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  className="w-64 text-sm font-medium bg-transparent rounded-md border outline-none border-card-border placeholder:text-muted-foreground/50 truncate"
                  onBlur={(e) => {
                    const value = e.target.value;
                    if (value !== state.note.title) {
                      const note = Note.parse(state.note);
                      note.title = value;
                      dispatch.note(note);
                    }
                    setEditingTitle(null);
                  }}
                />
              </div>
            )}
          </div>

          <nav className="flex gap-2 items-center">
            <div className="hidden gap-1 pr-2 mr-2 border-r sm:flex border-border/30">
              <Link to="/notes">
                <button
                  title="All Notes"
                  className="flex justify-center items-center w-9 h-9 rounded-full transition-all text-foreground/70 hover:text-foreground hover:bg-secondary/50"
                >
                  <LogsIcon className="size-4" />
                </button>
              </Link>
              <Link to="/read-it-later">
                <button
                  title="Read It Later"
                  className="flex justify-center items-center w-9 h-9 rounded-full transition-all text-foreground/70 hover:text-foreground hover:bg-secondary/50"
                >
                  <BookmarkCheckIcon className="size-4" />
                </button>
              </Link>
              <Link to="/tags">
                <button
                  title="Graph View"
                  className="flex justify-center items-center w-9 h-9 rounded-full transition-all text-foreground/70 hover:text-foreground hover:bg-secondary/50"
                >
                  <Network className="size-4" />
                </button>
              </Link>
            </div>

            <NewNoteButton />
            <ThemeToggle />
            <SettingsMenu />
          </nav>
        </div>
      </header>
      <TabsBar />
    </Fragment>
  );
};
