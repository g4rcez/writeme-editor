import { Fragment, useEffect, useState } from "react";
import { useGlobalStore } from "../store/global.store";
import { Note } from "../store/note";
import { NewNoteButton } from "./components/new-note-button";
import { SettingsMenu } from "./components/settings-menu";
import { TabsBar } from "./components/tabs-bar";
import { ThemeToggle } from "./components/theme-toggle";

export const Navbar = () => {
  const [state, dispatch] = useGlobalStore();
  const [editingTitle, setEditingTitle] = useState<string | null>(null);

  useEffect(() => setEditingTitle(null), [state.note?.id]);

  return (
    <Fragment>
      <header className="fixed top-0 z-10 w-full border-b h-navbar bg-background/90 border-border/50 backdrop-blur-md">
        <div className="flex justify-between items-center mx-auto w-full h-12 max-w-safe">
          <div className="flex gap-2 items-center">
            {state.note && (
              <input
                placeholder="Untitled"
                value={editingTitle ?? state.note.title}
                onChange={(e) => setEditingTitle(e.target.value)}
                className="flex-1 px-3 max-w-md h-8 text-sm text-left bg-transparent rounded-md border transition-all outline-none focus:ring-2 truncate border-border/50 focus:border-primary/50 focus:ring-primary/20"
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
          <nav className="flex gap-1 items-center">
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
