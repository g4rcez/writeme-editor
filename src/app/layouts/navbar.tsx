import { useGlobalStore } from "@/store/global.store";
import { Note } from "@/store/note";
import { DotsThreeVerticalIcon } from "@phosphor-icons/react/dist/csr/DotsThreeVertical";
import { Menu, MenuItem } from "@g4rcez/components";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { SettingsMenu } from "@/app/components/settings-menu";
import { ThemeToggle } from "@/app/components/theme-toggle";
import {
  BookBookmarkIcon,
  GearFineIcon,
  GraphIcon,
  NotepadIcon,
  NotePencilIcon,
  TerminalWindowIcon,
} from "@phosphor-icons/react";

export const Navbar = () => {
  const [state, dispatch] = useGlobalStore();
  const [editingTitle, setEditingTitle] = useState<string | null>(
    state.note?.title || "",
  );
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (state.note?.title) setEditingTitle(state.note.title);
    else setEditingTitle(null);
  }, [state.note?.id, state.note?.title]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        dispatch.setCreateNoteDialog({ isOpen: true, type: "note" });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const isEditor =
    location.pathname.startsWith("/note/") || location.pathname === "/";

  return (
    <header className="sticky top-0 z-50 w-full border-b print:hidden h-navbar bg-background border-border/20">
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
          <SettingsMenu />
          <ThemeToggle />
          <Menu label={<DotsThreeVerticalIcon size={20} />} title="Menu" className="!w-auto !min-w-0 !h-8 !px-1.5 !py-1.5 !rounded-md !justify-center">
            <MenuItem
              title="New note"
              onClick={() =>
                dispatch.setCreateNoteDialog({ isOpen: true, type: "note" })
              }
            >
              <span className="flex items-center gap-1">
                <NotePencilIcon />
                New note
              </span>
            </MenuItem>
            <MenuItem title="Notes" onClick={() => navigate("/notes")}>
              <span className="flex items-center gap-1">
                <NotepadIcon />
                Notes
              </span>
            </MenuItem>
            <MenuItem
              title="Read it later"
              onClick={() => navigate("/read-it-later")}
            >
              <span className="flex items-center gap-1">
                <BookBookmarkIcon />
                Read it later
              </span>
            </MenuItem>
            <MenuItem title="Graph view" onClick={() => navigate("/tags")}>
              <span className="flex items-center gap-1">
                <GraphIcon />
                Graph view
              </span>
            </MenuItem>
            <MenuItem
              title="Terminal"
              onClick={() => dispatch.toggleTerminal()}
            >
              <span className="flex items-center gap-1">
                <TerminalWindowIcon />
                Terminal
              </span>
            </MenuItem>
            <MenuItem title="Settings" onClick={() => navigate("/settings")}>
              <span className="flex items-center gap-1">
                <GearFineIcon />
                Settings
              </span>
            </MenuItem>
          </Menu>
        </nav>
      </div>
    </header>
  );
};
