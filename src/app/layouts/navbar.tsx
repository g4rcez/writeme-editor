import { useGlobalStore } from "@/store/global.store";
import { Note } from "@/store/note";
import { NetworkIcon } from "@phosphor-icons/react/dist/csr/Network";
import { StackPlusIcon } from "@phosphor-icons/react/dist/csr/StackPlus";
import { ListBulletsIcon } from "@phosphor-icons/react/dist/csr/ListBullets";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { NavbarButton } from "@/app/components/navbar-button";
import { NewNoteButton } from "@/app/components/new-note-button";
import { SettingsMenu } from "@/app/components/settings-menu";
import { ThemeToggle } from "@/app/components/theme-toggle";

export const Navbar = () => {
  const [state, dispatch] = useGlobalStore();
  const [editingTitle, setEditingTitle] = useState<string | null>(
    state.note?.title || "",
  );
  const location = useLocation();

  useEffect(() => {
    console.log("->", state.note);
    if (state.note?.title) setEditingTitle(state.note.title);
    else setEditingTitle(null);
  }, [state.note?.id, state.note?.title]);

  const isEditor =
    location.pathname.startsWith("/note/") || location.pathname === "/";

  return (
    <header className="sticky top-0 z-50 w-full border-b h-navbar bg-background border-border/20">
      <div className="flex gap-8 justify-between items-center px-3.5 w-full h-full">
        <div className="flex flex-1 gap-x-6 items-center">
          <Link to="/" className="transition-opacity hover:opacity-80">
            <img width="28px" src="/logo.png" />
          </Link>
          {state.note && isEditor && (
            <input
              title="Untitled Note"
              className="py-0 px-2 w-full h-8 text-sm bg-transparent border-b border-white"
              style={{
                borderBottom: "1px solid hsla(var(--card-border))",
                width: `clamp(8rem, ${(editingTitle ?? state.note.title).length}ch, 16rem)`,
              }}
              placeholder="Untitled Note"
              value={editingTitle ?? state.note.title}
              onChange={(e) => setEditingTitle(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter") {
                  const value = (e.target as HTMLInputElement).value;
                  if (state.note && value !== state.note.title) {
                    const note = Note.parse(state.note);
                    note.setTitle(value);
                    await dispatch.note(note);
                  }
                  setEditingTitle(null);
                  (e.target as HTMLInputElement).blur();
                }
                if (e.key === "Escape") {
                  setEditingTitle(null);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              onBlur={async (e) => {
                const value = e.target.value;
                if (state.note && value !== state.note.title) {
                  const note = Note.parse(state.note);
                  note.setTitle(value);
                  await dispatch.note(note);
                }
                setEditingTitle(null);
              }}
            />
          )}
        </div>

        <nav className="flex gap-2 items-center">
          <Link to="/notes">
            <NavbarButton title="All Notes" Icon={ListBulletsIcon} />
          </Link>
          <Link to="/read-it-later">
            <NavbarButton title="Read It Later" Icon={StackPlusIcon} />
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
  );
};
