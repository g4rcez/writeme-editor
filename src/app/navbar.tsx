import { BookmarkCheckIcon, LogsIcon, NetworkIcon } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useGlobalStore } from "../store/global.store";
import { Note } from "../store/note";
import { NavbarButton } from "./components/navbar-button";
import { NewNoteButton } from "./components/new-note-button";
import { SettingsMenu } from "./components/settings-menu";
import { TabsBar } from "./components/tabs-bar";
import { ThemeToggle } from "./components/theme-toggle";
import { Input } from "@g4rcez/components";

export const Navbar = () => {
  const [state, dispatch] = useGlobalStore();
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => setEditingTitle(null), [state.note?.id]);

  const isEditor =
    location.pathname.startsWith("/note/") || location.pathname === "/";

  return (
    <Fragment>
      <header className="sticky top-0 z-50 w-full border-b bg-background border-border/40">
        <div className="flex gap-8 justify-between items-center mx-auto w-full h-16 max-w-safe">
          <div className="flex flex-1 gap-6 items-center">
            <Link
              to="/"
              className="text-xl font-black transition-opacity hover:opacity-80 font-display"
            >
              <img width={32} src="/logo.png" />
            </Link>
            {state.note && isEditor && (
              <Input
                hiddenLabel
                title="Untitled Note"
                className="w-full text-sm"
                placeholder="Untitled Note"
                value={editingTitle ?? state.note.title}
                onChange={(e) => setEditingTitle(e.target.value)}
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
            )}
          </div>

          <nav className="flex gap-2 items-center">
            <Link to="/notes">
              <NavbarButton title="All Notes" Icon={LogsIcon} />
            </Link>
            <Link to="/read-it-later">
              <NavbarButton title="Read It Later" Icon={BookmarkCheckIcon} />
            </Link>
            <Link to="/tags">
              <NavbarButton title="Graph View" Icon={NetworkIcon} />
            </Link>
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
