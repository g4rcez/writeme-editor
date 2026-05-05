import { useGlobalStore } from "@/store/global.store";
import { Note } from "@/store/note";
import { SettingsService } from "@/store/settings";
import { Button, Menu, MenuItem } from "@g4rcez/components";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BookBookmarkIcon,
  ChatCircleDotsIcon,
  DotsThreeVerticalIcon,
  GearFineIcon,
  GraphIcon,
  MoonIcon,
  NotepadIcon,
  NotePencilIcon,
  SunIcon,
  TerminalWindowIcon,
} from "@phosphor-icons/react";

export const Navbar = () => {
  const [state, dispatch] = useGlobalStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [editingTitle, setEditingTitle] = useState<string | null>(
    state.note?.title ?? null,
  );

  useEffect(() => {
    setEditingTitle(state.note?.title ?? null);
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

  const isDark = state.theme === "dark";

  const toggleTheme = async () => {
    const nextTheme = isDark ? "light" : "dark";
    dispatch.theme(nextTheme);
    await SettingsService.save({ theme: nextTheme });
  };

  return (
    <header className="writeme-navbar">
      <div className="writeme-navbar-inner">
        <div className="writeme-navbar-left">
          <Link to="/" className="transition-opacity hover:opacity-80">
            <img width="28px" src="/logo.png" />
          </Link>
          {state.note && isEditor && (
            <input
              title="Untitled Note"
              className="writeme-navbar-title"
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
        <nav className="writeme-navbar-nav">
          <Menu
            asChild
            title="Menu"
            label={
              <Button theme="ghost-muted" size="small">
                <DotsThreeVerticalIcon size={20} />
              </Button>
            }
          >
            <MenuItem
              title="AI Assistant"
              onClick={() =>
                dispatch.setAiDrawer({ isOpen: true, chatId: null })
              }
            >
              <span className="flex items-center gap-1">
                <ChatCircleDotsIcon />
                AI Assistant
              </span>
            </MenuItem>
            <MenuItem title="Toggle theme" onClick={toggleTheme}>
              <span className="flex items-center gap-1">
                {isDark ? <SunIcon /> : <MoonIcon />}
                {isDark ? "Switch to light mode" : "Switch to dark mode"}
              </span>
            </MenuItem>
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
