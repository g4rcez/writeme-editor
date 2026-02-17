import { Search, X } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useGlobalStore, repositories } from "../../store/global.store";
import { Note } from "../../store/note";
import { SettingsService } from "../../store/settings";
import { formatSimplifiedPath, getRelativePath } from "../../lib/file-utils";

export const SearchBar = () => {
  const [, dispatch] = useGlobalStore();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Note[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const settings = SettingsService.load();
  const storageDir = settings.storageDirectory || "";

  const openSearch = useCallback(() => {
    setIsOpen(true);
    setQuery("");
    setResults([]);
    setSelectedIndex(0);
    setTimeout(() => inputRef.current?.focus(), 10);
  }, []);

  const closeSearch = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setResults([]);
  }, []);

  // Keyboard shortcut: Cmd/Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) {
          closeSearch();
        } else {
          openSearch();
        }
      }
      if (e.key === "Escape" && isOpen) {
        closeSearch();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, openSearch, closeSearch]);

  // Search as user types
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const searchNotes = async () => {
      const allNotes = await repositories.notes.getAll();
      const lowerQuery = query.toLowerCase();
      const filtered = allNotes.filter((note) => {
        const titleMatch = note.title.toLowerCase().includes(lowerQuery);
        const pathMatch = note.filePath?.toLowerCase().includes(lowerQuery);
        return titleMatch || pathMatch;
      });
      setResults(filtered.slice(0, 8));
      setSelectedIndex(0);
    };

    const debounce = setTimeout(searchNotes, 150);
    return () => clearTimeout(debounce);
  }, [query]);

  // Arrow key navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyNav = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && results[selectedIndex]) {
        e.preventDefault();
        selectNote(results[selectedIndex]);
      }
    };

    window.addEventListener("keydown", handleKeyNav);
    return () => window.removeEventListener("keydown", handleKeyNav);
  }, [isOpen, results, selectedIndex]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeSearch();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, closeSearch]);

  const selectNote = (note: Note) => {
    dispatch.selectNoteById(note.id);
    closeSearch();
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Search trigger button */}
      <button
        onClick={openSearch}
        className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-all ${
          isOpen
            ? "bg-muted/50 text-foreground"
            : "text-foreground/60 hover:text-foreground hover:bg-muted/30"
        }`}
        title="Search notes (⌘K)"
      >
        <Search className="w-4 h-4" />
        <span className="hidden md:inline text-foreground/50">Search...</span>
        <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium rounded bg-muted/50 text-foreground/50">
          ⌘K
        </kbd>
      </button>

      {/* Search panel */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 w-80 bg-background border border-border rounded-lg shadow-lg overflow-hidden z-50 animate-fade-in-scale">
          <div className="flex items-center px-3 py-2 border-b border-border">
            <Search className="w-4 h-4 text-foreground/50 mr-2 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search notes..."
              className="flex-1 bg-transparent outline-none text-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="p-1 rounded hover:bg-muted/50"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Results */}
          {results.length > 0 && (
            <ul className="max-h-64 overflow-y-auto p-1">
              {results.map((note, index) => {
                const relativePath =
                  note.filePath && storageDir
                    ? getRelativePath(storageDir, note.filePath)
                    : "";
                const folderPath = relativePath.includes("/")
                  ? relativePath.substring(0, relativePath.lastIndexOf("/"))
                  : "";
                const displayPath = formatSimplifiedPath(folderPath);

                return (
                  <li
                    key={note.id}
                    className={`flex flex-col px-3 py-2 rounded-md cursor-pointer transition-colors ${
                      index === selectedIndex
                        ? "bg-primary/10 text-foreground"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => selectNote(note)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <span className="text-sm font-medium truncate">
                      {note.title || "Untitled"}
                    </span>
                    {displayPath && (
                      <span className="text-xs text-foreground/50 truncate">
                        {displayPath}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Empty state */}
          {query && results.length === 0 && (
            <div className="p-4 text-center text-sm text-foreground/50">
              No notes found
            </div>
          )}

          {/* Initial state */}
          {!query && (
            <div className="p-4 text-center text-sm text-foreground/50">
              Type to search notes
            </div>
          )}
        </div>
      )}
    </div>
  );
};
