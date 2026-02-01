import { Link } from "brouther";
import { Fragment, useEffect, useState } from "react";
import { Menu, PanelLeft } from "lucide-react";
import { ThemeToggle } from "./components/theme-toggle";
import { NewNoteButton } from "./components/new-note-button";
import { SearchBar } from "./components/search-bar";
import { SettingsMenu } from "./components/settings-menu";
import { links } from "./router";
import { useGlobalStore } from "../store/global.store";
import { useUIStore } from "../store/ui.store";
import { Note } from "../store/note";
import { TabsBar } from "./components/tabs-bar";

export const Navbar = () => {
  const [state, dispatch] = useGlobalStore();
  const [uiState, uiDispatch] = useUIStore();
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setEditingTitle(null);
  }, [state.note?.id]);

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
                className="flex-1 px-3 max-w-md h-8 text-sm text-center bg-transparent rounded-md border transition-all outline-none focus:ring-2 truncate border-border/50 focus:border-primary/50 focus:ring-primary/20"
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
            <button
              title="Menu"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex justify-center items-center rounded-md transition-all lg:hidden size-8 text-foreground/70 hover:text-foreground hover:bg-muted/30"
            >
              <Menu className="size-4" />
            </button>
          </div>
          <nav className="flex gap-1 items-center">
            <div className="hidden sm:block">
              <SearchBar />
            </div>
            <NewNoteButton />
            <ThemeToggle />
            <SettingsMenu />
          </nav>
        </div>
        {mobileMenuOpen && (
          <div className="absolute right-0 left-0 top-full border-b shadow-lg lg:hidden bg-background border-border/50 animate-fade-in">
            <div className="p-4 space-y-3">
              <div className="sm:hidden">
                <SearchBar />
              </div>
              <button
                onClick={() => {
                  uiDispatch.toggleSidebar();
                  setMobileMenuOpen(false);
                }}
                className="flex gap-2 items-center py-2 px-3 w-full text-sm rounded-md text-foreground/70 hover:text-foreground hover:bg-muted/30"
              >
                <PanelLeft className="w-4 h-4" />
                <span>
                  {uiState.sidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
                </span>
              </button>
              <div className="pt-3 border-t border-border/50">
                <ul className="space-y-1">
                  <li>
                    <Link
                      href={links.examples}
                      onClick={() => setMobileMenuOpen(false)}
                      className="block py-2 px-3 text-sm rounded-md text-foreground/70 hover:text-foreground hover:bg-muted/30"
                    >
                      Examples
                    </Link>
                  </li>
                  <li>
                    <Link
                      href={links.about}
                      onClick={() => setMobileMenuOpen(false)}
                      className="block py-2 px-3 text-sm rounded-md text-foreground/70 hover:text-foreground hover:bg-muted/30"
                    >
                      About
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </header>
      <TabsBar />
    </Fragment>
  );
};
